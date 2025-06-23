import { ethers } from 'ethers';
import { REBALANCER_PRIVATE_KEY, RPC_URL, GAS_LIMIT, USDC_ADDRESS } from './rebalancer.config';
import PredictionMarketArtifact from '../artifacts/PredictionMarket.json';
import ConditionalTokensArtifact from '../artifacts/ConditionalTokens.json';
import UsdcArtifact from '../artifacts/MockUSDC.json'; 

export interface TradeOrder {
    predictionMarketAddress: string;
    tradeAmounts: bigint[];
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(REBALANCER_PRIVATE_KEY!, provider);

const approvalCache: { [key: string]: boolean } = {};

async function ensureConditionalTokenApproval(predictionMarketAddress: string, conditionalTokensAddress: string): Promise<void> {
    const cacheKey = `conditionalTokens:${conditionalTokensAddress}`;
    if (approvalCache[cacheKey]) {
        return;
    }

    const conditionalTokensContract = new ethers.Contract(conditionalTokensAddress, ConditionalTokensArtifact.abi, signer);

    console.log(`Checking Conditional Token approval for operator: ${predictionMarketAddress}`);
    const isApproved = await conditionalTokensContract.isApprovedForAll(signer.address, predictionMarketAddress);

    if (isApproved) {
        console.log(`Approval already set for operator ${predictionMarketAddress}.`);
        approvalCache[cacheKey] = true;
        return;
    }

    console.log(`Approval not set. Submitting setApprovalForAll transaction...`);
    try {
        const tx = await conditionalTokensContract.setApprovalForAll(predictionMarketAddress, true, {
            gasLimit: GAS_LIMIT || 100000,
        });
        console.log(`Approval transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Conditional Token approval confirmed for operator ${predictionMarketAddress}.`);
        approvalCache[cacheKey] = true;
    } catch (error) {
        console.error(`❌ Failed to set Conditional Token approval for ${predictionMarketAddress}:`, error);
        throw new Error('Conditional Token approval failed, cannot proceed with sell trade.');
    }
}

async function ensureUsdcApproval(predictionMarketAddress: string): Promise<void> {
    const cacheKey = `usdc:${USDC_ADDRESS}`;
    if (approvalCache[cacheKey]) {
        return;
    }
    
    const usdcContract = new ethers.Contract(USDC_ADDRESS, UsdcArtifact.abi, signer);
    
    console.log(`Checking USDC allowance for spender: ${predictionMarketAddress}`);
    const allowance = await usdcContract.allowance(signer.address, predictionMarketAddress);

    if (allowance >= ethers.parseUnits('1000000', 6)) { // Check for a reasonably large allowance
        console.log(`USDC allowance is sufficient. Caching result.`);
        approvalCache[cacheKey] = true;
        return;
    }

    console.log(`USDC allowance is insufficient. Submitting approve transaction...`);
    try {
        const tx = await usdcContract.approve(predictionMarketAddress, ethers.MaxUint256, { // Approve max amount
            gasLimit: GAS_LIMIT || 100000,
        });
        console.log(`USDC approval transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ USDC approval confirmed for spender ${predictionMarketAddress}.`);
        approvalCache[cacheKey] = true;
    } catch (error) {
        console.error(`❌ Failed to set USDC approval for ${predictionMarketAddress}:`, error);
        throw new Error('USDC approval failed, cannot proceed with buy trade.');
    }
}

export async function executeTrade(order: TradeOrder): Promise<void> {
    if (!order.tradeAmounts || order.tradeAmounts.every(amount => amount === 0n)) {
        console.log("No trade amounts provided. Skipping execution.");
        return;
    }

    const predictionMarketContract = new ethers.Contract(order.predictionMarketAddress, PredictionMarketArtifact.abi, signer);

    const hasSellOrder = order.tradeAmounts.some(amount => amount < 0n);
    const hasBuyOrder = order.tradeAmounts.some(amount => amount > 0n);

    try {
        if (hasSellOrder) {
            const conditionalTokensAddress = await predictionMarketContract.conditionalTokens();
            await ensureConditionalTokenApproval(order.predictionMarketAddress, conditionalTokensAddress);
        }

        if (hasBuyOrder) {
            await ensureUsdcApproval(order.predictionMarketAddress);
        }
    } catch (approvalError) {
        console.error('Halting trade execution due to approval error:', approvalError);
        return;
    }

    try {
        console.log(`Executing trade on market ${order.predictionMarketAddress} with amounts: [${order.tradeAmounts.join(', ')}]`);
        
        const tx = await predictionMarketContract.trade(order.tradeAmounts, 0, {
            gasLimit: GAS_LIMIT || 500000, 
        });

        console.log(`Trade transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Trade transaction confirmed. Gas used: ${receipt.gasUsed.toString()}`);

    } catch (error) {
        console.error(`❌ Failed to execute trade on market ${order.predictionMarketAddress}:`, error);
        throw error;
    }
}