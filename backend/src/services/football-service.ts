import axios from 'axios';

const API_KEY = process.env.API_KEY || '';
const BASE_URL = 'https://v3.football.api-sports.io';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-apisports-key': API_KEY,
    'x-apisports-host': 'v3.football.api-sports.io',
  },
});

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

export async function getFixtures(params: GetFixtureParams) {
  const cleanedParams = Object.fromEntries(
    Object.entries(params).filter(([_, val]) => val !== undefined)
  );

  const response = await apiClient.get('/fixtures', { params: cleanedParams });
  if (response.status !== 200) {
    throw new Error(`[FootballService] getFixtures failed with status ${response.status}`);
  }

  const data = response.data?.response ?? [];

  return data; 
}

export async function getStatistics(matchId: number, teamId: number) {
  const response = await apiClient.get('/fixtures/statistics', {
    params: { fixture: matchId, team: teamId },
  });
  return response.data?.response ?? [];
}

export async function getEvents(matchId: number) {
  const response = await apiClient.get('/fixtures/events', {
    params: { fixture: matchId },
  });
  return response.data?.response ?? [];
}

export async function getLineups(matchId: number) {
  const response = await apiClient.get('/fixtures/lineups', {
    params: { fixture: matchId },
  });
  return response.data?.response ?? [];
}

export async function getStandings(leagueId: number, season: number) {
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

export async function getTournamentDetails(params: TournamentQueryParams): Promise<any[]> {
  try {
    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(([_, val]) => val !== undefined)
    );

    const response = await apiClient.get('/leagues', { params: cleanedParams });
    if (response.status !== 200) {
      throw new Error(`[FootballService] getTournamentDetails failed with status ${response.status}`);
    }

    const leagues = response.data?.response ?? [];
    return leagues.map((league: any) => ({
      id: league.league.id,
      name: league.league.name,
      logo: league.league.logo,
    }));
  } catch (error) {
    console.error(
      `[FootballService] Error fetching tournament details for league ${params.league}, season ${params.season}:`,
      error
    );
    throw error;
  }
}

export async function getTeamNameById(teamId: number, leagueId?: number, season?: number): Promise<string | undefined> {
  try {
    const params: any = { id: teamId };
    if (leagueId) params.league = leagueId;
    if (season) params.season = season;

    const response = await apiClient.get('/teams', { params });
    if (response.status !== 200) {
      throw new Error(`[FootballService] getTeamNameById failed with status ${response.status}`);
    }

    const teams = response.data.response;
    if (teams.length > 0) {
      return teams[0].team.name;
    }
    return undefined;
  } catch (error) {
    console.error(`[FootballService] Error fetching team name for teamId ${teamId}:`, error);
    return undefined;
  }
}
