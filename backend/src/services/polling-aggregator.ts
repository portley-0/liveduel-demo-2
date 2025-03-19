import {
  getAllMatches,
  getMatchData,
  updateMatchData,
  deleteMatchData,
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
  OddsUpdatedEntity
} from './subgraph-service';

const LEAGUES = [2, 3, 39, 140, 78, 61, 71, 128, 135, 82];
const SEASONS = [2024, 2025];

let dataUpdateInterval: NodeJS.Timeout | undefined;
let matchCacheInterval: NodeJS.Timeout | undefined;

export function startMatchCachePolling() {
  if (matchCacheInterval) return;

  console.log('[MatchCachePolling] Doing initial poll immediately...');
  addUpcomingMatchesToCache().catch((err) =>
    console.error('[MatchCachePolling] Error in initial run:', err)
  );

  matchCacheInterval = setInterval(async () => {
    try {
      console.log('[MatchCachePolling] Poll cycle started.');
      await addUpcomingMatchesToCache();  
      console.log('[MatchCachePolling] Poll cycle finished.');
    } catch (error) {
      console.error('[MatchCachePolling] Error in poll cycle:', error);
    }
  }, 6 * 60 * 60 * 1000); 
}

export function startStandingsPolling() {
  let intervalTime = 24 * 60 * 60 * 1000;

  async function updateStandings() {
    const allMatches = getAllMatches();
    const hasLiveMatches = allMatches.some(
      (match) => match.statusShort && match.statusShort !== 'NS'
    );

    if (hasLiveMatches) {
      intervalTime = 60 * 60 * 1000; 
    }

    for (const leagueId of LEAGUES) {
      for (const season of SEASONS) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1500)); 

          const rawStandingsData = await getStandings(leagueId, season);

          if (!rawStandingsData || rawStandingsData.length === 0) {
            console.warn(`[StandingsPolling] No standings for league ${leagueId}, season ${season}. Skipping update.`);
            continue;
          }

          const parsedStandings = parseFootballStandings(rawStandingsData);
          if (!parsedStandings) {
            console.warn(`[StandingsPolling] Failed to parse standings for league ${leagueId}, season ${season}.`);
            continue;
          }

          const matches = getAllMatches().filter(
            (match) => match.leagueId === leagueId && match.season === season
          );

          for (const match of matches) {
            updateMatchData(match.matchId, { standings: parsedStandings });
          }
        } catch (error) {
          console.error(
            `[StandingsPolling] Error fetching standings for league ${leagueId}, season ${season}:`,
            error
          );
        }
      }
    }

    console.log(
      `[StandingsPolling] Updated standings. Next update in ${
        intervalTime / (60 * 60 * 1000)
      } hour(s).`
    );
  }

  updateStandings();

  setInterval(updateStandings, intervalTime);
}



export function startDataPolling() {
  if (dataUpdateInterval) return;

  dataUpdateInterval = setInterval(async () => {
    try {
      console.log('[PollingAggregator] Poll cycle started.');

      await updateCachedMatches();

      cleanupOldMatches();

      console.log('[PollingAggregator] Poll cycle finished.');
    } catch (error) {
      console.error('[PollingAggregator] Error in poll cycle:', error);
    }
  }, 40_000); 
}

export function stopPollingAggregator() {
  if (matchCacheInterval) {
    clearInterval(matchCacheInterval);
    matchCacheInterval = undefined;
  }
  if (dataUpdateInterval) {
    clearInterval(dataUpdateInterval);
    dataUpdateInterval = undefined;
  }
}

