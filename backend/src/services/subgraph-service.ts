import { request, gql } from 'graphql-request';
const fetch = require('node-fetch');

globalThis.fetch = fetch;
globalThis.Headers = fetch.Headers;

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

export async function getTournamentOddsById(tournamentId: number): Promise<TournamentOddsUpdatedEntity[]> {
  const query = gql`
    query GetTournamentOdds($tournamentId: BigInt!) {
      tournamentOddsUpdateds(
        where: { market_: { tournamentId: $tournamentId } }
        orderBy: timestamp
        orderDirection: asc
      ) {
        id
        market
        prices
        timestamp
      }
    }
  `;

  const variables = { tournamentId: tournamentId.toString() };
  const data = await request<{ tournamentOddsUpdateds: TournamentOddsUpdatedEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );
  return data.tournamentOddsUpdateds;
}

export async function getTournamentMarketByTournamentId(tournamentId: number): Promise<TournamentMarketEntity | null> {
  const query = gql`
    query GetTournamentMarket($tournamentId: BigInt!) {
      tournamentMarkets(where: { tournamentId: $tournamentId }, first: 1) {
        id
        tournamentId
        totalTeams
        isResolved
        resolvedOutcome
        teamIds
      }
    }
  `;

  const variables = { tournamentId: tournamentId.toString() };
  const data = await request<{ tournamentMarkets: TournamentMarketEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );

  if (data.tournamentMarkets.length === 0) {
    return null;
  }
  return { ...data.tournamentMarkets[0], id: data.tournamentMarkets[0].id.toLowerCase() };
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

export async function getTournamentMarketByAddress(
  marketAddress: string
): Promise<TournamentMarketEntity | null> {
  const query = gql`
    query TournamentMarketByAddress($market: Bytes!) {
      tournamentMarkets(where: { id: $market }) {
        id
        tournamentId
        totalTeams
        isResolved
        resolvedOutcome
        teamIds
      }
    }
  `;

  const variables = { market: marketAddress.toLowerCase() };
  try {
    const data = await request<{ tournamentMarkets: TournamentMarketEntity[] }>(
      SUBGRAPH_URL,
      query,
      variables
    );
    if (!data.tournamentMarkets || data.tournamentMarkets.length === 0) {
      return null;
    }
    return { ...data.tournamentMarkets[0], id: data.tournamentMarkets[0].id.toLowerCase() };
  } catch (error) {
    console.error(`[SubgraphService] Error fetching tournament market for address ${marketAddress}:`, error);
    return null;
  }
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

export async function getTournamentSharesPurchasedByMarket(marketAddress: string): Promise<TournamentSharesPurchasedEntity[]> {
  const query = gql`
    query GetTournamentSharesPurchased($market: Bytes!) {
      tournamentSharesPurchaseds(where: { market: $market }) {
        id
        market
        buyer
        outcome
        shares
        cost
        timestamp
      }
    }
  `;

  const variables = { market: marketAddress.toLowerCase() };
  const data = await request<{ tournamentSharesPurchaseds: TournamentSharesPurchasedEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );
  return data.tournamentSharesPurchaseds;
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

export async function getTournamentSharesSoldByMarket(marketAddress: string): Promise<TournamentSharesSoldEntity[]> {
  const query = gql`
    query GetTournamentSharesSold($market: Bytes!) {
      tournamentSharesSolds(where: { market: $market }) {
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

  const variables = { market: marketAddress.toLowerCase() };
  const data = await request<{ tournamentSharesSolds: TournamentSharesSoldEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );
  return data.tournamentSharesSolds;
}

export async function getTournamentFixtures(tournamentId: number): Promise<TournamentFixtureEntity[]> {
  const query = gql`
    query GetTournamentFixtures($tournamentId: BigInt!) {
      tournamentFixtures(where: { tournamentId: $tournamentId }) {
        id
        tournamentId
        matchId
        isRoundFinal
        isTournamentFinal
        resolved
      }
    }
  `;

  const variables = { tournamentId: tournamentId.toString() };
  const data = await request<{ tournamentFixtures: TournamentFixtureEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );
  return data.tournamentFixtures;
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

export async function getAllTournamentPurchasesForUser(userAddress: string): Promise<TournamentSharesPurchasedEntity[]> {
  const query = gql`
    query AllTournamentPurchasesForUser($buyer: Bytes!) {
      tournamentSharesPurchaseds(
        where: { buyer: $buyer }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        market
        buyer
        outcome
        shares
        cost
        timestamp
      }
    }
  `;

  const variables = { buyer: userAddress.toLowerCase() };
  const data = await request<{ tournamentSharesPurchaseds: TournamentSharesPurchasedEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );

  return data.tournamentSharesPurchaseds;
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

export async function getAllTournamentSalesForUser(userAddress: string): Promise<TournamentSharesSoldEntity[]> {
  const query = gql`
    query AllTournamentSalesForUser($seller: Bytes!) {
      tournamentSharesSolds(
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
  const data = await request<{ tournamentSharesSolds: TournamentSharesSoldEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );

  return data.tournamentSharesSolds;
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

export async function getAllTournamentRedeemedForUser(userAddress: string): Promise<TournamentPayoutRedeemedEntity[]> {
  const query = gql`
    query AllTournamentRedeemedForUser($redeemer: Bytes!) {
      tournamentPayoutRedeemeds(
        where: { redeemer: $redeemer }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        market
        tournamentId
        redeemer
        outcome
        amount
        timestamp
      }
    }
  `;

  const variables = { redeemer: userAddress.toLowerCase() };
  const data = await request<{ tournamentPayoutRedeemeds: TournamentPayoutRedeemedEntity[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );

  return data.tournamentPayoutRedeemeds;
}

export async function getAllActiveTournaments(): Promise<TournamentMarketEntity[]> {
  const query = gql`
    query GetAllActiveTournaments {
      tournamentMarkets(where: { isResolved: false }) {
        id
        tournamentId
        totalTeams
        isResolved
        resolvedOutcome
        teamIds
      }
    }
  `;

  const data = await request<{ tournamentMarkets: TournamentMarketEntity[] }>(
    SUBGRAPH_URL,
    query
  );

  return data.tournamentMarkets.map(market => ({
    ...market,
    id: market.id.toLowerCase()
  }));
}

export async function getTeamIdsByTournamentId(tournamentId: number): Promise<string[]> {
  const query = gql`
    query GetTournamentMarket($tournamentId: BigInt!) {
      tournamentMarkets(where: { tournamentId: $tournamentId }, first: 1) {
        teamIds
      }
    }
  `;
  const variables = { tournamentId: tournamentId.toString() };
  const data = await request<{ tournamentMarkets: { teamIds: string[] }[] }>(
    SUBGRAPH_URL,
    query,
    variables
  );
  return data.tournamentMarkets[0]?.teamIds || [];
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

export interface TournamentMarketEntity {
  id: string;
  tournamentId: string;
  totalTeams: number;
  isResolved: boolean;
  resolvedOutcome?: number | null;
  teamIds: string[];
}

export interface TournamentSharesPurchasedEntity {
  id: string;
  market: string;
  buyer: string;
  outcome: number;
  shares: string;
  cost: string;
  timestamp: string;
}

export interface TournamentSharesSoldEntity {
  id: string;
  market: string;
  seller: string;
  outcome: number;
  shares: string;
  actualGain: string;
  timestamp: string;
}

export interface TournamentOddsUpdatedEntity {
  id: string;
  market: string;
  prices: string[];
  timestamp: string;
}

export interface TournamentPayoutRedeemedEntity {
  id: string;
  market: string;
  tournamentId: string;
  redeemer: string;
  outcome: number;
  amount: string;
  timestamp: string;
}

export interface TournamentFixtureEntity {
  id: string;
  tournamentId: string;
  matchId: string;
  isRoundFinal: boolean;
  isTournamentFinal: boolean;
  resolved: boolean;
}
