import { ethers } from 'ethers';
import { RPC_URL, REBALANCER_PRIVATE_KEY } from './rebalancer.config';
import ConditionalTokensArtifact from '../artifacts/ConditionalTokens.json';
import UsdcArtifact from '../artifacts/MockUSDC.json';
import MarketFactoryArtifact from '../artifacts/MarketFactory.json';

const CONDITIONAL_TOKENS_ADDRESS = '0xfd16C758285877B88F2C30B66686dc8515EaE1CA'; 
const MARKET_FACTORY_ADDRESS = '0x16c6de1080DFF475F7F248D63db60eB93563DD8F'; 
const USDC_ADDRESS = '0x78FD2A3454A4F37C5518FE7E8AB07001DC0572Ce'; 

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(REBALANCER_PRIVATE_KEY!, provider);

const conditionalTokens = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, ConditionalTokensArtifact.abi, signer);
const usdcContract = new ethers.Contract(USDC_ADDRESS, UsdcArtifact.abi, signer);
const factoryContract = new ethers.Contract(MARKET_FACTORY_ADDRESS, MarketFactoryArtifact.abi, provider);


/**
 * Mints complete sets of outcome tokens for a given market by splitting collateral.
 * This is the primary method for "stocking the shelves" so the bot has inventory to trade.
 * @param conditionId The unique identifier for the market's condition.
 * @param usdcAmount The human-readable amount of USDC to use for minting (e.g., 15000).
 */
export async function bootstrapInventory(conditionId: string, usdcAmount: number): Promise<void> {
    console.log(`PORTFOLIO MANAGER: Bootstrapping inventory for condition ${conditionId} with ${usdcAmount} USDC.`);

    try {
        // 1. Scale the USDC amount by its 6 decimals to get the on-chain integer value.
        const amountToMint = ethers.parseUnits(usdcAmount.toString(), 6);
        console.log(`On-chain amount to mint: ${amountToMint.toString()}`);

        // 2. The bot must approve the ConditionalTokens contract to spend its USDC.
        console.log(`Approving ConditionalTokens contract to spend ${usdcAmount} USDC...`);
        const approveTx = await usdcContract.approve(CONDITIONAL_TOKENS_ADDRESS, amountToMint);
        await approveTx.wait();
        console.log(`USDC approval successful. TxHash: ${approveTx.hash}`);

        // 3. Define the parameters for splitting the position.
        // For a simple market, the parent collection is the collateral token itself.
        const parentCollectionId = ethers.ZeroHash;
        // The partition [1, 2, 4] corresponds to the three outcomes [Home, Draw, Away].
        const partition = [1, 2, 4]; 

        // 4. Call splitPosition to convert USDC into a complete set of outcome tokens.
        console.log(`Executing splitPosition to mint outcome tokens...`);
        const splitTx = await conditionalTokens.splitPosition(
            USDC_ADDRESS,
            parentCollectionId,
            conditionId,
            partition,
            amountToMint
        );
        await splitTx.wait();
        console.log(`✅ BOOTSTRAP SUCCESS: Inventory acquired for condition ${conditionId}. TxHash: ${splitTx.hash}`);

    } catch (error) {
        console.error(`PORTFOLIO MANAGER: Failed to bootstrap inventory for condition ${conditionId}:`, error);
        throw error; 
    }
}

/**
 * Unwinds the bot's position in a resolved market to reclaim the underlying USDC collateral.
 * @param marketId The API-Football ID for the market, used to find the on-chain identifiers.
 */
