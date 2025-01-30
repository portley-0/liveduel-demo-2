import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import * as chai from "chai";
import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
chai.use(solidity);
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

describe("MarketFactory - deployPredictionMarket() ", function () {
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS!;
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS!;
  const WHITELIST_WRAPPER_ADDRESS = process.env.WHITELIST_WRAPPER_ADDRESS!;

  let marketFactory: Contract;
  let liquidityPool: Contract;
  let whitelist: Contract;

  let oldUsdcReserve: BigNumber;

  // The match ID and future timestamp
  const MATCH_ID = 1318672; 
  const MATCH_TIMESTAMP = 1738220400; 

  let owner: any;

  before(async () => {
    [owner] = await ethers.getSigners();
    console.log("Using owner address:", owner.address);

    const MarketFactoryAbi = [
      "function deployPredictionMarket(uint256 matchId, uint256 matchTimestamp) external",
      "event PredictionMarketDeployed(uint256 matchId, address marketAddress, uint256 matchTimestamp)",
      "function predictionMarkets(uint256) external view returns (address)",
      "function lmsrMarketMakers(uint256) external view returns (address)",
      "function matchConditionIds(uint256) external view returns (bytes32)",
      "function matchTimestamps(uint256) external view returns (uint256)",
    ];
    const LiquidityPoolAbi = [
      "function usdcReserve() external view returns (uint256)",
      "function authorizedMarkets(address) external view returns (bool)",
    ];
    const WhitelistAbi = [
      "function isUserWhitelisted(address) external view returns (bool)",
    ];

    marketFactory = new ethers.Contract(MARKET_FACTORY_ADDRESS, MarketFactoryAbi, owner);
    liquidityPool = new ethers.Contract(LIQUIDITY_POOL_ADDRESS, LiquidityPoolAbi, owner);
    whitelist = new ethers.Contract(WHITELIST_WRAPPER_ADDRESS, WhitelistAbi, owner);

    oldUsdcReserve = await liquidityPool.usdcReserve();
    console.log("Current LiquidityPool USDC reserve:", oldUsdcReserve.toString());
  });

  it("should deploy a new PredictionMarket and withdraw liquidity", async function () {
    console.log("Calling deployPredictionMarket...");

    let tx, receipt;
    try {
      // Attempt the transaction
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
    // Verify the event arguments 
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
    console.log("New LiquidityPool USDC reserve:", newUsdcReserve.toString());
    // Expect difference ~ 5000 USDC (5000 * 10^18)
    const expectedWithdraw = ethers.BigNumber.from("5000000000000000000000"); 
    const actualWithdraw = oldUsdcReserve.sub(newUsdcReserve);

    expect(actualWithdraw).to.equal(
      expectedWithdraw,
      `Expected a 5000 USDC withdrawal, got ${actualWithdraw.toString()}`
    );

    // ============= WHITELIST + LIQUIDITYPOOL AUTH =============
    const isWhitelisted = await whitelist.isUserWhitelisted(marketAddress);
    expect(isWhitelisted).to.be.true;

    const isAuthorizedInPool = await liquidityPool.authorizedMarkets(marketAddress);
    expect(isAuthorizedInPool).to.be.true;

    console.log("All checks passed. Market deployed successfully!");
  });
});