async function addUpcomingMatchesToCache() {
  const today = new Date();
  const fromDate = today.toISOString().split('T')[0];

  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 10);
  const toDate = futureDate.toISOString().split('T')[0];

  const statuses = ['NS', '1H', 'HT', '2H', 'ET', 'P', 'LIVE'];

  for (const leagueId of LEAGUES) {
    for (const season of SEASONS) {
      for (const status of statuses) {
        const fixtures = await getFixtures({
          league: leagueId,
          season,
          from: fromDate,
          to: toDate,
          status: status
        });

        for (const fixture of fixtures) {
          const matchId = fixture.fixture.id;
          if (getMatchData(matchId)) continue;

          updateMatchData(matchId, {
            matchId,
            leagueId,
            leagueName: fixture.league.name,
            season,
            matchTimestamp: fixture.fixture.timestamp,
            homeTeamName: fixture.teams.home.name,
            homeTeamLogo: fixture.teams.home.logo,
            awayTeamName: fixture.teams.away.name,
            awayTeamLogo: fixture.teams.away.logo,
            homeScore: fixture.goals.home,
            awayScore: fixture.goals.away,
            statusShort: fixture.fixture.status.short,
            elapsed: fixture.fixture.status.elapsed
          });

          console.log(`[DataPolling] Added match ${matchId} to cache.`);
        }
      }
    }
  }
}


async function updateCachedMatches() {
  const allMatches = getAllMatches();

  for (const match of allMatches) {
    if (match.resolvedAt) {
      continue;
    }

    const currentTime = Date.now();
    const matchStartTimeMs = match.matchTimestamp! * 1000;

    const predictionMarket = await getPredictionMarketByMatchId(match.matchId);
    const hasPredictionMarket = !!predictionMarket;

    if (matchStartTimeMs && currentTime >= matchStartTimeMs || hasPredictionMarket) {
      console.log(`Refreshing data for match ${match.matchId}`);
      await refreshFootballData(match.matchId);
      await refreshSubgraphData(match.matchId);
    } else {
      console.log(`Skipping data refresh for match ${match.matchId}`);
    }
  }
}

async function refreshFootballData(matchId: number) {
  try {
    const fixtureArray = await getFixtures({ id: matchId });
    if (fixtureArray.length === 0) {
      return;
    }
    const fixture = fixtureArray[0];

    updateMatchData(matchId, {
      homeScore: fixture.goals.home,
      awayScore: fixture.goals.away,
      statusShort: fixture.fixture.status.short,
      elapsed: fixture.fixture.status.elapsed
    });

    if (!isMatchFinished(fixture.fixture.status.short)) {
      await mergeFootballDetails(matchId, fixture);
    }
  } catch (error) {
    console.error(`[refreshFootballData] Error for matchId=${matchId}`, error);
  }
}

async function mergeFootballDetails(matchId: number, fixtureData: any) {
  try {
    const homeTeamId = fixtureData.teams.home.id;
    const awayTeamId = fixtureData.teams.away.id;

    // 1) Events
    const rawEventsData = await getEvents(matchId);
    const parsedEvents = parseFootballEvents(rawEventsData);
    updateMatchData(matchId, { events: parsedEvents });

    // 2) Stats
    const homeStatsRaw = await getStatistics(matchId, homeTeamId);
    const awayStatsRaw = await getStatistics(matchId, awayTeamId);
    const mergedStats = parseFootballStats(homeStatsRaw, awayStatsRaw);
    updateMatchData(matchId, { statistics: mergedStats });

    // 3) Lineups
    const rawLineupsData = await getLineups(matchId);
    const parsedLineups = parseFootballLineups(rawLineupsData, homeTeamId);
    updateMatchData(matchId, { lineups: parsedLineups });

  } catch (error) {
    console.error(`[mergeFootballDetails] Error for matchId=${matchId}`, error);
  }
}

async function refreshSubgraphData(matchId: number) {
  try {
    // 1) Odds
    const oddsUpdatesData = await getOddsUpdatesByMatchId(matchId);
    integrateOddsUpdates(matchId, oddsUpdatesData);

    // 2) Prediction Market info
    const predictionMarket = await getPredictionMarketByMatchId(matchId);
    if (predictionMarket) {
      updateMatchData(matchId, { contract: predictionMarket.id });

      if (predictionMarket.isResolved) {
        updateMatchData(matchId, {
          resolvedAt: Date.now(),
          outcome: predictionMarket.resolvedOutcome ?? undefined
        });
      }

      // 3) Betting volume
      await computeBettingVolume(matchId, predictionMarket.id);
    }

  } catch (error) {
    console.error(`[refreshSubgraphData] Error for matchId=${matchId}`, error);
  }
}

