import { ethers } from 'ethers';
import {
    REBALANCER_PRIVATE_KEY,
    RPC_URL,
    POLLING_INTERVAL,
    DIVERGENCE_THRESHOLD,
    CONDITIONAL_TOKENS_ADDRESS,
    USDC_ADDRESS,
} from './rebalancer.config';

import PredictionMarketArtifact from '../artifacts/PredictionMarket.json';
import LMSRMarketMakerArtifact from '../artifacts/LMSRMarketMaker.json';
import ConditionalTokensArtifact from '../artifacts/ConditionalTokens.json';
import UsdcArtifact from '../artifacts/MockUSDC.json'; 

import { getActiveMatchIds, getMarketState, getOnChainOdds, MarketState } from './onchain-reader';
import { getMatchbookOdds, MarketOdds } from './matchbook.api';
import { findMatchbookId } from './id-mapper'; 
import { calculateOptimalTrade } from './trade-calculator';
import { executeTrade, TradeOrder } from './trade-executor';

function calculateDivergence(onChainOdds: MarketOdds, targetOdds: MarketOdds): number {
    const homeDiv = Math.abs(onChainOdds.home - targetOdds.home) / targetOdds.home;
    const drawDiv = Math.abs(onChainOdds.draw - targetOdds.draw) / targetOdds.draw;
    const awayDiv = Math.abs(onChainOdds.away - targetOdds.away) / targetOdds.away;
    return Math.max(homeDiv, drawDiv, awayDiv);
}

async function getPositionIds(
  conditionalTokens: ethers.Contract,
  conditionId: string
): Promise<[string, string, string]> {
    const outcomeIndexes = [0, 1, 2]; // Corresponds to Home, Draw, Away
    const positionIds: string[] = [];

    for (const outcomeIndex of outcomeIndexes) {
        const indexSet = 1 << outcomeIndex;
        const collectionId = await conditionalTokens.getCollectionId(
            ethers.ZeroHash,
            conditionId,
            indexSet
        );
        const positionId = await conditionalTokens.getPositionId(
            USDC_ADDRESS,
            collectionId
        );
        positionIds.push(positionId);
    }

    return positionIds as [string, string, string];
}


const rebalancerProvider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(REBALANCER_PRIVATE_KEY!, rebalancerProvider);

const conditionalTokens = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, ConditionalTokensArtifact.abi, signer);
const usdcContract = new ethers.Contract(USDC_ADDRESS, UsdcArtifact.abi, signer);

console.log(`Rebalancer service initialized. Using wallet: ${signer.address}`);

async function rebalanceAllMarkets() {
    console.log(`[${new Date().toISOString()}] Starting new rebalancing cycle...`);
    try {
        const activeMatchIds = await getActiveMatchIds();
        console.log(`Found ${activeMatchIds.length} active markets to check.`);
        if (activeMatchIds.length === 0) return;

        for (const matchId of activeMatchIds) {
            try {
                console.log(`--- Processing market (API-Football ID: ${matchId}) ---`);

                const marketState = await getMarketState(matchId);
                if (!marketState || !marketState.conditionId || !marketState.predictionMarketAddress) {
                    console.log(`Skipping market ${matchId}: Could not fetch complete on-chain state.`);
                    continue;
                }

                const mappingResult = await findMatchbookId(matchId);
                if (!mappingResult) {
                    console.log(`Skipping market ${matchId}: Could not map to a Matchbook event.`);
                    continue;
                }
                
                const { matchbookEventId, homeTeamName, awayTeamName } = mappingResult;
                
                const [onChainOdds, targetOdds] = await Promise.all([
                    getOnChainOdds(marketState.predictionMarketAddress),
                    getMatchbookOdds(matchbookEventId, homeTeamName, awayTeamName),
                ]);

                if (!onChainOdds || !targetOdds) {
                    console.log(`Skipping market ${matchId}: Missing on-chain or external odds.`);
                    continue;
                }

                const divergence = calculateDivergence(onChainOdds, targetOdds);
                console.log(`Market ${matchId} | On-Chain Odds: H:${onChainOdds.home.toFixed(2)} D:${onChainOdds.draw.toFixed(2)} A:${onChainOdds.away.toFixed(2)} | Target Odds: H:${targetOdds.home.toFixed(2)} D:${targetOdds.draw.toFixed(2)} A:${targetOdds.away.toFixed(2)}`);

                if (divergence < DIVERGENCE_THRESHOLD) {
                    console.log(`Market ${matchId} is balanced. Divergence: ${(divergence * 100).toFixed(2)}%`);
                    continue;
                }

                console.log(`Divergence of ${(divergence * 100).toFixed(2)}% detected for market ${matchId}. Analyzing trade...`);

                const predictionMarketContract = new ethers.Contract(marketState.predictionMarketAddress, PredictionMarketArtifact.abi, signer);
                const marketMakerAddress = await predictionMarketContract.marketMaker();
                const marketMakerContract = new ethers.Contract(marketMakerAddress, LMSRMarketMakerArtifact.abi, signer);

                const positionIds = await getPositionIds(conditionalTokens, marketState.conditionId);
                const botOutcomeTokenBalances = (await Promise.all(
                    positionIds.map(id => conditionalTokens.balanceOf(signer.address, id))
                )) as [bigint, bigint, bigint];
                const botUsdcBalance = await usdcContract.balanceOf(signer.address);

                console.log(`Bot balances: H: ${ethers.formatUnits(botOutcomeTokenBalances[0], 6)}, D: ${ethers.formatUnits(botOutcomeTokenBalances[1], 6)}, A: ${ethers.formatUnits(botOutcomeTokenBalances[2], 6)}, USDC: ${ethers.formatUnits(botUsdcBalance, 6)}`);

                const optimalTrade = await calculateOptimalTrade(
                    marketState,
                    targetOdds,
                    botOutcomeTokenBalances,
                    botUsdcBalance,
                    marketMakerContract
                );
                
                if (!optimalTrade.hasProfitableTrade || !optimalTrade.tradeAmounts) {
                    console.log(`No profitable rebalancing trade found for market ${matchId}.`);
                    continue;
                }
                
                const tradeOrder: TradeOrder = {
                    predictionMarketAddress: marketState.predictionMarketAddress,
                    tradeAmounts: optimalTrade.tradeAmounts
                };

                console.log(`Optimal trade found for ${matchId}:`, tradeOrder.tradeAmounts.map(a => Number(a) / 1e6));
                await executeTrade(tradeOrder);
                console.log(`✅ Successfully submitted rebalancing transaction for market ${matchId}.`);

            } catch (marketError) {
                console.error(`Error processing market ${matchId}:`, marketError);
            }
        }
    } catch (error) {
        console.error('A critical error occurred in the main rebalancing cycle:', error);
    } finally {
        console.log('--- Rebalancing cycle finished. ---');
    }
}

export function startRebalancerPolling() {
    console.log(`Starting Market Rebalancer Polling. Interval set to ${POLLING_INTERVAL / 1000} seconds.`);
    rebalanceAllMarkets();
    setInterval(rebalanceAllMarkets, POLLING_INTERVAL);
}