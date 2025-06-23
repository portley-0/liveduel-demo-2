import fuzz from 'fuzzball';
import { getFixtures } from './football-service'; 
import { getMatchbookUpcomingEvents, MatchbookEvent } from './matchbook.api';

interface ApiFootballMatchDetails {
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
}

export interface MappingResult {
    matchbookEventId: number;
    homeTeamName: string;
    awayTeamName: string;
}

const idCache = new Map<number, MappingResult>(); 
const failedMatchCache = new Set<number>();
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
    if (idCache.has(apiFootballId)) {
        console.log(`ID MAPPER: Cache HIT for API-Football ID ${apiFootballId}.`);
        return idCache.get(apiFootballId)!;
    }
    if (failedMatchCache.has(apiFootballId)) return null;

    console.log(`ID MAPPER: Cache MISS for ${apiFootballId}. Attempting new match...`);

    try {
        const footballMatch = await getApiFootballMatchDetails(apiFootballId);
        if (!footballMatch) {
            failedMatchCache.add(apiFootballId);
            return null;
        }

        const matchbookEvents = await getMatchbookUpcomingEvents(footballMatch.kickoffTime);
        if (!matchbookEvents || matchbookEvents.length === 0) {
            failedMatchCache.add(apiFootballId);
            return null;
        }
        
        console.log(`ID MAPPER: Found ${matchbookEvents.length} Matchbook events for kickoff time window.`);
        console.log('ID MAPPER: Matchbook events fetched:', matchbookEvents);

        let bestMatch: MatchbookEvent | null = null;
        let highestScore = 0;
        const footballMatchName = `${footballMatch.homeTeam} ${footballMatch.awayTeam}`;

        for (const mbEvent of matchbookEvents) {
            const score = fuzz.token_set_ratio(footballMatchName, mbEvent.name);
            console.log(`ID MAPPER: Comparing "${footballMatchName}" with Matchbook event "${mbEvent.name}". Score: ${score}`);

            if (score > highestScore) {
                highestScore = score;
                bestMatch = mbEvent;
            }
        }

        if (bestMatch && highestScore >= MIN_SIMILARITY_SCORE) {
            console.log(`ID MAPPER: Found confident match for ${apiFootballId}! Matchbook Event: "${bestMatch.name}" (${bestMatch.id}) with score ${highestScore}.`);
            
            const result: MappingResult = {
                matchbookEventId: bestMatch.id,
                homeTeamName: footballMatch.homeTeam,
                awayTeamName: footballMatch.awayTeam,
            };
            idCache.set(apiFootballId, result);
            return result;
        } else {
            console.log(`ID MAPPER: Failed to find confident match for ${apiFootballId}. Best score was ${highestScore}.`);
            failedMatchCache.add(apiFootballId);
            return null;
        }
    } catch (error) {
        console.error(`ID MAPPER: An unexpected error occurred while mapping ID ${apiFootballId}:`, error);
        failedMatchCache.add(apiFootballId);
        return null;
    }
}