function integrateOddsUpdates(matchId: number, oddsData: OddsUpdatedEntity[]) {
  if (oddsData.length === 0) return;

  const currentMatchData = getMatchData(matchId);
  if (!currentMatchData) return;

  let updatedHistory = currentMatchData.oddsHistory || {
    timestamps: [],
    homeOdds: [],
    drawOdds: [],
    awayOdds: []
  };

  for (const oddsItem of oddsData) {
    const newTimestamp = Number(oddsItem.timestamp) * 1000;
    const newHomeOdds = Number(oddsItem.home);
    const newDrawOdds = Number(oddsItem.draw);
    const newAwayOdds = Number(oddsItem.away);

    const lastIndex = updatedHistory.timestamps.length - 1;
    const lastHomeOdds = updatedHistory.homeOdds[lastIndex];
    const lastDrawOdds = updatedHistory.drawOdds[lastIndex];
    const lastAwayOdds = updatedHistory.awayOdds[lastIndex];

    if (lastIndex === -1 || newHomeOdds !== lastHomeOdds || newDrawOdds !== lastDrawOdds || newAwayOdds !== lastAwayOdds) {
      updatedHistory.timestamps.push(newTimestamp);
      updatedHistory.homeOdds.push(newHomeOdds);
      updatedHistory.drawOdds.push(newDrawOdds);
      updatedHistory.awayOdds.push(newAwayOdds);
    }
  }

  updateMatchData(matchId, { oddsHistory: updatedHistory });
}

async function computeBettingVolume(matchId: number, marketAddress: string) {
  const purchasedData = await getSharesPurchasedByMarket(marketAddress);
  const soldData = await getSharesSoldByMarket(marketAddress);

  let totalVolume = 0;

  for (const purchaseItem of purchasedData) {
    totalVolume += Number(purchaseItem.actualCost);
  }
  for (const saleItem of soldData) {
    totalVolume += Number(saleItem.actualGain);
  }

  updateMatchData(matchId, { bettingVolume: totalVolume });
}

function cleanupOldMatches() {
  const now = Date.now();
  const THREE_HOURS_MS = 3 * 60 * 60 * 1000; 
  const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000; 
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const allMatches = getAllMatches();

  for (const match of allMatches) {
    if (!match.matchTimestamp) continue; 

    const matchEndTimeMs = match.matchTimestamp * 1000;
    const isResolved = !!match.resolvedAt; 
    const hasContract = !!match.contract;
    const isPastThreeHours = now > matchEndTimeMs + THREE_HOURS_MS; //another bit of time, in case someone was looking at it

    if (isResolved && match.resolvedAt) {
      const resolvedTimeElapsed = now - match.resolvedAt;
    
      if (resolvedTimeElapsed > ONE_DAY_MS) { 
        console.log(`[Cleanup] Removing detailed data for resolved match ${match.matchId} (24 hours past)`);
        updateMatchData(match.matchId, {
          statistics: undefined,
          events: undefined,
          lineups: undefined,
          standings: undefined
        });
      }
    }

    if (!hasContract && isPastThreeHours) {
      console.log(`[Cleanup] Removing match ${match.matchId} (no contract, 2 hours past)`);
      deleteMatchData(match.matchId);
      continue;
    }

    if (isResolved && match.resolvedAt && now - match.resolvedAt > TWO_MONTHS_MS) {
      console.log(`[Cleanup] Removing fully resolved match ${match.matchId} (2 months past)`);
      deleteMatchData(match.matchId);
    }
  }
}

