import { broadcastMatchUpdate } from './socket';

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

const matchCache: Record<number, MatchData> = {};

export function initCache() {
  for (const key of Object.keys(matchCache)) {
    delete matchCache[+key];
  }
  console.log('Match cache initialized (cleared).');
}

export function getMatchData(matchId: number): MatchData | undefined {
  return matchCache[matchId];
}

export function updateMatchData(matchId: number, partialData: Partial<MatchData>) {
  if (!matchCache[matchId]) {
    matchCache[matchId] = { matchId };
  }

  if (partialData.oddsHistory && partialData.oddsHistory.homeOdds?.length) {
    const { homeOdds, drawOdds, awayOdds } = partialData.oddsHistory;
    const lastIndex = homeOdds.length - 1;

    partialData.latestOdds = {
      home: homeOdds[lastIndex],
      draw: drawOdds[lastIndex],
      away: awayOdds[lastIndex],
    };
  }

  matchCache[matchId] = {
    ...matchCache[matchId],
    ...partialData,
  };

  const updatedMatch = matchCache[matchId];
  broadcastMatchUpdate(updatedMatch);
}

export function deleteMatchData(matchId:number) {
  delete matchCache[matchId];
}

export function getAllMatches(): MatchData[] {
  return Object.values(matchCache);
}
