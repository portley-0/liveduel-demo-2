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
            { headers: { accept: 'application/json', 'content-type': 'application/json', 'User-Agent': 'api-doc-test-client' } }
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
            'include-prices': true,
            'price-depth': 1,
            'exchange-type': 'back-lay',
            'odds-type': 'DECIMAL',
        };

        const response = await axios.get(`${MATCHBOOK_API_URL}/edge/rest/events`, {
            headers: { 'session-token': token, accept: 'application/json', 'User-Agent': 'api-doc-test-client' },
            params,
        });
        
        console.log(`[getMatchbookUpcomingEvents] RAW RESPONSE for kickoff ${kickoffTime}:`, JSON.stringify(response.data, null, 2));
        console.log(`Fetched ${response.data.events.length} upcoming Matchbook events around kickoff time ${kickoffTime}.`);

        return response.data.events.map((event: any) => ({
            id: event.id,
            name: event.name,
        }));
    } catch (error) {
        console.error(`[getMatchbookUpcomingEvents] Error fetching events:`, error);
        return [];
    }
}

export async function getMatchbookOdds(
    matchbookEventId: string | number,
    homeTeamName: string,
    awayTeamName: string
): Promise<MarketOdds | null> {
  try {
    const token = await getSessionToken();

    const url = `${MATCHBOOK_API_URL}/edge/rest/events`;
    const params = {
      'ids': matchbookEventId.toString(),
      'exchange-type': 'back-lay',
      'odds-type': 'DECIMAL',
      'include-prices': true,
      'price-depth': 3,
      'price-mode': 'expanded'
    };
    
    const response = await axios.get(url, {
      headers: { 'session-token': token, accept: 'application/json', 'User-Agent': 'api-doc-test-client' },
      params,
    });
    
    if (!response.data || !response.data.events || response.data.events.length === 0) {
      return null;
    }

    const eventObject = response.data.events[0];
    const matchOddsMarket = eventObject.markets.find((m: any) => m.name === 'Match Odds');

    if (!matchOddsMarket || !matchOddsMarket.runners || matchOddsMarket.runners.length !== 3) {
      console.warn(`[getMatchbookOdds] Could not find a "Match Odds" market with 3 runners for event ${eventObject.id}`);
      return null;
    }

    let runners = [...matchOddsMarket.runners]; 

    const drawRunnerIndex = runners.findIndex((r: any) => r.name.toUpperCase().includes('DRAW'));
    if (drawRunnerIndex === -1) {
        console.warn(`[getMatchbookOdds] Could not find a 'Draw' runner for event ${eventObject.id}`);
        return null;
    }
    const drawRunner = runners.splice(drawRunnerIndex, 1)[0];
    
    const scores = runners.map(r => ({ runner: r, score: fuzz.ratio(r.name, homeTeamName) }));
    scores.sort((a, b) => b.score - a.score);

    const homeRunner = scores[0].runner;
    const awayRunner = scores[1].runner;
    
    const getBestBackPrice = (runner: any): number | null => {
        if (!runner?.prices?.length) return null;
        const backPrices = runner.prices
            .filter((p: any) => p.side === 'back')
            .sort((a: any, b: any) => b['decimal-odds'] - a['decimal-odds']); 
        return backPrices.length > 0 ? backPrices[0]['decimal-odds'] : null;
    }

    const homeOdds = getBestBackPrice(homeRunner);
    const drawOdds = getBestBackPrice(drawRunner);
    const awayOdds = getBestBackPrice(awayRunner);
    
    if (homeOdds !== null && drawOdds !== null && awayOdds !== null) {
      return { home: homeOdds, draw: drawOdds, away: awayOdds };
    } else {
      console.warn(`[getMatchbookOdds] One or more runners was missing price data for event ${eventObject.id}`);
      return null;
    }

  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`[getMatchbookOdds] Axios Error for event ${matchbookEventId}:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`[getMatchbookOdds] Unknown error for event ${matchbookEventId}:`, error);
    }
    return null;
  }
}