function isMatchFinished(statusShort?: string) {
  if (!statusShort) return false;
  return ['FT', 'AET', 'PEN'].includes(statusShort);
}

function parseFootballEvents(rawEvents: any[]): FixtureEvent[] {
  return rawEvents.map((eventItem: any) => ({
    time: {
      elapsed: eventItem.time.elapsed,
      extra: eventItem.time.extra ?? null
    },
    team: {
      id: eventItem.team.id,
      name: eventItem.team.name,
      logo: eventItem.team.logo
    },
    player: {
      id: eventItem.player?.id ?? null,
      name: eventItem.player?.name ?? ''
    },
    assist: {
      id: eventItem.assist?.id ?? null,
      name: eventItem.assist?.name ?? null
    },
    type: eventItem.type,
    detail: eventItem.detail,
    comments: eventItem.comments ?? null
  }));
}

function parseFootballStats(
  homeStatsRaw: any[],
  awayStatsRaw: any[]
): FixtureStatistics {
  const fixtureStats: FixtureStatistics = {};

  if (homeStatsRaw.length > 0) {
    const homeObject = homeStatsRaw[0];
    fixtureStats.home = {
      teamId: homeObject.team.id,
      name: homeObject.team.name,
      logo: homeObject.team.logo,
      stats: homeObject.statistics.map((statItem: any) => ({
        type: statItem.type,
        value: statItem.value
      }))
    };
  }

  if (awayStatsRaw.length > 0) {
    const awayObject = awayStatsRaw[0];
    fixtureStats.away = {
      teamId: awayObject.team.id,
      name: awayObject.team.name,
      logo: awayObject.team.logo,
      stats: awayObject.statistics.map((statItem: any) => ({
        type: statItem.type,
        value: statItem.value
      }))
    };
  }

  return fixtureStats;
}

function parseFootballLineups(
  rawLineups: any[],
  homeTeamId: number
): FixtureLineups {
  const lineups: FixtureLineups = {};

  for (const lineupObject of rawLineups) {
    const isHome = lineupObject.team.id === homeTeamId;

    const teamLineup = {
      team: {
        id: lineupObject.team.id,
        name: lineupObject.team.name,
        logo: lineupObject.team.logo,
        colors: lineupObject.team.colors
      },
      formation: lineupObject.formation,
      startXI: lineupObject.startXI.map((startPlayer: any) => ({
        player: {
          id: startPlayer.player.id,
          name: startPlayer.player.name,
          number: startPlayer.player.number,
          pos: startPlayer.player.pos,
          grid: startPlayer.player.grid ?? null
        }
      })),
      substitutes: lineupObject.substitutes.map((substitutePlayer: any) => ({
        player: {
          id: substitutePlayer.player.id,
          name: substitutePlayer.player.name,
          number: substitutePlayer.player.number,
          pos: substitutePlayer.player.pos,
          grid: substitutePlayer.player.grid ?? null
        }
      })),
      coach: {
        id: lineupObject.coach?.id,
        name: lineupObject.coach?.name,
        photo: lineupObject.coach?.photo
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
  if (!rawStandings.length) return undefined;
  
  const leagueObject = rawStandings[0].league;
  if (!leagueObject) return undefined;

  return {
    league: {
      id: leagueObject.id,
      name: leagueObject.name,
      country: leagueObject.country,
      logo: leagueObject.logo,
      flag: leagueObject.flag,
      season: leagueObject.season,
      standings: leagueObject.standings.flat().map((standingItem: any) => ({
        rank: standingItem.rank,
        team: {
          id: standingItem.team.id,
          name: standingItem.team.name,
          logo: standingItem.team.logo
        },
        points: standingItem.points,
        goalsDiff: standingItem.goalsDiff,
        group: standingItem.group,
        form: standingItem.form,
        status: standingItem.status,
        description: standingItem.description,
        all: standingItem.all,
        home: standingItem.home,
        away: standingItem.away,
        update: standingItem.update
      }))
    }
  };
}
