import 'dotenv/config';

export const API_FOOTBALL_KEY= process.env.API_KEY;
export const RPC_URL = process.env.AVALANCHE_FUJI_RPC;
export const REBALANCER_PRIVATE_KEY = process.env.PRIVATE_KEY;
export const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS;
export const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS!;

export const MATCHBOOK_USERNAME = process.env.MATCHBOOK_USERNAME;
export const MATCHBOOK_PASSWORD = process.env.MATCHBOOK_PASSWORD;

if (!RPC_URL || !REBALANCER_PRIVATE_KEY || !CONDITIONAL_TOKENS_ADDRESS || !MARKET_FACTORY_ADDRESS || !API_FOOTBALL_KEY || !MATCHBOOK_USERNAME || !MATCHBOOK_PASSWORD) {
  throw new Error('One or more required environment variables are missing for the rebalancer service.');
}

export const TOKEN_SCALE_FACTOR = 10n ** 6n; // Scale factor for token amounts

export const TARGET_INVENTORY_PER_OUTCOME = 15000n * TOKEN_SCALE_FACTOR; 

export const POLLING_INTERVAL = 30000; // 30 seconds

export const GAS_LIMIT = 2000000; 
export const USDC_ADDRESS = process.env.USDC_FAUCET_ADDRESS!;

// The minimum price difference required to trigger a rebalancing trade.
export const DIVERGENCE_THRESHOLD = 0.005; // 0.5%