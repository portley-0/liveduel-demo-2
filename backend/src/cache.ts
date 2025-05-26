import { broadcastMatchUpdate } from './socket';
import { broadcastTournamentUpdate } from './socket';

export interface TeamStanding {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form?: string;
  status?: string;
  description?: string; 

  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };

  update: string; 
}

export interface LeagueStanding {
  league: {
    id: number;
    name: string;
    country?: string;
    logo?: string;
    flag?: string;
    season: number;
    standings: TeamStanding[][];
  };
}

export interface LineupPlayer {
  player: {
    id: number;
    name: string;
    number: number;
    pos: string;     
    grid?: string | null; 
  };
}

export interface LineupTeamInfo {
  id: number;
  name: string;
  logo: string;
  colors?: {
    player?: {
      primary?: string;
      number?: string;
      border?: string;
    };
    goalkeeper?: {
      primary?: string;
      number?: string;
      border?: string;
    };
  };
}

export interface CoachInfo {
  id?: number;
  name?: string;
  photo?: string;
}

export interface TeamLineup {
  team: LineupTeamInfo;
  formation: string;          
  startXI: LineupPlayer[];    
  substitutes: LineupPlayer[]; 
  coach: CoachInfo;
}

export interface FixtureLineups {
  home?: TeamLineup;
  away?: TeamLineup;
}

export interface StatisticItem {
  type: string;
  value: number | string | null; 
}

export interface TeamStats {
  teamId: number;
  name: string;
  logo: string;
  stats: StatisticItem[];
}

export interface FixtureStatistics {
  home?: TeamStats;
  away?: TeamStats;
}

export interface FixtureEvent {
  time: {
    elapsed: number;    
    extra?: number | null; 
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id?: number | null;
    name: string;
  };
  assist: {
    id?: number | null;
    name?: string | null;
  };
  type: string;   
  detail: string; 
  comments?: string | null;
}

export interface MatchData {
  matchId: number;
  contract?: string;
  leagueId?: number;
  leagueName?: string;
  season?: number;
  homeTeamName?: string;
  homeTeamLogo?: string;
  awayTeamName?: string;
  awayTeamLogo?: string;
  homeScore?: number;
  awayScore?: number;
  statusShort?: string; 
  resolvedAt?: number;  
  outcome?: number,
  elapsed?: number;    
  matchTimestamp?: number;

  oddsHistory?: {
    timestamps: number[];
    homeOdds: number[];
    drawOdds: number[];
    awayOdds: number[];
  };
  latestOdds?: {
    home: number;
    draw: number;
    away: number;
  };
  bettingVolume?: number;

  statistics?: FixtureStatistics; 
  events?: FixtureEvent[]; 
  lineups?: FixtureLineups;
  standings?: LeagueStanding;
}

export interface TournamentData {
  tournamentId: number;
  season?: number;
  contract?: string;
  name?: string;
  logo?: string;
  resolvedAt?: number;
  outcome?: number; 

  nextRoundFixtures?: number[];

  teamIds?: number[];

  oddsHistory?: {
    timestamps: number[];
    teamOdds: Record<number, number[]>; // teamId -> odds over time
  };
  latestOdds?: Record<number, number>; // teamId -> latest odds

  bettingVolume?: number;

  standings?: LeagueStanding;
}


const matchCache: Record<number, MatchData> = {};
const tournamentCache: Record<number, TournamentData> = {};

export function initCache() {
  for (const key of Object.keys(matchCache)) {
    delete matchCache[+key];
  }
  console.log('Match cache initialized (cleared).');
}

export function initTournamentCache() {
  for (const key of Object.keys(tournamentCache)) {
    delete tournamentCache[+key];
  }
  console.log('Tournament cache initialized (cleared).');
}

export function getMatchData(matchId: number): MatchData | undefined {
  return matchCache[matchId];
}

export function getTournamentData(tournamentId: number): TournamentData | undefined {
  return tournamentCache[tournamentId];
}

export function updateMatchData(matchId: number, partialData: Partial<MatchData>) {
  if (!matchCache[matchId]) {
    matchCache[matchId] = { matchId };
  }

  matchCache[matchId] = {
    ...matchCache[matchId],
    ...partialData,
  };

  const updatedMatch = matchCache[matchId];
  broadcastMatchUpdate(updatedMatch);
}


export function updateTournamentData(tournamentId: number, partialData: Partial<TournamentData>) {
  if (!tournamentCache[tournamentId]) {
    tournamentCache[tournamentId] = { tournamentId };
  }

  tournamentCache[tournamentId] = {
    ...tournamentCache[tournamentId],
    ...partialData,
  };

  const updatedTournament = tournamentCache[tournamentId];
  broadcastTournamentUpdate(updatedTournament);
}

export function deleteMatchData(matchId:number) {
  delete matchCache[matchId];
}

export function deleteTournamentData(tournamentId: number) {
  delete tournamentCache[tournamentId];
}

export function getAllMatches(): MatchData[] {
  return Object.values(matchCache);
}

export function getAllTournaments(): TournamentData[] {
  return Object.values(tournamentCache);
}
