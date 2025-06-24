import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { bootstrapInventory } from '../src/services/portfolio-manager'; // Adjust path if needed
import MarketFactoryArtifact from '../src/artifacts/MarketFactory.json'; // Adjust path to your artifact

dotenv.config();

// --- Configuration ---
const MARKET_ID_TO_FIX = 1321716; // <-- CHANGE THIS VALUE

const BOOTSTRAP_FUNDING_AMOUNT_USDC = 15000;

// --- Environment Variables ---
const {
    AVALANCHE_FUJI_RPC, // Your RPC URL from .env
    PRIVATE_KEY,  // The bot's private key from .env
    MARKET_FACTORY_ADDRESS   // The factory's address from .env
} = process.env;


/**
 * A standalone script to manually bootstrap a market with outcome tokens.
 * This is useful if the automated bootstrapping process failed after deployment.
 *
 * Usage:
 * 1. Set the MARKET_ID_TO_FIX variable in this file.
 * 2. Run from your terminal: `npx ts-node scripts/bootstrapMarket.ts`
 */
async function main() {
    console.log('--- Manual Market Bootstrapper ---');

    // 1. --- Validate Environment and Configuration ---
    if (!AVALANCHE_FUJI_RPC || !PRIVATE_KEY || !MARKET_FACTORY_ADDRESS) {
        throw new Error('Missing required environment variables. Check your .env file for AVALANCHE_FUJI_RPC, REBALANCER_PRIVATE_KEY, and MARKET_FACTORY_ADDRESS.');
    }
    if (!MARKET_ID_TO_FIX) {
        throw new Error('MARKET_ID_TO_FIX is not set. Please edit the script file.');
    }

    console.log(`Attempting to bootstrap Market ID: ${MARKET_ID_TO_FIX}`);
    console.log(`Funding amount: ${BOOTSTRAP_FUNDING_AMOUNT_USDC} USDC`);

    // 2. --- Setup Provider and Signer ---
    // We only need a provider to read the conditionId from the factory.
    const provider = new ethers.JsonRpcProvider(AVALANCHE_FUJI_RPC);
    const factoryContract = new ethers.Contract(
        MARKET_FACTORY_ADDRESS,
        MarketFactoryArtifact.abi,
        provider
    );
    
    // 3. --- Get the conditionId from the MarketFactory ---
    let conditionId: string;
    try {
        console.log(`\nQuerying MarketFactory for conditionId of market ${MARKET_ID_TO_FIX}...`);
        
        // The public mapping 'matchConditionIds' has an auto-generated getter function with the same name.
        conditionId = await factoryContract.matchConditionIds(MARKET_ID_TO_FIX);
        
        if (!conditionId || conditionId === ethers.ZeroHash) {
            throw new Error(`Factory returned a zero or invalid conditionId. Does a market for ${MARKET_ID_TO_FIX} exist?`);
        }
        
        console.log(`Successfully retrieved Condition ID: ${conditionId}`);
    } catch (error) {
        console.error(`Failed to get conditionId from MarketFactory.`);
        throw error;
    }

    // 4. --- Call the Bootstrap Inventory Function ---
    // The bootstrapInventory function from portfolio-manager handles its own provider,
    // signer, approvals, and transaction sending. We just need to give it the ID.
    console.log(`\nHanding off to portfolio manager to acquire inventory...`);
    await bootstrapInventory(conditionId, BOOTSTRAP_FUNDING_AMOUNT_USDC);

    console.log(`\n✅✅✅ SCRIPT COMPLETE: Manual bootstrap for market ${MARKET_ID_TO_FIX} was successful!`);
}


main().catch((error) => {
    console.error('\n❌ BOOTSTRAP FAILED: An error occurred during the script execution.');
    console.error(error);
    process.exit(1);
});
