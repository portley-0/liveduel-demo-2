import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import * as chai from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
chai.use(solidity);
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import {
  MarketFactory,
  LiquidityPool,
  Whitelist,
} from "../typechain-types";

dotenv.config();

describe("MarketFactory - deployPredictionMarket() ", function () {
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS!;
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS!;
  const WHITELIST_ADDRESS = process.env.WHITELIST_ADDRESS!;

  let marketFactory: MarketFactory;
  let liquidityPool: LiquidityPool;
  let whitelist: Whitelist;

  let oldUsdcReserve: BigNumber;

  // The match ID and future timestamp from API Football
  const MATCH_ID = 1222840; 
  const MATCH_TIMESTAMP = 1741168800; 

  let owner: any;

  before(async () => {
    [owner] = await ethers.getSigners();
    console.log("Using owner address:", owner.address);

    marketFactory = (await ethers.getContractAt(
      "MarketFactory",
      MARKET_FACTORY_ADDRESS,
      owner
    )) as MarketFactory;

    liquidityPool = (await ethers.getContractAt(
      "LiquidityPool",
      LIQUIDITY_POOL_ADDRESS,
      owner
    )) as LiquidityPool;

    whitelist = (await ethers.getContractAt(
      "Whitelist",
      WHITELIST_ADDRESS,
      owner
    )) as Whitelist;

    oldUsdcReserve = await liquidityPool.usdcReserve();
    console.log("Current LiquidityPool USDC reserve:", ethers.utils.formatUnits(oldUsdcReserve, 6));
  });

  it("should deploy a new PredictionMarket and withdraw liquidity", async function () {
    console.log("Calling deployPredictionMarket...");

    let tx, receipt;
    try {
      tx = await marketFactory.connect(owner).deployPredictionMarket(MATCH_ID, MATCH_TIMESTAMP);
      receipt = await tx.wait();
      console.log("Transaction confirmed in block:", receipt.blockNumber);
    } catch (error) {
      console.error("Error details:", error);
      throw error;
    }

    // ============= PARSE PREDICTIONMARKETDEPLOYED EVENT =============
    const pmDeployedEvent = receipt.events?.find(e => e.event === "PredictionMarketDeployed");
    expect(pmDeployedEvent, "PredictionMarketDeployed event not found").to.exist;

    const { matchId, marketAddress, matchTimestamp } = pmDeployedEvent?.args || {};
   
    expect(matchId.toNumber()).to.equal(MATCH_ID, "Event matchId mismatch");
    expect(matchTimestamp.toNumber()).to.equal(MATCH_TIMESTAMP, "Event matchTimestamp mismatch");

    console.log("Deployed PredictionMarket at:", marketAddress);

    // ============= Update .env with newly deployed address =============
    const envFilePath = path.resolve(__dirname, "../.env"); 
    let envConfig = dotenv.parse(fs.readFileSync(envFilePath));

    envConfig.TEST_PREDICTION_MARKET_ADDRESS = marketAddress;

    let updatedEnv = "";
    for (const key in envConfig) {
      updatedEnv += `${key}=${envConfig[key]}\n`;
    }

    fs.writeFileSync(envFilePath, updatedEnv);
    console.log(`.env updated with TEST_PREDICTION_MARKET_ADDRESS=${marketAddress}`);

    // ============= CHECK MAPPINGS =============
    const storedMarketAddr = await marketFactory.predictionMarkets(MATCH_ID);
    expect(storedMarketAddr).to.equal(marketAddress, "predictionMarkets mapping mismatch");

    const lmsrAddress = await marketFactory.lmsrMarketMakers(MATCH_ID);
    expect(lmsrAddress).to.not.equal(ethers.constants.AddressZero, "LMSR MarketMaker is zero");
    console.log("LMSR MarketMaker address:", lmsrAddress);

    const conditionId = await marketFactory.matchConditionIds(MATCH_ID);
    expect(conditionId).to.not.equal(ethers.constants.HashZero, "ConditionId is zero");
    console.log("Condition ID:", conditionId);

    const onChainMatchTimestamp = await marketFactory.matchTimestamps(MATCH_ID);
    expect(onChainMatchTimestamp).to.equal(matchTimestamp, "matchTimestamps mismatch");
    console.log("On-chain matchTimestamp:", onChainMatchTimestamp.toString());    

    // ============= VERIFY LIQUIDITY WITHDRAWAL =============
    const newUsdcReserve = await liquidityPool.usdcReserve();
    console.log("New LiquidityPool USDC reserve:", ethers.utils.formatUnits(newUsdcReserve, 6));
    
    const expectedWithdraw = ethers.utils.parseUnits("30000", 6); 
    const actualWithdraw = oldUsdcReserve.sub(newUsdcReserve);

    expect(actualWithdraw).to.equal(
      expectedWithdraw,
      `Expected a 30,000 USDC withdrawal, got ${ethers.utils.formatUnits(actualWithdraw, 6)} USDC }`
    );

    // ============= WHITELIST + LIQUIDITYPOOL AUTH =============
    const isWhitelisted = await whitelist.isWhitelisted(marketAddress);
    expect(isWhitelisted).to.be.true;

    const isAuthorizedInPool = await liquidityPool.authorizedMarkets(marketAddress);
    expect(isAuthorizedInPool).to.be.true;

    console.log("All checks passed. Market deployed successfully!");
  });
});
