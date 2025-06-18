import { ethers } from 'ethers';
import { executeTrade, TradeOrder } from '../src/services/trade-executor';
import { RPC_URL, REBALANCER_PRIVATE_KEY, MARKET_FACTORY_ADDRESS } from '../src/services/rebalancer.config';
import { getActiveMatchIds } from '../src/services/onchain-reader';
import UsdcArtifact from '../src/artifacts/MockUSDC.json';
import MarketFactoryArtifact from '../src/artifacts/MarketFactory.json';
import PredictionMarketArtifact from '../src/artifacts/PredictionMarket.json';

const DEPLOYER_PRIVATE_KEY = process.env.PRIVATE_KEY;
const USDC_ADDRESS = '0x1A85e9870Dd44A8167b626981b1aBDc87cAAD4E5';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const rebalancerSigner = new ethers.Wallet(REBALANCER_PRIVATE_KEY!, provider);

const ENABLE_CONSOLE_LOGS = true;
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
    if (ENABLE_CONSOLE_LOGS) {
        jest.requireActual('console').log(...args);
    }
});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (ENABLE_CONSOLE_LOGS) {
        jest.requireActual('console').error(...args);
    }
});

describe('trade-executor (Integration Test)', () => {

    jest.setTimeout(180000);

    let activePredictionMarketAddress: string | undefined;

    beforeAll(async () => {
        console.log('\n--- Trade Executor Integration Test Setup ---');
        if (!DEPLOYER_PRIVATE_KEY) {
            throw new Error("FATAL: DEPLOYER_PRIVATE_KEY must be set in your environment.");
        }
        if (!MARKET_FACTORY_ADDRESS) {
            throw new Error("FATAL: Please add the deployed MARKET_FACTORY_ADDRESS to your config.");
        }

        const ownerSigner = new ethers.Wallet(DEPLOYER_PRIVATE_KEY!, provider);

        console.log('SETUP: Finding an active market to test against...');
        const marketFactoryReader = new ethers.Contract(MARKET_FACTORY_ADDRESS, MarketFactoryArtifact.abi, provider);
        const activeMatchIds = await getActiveMatchIds();
        if (activeMatchIds.length === 0) {
            console.error("SETUP FAILED: No active markets found. Cannot run trade execution tests.");
            return; 
        }
        const testMatchId = activeMatchIds[0];
        activePredictionMarketAddress = await marketFactoryReader.predictionMarkets(testMatchId);
        console.log(`SETUP: Found active PredictionMarket for MatchID ${testMatchId} at address: ${activePredictionMarketAddress}`);
        if (activePredictionMarketAddress === ethers.ZeroAddress) {
            throw new Error(`SETUP FAILED: Market for MatchID ${testMatchId} is registered but address is zero.`);
        }

        if (!activePredictionMarketAddress) {
            throw new Error("SETUP FAILED: activePredictionMarketAddress is undefined.");
        }
        const predictionMarketContract = new ethers.Contract(activePredictionMarketAddress, PredictionMarketArtifact.abi, ownerSigner);
        const currentBotAddress = await predictionMarketContract.botAddress();
        if (currentBotAddress.toLowerCase() !== rebalancerSigner.address.toLowerCase()) {
            console.log(`SETUP: Authorizing rebalancer (${rebalancerSigner.address}) as bot on PredictionMarket (${activePredictionMarketAddress})...`);
            const tx = await predictionMarketContract.setBotAddress(rebalancerSigner.address);
            await tx.wait();
            console.log('SETUP: Bot authorization successful.');
        } else {
            console.log(`SETUP: Rebalancer address is already the authorized bot.`);
        }
        expect((await predictionMarketContract.botAddress()).toLowerCase()).toBe(rebalancerSigner.address.toLowerCase());

        const usdcContract = new ethers.Contract(USDC_ADDRESS, UsdcArtifact.abi, rebalancerSigner);
        const balance = await usdcContract.balanceOf(rebalancerSigner.address);
        if (balance < ethers.parseUnits('10000', 6)) {
            console.log('SETUP: Minting 10,000 MockUSDC to rebalancer wallet...');
            const mintTx = await usdcContract['mint(uint256)'](ethers.parseUnits('10000', 6));
            await mintTx.wait();
            console.log('SETUP: Minting complete.');
        }
        const newBalance = await usdcContract.balanceOf(rebalancerSigner.address);
        console.log(`SETUP: Current USDC Balance: ${ethers.formatUnits(newBalance, 6)}`);
        expect(newBalance).toBeGreaterThan(0);
    });

    afterAll(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        console.log('\n--- Trade Executor Test Completed ---');
    });


    it('should successfully execute a trade that requires a USDC payment (buy order)', async () => {
        if (!activePredictionMarketAddress) {
            throw new Error("Test skipped: No active market was found during setup.");
        }

        const order: TradeOrder = {
            predictionMarketAddress: activePredictionMarketAddress,
            tradeAmounts: [100n, 0n, 0n]
        };
        console.log(`\n--- Testing buy trade on ${order.predictionMarketAddress} ---`);
        await expect(executeTrade(order)).resolves.not.toThrow();
    });

    it('should successfully execute a trade that results in a USDC payout (sell order)', async () => {
        if (!activePredictionMarketAddress) {
            throw new Error("Test skipped: No active market was found during setup.");
        }

        const order: TradeOrder = {
            predictionMarketAddress: activePredictionMarketAddress,
            tradeAmounts: [-50n, 0n, 0n]
        };
        console.log(`\n--- Testing sell trade on ${order.predictionMarketAddress} ---`);
        await expect(executeTrade(order)).resolves.not.toThrow();
    });

    it('should successfully execute a complex trade involving both a buy and a sell', async () => {
        if (!activePredictionMarketAddress) {
            throw new Error("Test skipped: No active market was found during setup.");
        }

        const order: TradeOrder = {
            predictionMarketAddress: activePredictionMarketAddress,
            tradeAmounts: [50n, -25n, 0n]
        };
        console.log(`\n--- Testing complex trade on ${order.predictionMarketAddress} ---`);
        await expect(executeTrade(order)).resolves.not.toThrow();
    });
});