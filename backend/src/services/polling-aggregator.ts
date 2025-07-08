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
  TournamentData,
  MatchData
} from '../cache';

import {
  getFixtures,
  getStatistics,
  getEvents,
  getLineups,
  getStandings,
  getTournamentDetails,
  getTeamNameById
} from './football-service';

import {
  getOddsUpdatesByMatchId,
  getPredictionMarketByMatchId,
  getSharesPurchasedByMarket,
  getTradesExecutedByMarket,
  getSharesSoldByMarket,
  OddsUpdatedEntity,
  TradeExecutedEntity,
  getTournamentOddsById,
  getTournamentMarketByTournamentId,
  getTournamentSharesPurchasedByMarket,
  getTournamentSharesSoldByMarket,
  getTournamentFixtures,
  TournamentOddsUpdatedEntity,
  getAllActiveTournaments
} from './subgraph-service';

import { unwindPositions } from './portfolio-manager';
import { findMatchbookId } from './id-mapper';
import { getMatchbookOdds } from './matchbook.api';

//const LEAGUES = [2, 3, 11, 13, 15, 34, 39, 130, 140, 71, 78, 61, 135, 239, 265, 848];
const LEAGUES = [15, 743];
const SEASONS = [2024, 2025, 2026];

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
        //if (tournament.resolvedAt) continue;
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

            const newMatchObject = {
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
              elapsed: fixture.fixture.status.elapsed,
              marketAvailable: false,
            };

            console.log(`[addUpcomingMatchesToCache] PREPARING TO CREATE MATCH ${matchId}:`, JSON.stringify(newMatchObject, null, 2));
            updateMatchData(matchId, newMatchObject);

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
  console.log('[TournamentCachePolling] Starting to add/update specific season tournaments for defined leagues.');

  const activeTournaments = await getAllActiveTournaments();
  console.log(activeTournaments);
  for (const tournament of activeTournaments) {
    let targetSeason: number;
    const leagueId = Number(tournament.tournamentId);
    if (leagueId === 34) {
      targetSeason = 2026;
    } else {
      targetSeason = 2024;
    }

    const currentCachedTournament = getTournamentData(leagueId);

    if (
      currentCachedTournament &&
      currentCachedTournament.season === targetSeason &&
      currentCachedTournament.name 
    ) {
      console.log(`[TournamentCachePolling] Tournament for league ${leagueId}, season ${targetSeason} is already correctly cached. Skipping.`);
      continue;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1200)); 

      console.log(`[TournamentCachePolling] Fetching tournament details for league ${leagueId}, target season ${targetSeason}.`);
      const detailsArray = await getTournamentDetails({ league: leagueId, season: targetSeason });
      console.log(`[TournamentCachePolling] DEBUG: For league ${leagueId}, season ${targetSeason}, detailsArray from getTournamentDetails:`, JSON.stringify(detailsArray, null, 2)); 

      if (detailsArray && detailsArray.length > 0 && detailsArray[0] && detailsArray[0].name) {
        const tournamentApiData = detailsArray[0];

        const newTournamentEntry: TournamentData = {
          tournamentId: leagueId,     
          season: targetSeason,        
          name: tournamentApiData.name,
          logo: tournamentApiData.logo,
        };

        updateTournamentData(leagueId, newTournamentEntry);

        console.log(`[TournamentCachePolling] Successfully cached/updated tournament: League ${leagueId}, Season ${targetSeason}, Name: "${tournamentApiData.name}".`);
      } else {
        console.log(`[TournamentCachePolling] No valid tournament details (e.g., name missing) found from API for league ${leagueId}, target season ${targetSeason}. Cache for this league might not be updated or fully populated.`);
      }
    } catch (error) {
      console.error(`[TournamentCachePolling] Error fetching or caching tournament for league ${leagueId}, target season ${targetSeason}:`, error);
    }
  } // end league loop
  console.log('[TournamentCachePolling] Finished cycle for adding/updating specific season tournaments.');
}

async function checkMatchbookMarketAvailability(matchId: number): Promise<boolean> {
  try {
    console.log(`[MarketCheck] Checking Matchbook availability for match ${matchId}...`);
    const mappingResult = await findMatchbookId(matchId);

    console.log(`[DebugCheck] For match ${matchId}, mappingResult is:`, mappingResult);

    // If we can't even map it to a Matchbook ID, it's not available.
    if (!mappingResult) {
      console.log(`[MarketCheck] Matchbook ID not found for match ${matchId}.`);
      return false;
    }

    const { matchbookEventId, homeTeamName, awayTeamName } = mappingResult;
    const matchbookOdds = await getMatchbookOdds(matchbookEventId, homeTeamName, awayTeamName);
    console.log(`[DebugCheck] For match ${matchId} (event ${matchbookEventId}), matchbookOdds are:`, matchbookOdds);

    // If we have an event ID but no active odds, it's not available for betting yet.
    if (!matchbookOdds) {
      console.log(`[MarketCheck] Matchbook odds not found for event ${matchbookEventId} (match ${matchId}).`);
      return false;
    }

    // If we pass both checks, the market is available!
    console.log(`[MarketCheck] ✅ Market is available on Matchbook for match ${matchId}.`);
    return true;

  } catch (error) {
    console.error(`[MarketCheck] Error checking availability for match ${matchId}:`, error);
    return false;
  }
}


