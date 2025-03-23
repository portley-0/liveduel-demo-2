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

const LEAGUES = [2, 3, 39, 140, 78, 61, 135, 88, 71, 253, 130, 94, 98, 848];
const SEASONS = [2024, 2025];

let dataUpdateInterval: NodeJS.Timeout | undefined;
let matchCacheInterval: NodeJS.Timeout | undefined;
let subgraphRefreshInterval: NodeJS.Timeout | undefined;

export function startFastSubgraphPolling() {
  if (subgraphRefreshInterval) return;

  console.log('[SubgraphPolling] Starting high-frequency subgraph refresh loop...');

  subgraphRefreshInterval = setInterval(async () => {
    try {
      const allMatches = getAllMatches();
      for (const match of allMatches) {
        if (match.resolvedAt || !match.contract) continue;
        console.log(`[SubgraphPolling] Refreshing match ${match.matchId}`);
        await refreshSubgraphData(match.matchId);
      }
    } catch (err) {
      console.error('[SubgraphPolling] Error during fast polling:', err);
    }
  }, 10000); 
}

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

    if (hasPredictionMarket && !match.contract) {
      console.log(`[updateCachedMatches] Setting contract for match ${match.matchId}: ${predictionMarket.id}`);
      updateMatchData(match.matchId, { contract: predictionMarket.id });
    }

    if (matchStartTimeMs && currentTime >= matchStartTimeMs || hasPredictionMarket) {
      console.log(`Refreshing data for match ${match.matchId}`);
      await refreshFootballData(match.matchId);
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
    const oddsUpdatesData = await getOddsUpdatesByMatchId(matchId);
    integrateOddsUpdates(matchId, oddsUpdatesData);

    const predictionMarket = await getPredictionMarketByMatchId(matchId);

    if (predictionMarket) {
      if (predictionMarket.isResolved) {
        updateMatchData(matchId, {
          resolvedAt: Date.now(),
          outcome: predictionMarket.resolvedOutcome ?? undefined
        });
      }

      await computeBettingVolume(matchId, predictionMarket.id);
    }
  } catch (error) {
    console.error(`[refreshSubgraphData] Error for matchId=${matchId}`, error);
  }
}

const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");
const DEFAULT_PROB = 0.3333333; // default probability (1/3)
const FLATLINE_ODDS = decimalProbabilityToOdds(DEFAULT_PROB); // ~3.0
const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // one week in milliseconds

function convert192x64ToDecimal(fixedVal: number): number {
  const bigVal = BigInt(fixedVal);
  const scaled = (bigVal * 10000n) / FIXED_192x64_SCALING_FACTOR;
  return Number(scaled) / 10000;
}

function decimalProbabilityToOdds(prob: number): number {
  return prob > 0 ? 1 / prob : 10;
}

interface OddsHistory {
  timestamps: number[];
  homeOdds: number[];
  drawOdds: number[];
  awayOdds: number[];
}

