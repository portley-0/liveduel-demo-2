import { ethers } from 'ethers';
import { RPC_URL, REBALANCER_PRIVATE_KEY } from './rebalancer.config';
import ConditionalTokensArtifact from '../artifacts/ConditionalTokens.json';
import UsdcArtifact from '../artifacts/MockUSDC.json';
import MarketFactoryArtifact from '../artifacts/MarketFactory.json';

const CONDITIONAL_TOKENS_ADDRESS = '0xb12038A8BA89c51fa3fc2b4215ce0b3483f63f5C'; 
const MARKET_FACTORY_ADDRESS = '0x222b0e8D3E29d639189BA84DB2c0C7b48Ed87f1D'; 
const USDC_ADDRESS = '0x1A85e9870Dd44A8167b626981b1aBDc87cAAD4E5'; 

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
        const conditionId = await factoryContract.getConditionId(marketId);
        if (!conditionId || conditionId === ethers.ZeroHash) {
            throw new Error(`Could not find conditionId for market ${marketId}.`);
        }

        const payoutNumerators = await conditionalTokens.payoutNumerators(conditionId);
        if (payoutNumerators.length === 0) {
            console.log(`Cannot unwind yet: Oracle has not reported the outcome for condition ${conditionId}.`);
            return; 
        }
        console.log(`Oracle has reported outcomes: [${payoutNumerators.join(', ')}]. Proceeding with redemption.`);

        const outcomeSlots = [1, 2, 4];

        console.log(`Executing redeemPositions for condition ${conditionId}...`);
        const redeemTx = await conditionalTokens.redeemPositions(
            USDC_ADDRESS,
            ethers.ZeroHash, 
            conditionId,
            outcomeSlots
        );
        await redeemTx.wait();
        console.log(`✅ UNWIND SUCCESS: Capital reclaimed for market ${marketId}. TxHash: ${redeemTx.hash}`);
        
    } catch (error) {
        console.error(`PORTFOLIO MANAGER: Failed to unwind positions for market ${marketId}:`, error);
        throw error;
    }
}