async function updateCachedMatches() {
  const allMatches = getAllMatches();

  for (const match of allMatches) {
    if (match.resolvedAt) {
      continue;
    }

    if (match.marketAvailable !== true) {
      const isNowAvailable = await checkMatchbookMarketAvailability(match.matchId);
      if (isNowAvailable) {
        updateMatchData(match.matchId, { marketAvailable: true });
      }
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

    const updatedData: Partial<MatchData> = {
        homeScore: fixture.goals.home,
        awayScore: fixture.goals.away,
        statusShort: fixture.fixture.status.short,
        elapsed: fixture.fixture.status.elapsed
    };
    
    updateMatchData(matchId, updatedData);

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
        console.log(`POLLER: Detected resolved market ${matchId}. Caching resolution and triggering unwind.`);
        
        updateMatchData(matchId, {
          resolvedAt: Date.now(),
          outcome: predictionMarket.resolvedOutcome ?? undefined
        });

        unwindPositions(matchId).catch(error => {
            console.error(`POLLER: Error during unwind process for market ${matchId}:`, error);
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

    let shouldFetchTeamNames = false;
    if (!currentTournament.teamNames) { // Case 1: No teamNames map in cache at all
        console.log(`[refreshTournamentSubgraphData] No teamNames object in cache for tournament ${tournamentId}. Will fetch.`);
        shouldFetchTeamNames = true;
    } else {
        const cachedTeamIdsSet = new Set(currentTournament.teamIds || []);
        // Case 2: Team list from subgraph is different from cached team list
        if (teamIds.length !== cachedTeamIdsSet.size || !teamIds.every(id => cachedTeamIdsSet.has(id))) {
            console.log(`[refreshTournamentSubgraphData] Team list changed for tournament ${tournamentId}. Cached: ${JSON.stringify(Array.from(cachedTeamIdsSet))}, New: ${JSON.stringify(teamIds)}. Will refresh all names.`);
            shouldFetchTeamNames = true;
        } else {
            // Case 3: Team list is the same, but some names might be missing in the cached teamNames map
            for (const teamId of teamIds) {
                if (!currentTournament.teamNames[teamId]) {
                    console.log(`[refreshTournamentSubgraphData] Missing name for teamId ${teamId} in tournament ${tournamentId} (team list unchanged). Will refresh names.`);
                    shouldFetchTeamNames = true;
                    break;
                }
            }
        }
    }

    if (shouldFetchTeamNames && teamIds.length > 0) {
        console.log(`[refreshTournamentSubgraphData] Fetching/Refreshing team names for tournament ${tournamentId} using ${teamIds.length} team IDs.`);
        const newTeamNamesRecord: Record<number, string> = {};
        const seasonForNameApi = currentTournament.season;
        if (seasonForNameApi === undefined) {
            console.warn(`[refreshTournamentSubgraphData] Season is undefined for tournament ${tournamentId}. Team names will be fetched without season context for getTeamNameById (if it's optional).`);
        }

        for (const teamId of teamIds) {
            try {
                const teamName = await getTeamNameById(teamId, tournamentId, seasonForNameApi);
                if (teamName) {
                    newTeamNamesRecord[teamId] = teamName;
                } else {
                    console.warn(`[refreshTournamentSubgraphData] Could not fetch team name for teamId ${teamId} in tournament ${tournamentId}.`);
                }
            } catch (teamNameError) {
                console.error(`[refreshTournamentSubgraphData] Error fetching team name for teamId ${teamId} in tournament ${tournamentId}:`, teamNameError);
            }
        }
        updates.teamNames = newTeamNamesRecord;
    } else if (shouldFetchTeamNames && teamIds.length === 0) {
        console.log(`[refreshTournamentSubgraphData] Subgraph returned zero teamIds for tournament ${tournamentId}. Clearing teamNames.`);
        updates.teamNames = {}; 
    }

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
  if (!currentMatchData) {
    return;
  }

  const allPointsFromSources: Array<{
    timestamp: number;
    home: number;
    draw: number;
    away: number;
    isNew: boolean;
  }> = [];

  const existingHistory = currentMatchData.oddsHistory as OddsHistory | undefined;
  if (existingHistory && existingHistory.timestamps && existingHistory.timestamps.length > 0) {
    for (let i = 0; i < existingHistory.timestamps.length; i++) {
      allPointsFromSources.push({
        timestamp: existingHistory.timestamps[i],
        home: existingHistory.homeOdds[i],
        draw: existingHistory.drawOdds[i],
        away: existingHistory.awayOdds[i],
        isNew: false,
      });
    }
  }

  oddsData.forEach(item => {
    try {
      allPointsFromSources.push({
        timestamp: Number(item.timestamp) * 1000,
        home: decimalProbabilityToOdds(convert192x64ToDecimal(Number(item.home))),
        draw: decimalProbabilityToOdds(convert192x64ToDecimal(Number(item.draw))),
        away: decimalProbabilityToOdds(convert192x64ToDecimal(Number(item.away))),
        isNew: true,
      });
    } catch (e) {
      // Error processing new odds item
    }
  });

  allPointsFromSources.sort((a, b) => a.timestamp - b.timestamp);
  const uniqueCombinedPoints = allPointsFromSources.filter((point, index, self) =>
    index === self.findLastIndex(p => p.timestamp === point.timestamp)
  );

  let expectedFlatTs1: number, expectedFlatTs2: number, expectedFlatTs3: number;

  if (uniqueCombinedPoints.length === 0 || uniqueCombinedPoints.every(p => p.home === FLATLINE_ODDS && p.draw === FLATLINE_ODDS && p.away === FLATLINE_ODDS)) {
    const anchorTimestamp = currentMatchData.matchTimestamp ? currentMatchData.matchTimestamp * 1000 : (Date.now() - WEEK_MS * 4); // Fallback to a very distant past if matchTimestamp is missing
    expectedFlatTs1 = anchorTimestamp - WEEK_MS - 120000;
    expectedFlatTs2 = anchorTimestamp - WEEK_MS - 60000;
    expectedFlatTs3 = anchorTimestamp - WEEK_MS;
     if (expectedFlatTs1 <= 0) { expectedFlatTs1 = 1; expectedFlatTs2 = 2; expectedFlatTs3 = 3; }
     if (expectedFlatTs2 <= expectedFlatTs1) expectedFlatTs2 = expectedFlatTs1 + 1;
     if (expectedFlatTs3 <= expectedFlatTs2) expectedFlatTs3 = expectedFlatTs2 + 1;

  } else {
    const firstSignalPoint = uniqueCombinedPoints.find(p => p.home !== FLATLINE_ODDS || p.draw !== FLATLINE_ODDS || p.away !== FLATLINE_ODDS);
    const firstActualTs = firstSignalPoint ? firstSignalPoint.timestamp : (uniqueCombinedPoints.length > 0 ? uniqueCombinedPoints[0].timestamp : (currentMatchData.matchTimestamp ? currentMatchData.matchTimestamp * 1000 : Date.now() - WEEK_MS * 4));

    if (firstActualTs > 180000) {
      expectedFlatTs3 = firstActualTs - 60000;
      expectedFlatTs2 = firstActualTs - 120000;
      expectedFlatTs1 = firstActualTs - 180000;
    } else if (firstActualTs > 3) {
      expectedFlatTs1 = 1;
      expectedFlatTs2 = 2;
      expectedFlatTs3 = 3;
    } else {
      expectedFlatTs1 = 1;
      expectedFlatTs2 = 2;
      expectedFlatTs3 = 3;
    }
  }

  let hasCorrectPrefix = false;
  if (existingHistory && existingHistory.timestamps && existingHistory.timestamps.length >= 3) {
    const prefixTimestampsMatch = existingHistory.timestamps[0] === expectedFlatTs1 &&
                                existingHistory.timestamps[1] === expectedFlatTs2 &&
                                existingHistory.timestamps[2] === expectedFlatTs3;
    const prefixOddsAreFlatline = existingHistory.homeOdds.slice(0, 3).every(o => o === FLATLINE_ODDS) &&
                                existingHistory.drawOdds.slice(0, 3).every(o => o === FLATLINE_ODDS) &&
                                existingHistory.awayOdds.slice(0, 3).every(o => o === FLATLINE_ODDS);
    if (prefixTimestampsMatch && prefixOddsAreFlatline) {
      hasCorrectPrefix = true;
    }
  }

  const newHistory: OddsHistory = { timestamps: [], homeOdds: [], drawOdds: [], awayOdds: [] };
  let pointsToProcessForAppending = uniqueCombinedPoints;

  if (hasCorrectPrefix) {
    for (let i = 0; i < 3; i++) {
      newHistory.timestamps.push(existingHistory!.timestamps[i]);
      newHistory.homeOdds.push(existingHistory!.homeOdds[i]);
      newHistory.drawOdds.push(existingHistory!.drawOdds[i]);
      newHistory.awayOdds.push(existingHistory!.awayOdds[i]);
    }
    pointsToProcessForAppending = uniqueCombinedPoints.filter(p => p.timestamp > expectedFlatTs3 ||
        (p.timestamp === expectedFlatTs3 && (p.home !== FLATLINE_ODDS || p.draw !== FLATLINE_ODDS || p.away !== FLATLINE_ODDS))
    );

  } else {
    newHistory.timestamps.push(expectedFlatTs1, expectedFlatTs2, expectedFlatTs3);
    newHistory.homeOdds.push(FLATLINE_ODDS, FLATLINE_ODDS, FLATLINE_ODDS);
    newHistory.drawOdds.push(FLATLINE_ODDS, FLATLINE_ODDS, FLATLINE_ODDS);
    newHistory.awayOdds.push(FLATLINE_ODDS, FLATLINE_ODDS, FLATLINE_ODDS);
  }

  pointsToProcessForAppending.forEach(point => {
    if (point.timestamp > newHistory.timestamps[newHistory.timestamps.length -1 ]) {
      newHistory.timestamps.push(point.timestamp);
      newHistory.homeOdds.push(point.home);
      newHistory.drawOdds.push(point.draw);
      newHistory.awayOdds.push(point.away);
    } else if (point.timestamp === newHistory.timestamps[newHistory.timestamps.length -1]) {
       // This case should primarily handle the point.timestamp === expectedFlatTs3 when hasCorrectPrefix is false
       // or if a new point somehow aligns with the last point of an existing correct prefix.
      if (point.home !== newHistory.homeOdds[newHistory.homeOdds.length -1] ||
          point.draw !== newHistory.drawOdds[newHistory.drawOdds.length -1] ||
          point.away !== newHistory.awayOdds[newHistory.awayOdds.length -1]) {
            newHistory.homeOdds[newHistory.homeOdds.length -1] = point.home;
            newHistory.drawOdds[newHistory.drawOdds.length -1] = point.draw;
            newHistory.awayOdds[newHistory.awayOdds.length -1] = point.away;
      }
    }
  });


  let latestOddsToStore = { home: DEFAULT_PROB, draw: DEFAULT_PROB, away: DEFAULT_PROB };
  if (oddsData.length > 0) {
    const lastIncomingOddsItem = oddsData[oddsData.length - 1];
    try {
      latestOddsToStore = {
        home: convert192x64ToDecimal(Number(lastIncomingOddsItem.home)),
        draw: convert192x64ToDecimal(Number(lastIncomingOddsItem.draw)),
        away: convert192x64ToDecimal(Number(lastIncomingOddsItem.away)),
      };
    } catch (e) {
      if (newHistory.timestamps.length > 0) {
        const lastIdx = newHistory.timestamps.length - 1;
        const probFromOdds = (o: number) => (o > 0 && o !== Infinity && o !== 0 ? 1 / o : DEFAULT_PROB);
        latestOddsToStore = {
          home: probFromOdds(newHistory.homeOdds[lastIdx]),
          draw: probFromOdds(newHistory.drawOdds[lastIdx]),
          away: probFromOdds(newHistory.awayOdds[lastIdx]),
        };
      }
    }
  } else if (newHistory.timestamps.length > 0) {
    const lastIdx = newHistory.timestamps.length - 1;
    const probFromOdds = (o: number) => (o > 0 && o !== Infinity && o !== 0 ? 1 / o : DEFAULT_PROB);
    latestOddsToStore = {
      home: probFromOdds(newHistory.homeOdds[lastIdx]),
      draw: probFromOdds(newHistory.drawOdds[lastIdx]),
      away: probFromOdds(newHistory.awayOdds[lastIdx]),
    };
  }

  updateMatchData(matchId, {
    oddsHistory: newHistory,
    latestOdds: latestOddsToStore,
  });
}

async function computeBettingVolume(matchId: number, marketAddress: string) {
  const [purchasedData, soldData, executedTradeData] = await Promise.all([
    getSharesPurchasedByMarket(marketAddress),
    getSharesSoldByMarket(marketAddress),
    getTradesExecutedByMarket(marketAddress) 
  ]);

  let totalVolume = 0;

  for (const purchaseItem of purchasedData) {
    totalVolume += Number(purchaseItem.actualCost);
  }

  for (const saleItem of soldData) {
    totalVolume += Number(saleItem.actualGain);
  }

  for (const executedTrade of executedTradeData) {
    const tradeValue = Math.abs(Number(executedTrade.netCostOrGain));
    totalVolume += tradeValue;
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
