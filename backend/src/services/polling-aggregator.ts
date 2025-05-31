import {
  getAllMatches,
  getMatchData,
  updateMatchData,
  deleteMatchData,
  getAllTournaments,
  getTournamentData,
  updateTournamentData,
  deleteTournamentData,
  LeagueStanding,
  FixtureLineups,
  FixtureEvent,
  FixtureStatistics,
  TournamentData
} from '../cache';

import {
  getFixtures,
  getStatistics,
  getEvents,
  getLineups,
  getStandings,
  getTournamentDetails
} from './football-service';

import {
  getOddsUpdatesByMatchId,
  getPredictionMarketByMatchId,
  getSharesPurchasedByMarket,
  getSharesSoldByMarket,
  OddsUpdatedEntity,
  getTournamentOddsById,
  getTournamentMarketByTournamentId,
  getTournamentSharesPurchasedByMarket,
  getTournamentSharesSoldByMarket,
  getTournamentFixtures,
  TournamentOddsUpdatedEntity,
  getAllActiveTournaments
} from './subgraph-service';

const LEAGUES = [2, 3, 15, 39, 140, 78, 61, 135, 848];
const SEASONS = [2024, 2025];

let dataUpdateInterval: NodeJS.Timeout | undefined;
let matchCacheInterval: NodeJS.Timeout | undefined;
let subgraphRefreshInterval: NodeJS.Timeout | undefined;
let tournamentPollInterval: NodeJS.Timeout | undefined;

