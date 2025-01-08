import { expect } from "chai";
import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";

describe("Live Integration Tests", function () {
    let deployer, bettor1, bettor2;
    let marketFactory, liquidityPool, predictionMarket, usdc, duelToken;
    let predictionMarketAddress;

    before(async function () {
        // Accounts
        [deployer, bettor1, bettor2] = await ethers.getSigners();

        // Attach to deployed contracts
        const MarketFactory = await ethers.getContractFactory("MarketFactory");
        marketFactory = await MarketFactory.attach("0xD77ac57e24b2368a2D1A115970e5Cbd0B2a91e74");

        const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
        liquidityPool = await LiquidityPool.attach("0xdE8039BF9dDFd63B0Ba46d97Ddc4230Ab5a7251E");

        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        usdc = await MockUSDC.attach("0x42eDcb19eE6f53423D2817061448Ca99ED2A5dD7");

        const DuelToken = await ethers.getContractFactory("DuelToken");
        duelToken = await DuelToken.attach("0x0D5449cf68e8C82D83841c3De3d54Fdc148b1A28");
    });

    it("should deploy a PredictionMarket", async function () {
        const matchId = 1001; // Real match ID
        const matchTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

        // Deploy a PredictionMarket
        const deployTx = await marketFactory.deployPredictionMarket(matchId, matchTimestamp);
        const receipt = await deployTx.wait();

        // Verify the event
        const event = receipt.events.find((e) => e.event === "PredictionMarketDeployed");
        expect(event).to.not.be.undefined;

        predictionMarketAddress = event.args.marketAddress;

        // Attach to the PredictionMarket 
        const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
        predictionMarket = await PredictionMarket.attach(predictionMarketAddress);

        console.log("PredictionMarket deployed at:", predictionMarketAddress);
    });

    it("should place bets on the PredictionMarket", async function () {
        const betAmount = ethers.utils.parseUnits("10", 18); // 10 USDC
        const outcome = 0; // Home win

        // Approve and place a bet for bettor1
        await usdc.connect(bettor1).approve(predictionMarketAddress, betAmount);
        const betTx1 = await predictionMarket.connect(bettor1).buyShares(outcome, betAmount.toString());
        await betTx1.wait();

        // Approve and place a bet for bettor2
        await usdc.connect(bettor2).approve(predictionMarketAddress, betAmount);
        const betTx2 = await predictionMarket.connect(bettor2).buyShares(outcome, betAmount.toString());
        await betTx2.wait();

        // Monitor events
        const receipt = await ethers.provider.getTransactionReceipt(betTx1.hash);
        const event = receipt.logs.find((log) => log.topics.includes(ethers.utils.id("SharesPurchased(address,uint8,uint256,uint256)")));
        expect(event).to.not.be.undefined;

        console.log("Bets placed successfully.");
    });

    it("should monitor LiquidityPool reserves", async function () {
        const [usdcReserve, duelReserve] = await liquidityPool.getReserves();

        console.log("USDC Reserve:", ethers.utils.formatUnits(usdcReserve, 6));
        console.log("DUEL Reserve:", ethers.utils.formatUnits(duelReserve, 18));

        expect(usdcReserve).to.be.gt(0);
    });

    it("should wait for Chainlink to resolve the match", async function () {
        console.log("Waiting for Chainlink to resolve the match...");

        // Poll the PredictionMarket until it's resolved
        let isResolved = false;
        while (!isResolved) {
            isResolved = await predictionMarket.isResolved();
            if (!isResolved) {
                await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds
            }
        }

        const resolvedOutcome = await predictionMarket.resolvedOutcome();
        console.log("Match resolved with outcome:", resolvedOutcome);

        expect(resolvedOutcome).to.be.within(0, 2); // Valid outcomes: 0 (Home), 1 (Draw), 2 (Away)
    });

    it("should redeem payouts", async function () {
        const redeemTx = await predictionMarket.connect(bettor1).redeemPayouts();
        await redeemTx.wait();

        console.log("Payouts redeemed successfully.");
    });

    it("should withdraw platform profit", async function () {
        const initialProfit = await marketFactory.platformProfitPool();
        const withdrawAmount = initialProfit.div(2); // Withdraw half

        const withdrawTx = await marketFactory.withdrawPlatformProfit(withdrawAmount);
        await withdrawTx.wait();

        const remainingProfit = await marketFactory.platformProfitPool();
        expect(remainingProfit).to.equal(initialProfit.sub(withdrawAmount));

        console.log("Platform profit withdrawn successfully.");
    });

    it("should test buying DUEL and staking", async function () {
        const buyAmount = ethers.utils.parseUnits("50", 6); // 50 USDC

        // Buy DUEL
        await usdc.connect(bettor1).approve(liquidityPool.address, buyAmount);
        const buyTx = await liquidityPool.connect(bettor1).buyDuel(buyAmount);
        await buyTx.wait();

        // Stake DUEL
        const duelBalance = await duelToken.balanceOf(bettor1.address);
        await duelToken.connect(bettor1).approve(liquidityPool.address, duelBalance);
        const stakeTx = await liquidityPool.connect(bettor1).stake(duelBalance);
        await stakeTx.wait();

        console.log("DUEL bought and staked successfully.");
    });

    it("should claim rewards from staking", async function () {
        const claimTx = await liquidityPool.connect(bettor1).claimRewards();
        await claimTx.wait();

        console.log("Staking rewards claimed successfully.");
    });
});
