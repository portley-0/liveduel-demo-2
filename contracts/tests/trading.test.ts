import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import * as chai from "chai";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { solidity } from "ethereum-waffle";
chai.use(solidity);
dotenv.config();
import {
  PredictionMarket,
  MarketFactory,
  LiquidityPool,
  ConditionalTokens,
  MockUSDC
} from "../typechain-types";

describe("PredictionMarket - buyShares() & sellShares()", function () {
  this.timeout(120000);
  let predictionMarket: PredictionMarket;
  let marketFactory: MarketFactory;
  let liquidityPool: LiquidityPool;
  let conditionalTokens: ConditionalTokens;
  let usdc: MockUSDC;
  let user: SignerWithAddress;

  const PREDICTION_MARKET_ADDRESS = process.env.TEST_PREDICTION_MARKET_ADDRESS!;
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS!;
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS!;
  const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS!;
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;

  let conditionId: string;
  let outcomeTokenId: any;
  let outcomeIndex = 2; 
  let tradeAmount = ethers.utils.parseUnits("100", 6);

  before(async function () {
    [user] = await ethers.getSigners();

    predictionMarket = (await ethers.getContractAt(
      "PredictionMarket",
      PREDICTION_MARKET_ADDRESS,
      user
    )) as PredictionMarket;
    
    marketFactory = (await ethers.getContractAt(
      "MarketFactory",
      MARKET_FACTORY_ADDRESS,
      user
    )) as MarketFactory;
    
    liquidityPool = (await ethers.getContractAt(
      "LiquidityPool",
      LIQUIDITY_POOL_ADDRESS,
      user
    )) as LiquidityPool;
    
    conditionalTokens = (await ethers.getContractAt(
      "ConditionalTokens",
      CONDITIONAL_TOKENS_ADDRESS,
      user
    )) as ConditionalTokens;
    
    usdc = (await ethers.getContractAt(
      "MockUSDC",
      MOCK_USDC_ADDRESS,
      user
    )) as MockUSDC;
    

    conditionId = await predictionMarket.conditionId();
    console.log(`Condition ID: ${conditionId}`);

    await usdc.mint(ethers.utils.parseUnits("1000", 6));
    console.log(`Minted 1000 USDC to user: ${user.address}`);

    // Get outcome token ID
    let indexSet = 1 << outcomeIndex;
    let collectionId = await conditionalTokens.getCollectionId(ethers.constants.HashZero, conditionId, indexSet);
    outcomeTokenId = await conditionalTokens.getPositionId(MOCK_USDC_ADDRESS, collectionId);
  });

  describe("buyShares() & sellShares() test", function () {
    it("Buys shares, checks balances, events and odds, then sells shares and logs results", async function () {
      // USDC & ERC1155 Balance Before Buy
      const usdcBalanceBeforeBuy = await usdc.balanceOf(user.address);
      const outcomeTokenBalanceBeforeBuy = await conditionalTokens.balanceOf(user.address, outcomeTokenId);

      console.log(`USDC Balance Before Buy: ${ethers.utils.formatUnits(usdcBalanceBeforeBuy, 6)} USDC`);
      console.log(`Outcome Token Balance Before Buy: ${ethers.utils.formatUnits(outcomeTokenBalanceBeforeBuy, 6)} Shares`);

      const netCost = await predictionMarket.getNetCost(outcomeIndex, tradeAmount);
      console.log(`Net Cost for 100 Shares: ${ethers.utils.formatUnits(netCost, 6)} USDC`);

      await usdc.approve(predictionMarket.address, ethers.utils.parseUnits("10000", 6));
      await conditionalTokens.setApprovalForAll(predictionMarket.address, true);

      // Buying 100 Shares
      console.log("Buying 100 Shares...");
      const tx = await predictionMarket.buyShares(outcomeIndex, tradeAmount);
      const receipt = await tx.wait() as any;

      // USDC & ERC1155 Balance After Buy
      const usdcBalanceAfterBuy = await usdc.balanceOf(user.address);
      const outcomeTokenBalanceAfterBuy = await conditionalTokens.balanceOf(user.address, outcomeTokenId);

      console.log(`USDC Balance After Buy: ${ethers.utils.formatUnits(usdcBalanceAfterBuy, 6)} USDC`);
      console.log(`Outcome Token Balance After Buy: ${ethers.utils.formatUnits(outcomeTokenBalanceAfterBuy, 6)} Shares`);

      const sharesPurchasedEvent = receipt.events?.find(e => e.event === "SharesPurchased");
      const oddsUpdatedEventBuy = receipt.events?.find((e) => e.event === "OddsUpdated");

      expect(sharesPurchasedEvent).to.exist;
      expect(oddsUpdatedEventBuy).to.exist;

      const liquidityPoolIface = liquidityPool.interface;
      const marketFactoryIface = marketFactory.interface;
      let rewardsUpdatedEvent, platformProfitAddedEvent;

      for (const log of receipt.logs) {
        try {
          const parsedLog = liquidityPoolIface.parseLog(log);
          if (parsedLog.name === "RewardsPoolUpdated") {
            rewardsUpdatedEvent = parsedLog;
          }
        } catch {}

        try {
          const parsedLog = marketFactoryIface.parseLog(log);
          if (parsedLog.name === "PlatformProfitAdded") {
            platformProfitAddedEvent = parsedLog;
          }
        } catch {}
      }

      expect(rewardsUpdatedEvent).to.exist;
      expect(platformProfitAddedEvent).to.exist;

      console.log(`
        ----------------------------------------
        Trade Summary (Buy)
        ----------------------------------------
        Outcome: ${sharesPurchasedEvent.args.outcome}
        Shares Purchased: ${ethers.utils.formatUnits(sharesPurchasedEvent.args.shares, 6)}
        Cost: ${ethers.utils.formatUnits(sharesPurchasedEvent.args.actualCost, 6)} USDC
        ----------------------------------------
        Updated Odds After Buy
        ----------------------------------------
        Home: ${(ethers.BigNumber.from(oddsUpdatedEventBuy.args.home).mul(10000).div(ethers.BigNumber.from("18446744073709551616")).toNumber() / 10000).toFixed(4)}
        Draw: ${(ethers.BigNumber.from(oddsUpdatedEventBuy.args.draw).mul(10000).div(ethers.BigNumber.from("18446744073709551616")).toNumber() / 10000).toFixed(4)}
        Away: ${(ethers.BigNumber.from(oddsUpdatedEventBuy.args.away).mul(10000).div(ethers.BigNumber.from("18446744073709551616")).toNumber() / 10000).toFixed(4)}
        ----------------------------------------
        Rewards Pool Increase: ${ethers.utils.formatUnits(rewardsUpdatedEvent.args.amount, 6)} USDC
        Platform Profit Increase: ${ethers.utils.formatUnits(platformProfitAddedEvent.args.amount, 6)} USDC
        ----------------------------------------
        `);


      // Selling 50 Shares
      console.log("Selling 50 Shares...");
      const sellTx = await predictionMarket.sellShares(outcomeIndex, tradeAmount.div(2));
      const sellReceipt = await sellTx.wait() as any;

      // USDC & ERC1155 Balance After Sell
      const usdcBalanceAfterSell = await usdc.balanceOf(user.address);
      const outcomeTokenBalanceAfterSell = await conditionalTokens.balanceOf(user.address, outcomeTokenId);

      console.log(`USDC Balance After Sell: ${ethers.utils.formatUnits(usdcBalanceAfterSell, 6)} USDC`);
      console.log(`Outcome Token Balance After Sell: ${ethers.utils.formatUnits(outcomeTokenBalanceAfterSell, 6)} Shares`);

      const sharesSoldEvent = sellReceipt.events.find(e => e.event === "SharesSold");
      const oddsUpdatedEventSell = sellReceipt.events.find(e => e.event === "OddsUpdated");

      expect(sharesSoldEvent).to.exist;
      expect(oddsUpdatedEventSell).to.exist;

      console.log(`
        ----------------------------------------
        Trade Summary (Sell)
        ----------------------------------------
        Outcome: ${sharesSoldEvent.args.outcome}
        Shares Sold: ${ethers.utils.formatUnits(sharesSoldEvent.args.shares, 6)}
        Gain: ${ethers.utils.formatUnits(sharesSoldEvent.args.actualGain, 6)} USDC
        ----------------------------------------
        Updated Odds After Sell
        ----------------------------------------
        Home: ${(ethers.BigNumber.from(oddsUpdatedEventSell.args.home).mul(10000).div(ethers.BigNumber.from("18446744073709551616")).toNumber() / 10000).toFixed(4)}
        Draw: ${(ethers.BigNumber.from(oddsUpdatedEventSell.args.draw).mul(10000).div(ethers.BigNumber.from("18446744073709551616")).toNumber() / 10000).toFixed(4)}
        Away: ${(ethers.BigNumber.from(oddsUpdatedEventSell.args.away).mul(10000).div(ethers.BigNumber.from("18446744073709551616")).toNumber() / 10000).toFixed(4)}
        ----------------------------------------
      `);
      const liquidityPoolBalance = await usdc.balanceOf(LIQUIDITY_POOL_ADDRESS);
      console.log(`Liquidity Pool Balance: ${ethers.utils.formatUnits(liquidityPoolBalance, 6)} USDC`);

    });
  });
});