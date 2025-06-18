import { ethers } from 'ethers';
import { REBALANCER_PRIVATE_KEY, RPC_URL, GAS_LIMIT } from './rebalancer.config';

import PredictionMarketArtifact from '../artifacts/PredictionMarket.json';
import ConditionalTokensArtifact from '../artifacts/ConditionalTokens.json';

export interface TradeOrder {
  predictionMarketAddress: string;
  tradeAmounts: bigint[];
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(REBALANCER_PRIVATE_KEY!, provider);

const approvalCache: { [tokenAddress: string]: boolean } = {};

async function ensureTokenApproval(predictionMarketAddress: string, conditionalTokensAddress: string): Promise<void> {
    if (approvalCache[conditionalTokensAddress]) {
        console.log(`Approval for ${conditionalTokensAddress} already confirmed.`);
        return;
    }

    const conditionalTokensContract = new ethers.Contract(
        conditionalTokensAddress,
        ConditionalTokensArtifact.abi,
        signer
    );

    console.log(`Checking token approval for operator: ${predictionMarketAddress}`);
    const isApproved = await conditionalTokensContract.isApprovedForAll(signer.address, predictionMarketAddress);

    if (isApproved) {
        console.log(`Approval already set for operator ${predictionMarketAddress}. Caching result.`);
        approvalCache[conditionalTokensAddress] = true;
        return;
    }

    console.log(`Approval not set. Submitting setApprovalForAll transaction...`);
    try {
        const tx = await conditionalTokensContract.setApprovalForAll(predictionMarketAddress, true, {
            gasLimit: GAS_LIMIT || 100000, 
        });
        console.log(`Approval transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Approval transaction confirmed for operator ${predictionMarketAddress}.`);
        approvalCache[conditionalTokensAddress] = true;
    } catch (error) {
        console.error(`❌ Failed to set token approval for ${predictionMarketAddress}:`, error);
        throw new Error('Token approval failed, cannot proceed with sell trade.');
    }
}

export async function executeTrade(order: TradeOrder): Promise<void> {
  if (!order.tradeAmounts || order.tradeAmounts.every(amount => amount === 0n)) {
    console.log("No trade amounts provided. Skipping execution.");
    return;
  }

  const predictionMarketContract = new ethers.Contract(
    order.predictionMarketAddress,
    PredictionMarketArtifact.abi,
    signer
  );

  const hasSellOrder = order.tradeAmounts.some(amount => amount < 0n);

  if (hasSellOrder) {
      try {
          const conditionalTokensAddress = await predictionMarketContract.conditionalTokens();
          await ensureTokenApproval(order.predictionMarketAddress, conditionalTokensAddress);
      } catch (approvalError) {
          console.error('Halting trade execution due to approval error:', approvalError);
          return;
      }
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