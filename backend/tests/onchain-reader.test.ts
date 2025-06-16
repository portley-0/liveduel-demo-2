import { ethers } from 'ethers';

import {
  getActiveMatchIds,
  getMarketState,
  getOnChainOdds,
} from '../src/services/onchain-reader';

import {
  RPC_URL,
  MARKET_FACTORY_ADDRESS,
} from '../src/services/rebalancer.config';

import MarketFactoryArtifact from '../src/artifacts/MarketFactory.json';

const ENABLE_CONSOLE_LOGS = true; 

let provider: ethers.JsonRpcProvider;
let marketFactoryContract: ethers.Contract;

const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
  if (ENABLE_CONSOLE_LOGS) {
    jest.requireActual('console').error(...args);
  }
});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args) => {
  if (ENABLE_CONSOLE_LOGS) {
    jest.requireActual('console').warn(...args);
  }
});
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
  if (ENABLE_CONSOLE_LOGS) {
    jest.requireActual('console').log(...args);
  }
});

describe('onchain-reader (functionality test)', () => {

  beforeAll(async () => {
    console.log('\n--- Initializing Ethers.js for live data check ---');
    if (!RPC_URL || !MARKET_FACTORY_ADDRESS) {
      throw new Error('Missing environment variables for live data check. Ensure RPC_URL and MARKET_FACTORY_ADDRESS are set.');
    }

    provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log(`Connected to RPC: ${RPC_URL}`);

    try {
      const blockNumber = await provider.getBlockNumber();
      console.log(`Current block number: ${blockNumber}`);
    } catch (e) {
      console.error('Failed to connect to RPC:', e);
      throw new Error('Could not connect to RPC. Check RPC_URL and network connectivity.');
    }

    marketFactoryContract = new ethers.Contract(
      MARKET_FACTORY_ADDRESS,
      MarketFactoryArtifact.abi,
      provider 
    );
    console.log(`MarketFactory contract initialized at: ${MARKET_FACTORY_ADDRESS}`);
    console.log('--- Ethers.js initialization complete ---');
  }, 30000); 

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    console.log('\n--- Live data check finished ---');
  });

  it('should sequentially fetch active match IDs, market state, and on-chain odds', async () => {
    console.log('\n--- Starting sequential on-chain data fetch ---');
    let selectedMatchId: number | undefined;
    let lmsrAddressForOdds: string | undefined;

    console.log('Fetching active match IDs...');
    const activeMatchIds = await getActiveMatchIds();
    console.log(`Active matches found: ${activeMatchIds.length > 0 ? activeMatchIds.join(', ') : 'None'}`);

    if (activeMatchIds.length === 0) {
      console.warn('No active matches found. Skipping further tests.');
      throw new Error('No active matches found on the MarketFactory contract. Cannot proceed with tests.');
    }

    selectedMatchId = activeMatchIds[0];
    console.log(`Selected Match ID for testing: ${selectedMatchId}`);

    console.log(`Fetching market state for Match ID: ${selectedMatchId}...`);
    const marketState = await getMarketState(selectedMatchId);

    if (!marketState) {
      console.error(`Could not retrieve market state for Match ID: ${selectedMatchId}`);
      throw new Error(`Failed to get market state for ${selectedMatchId}.`);
    }

    console.log('Market State retrieved:');
    console.log(`  LMSR Address: ${marketState.lmsrAddress}`);
    console.log(`  USDC Address: ${marketState.usdcAddress}`);
    console.log(`  Quantities (q): [${marketState.q.map(String).join(', ')}]`);
    console.log(`  Funding (b): ${marketState.b.toString()}`);

    lmsrAddressForOdds = marketState.lmsrAddress;

    console.log(`Fetching on-chain odds for LMSR Address: ${lmsrAddressForOdds}...`);
    const onChainOdds = await getOnChainOdds(lmsrAddressForOdds);

    if (!onChainOdds) {
      console.error(`Could not retrieve on-chain odds for LMSR Address: ${lmsrAddressForOdds}`);
      throw new Error(`Failed to get on-chain odds for ${lmsrAddressForOdds}.`);
    }

    console.log('On-Chain Odds retrieved:');
    console.log(`  Home: ${onChainOdds.home.toFixed(4)}`);
    console.log(`  Draw: ${onChainOdds.draw.toFixed(4)}`);
    console.log(`  Away: ${onChainOdds.away.toFixed(4)}`);

    console.log('--- Sequential on-chain data fetch complete ---');

    expect(activeMatchIds.length).toBeGreaterThan(0);
    expect(selectedMatchId).toBeDefined();
    expect(marketState).toBeDefined();
    expect(lmsrAddressForOdds).toBeDefined();
    expect(onChainOdds).toBeDefined();

  }, 30000); 
});
