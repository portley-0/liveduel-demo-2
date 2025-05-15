import {
  getAllPurchasesForUser,
  getAllSalesForUser,
  getAllRedeemedForUser,
  getPredictionMarketByAddress,
  PredictionMarketEntity,
  SharesPurchasedEntity,
  SharesSoldEntity,
  PayoutRedeemedEntity,
  getAllTournamentPurchasesForUser,
  getAllTournamentSalesForUser,
  getAllTournamentRedeemedForUser,
  getTournamentMarketByTournamentId,
  TournamentMarketEntity,
  TournamentSharesPurchasedEntity,
  TournamentSharesSoldEntity,
  TournamentPayoutRedeemedEntity,
  getTeamIdsByTournamentId,
} from './subgraph-service';

import { getFixtures, getTournamentDetails, getTeamNameById } from './football-service';

export interface UserPrediction {
  marketAddress: string;
  matchId?: number;
  tournamentId?: number;
  timestamp?: number | null;
  outcome: number;
  netShares: number;
  netCost: number;
  isResolved: boolean;
  resolvedOutcome?: number | null;
  hasRedeemed: boolean;
  homeTeamName?: string;
  homeTeamLogo?: string;
  awayTeamName?: string;
  awayTeamLogo?: string;
  selectedTeamName?: string;
  leagueId?: number;
  leagueName?: string;
}