export function startFastSubgraphPolling() {
  if (subgraphRefreshInterval) return;

  console.log('[SubgraphPolling] Starting high-frequency subgraph refresh loop...');

  subgraphRefreshInterval = setInterval(async () => {
    try {
      // Refresh match data
      const allMatches = getAllMatches();
      for (const match of allMatches) {
        if (match.resolvedAt) continue;
        console.log(`[SubgraphPolling] Refreshing match ${match.matchId}`);
        await refreshSubgraphData(match.matchId);
      }

      // Refresh tournament data
      const allTournaments = getAllTournaments();
      for (const tournament of allTournaments) {
        if (tournament.resolvedAt) continue;
        console.log(`[SubgraphPolling] Refreshing tournament ${tournament.tournamentId}`);
        const oddsData = await getTournamentOddsById(tournament.tournamentId);
        await refreshTournamentSubgraphData(tournament.tournamentId, oddsData);
      }
    } catch (err) {
      console.error('[SubgraphPolling] Error during fast polling:', err);
    }
  }, 10000); // Every 10 seconds
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

export function startTournamentCachePolling() {
  if (tournamentPollInterval) return;

  console.log('[TournamentCachePolling] Doing initial poll immediately...');
  addUpcomingTournamentsToCache().catch((err) =>
    console.error('[TournamentCachePolling] Error in initial run:', err)
  );

  tournamentPollInterval = setInterval(async () => {
    try {
      console.log('[TournamentCachePolling] Poll cycle started.');
      await addUpcomingTournamentsToCache();
      console.log('[TournamentCachePolling] Poll cycle finished.');
    } catch (error) {
      console.error('[TournamentCachePolling] Error in poll cycle:', error);
    }
  }, 6 * 60 * 60 * 1000); // Every 6 hours
}

export function startStandingsPolling() {
  let intervalTime = 24 * 60 * 60 * 1000; // 24 hours default
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;
  const INITIAL_STANDINGS_POLL_DELAY = 15000; // Delay for 15 seconds

  async function updateStandings() {
    console.log('[StandingsPolling] updateStandings function called.'); // Added for clarity
    const allMatches = getAllMatches();
    const hasLiveMatches = allMatches.some(
      (match) => match.statusShort && match.statusShort !== 'NS'
    );

    if (hasLiveMatches) {
      console.log('[StandingsPolling] Live matches detected, adjusting next interval if it was 24 hours.');
      intervalTime = 60 * 60 * 1000; // 1 hour if live matches
    } else {
      intervalTime = 24 * 60 * 60 * 1000; // Back to 24 hours if no live matches
    }


    for (const leagueId of LEAGUES) {
      for (const season of SEASONS) {
        let success = false;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 1500)); 

            console.log(`[StandingsPolling] Attempt ${attempt} for league ${leagueId}, season ${season}`);
            const rawStandingsData = await getStandings(leagueId, season);

            if (!rawStandingsData || rawStandingsData.length === 0) {
              console.warn(`[StandingsPolling] No standings from getStandings for league ${leagueId}, season ${season} on attempt ${attempt}.`);
              if (attempt === MAX_RETRIES) {
                console.warn(`[StandingsPolling] All attempts failed to get data for league ${leagueId}, season ${season}. Skipping update.`);
              } else {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); 
                continue; 
              }
              break; 
            }

            const parsedStandings = parseFootballStandings(rawStandingsData);
            if (!parsedStandings) {
              console.warn(`[StandingsPolling] Failed to parse standings for league ${leagueId}, season ${season} on attempt ${attempt}.`);
              if (attempt === MAX_RETRIES) {
                 console.warn(`[StandingsPolling] Parsing failed after all attempts for league ${leagueId}, season ${season}. Skipping update.`);
              } else {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); 
                continue; 
              }
              break; 
            }

            // Update matches
            const matches = getAllMatches().filter(
              (match) => match.leagueId === leagueId && match.season === season
            );
            for (const match of matches) {
              updateMatchData(match.matchId, { standings: parsedStandings });
            }

            // Update tournaments
            const tournaments = getAllTournaments().filter(
              (tournament) => tournament.tournamentId === leagueId && (!tournament.season || tournament.season === season)
            );
            if (tournaments.length > 0) {
              for (const tournament of tournaments) {
                updateTournamentData(tournament.tournamentId, { standings: parsedStandings });
                console.log(`[StandingsPolling] Successfully updated standings for tournament ${tournament.tournamentId} (league ${leagueId}), season ${season}.`);
              }
            } else {
                console.warn(`[StandingsPolling] No tournament found in cache for leagueId ${leagueId} (target for standings update), season ${season}.`);
            }
            
            success = true;
            break; 
          } catch (error) {
            console.error(
              `[StandingsPolling] Error on attempt ${attempt} for league ${leagueId}, season ${season}:`,
              error
            );
            if (attempt === MAX_RETRIES) {
              console.error(`[StandingsPolling] All ${MAX_RETRIES} attempts failed for league ${leagueId}, season ${season}. Giving up.`);
            } else {
              console.log(`[StandingsPolling] Retrying in ${RETRY_DELAY / 1000} seconds...`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
          }
        } 
        if (!success) {
            console.warn(`[StandingsPolling] Ultimately failed to process standings for league ${leagueId}, season ${season} after all retries.`);
        }
      } 
    } 

    console.log(
      `[StandingsPolling] Standings update cycle finished. Next interval set to ${intervalTime / (60 * 60 * 1000)} hour(s).`
    );
  }

  console.log(`[StandingsPolling] Initial run of updateStandings will be delayed by ${INITIAL_STANDINGS_POLL_DELAY / 1000} seconds.`);
  setTimeout(() => {
    console.log('[StandingsPolling] Executing delayed initial run of updateStandings...');
    updateStandings().catch(err => {
        console.error('[StandingsPolling] Error during initial delayed updateStandings execution:', err);
    });
  }, INITIAL_STANDINGS_POLL_DELAY);

  setInterval(updateStandings, intervalTime); 
}

export function startDataPolling() {
  if (dataUpdateInterval) return;

  dataUpdateInterval = setInterval(async () => {
    try {
      console.log('[PollingAggregator] Poll cycle started.');
      await updateCachedMatches();
      cleanupOldMatches();
      cleanupOldTournaments();
      console.log('[PollingAggregator] Poll cycle finished.');
    } catch (error) {
      console.error('[PollingAggregator] Error in poll cycle:', error);
    }
  }, 40_000); // Every 40 seconds
}

export function stopPollingAggregator() {
  if (matchCacheInterval) {
    clearInterval(matchCacheInterval);
    matchCacheInterval = undefined;
  }
  if (tournamentPollInterval) {
    clearInterval(tournamentPollInterval);
    tournamentPollInterval = undefined;
  }
  if (dataUpdateInterval) {
    clearInterval(dataUpdateInterval);
    dataUpdateInterval = undefined;
  }
  if (subgraphRefreshInterval) {
    clearInterval(subgraphRefreshInterval);
    subgraphRefreshInterval = undefined;
  }
}

