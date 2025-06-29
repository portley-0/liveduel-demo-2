import axios from 'axios';
import fuzz from 'fuzzball';
import { MATCHBOOK_USERNAME, MATCHBOOK_PASSWORD } from './rebalancer.config';

/**
 * Defines the structure for the final odds object.
 */
export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
}

/**
 * Defines the basic structure for a Matchbook event used in discovery.
 */
export interface MatchbookEvent {
  id: number;
  name: string;
}

// Session object to hold the token and its expiry time.
let session = {
  token: null as string | null,
  expiry: 0 as number,
};
const MATCHBOOK_API_URL = 'https://api.matchbook.com';

/**
 * Logs into the Matchbook API and retrieves a new session token.
 * @returns {Promise<string>} A new session token.
 */
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
        // Set expiry for 5.5 hours to be safe (tokens last for 6 hours).
        session = { token, expiry: Date.now() + 5.5 * 60 * 60 * 1000 };
        return token;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            console.error("Matchbook login failed:", error.response.data);
        } else if (error instanceof Error) {
            console.error("Matchbook login failed:", error.message);
        } else {
            console.error("Matchbook login failed:", error);
        }
        throw new Error("Could not authenticate with Matchbook API.");
    }
}

/**
 * Retrieves a valid session token, logging in if necessary.
 * @returns {Promise<string>} A valid session token.
 */
async function getSessionToken(): Promise<string> {
  if (session.token && Date.now() < session.expiry) {
    return session.token;
  }
  return await login();
}

/**
 * Fetches upcoming football events from Matchbook within a given time window.
 * This is used for the initial discovery of match IDs.
 * @param {string} kickoffTime - The ISO string of the target kickoff time.
 * @returns {Promise<MatchbookEvent[]>} A list of upcoming events.
 */
export async function getMatchbookUpcomingEvents(kickoffTime: string): Promise<MatchbookEvent[]> {
    try {
        const token = await getSessionToken();
        const eventStartTime = new Date(kickoffTime);
        const params = {
            'sport-ids': 15,
            'per-page': 100,
            'after': Math.floor((eventStartTime.getTime() - (8 * 60 * 60 * 1000)) / 1000),
            'before': Math.floor((eventStartTime.getTime() + (8 * 60 * 60 * 1000)) / 1000),
        };

        const response = await axios.get(`${MATCHBOOK_API_URL}/edge/rest/events`, {
            headers: { 'session-token': token, accept: 'application/json', 'User-Agent': 'api-doc-test-client' },
            params,
        });

        console.log(`Fetched ${response.data.events.length} upcoming Matchbook events around kickoff time ${kickoffTime}.`);

        return response.data.events.map((event: any) => ({
            id: event.id,
            name: event.name,
        }));
    } catch (error) {
        console.error("Failed to fetch upcoming Matchbook events:", error);
        return [];
    }
}

/**
 * Fetches and processes odds for a specific football match.
 * @param {string | number} matchbookEventId - The unique ID of the Matchbook event.
 * @param {string} homeTeamName - The name of the home team for fuzzy matching.
 * @param {string} awayTeamName - The name of the away team for fuzzy matching.
 * @returns {Promise<MarketOdds | null>} An object with home, draw, and away odds, or null if not found.
 */
export async function getMatchbookOdds(
    matchbookEventId: string | number,
    homeTeamName: string,
    awayTeamName: string
): Promise<MarketOdds | null> {
  try {
    const token = await getSessionToken();

    const url = `${MATCHBOOK_API_URL}/edge/rest/events/${matchbookEventId}`;

    const params = {
      'include-prices': true, 
      'odds-type': 'DECIMAL',
      'price-depth': 3,
      'exchange-type': 'back-lay',
    };

    const response = await axios.get(url, {
      headers: { 'session-token': token, accept: 'application/json', 'User-Agent': 'api-doc-test-client' },
      params,
    });

    console.log(`[getMatchbookOdds] RAW response for event ${matchbookEventId}:`, JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.markets || response.data.markets.length === 0) {
      console.warn(`[getMatchbookOdds] Event object returned, but it contains no markets for event ID ${matchbookEventId}.`);
      return null;
    }

    const eventObject = response.data;
    
    const possibleMarketNames = ['Match Odds', 'Full Time Result', 'Moneyline'];
    const matchOddsMarket = eventObject.markets.find((m: any) =>
      possibleMarketNames.includes(m.name)
    );

    if (!matchOddsMarket) {
        console.warn(`[getMatchbookOdds] Could not find a suitable primary market (e.g., Match Odds) for event ${matchbookEventId}`);
        return null;
    }
    console.log(`[getMatchbookOdds] Found market: "${matchOddsMarket.name}" for event ${matchbookEventId}`);

    if (!matchOddsMarket.runners || matchOddsMarket.runners.length !== 3) {
      console.warn(`[getMatchbookOdds] Market "${matchOddsMarket.name}" does not have exactly 3 runners.`);
      return null;
    }

    const runners = [...matchOddsMarket.runners];
    const drawRunnerIndex = runners.findIndex((r: any) => r.name.toUpperCase().includes('DRAW'));

    if (drawRunnerIndex === -1) {
        console.warn(`[getMatchbookOdds] Could not find a 'Draw' runner in market "${matchOddsMarket.name}".`);
        return null;
    }
    const drawRunner = runners.splice(drawRunnerIndex, 1)[0];

    const teamRunners = runners.map(r => ({
        runner: r,
        homeScore: fuzz.ratio(r.name, homeTeamName),
        awayScore: fuzz.ratio(r.name, awayTeamName)
    }));

    console.log('[getMatchbookOdds] Fuzzy matching scores:', teamRunners.map(r => ({name: r.runner.name, home: r.homeScore, away: r.awayScore})));

    teamRunners.sort((a, b) => b.homeScore - a.homeScore);
    const homeRunner = teamRunners[0].runner;

    teamRunners.sort((a, b) => b.awayScore - a.awayScore);
    const awayRunner = teamRunners[0].runner;

    console.log(`[getMatchbookOdds] Matched Runners: Home='${homeRunner.name}', Away='${awayRunner.name}', Draw='${drawRunner.name}'`);

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
      console.warn(`[getMatchbookOdds] Found all three runners, but one or more was missing price data.`);
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