export async function getUserPredictions(userAddress: string): Promise<UserPrediction[]> {
  // Fetch match-related data
  const allPurchases: SharesPurchasedEntity[] = await getAllPurchasesForUser(userAddress);
  const allSales: SharesSoldEntity[] = await getAllSalesForUser(userAddress);
  const allRedeems: PayoutRedeemedEntity[] = await getAllRedeemedForUser(userAddress);

  // Fetch tournament-related data
  const allTournamentPurchases: TournamentSharesPurchasedEntity[] = await getAllTournamentPurchasesForUser(userAddress);
  const allTournamentSales: TournamentSharesSoldEntity[] = await getAllTournamentSalesForUser(userAddress);
  const allTournamentRedeems: TournamentPayoutRedeemedEntity[] = await getAllTournamentRedeemedForUser(userAddress);

  interface GroupedInfo {
    market: string;
    outcome: number;
    totalPurchasedShares: number;
    totalPurchasedCost: number;
    totalSoldShares: number;
    totalSoldGain: number;
    isTournament: boolean;
  }

  const grouped: Record<string, GroupedInfo> = {};

  function getKey(market: string, outcome: number, isTournament: boolean) {
    return `${market.toLowerCase()}-${outcome}-${isTournament}`;
  }

  // Process match purchases
  for (const p of allPurchases) {
    const key = getKey(p.market, p.outcome, false);
    if (!grouped[key]) {
      grouped[key] = {
        market: p.market,
        outcome: p.outcome,
        totalPurchasedShares: 0,
        totalPurchasedCost: 0,
        totalSoldShares: 0,
        totalSoldGain: 0,
        isTournament: false,
      };
    }
    grouped[key].totalPurchasedShares += parseFloat(p.shares);
    grouped[key].totalPurchasedCost += parseFloat(p.actualCost);
  }

  // Process match sales
  for (const s of allSales) {
    const key = getKey(s.market, s.outcome, false);
    if (!grouped[key]) {
      grouped[key] = {
        market: s.market,
        outcome: s.outcome,
        totalPurchasedShares: 0,
        totalPurchasedCost: 0,
        totalSoldShares: 0,
        totalSoldGain: 0,
        isTournament: false,
      };
    }
    grouped[key].totalSoldShares += parseFloat(s.shares);
    grouped[key].totalSoldGain += parseFloat(s.actualGain);
  }

  // Process tournament purchases
  for (const p of allTournamentPurchases) {
    const key = getKey(p.market, p.outcome, true);
    if (!grouped[key]) {
      grouped[key] = {
        market: p.market,
        outcome: p.outcome,
        totalPurchasedShares: 0,
        totalPurchasedCost: 0,
        totalSoldShares: 0,
        totalSoldGain: 0,
        isTournament: true,
      };
    }
    grouped[key].totalPurchasedShares += parseFloat(p.shares);
    grouped[key].totalPurchasedCost += parseFloat(p.cost);
  }

  // Process tournament sales
  for (const s of allTournamentSales) {
    const key = getKey(s.market, s.outcome, true);
    if (!grouped[key]) {
      grouped[key] = {
        market: s.market,
        outcome: s.outcome,
        totalPurchasedShares: 0,
        totalPurchasedCost: 0,
        totalSoldShares: 0,
        totalSoldGain: 0,
        isTournament: true,
      };
    }
    grouped[key].totalSoldShares += parseFloat(s.shares);
    grouped[key].totalSoldGain += parseFloat(s.actualGain);
  }

  const predictions: UserPrediction[] = [];

  // Cache for team names
  const teamNameCache: Record<string, string> = {};

  async function getCachedTeamNameById(teamId: number, leagueId?: number, season?: number): Promise<string | undefined> {
    const cacheKey = `${teamId}-${leagueId || ''}-${season || ''}`;
    if (!teamNameCache[cacheKey]) {
      teamNameCache[cacheKey] = await getTeamNameById(teamId, leagueId, season) || `Team_${teamId}`;
    }
    return teamNameCache[cacheKey];
  }

  for (const key of Object.keys(grouped)) {
    const info = grouped[key];

    const netShares = info.totalPurchasedShares - info.totalSoldShares;
    if (netShares <= 0) {
      continue;
    }

    const netCost = info.totalPurchasedCost - info.totalSoldGain;

    let prediction: UserPrediction;

    if (info.isTournament) {
      // Handle tournament predictions
      const tournamentMarket: TournamentMarketEntity | null = await getTournamentMarketByTournamentId(
        parseInt(info.market, 10)
      );
      if (!tournamentMarket) {
        continue;
      }

      const tournamentId = parseInt(tournamentMarket.tournamentId, 10);
      const isResolved = tournamentMarket.isResolved;
      const resolvedOutcome = tournamentMarket.resolvedOutcome ?? null;

      let hasRedeemed = false;
      if (isResolved) {
        const userRedemptionsInMarket = allTournamentRedeems.filter(
          (r) => r.market.toLowerCase() === info.market.toLowerCase()
        );
        if (userRedemptionsInMarket.length > 0) {
          hasRedeemed = true;
        }
      }

      // Fetch tournament details and team name
      let leagueId: number | undefined;
      let leagueName: string | undefined;
      let selectedTeamName: string | undefined;

      const tournamentDetails = await getTournamentDetails({ league: tournamentId });
      if (tournamentDetails.length > 0) {
        const tournament = tournamentDetails[0];
        leagueId = tournament.id;
        leagueName = tournament.name;
        const teamIds = await getTeamIdsByTournamentId(tournamentId);
        if (info.outcome < teamIds.length) {
          const teamId = Number(teamIds[info.outcome]);
          const teamName = await getCachedTeamNameById(teamId, tournament.id, tournament.season);
          selectedTeamName = teamName ? `${teamName} To Win` : undefined;
          if (!teamName) {
            console.warn(`Team name not found for teamId ${teamId} in league ${tournament.id}`);
          }
        }
      }

      prediction = {
        marketAddress: info.market,
        tournamentId,
        outcome: info.outcome,
        netShares,
        netCost,
        isResolved,
        resolvedOutcome,
        hasRedeemed,
        selectedTeamName,
        leagueId,
        leagueName,
      };
    } else {
      // Handle match predictions 
      const marketEntity: PredictionMarketEntity | null = await getPredictionMarketByAddress(info.market);
      if (!marketEntity) {
        continue;
      }

      const matchId = parseInt(marketEntity.matchId, 10);
      const isResolved = marketEntity.isResolved;
      const resolvedOutcome = marketEntity.resolvedOutcome ?? null;

      let hasRedeemed = false;
      if (isResolved) {
        const userRedemptionsInMarket = allRedeems.filter(
          (r) => r.market.toLowerCase() === info.market.toLowerCase()
        );
        if (userRedemptionsInMarket.length > 0) {
          hasRedeemed = true;
        }
      }

      let timestamp: number | null = null;
      let homeTeamName: string | undefined;
      let homeTeamLogo: string | undefined;
      let awayTeamName: string | undefined;
      let awayTeamLogo: string | undefined;

      const fixtureArray = await getFixtures({ id: matchId });
      if (fixtureArray.length > 0) {
        const fixture = fixtureArray[0];
        timestamp = fixture.fixture.timestamp;
        homeTeamName = fixture.teams.home.name;
        homeTeamLogo = fixture.teams.home.logo;
        awayTeamName = fixture.teams.away.name;
        awayTeamLogo = fixture.teams.away.logo;
      }

      prediction = {
        marketAddress: info.market,
        matchId,
        timestamp,
        outcome: info.outcome,
        netShares,
        netCost,
        isResolved,
        resolvedOutcome,
        hasRedeemed,
        homeTeamName,
        homeTeamLogo,
        awayTeamName,
        awayTeamLogo,
      };
    }

    predictions.push(prediction);
  }

  return predictions;
}