import axios from 'axios';
import fuzz from 'fuzzball'; 
import { MATCHBOOK_USERNAME, MATCHBOOK_PASSWORD } from './rebalancer.config';

export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
}

export interface MatchbookEvent {
  id: number;
  name: string;
}

let session = {
  token: null as string | null,
  expiry: 0 as number,
};
const MATCHBOOK_API_URL = 'https://api.matchbook.com';

async function login(): Promise<string> {
    console.log('Authenticating with Matchbook API...');
    try {
        const response = await axios.post(
            `${MATCHBOOK_API_URL}/bpapi/rest/security/session`,
            { username: MATCHBOOK_USERNAME, password: MATCHBOOK_PASSWORD },
            { headers: { 'Content-Type': 'application/json' } }
        );
        const token = response.data['session-token'];
        if (!token) throw new Error('Login failed: session-token not found in response.');
        console.log('Successfully authenticated with Matchbook.');
        session = { token, expiry: Date.now() + 5.5 * 60 * 60 * 1000 };
        return token;
    } catch (error) {
        if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response) {
            // @ts-ignore
            console.error("Matchbook login failed:", error.response.data);
        } else if (error instanceof Error) {
            console.error("Matchbook login failed:", error.message);
        } else {
            console.error("Matchbook login failed:", error);
        }
        throw new Error("Could not authenticate with Matchbook API.");
    }
}

async function getSessionToken(): Promise<string> {
  if (session.token && Date.now() < session.expiry) {
    return session.token;
  }
  return await login();
}

export async function getMatchbookUpcomingEvents(kickoffTime: string): Promise<MatchbookEvent[]> {
    try {
        const token = await getSessionToken();
        const eventStartTime = new Date(kickoffTime);
        const params = {
            'sport-ids': 15, 
            'per-page': 100,
            'after': Math.floor((eventStartTime.getTime() - (24 * 60 * 60 * 1000)) / 1000), 
            'before': Math.floor((eventStartTime.getTime() + (48 * 60 * 60 * 1000)) / 1000),
        };

        const response = await axios.get(`${MATCHBOOK_API_URL}/edge/rest/events`, {
            headers: { 'session-token': token, 'Accept': 'application/json' },
            params,
        });
        console.log(`Fetched ${response.data.events.length} upcoming Matchbook events around kickoff time ${kickoffTime}.`);
        
        return response.data.events.map((event: any) => ({
            id: event.id,
            name: event.name,
        }));
    } catch (error) {
        return [];
    }
}

/**
 * Fetches the latest odds for a specific Matchbook event ID, finding runners by name.
 * @param matchbookEventId The ID of the event on Matchbook.
 * @param homeTeamName The name of the home team to look for.
 * @param awayTeamName The name of the away team to look for.
 * @returns A promise that resolves to a MarketOdds object or null on error.
 */
export async function getMatchbookOdds(
    matchbookEventId: number,
    homeTeamName: string,
    awayTeamName: string
): Promise<MarketOdds | null> {
  try {
    const token = await getSessionToken();

    const response = await axios.get(`${MATCHBOOK_API_URL}/edge/rest/events/${matchbookEventId}`, {
      headers: { 'session-token': token, 'Accept': 'application/json' },
      params: { 'include-prices': true, 'price-depth': 3 },
    });

    const matchOddsMarket = response.data.markets.find((m: any) => m.name === 'Match Odds');
    if (!matchOddsMarket || !matchOddsMarket.runners) {
      console.warn(`Could not find "Match Odds" market for event ${matchbookEventId}`);
      return null;
    }

    const runners = matchOddsMarket.runners;
    
    // **MODIFIED LOGIC: Find each runner by name instead of array index.**
    const homeRunner = runners.find((r: any) => fuzz.partial_ratio(r.name, homeTeamName) > 90);
    const awayRunner = runners.find((r: any) => fuzz.partial_ratio(r.name, awayTeamName) > 90);
    // The name for "Draw" can vary, so check for its inclusion.
    const drawRunner = runners.find((r: any) => r.name.toUpperCase().includes('DRAW'));

    const getBestBackPrice = (runner: any): number | null => {
        if (!runner?.prices?.length) return null;
        const backPrices = runner.prices
            .filter((p: any) => p.side === 'back')
            .sort((a: any, b: any) => b['decimal-odds'] - a['decimal-odds']); // Descending sort for best price
        return backPrices.length > 0 ? backPrices[0]['decimal-odds'] : null;
    }

    const homeOdds = getBestBackPrice(homeRunner);
    const drawOdds = getBestBackPrice(drawRunner);
    const awayOdds = getBestBackPrice(awayRunner);
    
    if (homeOdds !== null && drawOdds !== null && awayOdds !== null) {
      return { home: homeOdds, draw: drawOdds, away: awayOdds };
    } else {
      console.warn(`Could not find all three runners by name for event ${matchbookEventId}`);
      return null;
    }

  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error && error.response) {
      // @ts-ignore
      console.error(`Error fetching Matchbook odds for event ${matchbookEventId}:`, error.response.data);
    } else if (error instanceof Error) {
      console.error(`Error fetching Matchbook odds for event ${matchbookEventId}:`, error.message);
    } else {
      console.error(`An unknown error occurred while fetching Matchbook odds for event ${matchbookEventId}:`, error);
    }
    return null;
  }
}