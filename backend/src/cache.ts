import { io } from '../socket';

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

function broadcastMatchUpdate(match: MatchData) {
  io.emit('matchUpdate', match);
}

export function deleteMatchData(matchId:number) {
  delete matchCache[matchId];
}

export function getAllMatches(): MatchData[] {
  return Object.values(matchCache);
}

export function getMatchesFiltered(options?: {
  leagueId?: number;
  liveOnly?: boolean;
  sortOption?: 'bettingVolume' | 'elapsedAsc' | 'elapsedDesc' | 'totalGoals' | 'startTimeAsc';
}) {
  let all = getAllMatches(); 

  if (options?.leagueId) {
    all = all.filter((m) => m.leagueId === options.leagueId);
  }

  if (options?.liveOnly) {
    const LIVE_STATUSES = ["1H", "HT", "2H", "ET"];
    all = all.filter((m) => m.statusShort && LIVE_STATUSES.includes(m.statusShort));
  }

  switch (options?.sortOption) {
    case 'bettingVolume':
      all.sort((a, b) => {
        const volumeA = a.bettingVolume ?? 0;
        const volumeB = b.bettingVolume ?? 0;
        return volumeB - volumeA; 
      });
      break;

    case 'elapsedAsc':
      all.sort((a, b) => {
        const elapsedA = a.elapsed ?? 0;
        const elapsedB = b.elapsed ?? 0;
        return elapsedA - elapsedB; 
      });
      break;

    case 'elapsedDesc':
      all.sort((a, b) => {
        const elapsedA = a.elapsed ?? 0;
        const elapsedB = b.elapsed ?? 0;
        return elapsedB - elapsedA; 
      });
      break;

    case 'totalGoals':
      all.sort((a, b) => {
        const goalsA = (a.homeScore ?? 0) + (a.awayScore ?? 0);
        const goalsB = (b.homeScore ?? 0) + (b.awayScore ?? 0);
        return goalsB - goalsA; 
      });
      break;

    case 'startTimeAsc':
      all.sort((a, b) => {
        const timeA = a.matchTimestamp ?? 0;
        const timeB = b.matchTimestamp ?? 0;
        return timeA - timeB; 
      });
      break;

    default:
      break;
  }

  return all.map((m) => ({
    matchId: m.matchId,
    contract: m.contract,
    leagueId: m.leagueId,
    homeTeamName: m.homeTeamName,
    homeTeamLogo: m.homeTeamLogo,
    awayTeamName: m.awayTeamName,
    awayTeamLogo: m.awayTeamLogo,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    statusShort: m.statusShort,
    elapsed: m.elapsed,
    timestamp: m.matchTimestamp,
    oddsHistory: m.oddsHistory,
    latestOdds: m.latestOdds,
    bettingVolume: m.bettingVolume,
  }));
}
