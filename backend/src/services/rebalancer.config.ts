import 'dotenv/config';

export const RPC_URL = process.env.AVALANCHE_FUJI_RPC;
export const REBALANCER_PRIVATE_KEY = process.env.PRIVATE_KEY;
export const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS;

export const MATCHBOOK_USERNAME = process.env.MATCHBOOK_USERNAME;
export const MATCHBOOK_PASSWORD = process.env.MATCHBOOK_PASSWORD;

if (!RPC_URL || !REBALANCER_PRIVATE_KEY || !MARKET_FACTORY_ADDRESS) {
  throw new Error('One or more required environment variables are missing for the rebalancer service.');
}

export const POLLING_INTERVAL = 30000; // 30 seconds

// The minimum price difference required to trigger a rebalancing trade.
export const DIVERGENCE_THRESHOLD = 0.005; // 0.5%