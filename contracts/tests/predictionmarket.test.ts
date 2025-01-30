import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import * as chai from "chai";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { solidity } from "ethereum-waffle";
chai.use(solidity);
dotenv.config();

describe("PredictionMarket - buyShares()", function () {
  let predictionMarket: any;
  let marketFactory: any;
  let liquidityPool: any;
  let conditionalTokens: any;
  let usdc: any;
  let user: any;

  const PREDICTION_MARKET_ADDRESS = process.env.TEST_PREDICTION_MARKET_ADDRESS!;
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS!;
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS!;
  const CONDITIONAL_TOKENS_WRAPPER_ADDRESS = process.env.CONDITIONAL_TOKENS_WRAPPER_ADDRESS!;
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;

  let conditionId: string;

  before(async function () {
    [user] = await ethers.getSigners();

    const PredictionMarketAbi = [
      "function isResolved() external view returns (bool)",
      "function buyShares(uint8 outcome, uint256 amount) external",
      "function marketMaker() external view returns (address)",
      "function conditionId() external view returns (bytes32)",
      "event SharesPurchased(address indexed buyer, uint8 indexed outcome, uint256 shares, uint256 totalCost)",
      "event OddsUpdated(uint256 indexed matchId, uint256 homePrice, uint256 drawPrice, uint256 awayPrice)"
    ];

    const MarketFactoryAbi = [
      "function platformProfitPool() external view returns (uint256)"
    ];

    const LiquidityPoolAbi = [
      "function stakingRewardsPool() external view returns (uint256)",
      "function usdcReserve() external view returns (uint256)",
      "event FundsWithdrawn(address indexed market, uint256 amount18)"
    ];

    const ConditionalTokensAbi = [
      "function balanceOf(address account, uint256 id) external view returns (uint256)",
      "function getPositionId(address, bytes32) external pure returns (uint256)",
      "function getCollectionId(bytes32, bytes32, uint256) external view returns (bytes32)"
    ];

    const UsdcAbi = [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address spender, uint256 value) external returns (bool)",
      "function mint(uint256 amount) external"
    ];

    predictionMarket = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PredictionMarketAbi, user);
    marketFactory = new ethers.Contract(MARKET_FACTORY_ADDRESS, MarketFactoryAbi, user);
    liquidityPool = new ethers.Contract(LIQUIDITY_POOL_ADDRESS, LiquidityPoolAbi, user);
    conditionalTokens = new ethers.Contract(CONDITIONAL_TOKENS_WRAPPER_ADDRESS, ConditionalTokensAbi, user);
    usdc = new ethers.Contract(MOCK_USDC_ADDRESS, UsdcAbi, user);

    const resolved = await predictionMarket.isResolved();
    if (resolved) {
      console.log("Market is already resolved. Skipping all tests.");
      this.skip();
    }

    conditionId = await predictionMarket.conditionId();
    console.log("ConditionId:", conditionId);

    await usdc.mint(ethers.utils.parseUnits("50000", 6));
    console.log("Minted 50,000 USDC to user:", user.address);
  });

  describe("buyShares()", function () {
    it("should revert on invalid outcome", async function () {
      await expect(
        predictionMarket.connect(user).buyShares(3, 100)
      ).to.be.revertedWith("Invalid outcome");
    });

    it("should revert on amount=0", async function () {
      await expect(
        predictionMarket.connect(user).buyShares(0, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("allows user to buy shares and emits events", async function () {
      // Approve
      await usdc.connect(user).approve(predictionMarket.address, ethers.utils.parseUnits("10000", 6));

      // LOG balances + MarketMaker info BEFORE buy
      const userBalanceBefore = await usdc.balanceOf(user.address);
      console.log("User USDC balance BEFORE buy:", userBalanceBefore.toString());

      const marketMakerAddr = await predictionMarket.marketMaker();
      const MarketMaker = new ethers.Contract(marketMakerAddr, [
        "function stage() external view returns (uint8)",
        "function funding() external view returns (uint)",
        "function atomicOutcomeSlotCount() external view returns (uint)",
        "function whitelist() external view returns (address)"
      ], user);
      const mmStageBefore = await MarketMaker.stage();
      const mmFundingBefore = await MarketMaker.funding();
      const mmSlotCount = await MarketMaker.atomicOutcomeSlotCount();
      const mmWhitelist = await MarketMaker.whitelist();
      console.log("MarketMaker stage BEFORE buy:", mmStageBefore.toString());
      console.log("MarketMaker funding BEFORE buy:", mmFundingBefore.toString());
      console.log("MarketMaker atomicOutcomeSlotCount:", mmSlotCount.toString());
      console.log("MarketMaker whitelist:", mmWhitelist);

      const lpReserveBefore = await liquidityPool.usdcReserve();
      console.log("LiquidityPool usdcReserve BEFORE buy:", lpReserveBefore.toString());

      // Also log the platformProfitPool, etc.
      const oldProfit = await marketFactory.platformProfitPool();
      console.log("Platform profit pool BEFORE buy:", oldProfit.toString());

      const oldLpRewards = await liquidityPool.stakingRewardsPool();
      console.log("LP rewards BEFORE buy:", oldLpRewards.toString());

      const netCost = await predictionMarket.connect(user).getNetCost(0, 100);
      console.log("netCost =>", netCost.toString());
      if (netCost.lte(0)) {
        console.log("Net cost <= 0 => That means buyShares would revert with 'Invalid trade cost'");
      }

      // Actually run the trade
      const tx = await predictionMarket.connect(user).buyShares(0, 100);
      const receipt = await tx.wait();

      // Logs after
      const userBalanceAfter = await usdc.balanceOf(user.address);
      console.log("User USDC balance AFTER buy:", userBalanceAfter.toString());

      const mmStageAfter = await MarketMaker.stage();
      const mmFundingAfter = await MarketMaker.funding();
      console.log("MarketMaker stage AFTER buy:", mmStageAfter.toString());
      console.log("MarketMaker funding AFTER buy:", mmFundingAfter.toString());

      const lpReserveAfter = await liquidityPool.usdcReserve();
      console.log("LiquidityPool usdcReserve AFTER buy:", lpReserveAfter.toString());

      // parse events
      const sharesPurchasedEvent = receipt.events.find(e => e.event === "SharesPurchased");
      const oddsUpdatedEvent = receipt.events.find(e => e.event === "OddsUpdated");
      expect(sharesPurchasedEvent).to.exist;
      expect(oddsUpdatedEvent).to.exist;

      console.log("SharesPurchased => buyer:", sharesPurchasedEvent.args.buyer);
      console.log("                outcome:", sharesPurchasedEvent.args.outcome.toString());
      console.log("                 shares:", sharesPurchasedEvent.args.shares.toString());
      console.log("              totalCost:", sharesPurchasedEvent.args.totalCost.toString());

      console.log("OddsUpdated => matchId:", oddsUpdatedEvent.args.matchId.toString());
      console.log("              homePrice:", oddsUpdatedEvent.args.homePrice.toString());
      console.log("              drawPrice:", oddsUpdatedEvent.args.drawPrice.toString());
      console.log("              awayPrice:", oddsUpdatedEvent.args.awayPrice.toString());

      const userSpent = userBalanceBefore.sub(userBalanceAfter);
      console.log("User spent USDC:", userSpent.toString());

      // After check
      const newProfit = await marketFactory.platformProfitPool();
      const newLpRewards = await liquidityPool.stakingRewardsPool();
      const profitDiff = newProfit.sub(oldProfit);
      const lpRewardsDiff = newLpRewards.sub(oldLpRewards);

      console.log("Platform profit increase:", profitDiff.toString());
      console.log("LP rewards increase:", lpRewardsDiff.toString());
      expect(profitDiff).to.equal(lpRewardsDiff);
    });

    it("withdraws from LiquidityPool if shortfall in MarketMaker collateral", async function () {
      const marketMakerAddr = await predictionMarket.marketMaker();
      const mmBalanceBefore = await usdc.balanceOf(marketMakerAddr);
      const lpReserveBefore = await liquidityPool.usdcReserve();
      const shortfallAmount = mmBalanceBefore.add(ethers.utils.parseUnits("1000", 6));

      await usdc.connect(user).approve(predictionMarket.address, shortfallAmount);
      const tx = await predictionMarket.connect(user).buyShares(0, shortfallAmount);
      const receipt = await tx.wait();

      const fundsWithdrawnEvent = receipt.events.find(
        e => e.address.toLowerCase() === LIQUIDITY_POOL_ADDRESS.toLowerCase() && e.event === "FundsWithdrawn"
      );
      expect(fundsWithdrawnEvent).to.exist;
      console.log("FundsWithdrawn => amount18:", fundsWithdrawnEvent.args.amount18.toString());
      expect(fundsWithdrawnEvent.args.amount18).to.be.gt(0);

      const ammFundingChangedEvent = receipt.events.find(
        e => e.address.toLowerCase() === marketMakerAddr.toLowerCase() && e.event === "AMMFundingChanged"
      );
      expect(ammFundingChangedEvent).to.exist;
      console.log("AMMFundingChanged => fundingChange:", ammFundingChangedEvent.args.fundingChange.toString());
      expect(ammFundingChangedEvent.args.fundingChange).to.be.gt(0);

      const mmBalanceAfter = await usdc.balanceOf(marketMakerAddr);
      const lpReserveAfter = await liquidityPool.usdcReserve();
      console.log("MM USDC before:", mmBalanceBefore.toString(), "-> after:", mmBalanceAfter.toString());
      console.log("LP Reserve before:", lpReserveBefore.toString(), "-> after:", lpReserveAfter.toString());

      expect(mmBalanceAfter).to.be.gt(mmBalanceBefore);
      const lpDiff = lpReserveBefore.sub(lpReserveAfter);
      expect(lpDiff).to.equal(fundsWithdrawnEvent.args.amount18);
    });

    it("credits user with outcome tokens", async function () {
      const indexSet = 1 << 0;
      const collectionId = await conditionalTokens.getCollectionId(
        ethers.constants.HashZero,
        conditionId,
        indexSet
      );
      const positionId = await conditionalTokens.getPositionId(MOCK_USDC_ADDRESS, collectionId);
      const bal = await conditionalTokens.balanceOf(user.address, positionId);
      expect(bal).to.be.gt(0);
      console.log("Outcome token balance:", bal.toString());
    });
  });
});
