import {
    getAllPurchasesForUser,
    getAllSalesForUser,
    getAllRedeemedForUser,
    getPredictionMarketByAddress,
    PredictionMarketEntity,
    SharesPurchasedEntity,
    SharesSoldEntity,
    PayoutRedeemedEntity
  } from './subgraph-service';
  
  import { getFixtures } from './football-service'; 
  
  export interface UserPrediction {
    marketAddress: string;
    matchId: number;
  
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
  }
  
  export async function getUserPredictions(userAddress: string): Promise<UserPrediction[]> {
    const allPurchases: SharesPurchasedEntity[] = await getAllPurchasesForUser(userAddress);
    const allSales: SharesSoldEntity[] = await getAllSalesForUser(userAddress);
    const allRedeems: PayoutRedeemedEntity[] = await getAllRedeemedForUser(userAddress);
  
    interface GroupedInfo {
      market: string;
      outcome: number;
      totalPurchasedShares: number;
      totalPurchasedCost: number;
      totalSoldShares: number;
      totalSoldGain: number;
    }
  
    const grouped: Record<string, GroupedInfo> = {};
  
    function getKey(market: string, outcome: number) {
      return `${market.toLowerCase()}-${outcome}`;
    }
  
    for (const p of allPurchases) {
      const key = getKey(p.market, p.outcome);
      if (!grouped[key]) {
        grouped[key] = {
          market: p.market,
          outcome: p.outcome,
          totalPurchasedShares: 0,
          totalPurchasedCost: 0,
          totalSoldShares: 0,
          totalSoldGain: 0
        };
      }
      grouped[key].totalPurchasedShares += parseFloat(p.shares);
      grouped[key].totalPurchasedCost   += parseFloat(p.actualCost);
    }
  
    for (const s of allSales) {
      const key = getKey(s.market, s.outcome);
      if (!grouped[key]) {
        grouped[key] = {
          market: s.market,
          outcome: s.outcome,
          totalPurchasedShares: 0,
          totalPurchasedCost: 0,
          totalSoldShares: 0,
          totalSoldGain: 0
        };
      }
      grouped[key].totalSoldShares += parseFloat(s.shares);
      grouped[key].totalSoldGain   += parseFloat(s.actualGain);
    }
  
    const predictions: UserPrediction[] = [];
  
    for (const key of Object.keys(grouped)) {
      const info = grouped[key];
  
      const netShares = info.totalPurchasedShares - info.totalSoldShares;
      if (netShares <= 0) {
        continue;
      }
  
      const netCost = info.totalPurchasedCost - info.totalSoldGain;
  
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
  
      let homeTeamName: string | undefined;
      let homeTeamLogo: string | undefined;
      let awayTeamName: string | undefined;
      let awayTeamLogo: string | undefined;
  
      const fixtureArray = await getFixtures({ id: matchId });
      if (fixtureArray.length > 0) {
        const fixture = fixtureArray[0];
        homeTeamName = fixture.teams.home.name;
        homeTeamLogo = fixture.teams.home.logo;
        awayTeamName = fixture.teams.away.name;
        awayTeamLogo = fixture.teams.away.logo;
      }
  
      predictions.push({
        marketAddress: info.market,
        matchId,
        outcome: info.outcome,
        netShares,
        netCost,
        isResolved,
        resolvedOutcome,
        hasRedeemed,
        homeTeamName,
        homeTeamLogo,
        awayTeamName,
        awayTeamLogo
      });
    }
  
    return predictions;
  }
  