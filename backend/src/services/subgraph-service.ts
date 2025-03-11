import { request, gql } from 'graphql-request';

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || '';

export async function getOddsUpdatesByMatchId(matchId: number): Promise<OddsUpdatedEntity[]> {
  const query = gql`
    query OddsUpdates($matchId: BigInt!) {
      oddsUpdateds(
        where: { matchId: $matchId }
        orderBy: timestamp
        orderDirection: asc
      ) {
        id
        market
        matchId
        home
        draw
        away
        timestamp
      }
    }
  `;

  const variables = { matchId: matchId.toString() };
  const data = await request<{ oddsUpdateds: OddsUpdatedEntity[] }>(SUBGRAPH_URL, query, variables);
  return data.oddsUpdateds;
}

export async function getPredictionMarketByMatchId(
  matchId: number
): Promise<PredictionMarketEntity | null> {
  const query = gql`
    query PredictionMarketByMatchId($matchId: BigInt!) {
      predictionMarkets(where: { matchId: $matchId }) {
        id
        matchId
        matchTimestamp
        isResolved
        resolvedOutcome
      }
    }
  `;
  const variables = { matchId: matchId.toString() };
  const data = await request<{ predictionMarkets: PredictionMarketEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );
  if (data.predictionMarkets.length === 0) {
    return null;
  }
  return data.predictionMarkets[0];
}

export async function getPredictionMarketByAddress(
  marketAddress: string
): Promise<PredictionMarketEntity | null> {
  const query = gql`
    query PredictionMarketByAddress($market: Bytes!) {
      predictionMarkets(where: { id: $market }) {
        id
        matchId
        matchTimestamp
        isResolved
        resolvedOutcome
      }
    }
  `;

  const variables = { market: marketAddress.toLowerCase() };
  const data = await request<{ predictionMarkets: PredictionMarketEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );

  if (!data.predictionMarkets || data.predictionMarkets.length === 0) {
    return null;
  }
  return data.predictionMarkets[0];
}

export async function getSharesPurchasedByMarket(marketAddress: string): Promise<SharesPurchasedEntity[]> {
  const query = gql`
    query SharesPurchasedByMarket($market: Bytes!) {
      sharesPurchaseds(where: { market: $market }) {
        id
        market
        buyer
        outcome
        shares
        actualCost
        timestamp
      }
    }
  `;
  const data = await request<{ sharesPurchaseds: SharesPurchasedEntity[] }>(
    SUBGRAPH_URL,
    query,
    { market: marketAddress.toLowerCase() }
  );
  return data.sharesPurchaseds;
}

export async function getSharesSoldByMarket(marketAddress: string): Promise<SharesSoldEntity[]> {
  const query = gql`
    query SharesSoldByMarket($market: Bytes!) {
      sharesSolds(where: { market: $market }) {
        id
        market
        seller
        outcome
        shares
        actualGain
        timestamp
      }
    }
  `;
  const data = await request<{ sharesSolds: SharesSoldEntity[] }>(
    SUBGRAPH_URL,
    query,
    { market: marketAddress.toLowerCase() }
  );
  return data.sharesSolds;
}

export async function getAllPurchasesForUser(userAddress: string): Promise<SharesPurchasedEntity[]> {
  const query = gql`
    query AllPurchasesForUser($buyer: Bytes!) {
      sharesPurchaseds(
        where: { buyer: $buyer }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        market
        buyer
        outcome
        shares
        actualCost
        timestamp
      }
    }
  `;

  const variables = { buyer: userAddress.toLowerCase() };
  const data = await request<{ sharesPurchaseds: SharesPurchasedEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );

  return data.sharesPurchaseds;
}

export async function getAllSalesForUser(userAddress: string): Promise<SharesSoldEntity[]> {
  const query = gql`
    query AllSalesForUser($seller: Bytes!) {
      sharesSolds(
        where: { seller: $seller }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        market
        seller
        outcome
        shares
        actualGain
        timestamp
      }
    }
  `;

  const variables = { seller: userAddress.toLowerCase() };
  const data = await request<{ sharesSolds: SharesSoldEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );

  return data.sharesSolds;
}

export async function getAllRedeemedForUser(userAddress: string): Promise<PayoutRedeemedEntity[]> {
  const query = gql`
    query AllRedeemedForUser($redeemer: Bytes!) {
      payoutRedeemeds(
        where: { redeemer: $redeemer }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        market
        redeemer
        outcome
        amount
        timestamp
      }
    }
  `;

  const variables = { redeemer: userAddress.toLowerCase() };
  const data = await request<{ payoutRedeemeds: PayoutRedeemedEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );

  return data.payoutRedeemeds;
}

export interface PredictionMarketEntity {
  id: string;            
  matchId: string;       
  matchTimestamp: string; 
  isResolved: boolean;
  resolvedOutcome?: number | null;
}

export interface SharesPurchasedEntity {
  id: string;
  market: string;
  buyer: string;
  outcome: number;
  shares: string;       
  actualCost: string;   
  timestamp: string;    
}

export interface SharesSoldEntity {
  id: string;
  market: string;
  seller: string;
  outcome: number;
  shares: string;
  actualGain: string;
  timestamp: string;
}

export interface OddsUpdatedEntity {
  id: string;
  market: string;
  matchId: string;
  home: string;
  draw: string;
  away: string;
  timestamp: string;
}

export interface PayoutRedeemedEntity {
  id: string;
  market: string;
  redeemer: string;
  outcome: number;
  amount: string;
  timestamp: string;
}