function integrateOddsUpdates(matchId: number, oddsData: OddsUpdatedEntity[]) {
  const currentMatchData = getMatchData(matchId);
  if (!currentMatchData) return;

  // Get existing history or initialize a new one.
  let updatedHistory: OddsHistory = currentMatchData.oddsHistory || {
    timestamps: [],
    homeOdds: [],
    drawOdds: [],
    awayOdds: [],
  };

  // CASE 1: No new odds data provided.
  if (oddsData.length === 0) {
    if (updatedHistory.timestamps.length === 0) {
      const now = Date.now();
      // Create three flatline points (earliest one is one week ago).
      const flatTimestamps = [now - WEEK_MS, now - WEEK_MS + 60000, now];
      flatTimestamps.forEach(ts => {
        updatedHistory.timestamps.push(ts);
        updatedHistory.homeOdds.push(FLATLINE_ODDS);
        updatedHistory.drawOdds.push(FLATLINE_ODDS);
        updatedHistory.awayOdds.push(FLATLINE_ODDS);
      });
      updateMatchData(matchId, {
        oddsHistory: updatedHistory,
        latestOdds: { home: DEFAULT_PROB, draw: DEFAULT_PROB, away: DEFAULT_PROB },
      });
    }
    return;
  }

  // CASE 2: No history exists yet -> add all incoming odds updates.
  if (updatedHistory.timestamps.length === 0) {
    oddsData.forEach(oddsItem => {
      const ts = Number(oddsItem.timestamp) * 1000;
      const homeProb = convert192x64ToDecimal(Number(oddsItem.home));
      const drawProb = convert192x64ToDecimal(Number(oddsItem.draw));
      const awayProb = convert192x64ToDecimal(Number(oddsItem.away));
      updatedHistory.timestamps.push(ts);
      updatedHistory.homeOdds.push(decimalProbabilityToOdds(homeProb));
      updatedHistory.drawOdds.push(decimalProbabilityToOdds(drawProb));
      updatedHistory.awayOdds.push(decimalProbabilityToOdds(awayProb));
    });
    const currentLength: number = updatedHistory.timestamps.length;
    if (currentLength === 1) {
      const firstTimestamp = updatedHistory.timestamps[0];
      const flatTimestamp = firstTimestamp - WEEK_MS;
      updatedHistory.timestamps.unshift(flatTimestamp);
      updatedHistory.homeOdds.unshift(FLATLINE_ODDS);
      updatedHistory.drawOdds.unshift(FLATLINE_ODDS);
      updatedHistory.awayOdds.unshift(FLATLINE_ODDS);
    }
  } else {
    // CASE 3: History exists -> only append the latest update if it's new.
    const lastOddsUpdate = oddsData[oddsData.length - 1];
    const newTimestamp = Number(lastOddsUpdate.timestamp) * 1000;
    const newHomeProb = convert192x64ToDecimal(Number(lastOddsUpdate.home));
    const newDrawProb = convert192x64ToDecimal(Number(lastOddsUpdate.draw));
    const newAwayProb = convert192x64ToDecimal(Number(lastOddsUpdate.away));
    const lastIndex = updatedHistory.timestamps.length - 1;
    if (updatedHistory.timestamps[lastIndex] !== newTimestamp) {
      // Convert stored decimal odds back to probabilities.
      const lastHomeProb = 1 / updatedHistory.homeOdds[lastIndex];
      const lastDrawProb = 1 / updatedHistory.drawOdds[lastIndex];
      const lastAwayProb = 1 / updatedHistory.awayOdds[lastIndex];
      if (
        newHomeProb !== lastHomeProb ||
        newDrawProb !== lastDrawProb ||
        newAwayProb !== lastAwayProb
      ) {
        updatedHistory.timestamps.push(newTimestamp);
        updatedHistory.homeOdds.push(decimalProbabilityToOdds(newHomeProb));
        updatedHistory.drawOdds.push(decimalProbabilityToOdds(newDrawProb));
        updatedHistory.awayOdds.push(decimalProbabilityToOdds(newAwayProb));
      }
    }
  }

  // ALWAYS ensure a flatline reference point is present at the beginning.
  // Instead of checking the timestamp, simply check if the first odds are flatline odds.
  if (updatedHistory.timestamps.length > 0) {
    if (
      updatedHistory.homeOdds[0] !== FLATLINE_ODDS ||
      updatedHistory.drawOdds[0] !== FLATLINE_ODDS ||
      updatedHistory.awayOdds[0] !== FLATLINE_ODDS
    ) {
      const firstTimestamp = updatedHistory.timestamps[0];
      const flatTimestamp = firstTimestamp - WEEK_MS;
      updatedHistory.timestamps.unshift(flatTimestamp);
      updatedHistory.homeOdds.unshift(FLATLINE_ODDS);
      updatedHistory.drawOdds.unshift(FLATLINE_ODDS);
      updatedHistory.awayOdds.unshift(FLATLINE_ODDS);
    }
  }

  // Update latestOdds using the last odds update.
  const lastOddsItem = oddsData[oddsData.length - 1];
  const latestHomeProb = convert192x64ToDecimal(Number(lastOddsItem.home));
  const latestDrawProb = convert192x64ToDecimal(Number(lastOddsItem.draw));
  const latestAwayProb = convert192x64ToDecimal(Number(lastOddsItem.away));

  updateMatchData(matchId, {
    oddsHistory: updatedHistory,
    latestOdds: {
      home: latestHomeProb,
      draw: latestDrawProb,
      away: latestAwayProb,
    },
  });
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
      startXI: Array.isArray(lineupObject.startXI)
        ? lineupObject.startXI.map((startPlayer: any) => ({
            player: {
              id: startPlayer.player.id,
              name: startPlayer.player.name,
              number: startPlayer.player.number,
              pos: startPlayer.player.pos,
              grid: startPlayer.player.grid ?? null
            }
          }))
        : [],
      substitutes: Array.isArray(lineupObject.substitutes)
        ? lineupObject.substitutes.map((substitutePlayer: any) => ({
            player: {
              id: substitutePlayer.player.id,
              name: substitutePlayer.player.name,
              number: substitutePlayer.player.number,
              pos: substitutePlayer.player.pos,
              grid: substitutePlayer.player.grid ?? null
            }
          }))
        : [],
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
