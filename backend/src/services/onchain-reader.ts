import { ethers } from 'ethers';
import { RPC_URL, MARKET_FACTORY_ADDRESS } from './rebalancer.config';

import MarketFactoryArtifact from '../artifacts/MarketFactory.json';
import ConditionalTokensArtifact from '../artifacts/ConditionalTokens.json';
import LmsrMarketMakerArtifact from '../artifacts/LMSRMarketMaker.json';

const FIXED_192x64_SCALING_FACTOR = 18446744073709551616n;

interface MarketDetails {
  lmsrAddress: string;
  conditionId: string;
  conditionalTokensAddress: string;
  usdcAddress: string;
}

export interface MarketState {
  lmsrAddress: string;
  usdcAddress: string;
  q: bigint[];
  b: bigint;
}

export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
}

function convert192x64ToDecimal(fixedVal: bigint): number {
  const scaledUp = fixedVal * 1000000n; 
  const divided = scaledUp / FIXED_192x64_SCALING_FACTOR;
  return Number(divided) / 1000000;
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const marketFactoryContract = new ethers.Contract(
  MARKET_FACTORY_ADDRESS!,
  MarketFactoryArtifact.abi,
  provider
);

export async function getActiveMatchIds(): Promise<number[]> {
  try {
    const activeMatchesAsBigInt: bigint[] = await marketFactoryContract.getActiveMatches();
    return activeMatchesAsBigInt.map(id => Number(id));
  } catch (error) {
    console.error("Error fetching active match IDs:", error);
    return [];
  }
}

async function getMarketDetails(matchId: number): Promise<MarketDetails | null> {
    try {
        const [lmsrAddress, conditionId, conditionalTokensAddress, usdcAddress] = await Promise.all([
        marketFactoryContract.lmsrMarketMakers(matchId),
        marketFactoryContract.matchConditionIds(matchId),
        marketFactoryContract.conditionalTokens(),
        marketFactoryContract.usdc(),
        ]);

        if (lmsrAddress === ethers.ZeroAddress) {
        console.warn(`No LMSR Market Maker found for matchId: ${matchId}`);
        return null;
        }
        return { lmsrAddress, conditionId, conditionalTokensAddress, usdcAddress };
    } catch (error) {
        console.error(`Error fetching details for market ${matchId}:`, error);
        return null;
    }
}

async function getPositionIds(details: MarketDetails): Promise<bigint[]> {
    const conditionalTokensContract = new ethers.Contract(
        details.conditionalTokensAddress,
        ConditionalTokensArtifact.abi,
        provider
    );
    const positionIds: bigint[] = [];
    for (let i = 0; i < 3; i++) {
        const indexSet = 1 << i;
        const collectionId = await conditionalTokensContract.getCollectionId(
            ethers.ZeroHash,
            details.conditionId,
            indexSet
        );
        const positionId = await conditionalTokensContract.getPositionId(
            details.usdcAddress,
            collectionId
        );
        positionIds.push(positionId);
    }
    return positionIds;
}

export async function getMarketState(matchId: number): Promise<MarketState | null> {
    const details = await getMarketDetails(matchId);
    if (!details) return null;

    const positionIds = await getPositionIds(details);
    if (positionIds.length !== 3) {
        console.error(`Failed to calculate position IDs for market ${matchId}`);
        return null;
    }

    const lmsrContract = new ethers.Contract(details.lmsrAddress, LmsrMarketMakerArtifact.abi, provider);
    const conditionalTokensContract = new ethers.Contract(details.conditionalTokensAddress, ConditionalTokensArtifact.abi, provider);

    try {
        const [q_home, q_draw, q_away, b] = await Promise.all([
        conditionalTokensContract.balanceOf(details.lmsrAddress, positionIds[0]),
        conditionalTokensContract.balanceOf(details.lmsrAddress, positionIds[1]),
        conditionalTokensContract.balanceOf(details.lmsrAddress, positionIds[2]),
        lmsrContract.funding(),
        ]);

        return {
        lmsrAddress: details.lmsrAddress,
        usdcAddress: details.usdcAddress,
        q: [q_home, q_draw, q_away],
        b: b,
        };
    } catch (error) {
        console.error(`Error fetching final market state for ${matchId}:`, error);
        return null;
    }
}

export async function getOnChainOdds(lmsrAddress: string): Promise<MarketOdds | null> {
    try {
        const lmsrContract = new ethers.Contract(lmsrAddress, LmsrMarketMakerArtifact.abi, provider);
        const [priceHome, priceDraw, priceAway] = await Promise.all([
            lmsrContract.calcMarginalPrice(0),
            lmsrContract.calcMarginalPrice(1),
            lmsrContract.calcMarginalPrice(2),
        ]);

        const probHome = convert192x64ToDecimal(priceHome);
        const probDraw = convert192x64ToDecimal(priceDraw);
        const probAway = convert192x64ToDecimal(priceAway);

        return {
            home: 1 / probHome,
            draw: 1 / probDraw,
            away: 1 / probAway,
        };
    } catch (error) {
        console.error(`Error fetching marginal prices from ${lmsrAddress}:`, error);
        return null;
    }
}