async function addUpcomingMatchesToCache() {
  const today = new Date();
  const initialRangeDays = 6;
  const rangeIncreaseDays = 7;
  const maxRangeWeeks = 4; // Set a maximum search range (e.g., 4 weeks)
  const statuses = ['NS', '1H', 'HT', '2H', 'ET', 'P', 'LIVE'];

  for (const leagueId of LEAGUES) {
    for (const season of SEASONS) {
      let currentRangeDays = initialRangeDays;
      let fixturesFoundForTournament = false;

      while (currentRangeDays <= maxRangeWeeks * 7 && !fixturesFoundForTournament) {
        const fromDate = today.toISOString().split('T')[0];
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + currentRangeDays);
        const toDate = futureDate.toISOString().split('T')[0];

        console.log(`[DataPolling] Fetching for league ${leagueId}, season ${season} with range ${currentRangeDays} days.`);

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

            console.log(`[DataPolling] Added match ${matchId} to cache (league ${leagueId}, season ${season}, status ${status} - range ${currentRangeDays} days).`);
            fixturesFoundForTournament = true;
          }
        }

        if (!fixturesFoundForTournament) {
          currentRangeDays += rangeIncreaseDays;
          console.log(`[DataPolling] No new fixtures found for league ${leagueId}, season ${season}. Increasing range to ${currentRangeDays} days.`);
        }
      }

      if (!fixturesFoundForTournament) {
        console.warn(`[DataPolling] No new fixtures found for league ${leagueId}, season ${season} within the maximum range of ${maxRangeWeeks} weeks.`);
      }
    }
  }
}

