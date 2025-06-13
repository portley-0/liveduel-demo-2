import { ethers } from 'ethers';
import { RPC_URL, REBALANCER_PRIVATE_KEY } from './rebalancer.config';
import LmsrMarketMakerArtifact from '../artifacts/LMSRMarketMaker.json';
import UsdcArtifact from '../artifacts/MockUSDC.json';

export interface TradeOrder {
  lmsrAddress: string;
  usdcAddress: string;
  tradeAmounts: [number, number, number];
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(REBALANCER_PRIVATE_KEY!, provider);

/**
 * Executes a calculated rebalancing trade on the blockchain.
 * @param order An object containing all necessary details for the trade.
 */
export async function executeTrade(order: TradeOrder): Promise<void> {
  const { lmsrAddress, usdcAddress, tradeAmounts } = order;

  console.log(`EXECUTOR: Preparing to execute trade on LMSR ${lmsrAddress}`);

  // Create contract instances needed for execution
  const lmsrContract = new ethers.Contract(lmsrAddress, LmsrMarketMakerArtifact.abi, signer);
  const usdcContract = new ethers.Contract(usdcAddress, UsdcArtifact.abi, signer);

  try {
    // 1. GET FINAL ON-CHAIN COST
    // We call this right before trading to get the most accurate, up-to-date cost
    // and to protect against front-running or price slippage.
    console.log(`EXECUTOR: Calculating final net cost for trade: [${tradeAmounts.join(', ')}]`);
    const netCost = await lmsrContract.calcNetCost(tradeAmounts);
    console.log(`EXECUTOR: Calculated on-chain net cost: ${ethers.formatUnits(netCost, 6)} USDC`);

    // 2. APPROVE SPEND (if necessary)
    // If the netCost is positive, our wallet needs to pay USDC.
    // We must first approve the LMSR contract to pull that amount from our wallet.
    if (netCost > 0) {
      console.log(`EXECUTOR: Net cost is positive. Approving USDC spend...`);
      const approveTx = await usdcContract.approve(lmsrAddress, netCost);
      await approveTx.wait(); // Wait for the approval to be mined
      console.log(`EXECUTOR: USDC approval successful. TxHash: ${approveTx.hash}`);
    } else {
        console.log(`EXECUTOR: Net cost is zero or negative. No approval needed.`);
    }

    // 3. EXECUTE THE TRADE
    console.log(`EXECUTOR: Submitting trade to LMSR contract...`);
    const tradeTx = await lmsrContract.trade(
        tradeAmounts,
        netCost // Use the exact netCost as the collateral limit for safety
    );

    console.log(`EXECUTOR: Trade transaction sent. Waiting for confirmation... TxHash: ${tradeTx.hash}`);
    const receipt = await tradeTx.wait();
    console.log(`✅ EXECUTOR: Trade confirmed! Block: ${receipt.blockNumber}, Gas Used: ${receipt.gasUsed.toString()}`);

  } catch (error) {
    if (error instanceof Error) {
        // More specific error logging
        const ethersError = error as any;
        if (ethersError.reason) {
            console.error(`EXECUTOR: Trade execution failed with reason: "${ethersError.reason}"`);
        } else {
            console.error(`EXECUTOR: An error occurred during trade execution:`, error.message);
        }
    } else {
        console.error("EXECUTOR: An unknown error occurred during trade execution:", error);
    }
    // Re-throw the error so the main loop can know it failed.
    throw error;
  }
}