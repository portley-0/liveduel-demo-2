import { ethers } from 'ethers';
import { executeTrade, TradeOrder } from '../src/services/trade-executor';
import { RPC_URL, REBALANCER_PRIVATE_KEY } from '../src/services/rebalancer.config';
import PredictionMarketArtifact from '../src/artifacts/PredictionMarket.json';
import UsdcArtifact from '../src/artifacts/MockUSDC.json';

// =================================================================================
//                            CONFIGURATION
// =================================================================================
// 1. PASTE THE ADDRESS OF YOUR NEWLY DEPLOYED PREDICTION MARKET CONTRACT HERE
const HARDCODED_MARKET_ADDRESS = 'PASTE_YOUR_FRESH_MARKET_ADDRESS_HERE';

// 2. CONFIGURE YOUR DEPLOYER AND USDC ADDRESSES
const DEPLOYER_PRIVATE_KEY = process.env.PRIVATE_KEY;
const USDC_ADDRESS = '0x1A85e9870Dd44A8167b626981b1aBDc87cAAD4E5'; // MockUSDC on Fuji
// =================================================================================

// --- Helper Constants and Functions ---
const FIXED_192x64_SCALING_FACTOR = 18446744073709551616n; // 2^64

function convert192x64ToDecimal(fixedVal: bigint): number {
  const tempScaler = 1000000n;
  const scaled = (fixedVal * tempScaler) / FIXED_192x64_SCALING_FACTOR;
  return Number(scaled) / Number(tempScaler);
}

function decimalProbabilityToOdds(prob: number): number {
    if (prob <= 0) return Infinity;
    return 1 / prob;
}

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

// --- UPDATED HELPER FUNCTION ---
// This now uses the more efficient proxy function on the PredictionMarket contract.
async function getOnChainDecimalProbs(predictionMarketAddress: string): Promise<[number, number, number]> {
    const market = new ethers.Contract(predictionMarketAddress, PredictionMarketArtifact.abi, provider);
    
    // Call the proxy function directly, in parallel, for efficiency.
    const [homeProbFixed, drawProbFixed, awayProbFixed] = await Promise.all([
        market.getMarginalPrice(0),
        market.getMarginalPrice(1),
        market.getMarginalPrice(2)
    ]);

    return [
        convert192x64ToDecimal(homeProbFixed),
        convert192x64ToDecimal(drawProbFixed),
        convert192x64ToDecimal(awayProbFixed)
    ];
}


describe('trade-executor (End-to-End On-Chain Test)', () => {

    jest.setTimeout(180000); // 3 minutes timeout for on-chain transactions

    beforeAll(async () => {
        console.log('\n--- On-Chain Test Setup ---');
        if (!DEPLOYER_PRIVATE_KEY) {
            throw new Error("FATAL: DEPLOYER_PRIVATE_KEY must be set in your environment.");
        }
        if (!HARDCODED_MARKET_ADDRESS || !HARDCODED_MARKET_ADDRESS.startsWith('0x')) {
            throw new Error("FATAL: Please set the HARDCODED_MARKET_ADDRESS constant in the test file.");
        }

        const ownerSigner = new ethers.Wallet(DEPLOYER_PRIVATE_KEY!, provider);
        const predictionMarketContract = new ethers.Contract(HARDCODED_MARKET_ADDRESS, PredictionMarketArtifact.abi, ownerSigner);

        // Ensure the rebalancer bot is authorized
        const currentBotAddress = await predictionMarketContract.botAddress();
        if (currentBotAddress.toLowerCase() !== rebalancerSigner.address.toLowerCase()) {
            console.log(`SETUP: Authorizing rebalancer (${rebalancerSigner.address}) as bot...`);
            const tx = await predictionMarketContract.setBotAddress(rebalancerSigner.address);
            await tx.wait();
            console.log('SETUP: Bot authorization successful.');
        } else {
            console.log(`SETUP: Rebalancer address is already the authorized bot.`);
        }
        
        // Ensure the rebalancer bot has enough USDC
        const usdcContract = new ethers.Contract(USDC_ADDRESS, UsdcArtifact.abi, ownerSigner);
        const rebalancerBalance = await usdcContract.balanceOf(rebalancerSigner.address);
        if (rebalancerBalance < ethers.parseUnits('10000', 6)) {
            console.log('SETUP: Minting 10,000 MockUSDC to rebalancer wallet...');
            const mintTx = await usdcContract['mint(address,uint256)'](rebalancerSigner.address, ethers.parseUnits('10000', 6));
            await mintTx.wait();
            console.log('SETUP: Minting complete.');
        }
        const newBalance = await usdcContract.balanceOf(rebalancerSigner.address);
        console.log(`SETUP: Rebalancer USDC Balance: ${ethers.formatUnits(newBalance, 6)}`);
        expect(newBalance).toBeGreaterThan(0);
    });

    afterAll(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        console.log('\n--- On-Chain Test Completed ---');
    });

    it('should execute a calculated trade and correctly update on-chain odds', async () => {
        // --- 1. Define the trade we want to test ---
        const calculatedTrade: TradeOrder = {
            predictionMarketAddress: HARDCODED_MARKET_ADDRESS,
            // This is the output from "Scenario 1: Strong Home Favorite" from our unit tests.
            tradeAmounts: [5536053696n, -3927892607n, -3927892607n]
        };
        const targetOdds = { home: 2.0, draw: 4.0, away: 4.0 };

        // --- 2. Get the on-chain odds BEFORE the trade ---
        const beforeProbs = await getOnChainDecimalProbs(HARDCODED_MARKET_ADDRESS);
        console.log('\n--- Verifying Scenario 1: Strong Home Favorite (2.0, 4.0, 4.0) ---');
        console.log('On-chain odds BEFORE trade:', beforeProbs.map(p => decimalProbabilityToOdds(p).toFixed(2)));

        // --- 3. Execute the trade ---
        console.log('Executing trade:', calculatedTrade.tradeAmounts);
        await expect(executeTrade(calculatedTrade)).resolves.not.toThrow();
        console.log('Trade executed successfully.');

        // --- 4. Get the on-chain odds AFTER the trade ---
        const afterProbs = await getOnChainDecimalProbs(HARDCODED_MARKET_ADDRESS);
        console.log('On-chain odds AFTER trade:', afterProbs.map(p => decimalProbabilityToOdds(p).toFixed(2)));
        console.log('Target odds for comparison: ', [targetOdds.home.toFixed(2), targetOdds.draw.toFixed(2), targetOdds.away.toFixed(2)]);

        // --- 5. Verify the results ---
        const targetProbs = [1 / targetOdds.home, 1 / targetOdds.draw, 1 / targetOdds.away];
        
        expect(afterProbs[0]).toBeCloseTo(targetProbs[0], 3); // Check with 3 decimal places of precision
        expect(afterProbs[1]).toBeCloseTo(targetProbs[1], 3);
        expect(afterProbs[2]).toBeCloseTo(targetProbs[2], 3);
        console.log('✅ Verification successful: On-chain odds match target odds!');
    });
});