async function addUpcomingTournamentsToCache() {
  try {
    const activeTournaments = await getAllActiveTournaments();
    for (const tournament of activeTournaments) {
      const tournamentId = Number(tournament.tournamentId);
      if (getTournamentData(tournamentId)) continue;

      const details = await getTournamentDetails({ league: tournamentId, season: SEASONS[0] });
      const tournamentDetails = details[0] || {};

      updateTournamentData(tournamentId, {
        tournamentId,
        season: SEASONS[0] || SEASONS[1],
        name: tournamentDetails.name,
        logo: tournamentDetails.logo
      });

      console.log(`[TournamentCachePolling] Added tournament ${tournamentId} to cache.`);
      await new Promise(resolve => setTimeout(resolve, 1000)); 
    }
  } catch (error) {
    console.error('[TournamentCachePolling] Error adding tournaments to cache:', error);
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

async function refreshTournamentSubgraphData(tournamentId: number, oddsData: TournamentOddsUpdatedEntity[]) {
  try {
    const currentTournament = getTournamentData(tournamentId);
    if (!currentTournament) {
      console.warn(`[refreshTournamentSubgraphData] No tournament data for tournamentId=${tournamentId}`);
      return;
    }

    const tournamentMarket = await getTournamentMarketByTournamentId(tournamentId);
    if (!tournamentMarket || !tournamentMarket.teamIds) {
      console.warn(`[refreshTournamentSubgraphData] No tournament market or teamIds for tournamentId=${tournamentId}`, {
        tournamentMarket,
        teamIds: tournamentMarket?.teamIds,
      });
      return;
    }

    const teamIds = tournamentMarket.teamIds.map(id => Number(id));
    console.log(`[refreshTournamentSubgraphData] Fetched teamIds for tournamentId=${tournamentId}:`, teamIds);

    // Prepare update object
    const updates: Partial<TournamentData> = {};

    // Update contract
    if (!currentTournament.contract || currentTournament.contract !== tournamentMarket.id) {
      console.log(`[refreshTournamentSubgraphData] Updating contract for tournament ${tournamentId} to ${tournamentMarket.id}`);
      updates.contract = tournamentMarket.id;
    } else {
      console.log(`[refreshTournamentSubgraphData] Contract for tournament ${tournamentId} already set to ${currentTournament.contract}`);
    }

    // Initialize odds history
    let updatedOddsHistory = currentTournament.oddsHistory || {
      timestamps: [],
      teamOdds: {},
    };

    teamIds.forEach(teamId => {
      if (!updatedOddsHistory.teamOdds[teamId]) {
        updatedOddsHistory.teamOdds[teamId] = [];
      }
    });

    const DEFAULT_PROB = teamIds.length > 0 ? 1 / teamIds.length : 0.25;
    const FLATLINE_ODDS = decimalProbabilityToOdds(DEFAULT_PROB);
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    if (oddsData.length === 0) {
      if (updatedOddsHistory.timestamps.length === 0) {
        const now = Date.now();
        const flatTimestamps = [now - WEEK_MS, now - WEEK_MS + 60000, now];
        flatTimestamps.forEach(ts => {
          updatedOddsHistory.timestamps.push(ts);
          teamIds.forEach(teamId => {
            updatedOddsHistory.teamOdds[teamId].push(FLATLINE_ODDS);
          });
        });
        const flatLatestOdds: Record<number, number> = {};
        teamIds.forEach(teamId => {
          flatLatestOdds[teamId] = DEFAULT_PROB;
        });
        updates.teamIds = teamIds;
        updates.oddsHistory = updatedOddsHistory;
        updates.latestOdds = flatLatestOdds;
      }
    } else {
      if (updatedOddsHistory.timestamps.length === 0) {
        let hasValidOdds = false;
        oddsData.forEach(oddsItem => {
          const ts = Number(oddsItem.timestamp) * 1000;
          if (isNaN(ts) || ts > Date.now()) {
            console.warn(`[refreshTournamentSubgraphData] Invalid timestamp ${oddsItem.timestamp} for tournamentId=${tournamentId}`);
            return;
          }
          updatedOddsHistory.timestamps.push(ts);
          oddsItem.prices.forEach((price, index) => {
            if (index >= teamIds.length) {
              console.warn(`[refreshTournamentSubgraphData] Odds index ${index} exceeds teamIds length for tournamentId=${tournamentId}`);
              return;
            }
            const teamId = teamIds[index];
            const prob = convert192x64ToDecimal(Number(price));
            updatedOddsHistory.teamOdds[teamId].push(decimalProbabilityToOdds(prob));
          });
          hasValidOdds = true;
        });

        if (hasValidOdds && updatedOddsHistory.timestamps.length > 0) {
          const firstTimestamp = updatedOddsHistory.timestamps[0];
          const flatTimestamps = [
            firstTimestamp - WEEK_MS,
            firstTimestamp - WEEK_MS + 60000,
            firstTimestamp - WEEK_MS + 120000,
          ];
          flatTimestamps.reverse().forEach(ts => {
            updatedOddsHistory.timestamps.unshift(ts);
            teamIds.forEach(teamId => {
              updatedOddsHistory.teamOdds[teamId].unshift(FLATLINE_ODDS);
            });
          });
        } else {
          const now = Date.now();
          const flatTimestamps = [now - WEEK_MS, now - WEEK_MS + 60000, now];
          flatTimestamps.forEach(ts => {
            updatedOddsHistory.timestamps.push(ts);
            teamIds.forEach(teamId => {
              updatedOddsHistory.teamOdds[teamId].push(FLATLINE_ODDS);
            });
          });
        }
      } else {
        const lastOddsUpdate = oddsData[oddsData.length - 1];
        const newTimestamp = Number(lastOddsUpdate.timestamp) * 1000;
        if (isNaN(newTimestamp) || newTimestamp > Date.now()) {
          console.warn(`[refreshTournamentSubgraphData] Invalid last timestamp ${lastOddsUpdate.timestamp} for tournamentId=${tournamentId}`);
        } else {
          const lastIndex = updatedOddsHistory.timestamps.length - 1;
          if (updatedOddsHistory.timestamps[lastIndex] !== newTimestamp) {
            const lastProbs: Record<number, number> = {};
            teamIds.forEach((teamId, index) => {
              lastProbs[teamId] = 1 / updatedOddsHistory.teamOdds[teamId][lastIndex];
            });
            let hasChanges = false;
            const newProbs: Record<number, number> = {};
            lastOddsUpdate.prices.forEach((price, index) => {
              if (index >= teamIds.length) return;
              const teamId = teamIds[index];
              newProbs[teamId] = convert192x64ToDecimal(Number(price));
              if (newProbs[teamId] !== lastProbs[teamId]) {
                hasChanges = true;
              }
            });
            if (hasChanges) {
              updatedOddsHistory.timestamps.push(newTimestamp);
              lastOddsUpdate.prices.forEach((price, index) => {
                if (index >= teamIds.length) return;
                const teamId = teamIds[index];
                const prob = convert192x64ToDecimal(Number(price));
                updatedOddsHistory.teamOdds[teamId].push(decimalProbabilityToOdds(prob));
              });
            }
          }
        }

        const hasThreeFlatlinePoints = updatedOddsHistory.timestamps.length >= 3 &&
          teamIds.every(teamId =>
            updatedOddsHistory.teamOdds[teamId][0] === FLATLINE_ODDS &&
            updatedOddsHistory.teamOdds[teamId][1] === FLATLINE_ODDS &&
            updatedOddsHistory.teamOdds[teamId][2] === FLATLINE_ODDS
          );
        if (!hasThreeFlatlinePoints) {
          const firstTimestamp = updatedOddsHistory.timestamps[0];
          const flatTimestamps = [
            firstTimestamp - WEEK_MS,
            firstTimestamp - WEEK_MS + 60000,
            firstTimestamp - WEEK_MS + 120000,
          ];
          flatTimestamps.reverse().forEach(ts => {
            updatedOddsHistory.timestamps.unshift(ts);
            teamIds.forEach(teamId => {
              updatedOddsHistory.teamOdds[teamId].unshift(FLATLINE_ODDS);
            });
          });
        }
      }

      updates.teamIds = teamIds;
      updates.oddsHistory = updatedOddsHistory;

      const lastOddsItem = oddsData[oddsData.length - 1] || {};
      const latestOdds: Record<number, number> = {};
      teamIds.forEach((teamId, index) => {
        const price = lastOddsItem.prices ? lastOddsItem.prices[index] : null;
        latestOdds[teamId] = price ? convert192x64ToDecimal(Number(price)) : DEFAULT_PROB;
      });
      updates.latestOdds = latestOdds;
    }

    if (tournamentMarket) {
      if (tournamentMarket.isResolved) {
        updates.resolvedAt = Date.now();
        updates.outcome = tournamentMarket.resolvedOutcome ?? undefined;
      }

      const fixtures = await getTournamentFixtures(tournamentId);
      const nextRoundFixtures = fixtures
        .filter((fixture) => !fixture.resolved)
        .map((fixture) => Number(fixture.matchId));
      updates.nextRoundFixtures = nextRoundFixtures;

      const purchasedData = await getTournamentSharesPurchasedByMarket(tournamentMarket.id);
      const soldData = await getTournamentSharesSoldByMarket(tournamentMarket.id);

      let totalVolume = 0;
      for (const purchaseItem of purchasedData) {
        totalVolume += Number(purchaseItem.cost);
      }
      for (const saleItem of soldData) {
        totalVolume += Number(saleItem.actualGain);
      }
      updates.bettingVolume = totalVolume;
    }

    // Single update to avoid partial overwrites
    if (Object.keys(updates).length > 0) {
      updateTournamentData(tournamentId, updates);
      console.log(`[refreshTournamentSubgraphData] Updated tournament ${tournamentId} with:`, updates);
    } else {
      console.log(`[refreshTournamentSubgraphData] No updates needed for tournament ${tournamentId}`);
    }
  } catch (error) {
    console.error(`[refreshTournamentSubgraphData] Error for tournamentId=${tournamentId}:`, error);
  }
}


const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");
const DEFAULT_PROB = 0.3333333;
const FLATLINE_ODDS = decimalProbabilityToOdds(DEFAULT_PROB); 
const WEEK_MS = 7 * 24 * 60 * 60 * 1000; 

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

  let updatedHistory: OddsHistory = currentMatchData.oddsHistory || {
    timestamps: [],
    homeOdds: [],
    drawOdds: [],
    awayOdds: [],
  };

  if (oddsData.length === 0) {
    if (updatedHistory.timestamps.length === 0) {
      const now = Date.now();
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
    const lastOddsUpdate = oddsData[oddsData.length - 1];
    const newTimestamp = Number(lastOddsUpdate.timestamp) * 1000;
    const newHomeProb = convert192x64ToDecimal(Number(lastOddsUpdate.home));
    const newDrawProb = convert192x64ToDecimal(Number(lastOddsUpdate.draw));
    const newAwayProb = convert192x64ToDecimal(Number(lastOddsUpdate.away));
    const lastIndex = updatedHistory.timestamps.length - 1;
    if (updatedHistory.timestamps[lastIndex] !== newTimestamp) {
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

async function cleanupOldTournaments() {
  const now = Date.now();
  const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000; // 2 months

  const allTournaments = getAllTournaments();

  for (const tournament of allTournaments) {
    if (!tournament.resolvedAt) continue;

    const resolvedTimeElapsed = now - tournament.resolvedAt;

    // Remove fully resolved tournaments after 2 months
    if (resolvedTimeElapsed > TWO_MONTHS_MS) {
      console.log(`[Cleanup] Removing fully resolved tournament ${tournament.tournamentId}`);
      deleteTournamentData(tournament.tournamentId);
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
