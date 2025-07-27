// football-service.ts
import axios from 'axios';
import axiosRetry from 'axios-retry';
import Bottleneck from 'bottleneck';
import 'dotenv/config';

const API_KEY = process.env.API_KEY || '';
console.log('API_KEY from env:', process.env.API_KEY);
const BASE_URL = 'https://v3.football.api-sports.io';

// ---------- Create Axios client with retry logic ----------
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-apisports-key': API_KEY,
    'x-apisports-host': 'v3.football.api-sports.io',
  },
});

// Retry on network errors or 429 Too Many Requests, with exponential backoff
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: error =>
    axiosRetry.isNetworkError(error) ||
    error.response?.status === 429,
});

// Log rate‑limit headers for monitoring
apiClient.interceptors.response.use(resp => {
  const used =
    resp.headers['x-ratelimit-used'] ||
    resp.headers['x-rapidapi-requests-used'];
  const limit =
    resp.headers['x-ratelimit-limit'] ||
    resp.headers['x-rapidapi-request-limit'];
  console.log(`[API Rate] ${used || '?'} / ${limit || '?'}`);
  return resp;
});

// ---------- Throttler setup (≈450 requests/minute) ----------
const limiter = new Bottleneck({
  reservoir: 450,
  reservoirRefreshAmount: 450,
  reservoirRefreshInterval: 60 * 1000, // refill every minute
  maxConcurrent: 1,
  minTime: 150, // at least 150 ms between requests
});

// ---------- Types ----------
export interface GetFixtureParams {
  id?: number;
  live?: string;
  league?: number;
  date?: string;
  season?: number;
  from?: string;
  to?: string;
  status?: string;
}

export interface TournamentQueryParams {
  league?: number;
  season?: number;
}

// ---------- Wrapped service functions ----------

export const getFixtures = limiter.wrap(
  async (params: GetFixtureParams) => {
    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(([_, val]) => val !== undefined)
    );

    const response = await apiClient.get('/fixtures', {
      params: cleanedParams,
    });
    if (response.status !== 200) {
      throw new Error(
        `[FootballService] getFixtures failed with status ${response.status}`
      );
    }
    return response.data?.response ?? [];
  }
);

export const getStatistics = limiter.wrap(
  async (matchId: number, teamId: number) => {
    const response = await apiClient.get('/fixtures/statistics', {
      params: { fixture: matchId, team: teamId },
    });
    return response.data?.response ?? [];
  }
);

export const getEvents = limiter.wrap(
  async (matchId: number) => {
    const response = await apiClient.get('/fixtures/events', {
      params: { fixture: matchId },
    });
    return response.data?.response ?? [];
  }
);

export const getLineups = limiter.wrap(
  async (matchId: number) => {
    const response = await apiClient.get('/fixtures/lineups', {
      params: { fixture: matchId },
    });
    return response.data?.response ?? [];
  }
);

export const getStandings = limiter.wrap(
  async (leagueId: number, season: number) => {
    try {
      const response = await apiClient.get('/standings', {
        params: { league: leagueId, season },
      });
      return response.data.response ?? [];
    } catch (error) {
      console.error(`[FootballService] Error fetching standings:`, error);
      return [];
    }
  }
);

export const getTournamentDetails = limiter.wrap(
  async (params: TournamentQueryParams): Promise<any[]> => {
    const cleanedParams: { [key: string]: number | string } = {};
    if (params.league !== undefined) {
      cleanedParams.id = params.league;
    }
    if (params.season !== undefined) {
      cleanedParams.season = params.season;
    }

    console.log(
      `[FootballService] getTournamentDetails - Attempting to fetch with effective params:`,
      JSON.stringify(cleanedParams)
    );

    try {
      const response = await apiClient.get('/leagues', {
        params: cleanedParams,
      });

      console.log(
        `[FootballService] getTournamentDetails - Raw response status for effective params ${JSON.stringify(
          cleanedParams
        )}: ${response.status}`
      );
      console.log(
        `[FootballService] getTournamentDetails - Raw response.data for effective params ${JSON.stringify(
          cleanedParams
        )}:`,
        JSON.stringify(response.data, null, 2)
      );

      if (response.status !== 200) {
        throw new Error(
          `[FootballService] getTournamentDetails failed with status ${response.status}. Data: ${JSON.stringify(
            response.data
          )}`
        );
      }

      if (!response.data || !response.data.response) {
        console.warn(
          `[FootballService] getTournamentDetails - API response.data or response.data.response is missing for params:`,
          cleanedParams
        );
        console.warn(
          `[FootballService] getTournamentDetails - Full API response.data for missing structure:`,
          JSON.stringify(response.data, null, 2)
        );
        return [];
      }

      const leagues = response.data.response;
      if (!Array.isArray(leagues)) {
        console.warn(
          `[FootballService] getTournamentDetails - API response.data.response was not an array for params:`,
          cleanedParams,
          `. Actual data:`,
          JSON.stringify(leagues, null, 2)
        );
        return [];
      }

      return leagues
        .map((leagueItem: any) => {
          if (
            leagueItem &&
            leagueItem.league &&
            leagueItem.league.id !== undefined &&
            leagueItem.league.name !== undefined
          ) {
            return {
              id: leagueItem.league.id,
              name: leagueItem.league.name,
              logo: leagueItem.league.logo,
            };
          } else {
            console.warn(
              `[FootballService] getTournamentDetails - Encountered an item in 'leagues' array with unexpected structure:`,
              JSON.stringify(leagueItem, null, 2)
            );
            return null;
          }
        })
        .filter(item => item !== null);
    } catch (error: any) {
      console.error(
        `[FootballService] CRITICAL Error fetching tournament details for original params { league: ${params.league}, season: ${params.season} } (effective params: ${JSON.stringify(
          cleanedParams
        )}):`,
        error.message
      );
      if (error.response) {
        console.error(
          '[FootballService] Error response data:',
          JSON.stringify(error.response.data, null, 2)
        );
        console.error(
          '[FootballService] Error response status:',
          error.response.status
        );
        console.error(
          '[FootballService] Error response headers:',
          JSON.stringify(error.response.headers, null, 2)
        );
      } else if (error.request) {
        console.error('[FootballService] Error request:', error.request);
      }
      return [];
    }
  }
);

export const getTeamNameById = limiter.wrap(
  async (
    teamId: number,
    leagueId?: number,
    season?: number
  ): Promise<string | undefined> => {
    try {
      const params: any = { id: teamId };
      if (leagueId) params.league = leagueId;
      if (season) params.season = season;

      const response = await apiClient.get('/teams', { params });
      if (response.status !== 200) {
        throw new Error(
          `[FootballService] getTeamNameById failed with status ${response.status}`
        );
      }

      const teams = response.data.response;
      if (teams.length > 0) {
        return teams[0].team.name;
      }
      return undefined;
    } catch (error) {
      console.error(
        `[FootballService] Error fetching team name for teamId ${teamId}:`,
        error
      );
      return undefined;
    }
  }
);
