import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import * as chai from "chai";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { solidity } from "ethereum-waffle";
chai.use(solidity);
dotenv.config();

describe("PredictionMarket - buyShares()", function () {
  this.timeout(120000);
  let predictionMarket: any;
  let marketFactory: any;
  let liquidityPool: any;
  let conditionalTokens: any;
  let whitelist: any;
  let usdc: any;
  let user: any;

  const PREDICTION_MARKET_ADDRESS = process.env.TEST_PREDICTION_MARKET_ADDRESS!;
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS!;
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS!;
  const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS!;
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;
  const WHITELIST_ADDRESS = process.env.WHITELIST_ADDRESS!;

  let conditionId: string;

  before(async function () {
    [user] = await ethers.getSigners();

    const PredictionMarketAbi = [
      "function isResolved() external view returns (bool)",
      "function buyShares(uint8 outcome, uint256 amount) external",
      "function marketMaker() external view returns (address)",
      "function conditionId() external view returns (bytes32)",
      "function getNetCost(uint8 outcome, uint256 shares) external view returns (int)",
      "event SharesPurchased(address indexed buyer, uint8 indexed outcome, uint256 shares, int actualCost)",
      "event OddsUpdated(uint256 indexed matchId, uint256 home, uint256 draw, uint256 away)"
    ];

    const MarketFactoryAbi = [
      "function platformProfitPool() external view returns (uint256)",
      "function verifyUser(address user) external"
    ];

    const WhitelistAbi = [
      "function addToWhitelist(address[] memory users) external",
      "function isWhitelisted(address user) external view returns (bool)"
    ];

    const LiquidityPoolAbi = [
      "function usdcReserve() external view returns (uint256)",
      "event FundsWithdrawn(address indexed market, uint256 amount)",
      "event RewardsPoolUpdated(uint256 amount)" 
    ];

    const ConditionalTokensAbi = [
      "function balanceOf(address account, uint256 id) external view returns (uint256)",
      "function getPositionId(address, bytes32) external pure returns (uint256)",
      "function getCollectionId(bytes32, bytes32, uint256) external view returns (bytes32)",
      "function setApprovalForAll(address operator, bool approved) external",
      "function isApprovedForAll(address owner, address operator) external view returns (bool)"
    ];

    const UsdcAbi = [
      "function balanceOf(address) external view returns (uint256)",
      "function approve(address spender, uint256 value) external returns (bool)",
      "function mint(uint256 amount) external",
      "function allowance(address owner, address spender) external view returns (uint256)"
    ];

    predictionMarket = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PredictionMarketAbi, user);
    marketFactory = new ethers.Contract(MARKET_FACTORY_ADDRESS, MarketFactoryAbi, user);
    liquidityPool = new ethers.Contract(LIQUIDITY_POOL_ADDRESS, LiquidityPoolAbi, user);
    conditionalTokens = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, ConditionalTokensAbi, user);
    usdc = new ethers.Contract(MOCK_USDC_ADDRESS, UsdcAbi, user);
    whitelist = new ethers.Contract(WHITELIST_ADDRESS, WhitelistAbi, user);

    const resolved = await predictionMarket.isResolved();
    if (resolved) {
      console.log("Market is already resolved. Skipping all tests.");
      this.skip();
    }

    conditionId = await predictionMarket.conditionId();
    console.log("ConditionId:", conditionId);

    // Give the user some USDC
    await usdc.mint(ethers.utils.parseUnits("10000", 6));
    console.log("Minted 10,000 USDC to user:", user.address);

    await marketFactory.verifyUser(user.address);
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
      
      const userBalanceBefore = await usdc.balanceOf(user.address);
      console.log("User USDC balance BEFORE buy:", userBalanceBefore.toString());

      const marketMakerAddr = await predictionMarket.marketMaker();
      const MarketMaker = new ethers.Contract(marketMakerAddr, [
        "function stage() external view returns (uint8)",
        "function funding() external view returns (uint)",
        "function atomicOutcomeSlotCount() external view returns (uint)",
        "function whitelist() external view returns (address)",
        "event AMMFundingChanged(int fundingChange)"  
      ], user);
      

      const mmStageBefore = await MarketMaker.stage();
      const mmFundingBefore = await MarketMaker.funding();
      const mmSlotCount = await MarketMaker.atomicOutcomeSlotCount();
      const mmWhitelist = await MarketMaker.whitelist();
      console.log("MarketMaker stage BEFORE buy:", mmStageBefore.toString());
      console.log("MarketMaker funding BEFORE buy:", mmFundingBefore.toString());
      console.log("MarketMaker atomicOutcomeSlotCount:", mmSlotCount.toString());
      console.log("MarketMaker whitelist:", mmWhitelist);

      // Check LiquidityPool and platform profit before
      const lpReserveBefore = await liquidityPool.usdcReserve();
      console.log("LiquidityPool usdcReserve BEFORE buy:", lpReserveBefore.toString());
 
      const oldProfit = await marketFactory.platformProfitPool();
      console.log("Platform profit pool BEFORE buy:", oldProfit.toString());

      // Optionally check netCost for this trade
      const netCost = await predictionMarket.connect(user).getNetCost(0, 100);
      console.log("netCost =>", netCost.toString());

      const userWhitelisted = await whitelist.isWhitelisted(user.address);
      console.log("User whitelisted:", userWhitelisted);

      const marketWhitelisted = await whitelist.isWhitelisted(predictionMarket.address);
      console.log("Market whitelisted:", marketWhitelisted);

      await usdc.connect(user).approve(predictionMarket.address, ethers.utils.parseUnits("10000", 6));

      await conditionalTokens.connect(user).setApprovalForAll(marketMakerAddr, true);
      await conditionalTokens.connect(user).setApprovalForAll(predictionMarket.address, true);
      const approved = await conditionalTokens.isApprovedForAll(predictionMarket.address, marketMakerAddr);
      console.log("MarketMaker Approved by Prediction Market:", approved);
      const tx = await predictionMarket.connect(user).buyShares(0, 100);
      const receipt = await tx.wait();

      const userBalanceAfter = await usdc.balanceOf(user.address);
      console.log("User USDC balance AFTER buy:", userBalanceAfter.toString());

      const mmStageAfter = await MarketMaker.stage();
      const mmFundingAfter = await MarketMaker.funding();
      console.log("MarketMaker stage AFTER buy:", mmStageAfter.toString());
      console.log("MarketMaker funding AFTER buy:", mmFundingAfter.toString());

      const lpReserveAfter = await liquidityPool.usdcReserve();
      console.log("LiquidityPool usdcReserve AFTER buy:", lpReserveAfter.toString());

      // Find events
      const sharesPurchasedEvent = receipt.events.find(e => e.event === "SharesPurchased");
      const oddsUpdatedEvent = receipt.events.find(e => e.event === "OddsUpdated");
      const rewardsUpdatedEvent = receipt.events.find(e => e.address.toLowerCase() === liquidityPool.address.toLowerCase() && e.event === "RewardsPoolUpdated");
      expect(sharesPurchasedEvent).to.exist;
      expect(oddsUpdatedEvent).to.exist;
      //expect(rewardsUpdatedEvent).to.exist;

      console.log("SharesPurchased => buyer:", sharesPurchasedEvent.args.buyer);
      console.log("                outcome:", sharesPurchasedEvent.args.outcome.toString());
      console.log("                 shares:", sharesPurchasedEvent.args.shares.toString());
      console.log("              totalCost:", sharesPurchasedEvent.args.actualCost.toString());

      console.log("OddsUpdated => matchId:", oddsUpdatedEvent.args.matchId.toString());
      console.log("              homePrice:", oddsUpdatedEvent.args.home.toString());
      console.log("              drawPrice:", oddsUpdatedEvent.args.draw.toString());
      console.log("              awayPrice:", oddsUpdatedEvent.args.away.toString());

      const userSpent = userBalanceBefore.sub(userBalanceAfter);
      console.log("User spent USDC:", userSpent.toString());

      console.log("RewardsPoolUpdated => amount:", rewardsUpdatedEvent.args.amount.toString());

      const newProfit = await marketFactory.platformProfitPool();
      const profitDiff = newProfit.sub(oldProfit);
      console.log("Platform profit increase:", profitDiff.toString());

      const lpReserveDiff = lpReserveBefore.sub(lpReserveAfter);
      console.log("LiquidityPool usdcReserve change:", lpReserveDiff.toString());

    });

    it("withdraws from LiquidityPool if shortfall in MarketMaker collateral", async function () {
      const marketMakerAddr = await predictionMarket.marketMaker();
      const MarketMaker = new ethers.Contract(marketMakerAddr, [
        "event AMMFundingChanged(int fundingChange)"  
      ], user);
      const mmBalanceBefore = await usdc.balanceOf(marketMakerAddr);
      const lpReserveBefore = await liquidityPool.usdcReserve();
      const shortfallAmount = mmBalanceBefore.add(ethers.utils.parseUnits("1000", 6));

      await usdc.connect(user).approve(predictionMarket.address, shortfallAmount);
      const tx = await predictionMarket.connect(user).buyShares(0, shortfallAmount);
      const receipt = await tx.wait();

      const fundsWithdrawnEvent = receipt.events.find(
        e => e.address.toLowerCase() === liquidityPool.address.toLowerCase() && e.event === "FundsWithdrawn"
      );
      expect(fundsWithdrawnEvent).to.exist;
      console.log("FundsWithdrawn => amount:", fundsWithdrawnEvent.args.amount.toString());
      expect(fundsWithdrawnEvent.args.amount).to.be.gt(0);

      const ammFundingChangedEvent = receipt.events.find(
        e => e.address.toLowerCase() === MarketMaker.address.toLowerCase() && e.event === "AMMFundingChanged"
      );
      expect(ammFundingChangedEvent).to.exist;
      console.log("AMMFundingChanged => fundingChange:", ammFundingChangedEvent.args.fundingChange.toString());
      expect(ammFundingChangedEvent.args.fundingChange).to.be.gt(0);

      const mmBalanceAfter = await usdc.balanceOf(marketMakerAddr);
      const lpReserveAfter = await liquidityPool.usdcReserve();
      console.log("MM USDC before:", mmBalanceBefore.toString(), "-> after:", mmBalanceAfter.toString());
      console.log("LP Reserve before:", lpReserveBefore.toString(), "-> after:", lpReserveAfter.toString());

      // MarketMaker's USDC should have increased
      expect(mmBalanceAfter).to.be.gt(mmBalanceBefore);

      // The difference in the pool's reserve matches the withdrawn amount
      const lpDiff = lpReserveBefore.sub(lpReserveAfter);
      expect(lpDiff).to.equal(fundsWithdrawnEvent.args.amount);
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
