import axios from 'axios';
import fuzz from 'fuzzball';
import JSONbig from 'json-bigint';
import { MATCHBOOK_USERNAME, MATCHBOOK_PASSWORD } from './rebalancer.config';

export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
}

export interface MatchbookEvent {
  id: bigint; 
  name: string;
}

let session = {
  token: null as string | null,
  expiry: 0 as number,
};
const MATCHBOOK_API_URL = 'https://api.matchbook.com';

const axiosInstance = axios.create({
  transformResponse: [(data) => {
    if (typeof data === 'string') {
      try {
        return JSONbig.parse(data);
      } catch (e) {
        return data;
      }
    }
    return data;
  }],
});


async function login(): Promise<string> {
    console.log('Authenticating with Matchbook API...');
    try {
        const response = await axiosInstance.post(
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
        if (axios.isAxiosError(error) && error.response) {
            console.error("Matchbook login failed:", error.response.data);
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
            'after': Math.floor((eventStartTime.getTime() - (8 * 60 * 60 * 1000)) / 1000),
            'before': Math.floor((eventStartTime.getTime() + (8 * 60 * 60 * 1000)) / 1000),
        };

        const response = await axiosInstance.get(`${MATCHBOOK_API_URL}/edge/rest/events`, {
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

export async function getMatchbookOdds(
    matchbookEventId: bigint, 
    homeTeamName: string,
    awayTeamName: string
): Promise<MarketOdds | null> {
  try {
    const token = await getSessionToken();

    const url = `${MATCHBOOK_API_URL}/edge/rest/events/${matchbookEventId.toString()}`; // Use .toString() for the URL

    const params = {
      'include-prices': true,
      'odds-type': 'DECIMAL',
      'price-depth': 3,
    };

    const response = await axiosInstance.get(url, {
      headers: { 'session-token': token, accept: 'application/json', 'User-Agent': 'api-doc-test-client' },
      params,
    });

    console.log(`[getMatchbookOdds] RAW response for event ${matchbookEventId.toString()}:`, JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.markets || response.data.markets.length === 0) {
      console.warn(`[getMatchbookOdds] Event object returned, but it contains no markets for event ID ${matchbookEventId.toString()}.`);
      return null;
    }

    const eventObject = response.data;
    
    const possibleMarketNames = ['Match Odds', 'Full Time Result', 'Moneyline'];
    const matchOddsMarket = eventObject.markets.find((m: any) =>
      possibleMarketNames.includes(m.name)
    );

    if (!matchOddsMarket) {
        console.warn(`[getMatchbookOdds] Could not find a suitable primary market for event ${matchbookEventId.toString()}`);
        return null;
    }
    
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

    teamRunners.sort((a, b) => b.homeScore - a.homeScore);
    const homeRunner = teamRunners[0].runner;

    teamRunners.sort((a, b) => b.awayScore - a.awayScore);
    const awayRunner = teamRunners[0].runner;

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
      console.error(`[getMatchbookOdds] Axios Error for event ${matchbookEventId.toString()}:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`[getMatchbookOdds] Unknown error for event ${matchbookEventId.toString()}:`, error);
    }
    return null;
  }
}