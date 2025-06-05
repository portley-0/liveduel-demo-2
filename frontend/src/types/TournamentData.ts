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
      standings: TeamStanding[][] | TeamStanding[];
    };
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
    teamNames?: Record<number, string>;
  
    oddsHistory?: {
      timestamps: number[];
      teamOdds: Record<number, number[]>; // teamId -> odds over time
    };
    latestOdds?: Record<number, number>; // teamId -> latest odds
  
    bettingVolume?: number;
  
    standings?: LeagueStanding;
  }