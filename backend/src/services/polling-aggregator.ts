import { 
    getAllMatches,
    getMatchData,
    updateMatchData,
    deleteMatchData,
    MatchData,
    LeagueStanding,
    FixtureLineups,
    FixtureEvent,
    FixtureStatistics
  } from '../cache';
  
  import {
    getFixtures,
    getStatistics,
    getEvents,
    getLineups,
    getStandings
  } from './football-service';
  
  import {
    getOddsUpdatesByMatchId,
    getPredictionMarketByMatchId,
    getSharesPurchasedByMarket,
    getSharesSoldByMarket,
    OddsUpdatedEntity,
    SharesPurchasedEntity,
    SharesSoldEntity
  } from './subgraph-service';
  
  let pollingInterval: NodeJS.Timeout | undefined;
  
  export function startPollingAggregator() {
    if (pollingInterval) return;
  
    pollingInterval = setInterval(async () => {
      try {
        console.log('[PollingAggregator] Poll cycle started.');
  
        // 1) Add new upcoming matches into the cache
        await addUpcomingMatchesToCache();
  
        // 2) Update existing matches with Football & Subgraph data
        await updateCachedMatches();
  
        // 3) Cleanup old resolved matches
        cleanupOldMatches();
  
        console.log('[PollingAggregator] Poll cycle finished.');
      } catch (err) {
        console.error('[PollingAggregator] Error in poll cycle:', err);
      }
    }, 60_000); // run every 60s, adjust as needed
  }
  
  export function stopPollingAggregator() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = undefined;
    }
  }
  
  /**
   * 1) Add upcoming matches (status=NS) for the next 7 days into the cache.
   *    We'll just store minimal data (teams, logos, timestamps).
   */
  async function addUpcomingMatchesToCache() {
    const ALLOWED_LEAGUES = [39, 78]; // example leagues
    const CURRENT_SEASON = 2025;
  
    const today = new Date();
    const fromDate = today.toISOString().split('T')[0];
  
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 7);
    const toDate = futureDate.toISOString().split('T')[0];
  
    for (const leagueId of ALLOWED_LEAGUES) {
      const notStarted = await getFixtures({
        league: leagueId,
        season: CURRENT_SEASON,
        from: fromDate,
        to: toDate,
        status: 'NS'
      });
  
      // For each returned fixture, if not in cache, add minimal info
      for (const fixture of notStarted) {
        const matchId = fixture.fixture.id;
        const existing = getMatchData(matchId);
        if (existing) continue; // already in cache
  
        updateMatchData(matchId, {
          matchId,
          leagueId,
          season: CURRENT_SEASON,
          matchTimestamp: fixture.fixture.timestamp,
          homeTeamName: fixture.teams.home.name,
          homeTeamLogo: fixture.teams.home.logo,
          awayTeamName: fixture.teams.away.name,
          awayTeamLogo: fixture.teams.away.logo,
          homeScore: fixture.goals.home,
          awayScore: fixture.goals.away,
          statusShort: fixture.fixture.status.short,
          elapsed: fixture.fixture.status.elapsed,
        });
      }
    }
  }
  
  /**
   * 2) Update *all* matches in the cache with fresh Football & Subgraph data.
   */
  async function updateCachedMatches() {
    const allMatches = getAllMatches();
  
    for (const match of allMatches) {
      // If already resolved, skip further updates. (You can remove this if you want to keep polling.)
      if (match.resolvedAt) {
        continue;
      }
  
      // (A) Refresh scoreboard + basic fixture info from Football API
      await refreshFootballData(match.matchId);
  
      // (B) Refresh subgraph data (odds, volume, resolution)
      await refreshSubgraphData(match.matchId);
    }
  }
  
  /**
   * For a single matchId, re-fetch the fixture info from Football to update
   * score, status, elapsed. If the match is not finished, fetch deeper data:
   * events, stats, lineups, standings.
   */
  async function refreshFootballData(matchId: number) {
    try {
      const fixtureArray = await getFixtures({ id: matchId });
      if (fixtureArray.length === 0) {
        // Possibly the fixture is no longer returned by the API (?), skip
        return;
      }
      const fixture = fixtureArray[0];
  
      // Basic scoreboard + status
      updateMatchData(matchId, {
        homeScore: fixture.goals.home,
        awayScore: fixture.goals.away,
        statusShort: fixture.fixture.status.short,
        elapsed: fixture.fixture.status.elapsed,
      });
  
      // If still not finished, merge deeper data
      if (!isMatchFinished(fixture.fixture.status.short)) {
        await mergeFootballDetails(matchId, fixture);
      }
    } catch (err) {
      console.error(`[refreshFootballData] Error for matchId=${matchId}`, err);
    }
  }
  
  /**
   * Merge events, stats, lineups, standings from Football API for an in-progress match.
   */
  async function mergeFootballDetails(matchId: number, fixtureData: any) {
    try {
      const homeTeamId = fixtureData.teams.home.id;
      const awayTeamId = fixtureData.teams.away.id;
  
      // events
      const rawEvents = await getEvents(matchId);
      const parsedEvents = parseFootballEvents(rawEvents);
      updateMatchData(matchId, { events: parsedEvents });
  
      // stats
      const homeStatsRaw = await getStatistics(matchId, homeTeamId);
      const awayStatsRaw = await getStatistics(matchId, awayTeamId);
      const mergedStats = parseFootballStats(homeStatsRaw, awayStatsRaw);
      updateMatchData(matchId, { statistics: mergedStats });
  
      // lineups
      const rawLineups = await getLineups(matchId);
      const parsedLineups = parseFootballLineups(rawLineups, homeTeamId, awayTeamId);
      updateMatchData(matchId, { lineups: parsedLineups });
  
      // standings
      const leagueId = fixtureData.league.id;
      const season = fixtureData.league.season;
      const rawStandings = await getStandings(leagueId, season);
      const parsedStandings = parseFootballStandings(rawStandings);
      updateMatchData(matchId, { standings: parsedStandings });
  
    } catch (err) {
      console.error(`[mergeFootballDetails] Error for matchId=${matchId}`, err);
    }
  }
  
  /**
   * Refresh subgraph data for odds, volume, resolution outcome.
   */
  async function refreshSubgraphData(matchId: number) {
    try {
      // 1) Odds updates
      const oddsUpdates = await getOddsUpdatesByMatchId(matchId);
      integrateOddsUpdates(matchId, oddsUpdates);
  
      // 2) Market info => if resolved or not, also store contract address
      const market = await getPredictionMarketByMatchId(matchId);
      if (market) {
        // store the contract address in "contract" field
        updateMatchData(matchId, { contract: market.id });
  
        if (market.isResolved) {
          // Mark outcome + resolvedAt
          updateMatchData(matchId, {
            resolvedAt: Date.now(),
            outcome: market.resolvedOutcome ?? undefined
          });
        }
  
        // 3) Betting volume from shares purchased & sold
        await computeBettingVolume(matchId, market.id);
      }
  
    } catch (err) {
      console.error(`[refreshSubgraphData] Error for matchId=${matchId}`, err);
    }
  }
  
  /**
   * Merges array of subgraph OddsUpdatedEntity into the cache's oddsHistory.
   */
  function integrateOddsUpdates(matchId: number, oddsArray: OddsUpdatedEntity[]) {
    if (oddsArray.length === 0) return;
    const matchData = getMatchData(matchId);
    if (!matchData) return;
  
    // We'll append each oddsUpdate in chronological order
    let updatedHistory = matchData.oddsHistory || {
      timestamps: [],
      homeOdds: [],
      drawOdds: [],
      awayOdds: []
    };
  
    // If we want to avoid duplications, we can track the last known timestamp
    // or ensure each timestamp is unique. For now, let's just append new ones:
    for (const odds of oddsArray) {
      // we can skip if we already have that timestamp, or just push
      updatedHistory.timestamps.push(Number(odds.timestamp));
      updatedHistory.homeOdds.push(Number(odds.home));
      updatedHistory.drawOdds.push(Number(odds.draw));
      updatedHistory.awayOdds.push(Number(odds.away));
    }
  
    updateMatchData(matchId, { oddsHistory: updatedHistory });
  }
  
  /**
   * Summation of purchased "actualCost" + sold "actualGain" for the market => bettingVolume
   */
  async function computeBettingVolume(matchId: number, marketAddress: string) {
    const purchased = await getSharesPurchasedByMarket(marketAddress);
    const sold = await getSharesSoldByMarket(marketAddress);
  
    let totalVolume = 0;
  
    for (const p of purchased) {
      totalVolume += Number(p.actualCost);
    }
    for (const s of sold) {
      totalVolume += Number(s.actualGain);
    }
  
    updateMatchData(matchId, { bettingVolume: totalVolume });
  }
  
  /**
   * 3) Remove matches older than 2 months if resolved.
   */
  function cleanupOldMatches() {
    const now = Date.now();
    const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
  
    const all = getAllMatches();
    for (const match of all) {
      if (match.resolvedAt && now - match.resolvedAt > TWO_MONTHS_MS) {
        console.log(`[PollingAggregator] Removing old resolved match ${match.matchId}`);
        deleteMatchData(match.matchId);
      }
    }
  }
  
  /**
   * Helper: check if match is finished ("FT", "AET", "PEN")
   */
  function isMatchFinished(statusShort?: string) {
    if (!statusShort) return false;
    return ['FT', 'AET', 'PEN'].includes(statusShort);
  }
  
  /**
   * -------------------------
   * PARSING FUNCTIONS
   * -------------------------
   * Convert Football API raw data => typed structures
   * (Add your real mapping logic here.)
   */
  
  function parseFootballEvents(rawEvents: any[]): FixtureEvent[] {
    // Example:
    return rawEvents.map((ev: any) => ({
      time: {
        elapsed: ev.time.elapsed,
        extra: ev.time.extra ?? null
      },
      team: {
        id: ev.team.id,
        name: ev.team.name,
        logo: ev.team.logo
      },
      player: {
        id: ev.player?.id ?? null,
        name: ev.player?.name ?? ''
      },
      assist: {
        id: ev.assist?.id ?? null,
        name: ev.assist?.name ?? null
      },
      type: ev.type,
      detail: ev.detail,
      comments: ev.comments ?? null
    }));
  }
  
  function parseFootballStats(
    homeStatsRaw: any[],
    awayStatsRaw: any[]
  ): FixtureStatistics {
    // Usually each array has exactly 1 object with { team: {id,name,logo}, statistics: [{type,value}, ...] }
    const stats: FixtureStatistics = {};
  
    if (homeStatsRaw.length > 0) {
      const homeObj = homeStatsRaw[0];
      stats.home = {
        teamId: homeObj.team.id,
        name: homeObj.team.name,
        logo: homeObj.team.logo,
        stats: homeObj.statistics.map((s: any) => ({
          type: s.type,
          value: s.value,
        }))
      };
    }
  
    if (awayStatsRaw.length > 0) {
      const awayObj = awayStatsRaw[0];
      stats.away = {
        teamId: awayObj.team.id,
        name: awayObj.team.name,
        logo: awayObj.team.logo,
        stats: awayObj.statistics.map((s: any) => ({
          type: s.type,
          value: s.value,
        }))
      };
    }
  
    return stats;
  }
  
  function parseFootballLineups(
    rawLineups: any[],
    homeTeamId: number,
    awayTeamId: number
  ): FixtureLineups {
    // rawLineups is typically an array of 2 objects, one for each side
    const lineups: FixtureLineups = {};
    for (const ln of rawLineups) {
      const isHome = (ln.team.id === homeTeamId);
  
      const teamLineup = {
        team: {
          id: ln.team.id,
          name: ln.team.name,
          logo: ln.team.logo,
          colors: ln.team.colors,
        },
        formation: ln.formation,
        startXI: ln.startXI.map((p: any) => ({
          player: {
            id: p.player.id,
            name: p.player.name,
            number: p.player.number,
            pos: p.player.pos,
            grid: p.player.grid ?? null
          }
        })),
        substitutes: ln.substitutes.map((p: any) => ({
          player: {
            id: p.player.id,
            name: p.player.name,
            number: p.player.number,
            pos: p.player.pos,
            grid: p.player.grid ?? null
          }
        })),
        coach: {
          id: ln.coach?.id,
          name: ln.coach?.name,
          photo: ln.coach?.photo
        }
      };
  
      if (isHome) {
        lineups.home = teamLineup;
      } else {
        lineups.away = teamLineup;
      }
    }
    return lineups;
  }
  
  function parseFootballStandings(rawStandings: any[]): LeagueStanding | undefined {
    // Typically rawStandings = [ { league: { id, name, country, ... standings: [ [ ... ] ] } } ]
    if (!rawStandings.length) return undefined;
    const leagueObj = rawStandings[0].league;
    if (!leagueObj) return undefined;
  
    return {
      league: {
        id: leagueObj.id,
        name: leagueObj.name,
        country: leagueObj.country,
        logo: leagueObj.logo,
        flag: leagueObj.flag,
        season: leagueObj.season,
        standings: leagueObj.standings.map((groupArr: any) =>
          groupArr.map((st: any) => ({
            rank: st.rank,
            team: {
              id: st.team.id,
              name: st.team.name,
              logo: st.team.logo,
            },
            points: st.points,
            goalsDiff: st.goalsDiff,
            group: st.group,
            form: st.form,
            status: st.status,
            description: st.description,
            all: st.all,
            home: st.home,
            away: st.away,
            update: st.update,
          }))
        ),
      }
    };
  }
  
  