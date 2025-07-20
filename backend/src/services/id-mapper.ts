import fuzz from 'fuzzball';
import { getFixtures } from './football-service';
import { getMatchbookUpcomingEvents, MatchbookEvent, getMatchbookOdds } from './matchbook.api';

interface ApiFootballMatchDetails {
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
}

export interface MappingResult {
    matchbookEventId: bigint;
    homeTeamName: string;
    awayTeamName: string;
}

interface CachedMapping extends MappingResult {
    expiry: number;
}

const idCache = new Map<number, CachedMapping>();

const CACHE_TTL = 1 * 60 * 60 * 1000;
const MIN_SIMILARITY_SCORE = 70; 

async function getApiFootballMatchDetails(apiFootballId: number): Promise<ApiFootballMatchDetails | null> {
    console.log(`ID MAPPER: Fetching details for API-Football ID: ${apiFootballId} from football-service.`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        const fixturesResponse = await getFixtures({ id: apiFootballId });
        if (!fixturesResponse || fixturesResponse.length === 0) {
            console.warn(`ID MAPPER: No fixture found in API-Football for ID: ${apiFootballId}`);
            return null;
        }
        const fixture = fixturesResponse[0];
        return {
            homeTeam: fixture.teams.home.name,
            awayTeam: fixture.teams.away.name,
            kickoffTime: fixture.fixture.date,
        };
    } catch (error) {
        console.error(`ID MAPPER: Error fetching from football-service for ID ${apiFootballId}:`, error);
        return null;
    }
}

export async function findMatchbookId(apiFootballId: number): Promise<MappingResult | null> {
    const cachedItem = idCache.get(apiFootballId);
    if (cachedItem && Date.now() < cachedItem.expiry) {
        console.log(`ID MAPPER: Cache HIT for API-Football ID ${apiFootballId}.`);
        return cachedItem;
    }

    if (cachedItem) {
        console.log(`ID MAPPER: Cache STALE for ${apiFootballId}. Attempting new match...`);
    } else {
        console.log(`ID MAPPER: Cache MISS for ${apiFootballId}. Attempting new match...`);
    }

    try {
        const footballMatch = await getApiFootballMatchDetails(apiFootballId);
        if (!footballMatch) {
            return null;
        }

        const matchbookEvents = await getMatchbookUpcomingEvents(footballMatch.kickoffTime);
        if (!matchbookEvents || matchbookEvents.length === 0) {
            console.warn(`ID MAPPER: No upcoming events found from Matchbook for kickoff ${footballMatch.kickoffTime}`);
            return null;
        }

        console.log(`ID MAPPER: Found ${matchbookEvents.length} Matchbook events for kickoff time window.`);

        const footballMatchName = `${footballMatch.homeTeam} ${footballMatch.awayTeam}`;

        const potentialMatches = matchbookEvents
            .map(mbEvent => ({
                event: mbEvent,
                score: fuzz.token_set_ratio(footballMatchName, mbEvent.name)
            }))
            .filter(match => match.score >= MIN_SIMILARITY_SCORE)
            .sort((a, b) => b.score - a.score); 

        if (potentialMatches.length === 0) {
            console.warn(`ID MAPPER: Failed to find any confident match for "${footballMatchName}".`);
            return null;
        }

        console.log(`ID MAPPER: Found ${potentialMatches.length} potential matches for "${footballMatchName}". Verifying which one has an active market...`);

        for (const match of potentialMatches) {
            console.log(`ID MAPPER: Testing event "${match.event.name}" (ID: ${match.event.id}) with score ${match.score}...`);
            const odds = await getMatchbookOdds(match.event.id, footballMatch.homeTeam, footballMatch.awayTeam);

            if (odds) {
                console.log(`ID MAPPER: SUCCESS! Found active market for event ID ${match.event.id}. This is the correct ID.`);
                
                const result: MappingResult = {
                    matchbookEventId: match.event.id,
                    homeTeamName: footballMatch.homeTeam,
                    awayTeamName: footballMatch.awayTeam,
                };
                
                idCache.set(apiFootballId, { ...result, expiry: Date.now() + CACHE_TTL });
                
                return result; 
            } else {
                console.log(`ID MAPPER: No odds found for event ID ${match.event.id}. It is likely stale. Trying next potential match...`);
            }
        }

        console.warn(`ID MAPPER: All potential matches for "${footballMatchName}" were tested and none had an available market.`);
        return null;

    } catch (error) {
        console.error(`ID MAPPER: An unexpected error occurred while mapping ID ${apiFootballId}:`, error);
        return null;
    }
}