export async function unwindPositions(marketId: number): Promise<void> {
  console.log(`PORTFOLIO MANAGER: Starting unwind process for resolved market ${marketId}.`);

  try {
    const conditionId: string = await factoryContract.matchConditionIds(marketId);
    if (!conditionId || conditionId === ethers.ZeroHash) {
      throw new Error(`Could not find conditionId for market ${marketId}.`);
    }

    // Check if condition is resolved by looking at payoutDenominator
    const payoutDenominator: bigint = await conditionalTokens.payoutDenominator(conditionId);
    if (payoutDenominator === 0n) {
      console.log(`Cannot unwind yet: condition ${conditionId} is not resolved (denominator is zero).`);
      return;
    }

    // Fetch payout numerators
    const payoutNumerators: bigint[] = await conditionalTokens.payoutNumerators(conditionId);
    console.log(`Oracle reported payout numerators: [${payoutNumerators.map(n => n.toString()).join(', ')}], denominator: ${payoutDenominator.toString()}`);

    // Build indexSets: one per non-zero payout numerator (each outcome that has weight)
    const indexSets: number[] = [];
    for (let j = 0; j < payoutNumerators.length; j++) {
      if (payoutNumerators[j] !== 0n) {
        indexSets.push(1 << j); // e.g., outcome slot j => bitmask with that bit set
      }
    }
    if (indexSets.length === 0) {
      console.log(`No winning outcomes found for condition ${conditionId}; nothing to redeem.`);
      return;
    }

    console.log(`Executing redeemPositions for condition ${conditionId} with indexSets [${indexSets.join(', ')}]...`);
    const redeemTx = await conditionalTokens.redeemPositions(
      USDC_ADDRESS,
      ethers.ZeroHash,
      conditionId,
      indexSets,
      { gasLimit: 300_000 }
    );
    const receipt = await redeemTx.wait();
    console.log(`✅ UNWIND SUCCESS: Capital reclaimed for market ${marketId}. TxHash: ${receipt.transactionHash}`);
  } catch (error) {
    console.error(`PORTFOLIO MANAGER: Failed to unwind positions for market ${marketId}:`, error);
    throw error;
  }
}

/**
 * Given a list of active matchIds and the expected bootstrap amount per market,
 * ensure each has outcome tokens; if not, try to bootstrap it.
 */
export async function reconcileMissingBootstraps(
  matchIds: number[],
  expectedUsdcPerMarket: number
): Promise<void> {
  for (const matchId of matchIds) {
    try {
      const conditionId: string = await factoryContract.matchConditionIds(matchId);
      if (!conditionId || conditionId === ethers.ZeroHash) {
        console.warn(`Reconcile: no conditionId for match ${matchId}, skipping.`);
        continue;
      }

      // How many outcomes this condition has
      const outcomeSlotCountBig: bigint = await conditionalTokens.getOutcomeSlotCount(conditionId);
      const nOutcomes = Number(outcomeSlotCountBig);
      if (nOutcomes < 2) {
        console.warn(`Reconcile: invalid outcome count (${nOutcomes}) for condition ${conditionId}`);
        continue;
      }

      // Build partition / outcome slots
      const outcomeSlots = Array.from({ length: nOutcomes }, (_, i) => 1 << i); // [1,2,4,...]


      // Check current inventory: does the bot hold at least some of each outcome token?
      const walletAddress = await signer.getAddress();
      let missing = false;
      for (const slot of outcomeSlots) {
        const collectionId = await conditionalTokens.getCollectionId(ethers.ZeroHash, conditionId, slot);
        const positionId = await conditionalTokens.getPositionId(USDC_ADDRESS, collectionId);
        const balance: bigint = await conditionalTokens.balanceOf(walletAddress, positionId);
        if (balance === 0n) {
          console.log(`Reconcile: missing token for slot ${slot} on condition ${conditionId}`);
          missing = true;
        }
      }

      if (!missing) {
        console.log(`Reconcile: inventory already present for match ${matchId} (condition ${conditionId}).`);
        continue;
      }

      // Attempt bootstrap with fallback chunking
      console.log(`Reconcile: bootstrapping missing inventory for match ${matchId}, condition ${conditionId}`);
      try {
        await bootstrapInventory(conditionId, expectedUsdcPerMarket);
      } catch (primaryErr) {
        console.warn(`Reconcile: primary bootstrap failed for match ${matchId}, trying smaller chunk.`, primaryErr);
        // fallback to half
        await bootstrapInventory(conditionId, Math.floor(expectedUsdcPerMarket / 2));
      }

    } catch (err) {
      console.error(`Reconcile: error handling match ${matchId}:`, err);
    }
  }
}
