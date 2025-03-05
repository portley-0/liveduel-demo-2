import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import dotenv from "dotenv";
import { BigNumber, Signer } from "ethers";
import { 
  PredictionMarket, 
  MarketFactory, 
  ConditionalTokens, 
  LiquidityPool, 
  LMSRMarketMaker 
} from "../typechain-types";

dotenv.config();

describe("Market Resolution Test", function () {
  this.timeout(120000);

  let user: Signer;
  let marketFactory: MarketFactory;
  let predictionMarket: PredictionMarket;
  let conditionalTokens: ConditionalTokens;
  let liquidityPool: LiquidityPool;
  let marketMaker: LMSRMarketMaker;

  const PREDICTION_MARKET_ADDRESS = process.env.TEST_PREDICTION_MARKET_ADDRESS!;
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS!;
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS!;
  const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS!;
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;

  let matchId: number;
  let resolvedOutcome: number;

  before(async function () {
    [user] = await ethers.getSigners();

    predictionMarket = await ethers.getContractAt("PredictionMarket", PREDICTION_MARKET_ADDRESS, user) as PredictionMarket;
    marketFactory = await ethers.getContractAt("MarketFactory", MARKET_FACTORY_ADDRESS, user) as MarketFactory;
    conditionalTokens = await ethers.getContractAt("ConditionalTokens", CONDITIONAL_TOKENS_ADDRESS, user) as ConditionalTokens;
    liquidityPool = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL_ADDRESS, user) as LiquidityPool;

    const marketMakerAddress = await predictionMarket.marketMaker();
    marketMaker = await ethers.getContractAt("LMSRMarketMaker", marketMakerAddress, user) as LMSRMarketMaker;


    matchId = (await predictionMarket.matchId()).toNumber();
    console.log(`Match ID: ${matchId}`);
  });

  it("Verifies that the match ID is no longer in active matches", async function () {
    const activeMatches = await marketFactory.getActiveMatches();
    const activeMatchesStr = activeMatches.map((id) => id.toString());
    const matchIdStr = matchId.toString();

    console.log("Active Matches:", activeMatchesStr);
    expect(activeMatchesStr).to.not.include(matchIdStr, `Match ID ${matchIdStr} is still active!`);
    console.log(`Match ID ${matchIdStr} successfully removed from active matches.`);
  });

  it("Logs the PredictionMarketResolved event", async function () {
    const latestBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(latestBlock - 2000, 0);
    const filter = marketFactory.filters.PredictionMarketResolved();
    const events = await marketFactory.queryFilter(filter, fromBlock, latestBlock);
    const filteredEvents = events.filter(event => event.args?.matchId?.eq(matchId));
    
    expect(events.length).to.be.gt(0, "PredictionMarketResolved event was not found!");
    resolvedOutcome = filteredEvents[0].args.outcome;

    console.log(`
      PredictionMarketResolved Event (MarketFactory)
      ----------------------------------------
      Match ID: ${filteredEvents[0].args.matchId.toString()}
      Resolved Outcome: ${filteredEvents[0].args.outcome}
      ----------------------------------------
    `);
  });

  it("Logs the MarketResolved event in PredictionMarket", async function () {
    const latestBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(latestBlock - 2000, 0);
    const filter = predictionMarket.filters.MarketResolved(matchId);
    const events = await predictionMarket.queryFilter(filter, fromBlock, latestBlock);
    
    expect(events.length).to.be.gt(0, "MarketResolved event was not found!");
    const event = events[0];
    console.log(`
      MarketResolved Event (PredictionMarket)
      ----------------------------------------
      Match ID: ${event.args.matchId.toString()}
      Resolved Outcome: ${event.args.outcome}
      ----------------------------------------
    `);
  });

  it("Checks that isResolved and resolvedOutcome are correctly set in PredictionMarket", async function () {
    const isResolved = await predictionMarket.isResolved();
    const storedResolvedOutcome = await predictionMarket.resolvedOutcome();

    expect(isResolved).to.be.true;
    expect(storedResolvedOutcome).to.equal(resolvedOutcome, "Stored resolved outcome does not match the expected outcome.");

    console.log(`Market isResolved: ${isResolved}`);
    console.log(`Resolved Outcome Stored: ${storedResolvedOutcome}`);
  });

  it("Verifies the required collateral for payouts in ConditionalTokens", async function () {
    const conditionId = await predictionMarket.conditionId();
    const indexSet = 1 << resolvedOutcome;
    const collectionId = await conditionalTokens.getCollectionId(
        ethers.constants.HashZero,
        conditionId,
        indexSet
    );

    const winningPositionId = await conditionalTokens.getPositionId(
      MOCK_USDC_ADDRESS,
      collectionId
    );

    const bettors = await predictionMarket.getBettors();

    const ids = Array(bettors.length).fill(winningPositionId);
    const balances = await conditionalTokens.balanceOfBatch(bettors, ids);
    let requiredCollateral = ethers.BigNumber.from(0);
    for (const balance of balances) {
        requiredCollateral = requiredCollateral.add(balance);
    }

    const marketMakerFunding = await conditionalTokens.balanceOf(marketMaker.address, winningPositionId);

    let wageredAmount = ethers.BigNumber.from(0);
    for (let i = 0; i < 3; i++) {
      await predictionMarket.totalWageredPerOutcome(i).then((amount) => {
        wageredAmount = wageredAmount.add(amount);
      });
    }

    const initialFunding = await marketMaker.funding();

    const remainingCollateral = initialFunding.add(wageredAmount);

    console.log(`
      Collateral Check
      ----------------------------------------
      Total Required Payouts: ${ethers.utils.formatUnits(requiredCollateral, 6)} USDC
      Remaining MarketMaker Funding: ${ethers.utils.formatUnits(marketMakerFunding, 6)} USDC
      Wagered Amount: ${ethers.utils.formatUnits(wageredAmount, 6)} USDC
      Remaining USDC Collateral: ${ethers.utils.formatUnits(remainingCollateral, 6)} USDC
      ----------------------------------------
    `);

    expect(remainingCollateral.toNumber()).to.be.gte(
      requiredCollateral.toNumber(),
      "MarketMaker does not have enough collateral for payouts!"
  );

  });

  it("Logs the FundsReturned event in LiquidityPool", async function () {
    const latestBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(latestBlock - 2000, 0);
    const filter = liquidityPool.filters.FundsReturned(PREDICTION_MARKET_ADDRESS);
    const events = await liquidityPool.queryFilter(filter, fromBlock, latestBlock);
    
    expect(events.length).to.be.gt(0, "FundsReturned event was not found!");
    const event = events[0];
    console.log(`
      FundsReturned Event
      ----------------------------------------
      Market Address: ${event.args.market}
      Amount: ${ethers.utils.formatUnits(event.args.amount, 6)} USDC
      ----------------------------------------
    `);
  });

  it("Checks that the MarketMaker stage is Closed", async function () {
    const marketStage = await marketMaker.stage();

    expect(marketStage).to.equal(2, "MarketMaker stage is not closed!");
    console.log(`MarketMaker stage is correctly set to Closed (2).`);
  });
});
