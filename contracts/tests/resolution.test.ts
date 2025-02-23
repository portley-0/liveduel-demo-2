import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

describe("Market Resolution Test", function () {
  this.timeout(120000); 

  let user: any;
  let marketFactory: any;
  let predictionMarket: any;
  let conditionalTokens: any;
  let liquidityPool: any;
  let marketMaker: any;

  const PREDICTION_MARKET_ADDRESS = process.env.TEST_PREDICTION_MARKET_ADDRESS!;
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS!;
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS!;
  const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS!;
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;

  let matchId: number;
  let resolvedOutcome: number;

  before(async function () {
    [user] = await ethers.getSigners();

    const PredictionMarketAbi = [
      "function matchId() external view returns (uint256)",
      "function isResolved() external view returns (bool)",
      "function resolvedOutcome() external view returns (uint8)",
      "function getBettors() external view returns (address[] memory)",
      "function conditionId() external view returns (bytes32)",
      "function marketMaker() external view returns (address)",
      "event MarketResolved(uint256 indexed matchId, uint8 indexed outcome)"
    ];

    const MarketFactoryAbi = [
      "function getActiveMatches() external view returns (uint256[])",
      "event PredictionMarketResolved(uint256 indexed matchId, uint8 indexed outcome)"
    ];

    const ConditionalTokensAbi = [
      "function getConditionId(address, bytes32, uint) external view returns (bytes32)",
      "function balanceOf(address account, uint256 id) external view returns (uint256)",
      "function getCollectionId(bytes32, bytes32, uint ) external view returns (bytes32)",
      "function balanceOfBatch(address[] memory accounts, uint256[] memory ids) external view returns (uint256[] memory)",
      "function getPositionId(address, bytes32) external view returns (uint256)"
    ];

    const LiquidityPoolAbi = [ 
      "event FundsReturned(address indexed market, uint256 amount)"
    ];

    predictionMarket = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PredictionMarketAbi, user);
    marketFactory = new ethers.Contract(MARKET_FACTORY_ADDRESS, MarketFactoryAbi, user);
    conditionalTokens = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, ConditionalTokensAbi, user);
    liquidityPool = new ethers.Contract(LIQUIDITY_POOL_ADDRESS, LiquidityPoolAbi, user);

    matchId = await predictionMarket.matchId();
    console.log(`Match ID: ${matchId}`);
  });

  it("Verifies that the match ID is no longer in active matches", async function () {
    const activeMatches = await marketFactory.getActiveMatches();
    const activeMatchesStr = activeMatches.map((id: any) => id.toString());
    const matchIdStr = matchId.toString();

    console.log("Active Matches:", activeMatchesStr);
    expect(activeMatchesStr).to.not.include(matchIdStr, `Match ID ${matchIdStr} is still active!`);
    console.log(`Match ID ${matchIdStr} successfully removed from active matches.`);
  });

  it("Logs the PredictionMarketResolved event", async function () {
    const latestBlock = await ethers.provider.getBlockNumber();
    const fromBlock = latestBlock - 2000; 
    const filter = marketFactory.filters.PredictionMarketResolved(matchId);
    const events = await marketFactory.queryFilter(filter, fromBlock, latestBlock);
    
    expect(events.length).to.be.gt(0, "PredictionMarketResolved event was not found!");

    const event = events[0];
    resolvedOutcome = event.args.outcome;
    console.log(`
      PredictionMarketResolved Event
      ----------------------------------------
      Match ID: ${event.args.matchId.toString()}
      Resolved Outcome: ${event.args.outcome}
      ----------------------------------------
    `);
  });

  it("Logs the MarketResolved event in PredictionMarket", async function () {
    const filter = predictionMarket.filters.MarketResolved(matchId);
    const events = await predictionMarket.queryFilter(filter);
    expect(events.length).to.be.gt(0, "MarketResolved event was not found!");

    const event = events[0];
    console.log(`
      MarketResolved Event
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
    expect(storedResolvedOutcome).to.equal(resolvedOutcome);

    console.log(`Market isResolved: ${isResolved}`);
    console.log(`Resolved Outcome Stored: ${storedResolvedOutcome}`);
  });

  it("Verifies the required collateral for payouts in ConditionalTokens", async function () {
    // Step 1: Retrieve the `conditionId` from the PredictionMarket
    const conditionId = await predictionMarket.conditionId();

    // Step 2: Get the index set for the resolved outcome
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

    // Step 3: Retrieve bettors
    const bettors = await predictionMarket.getBettors();

    // Step 4: Fetch balances for all bettors in one batch call
    const ids = Array(bettors.length).fill(winningPositionId);
    const balances = await conditionalTokens.balanceOfBatch(bettors, ids);

    // Step 5: Calculate the total required collateral for payouts
    let requiredCollateral = ethers.BigNumber.from(0);
    for (const balance of balances) {
        requiredCollateral = requiredCollateral.add(balance);
    }

    // Step 6: Get the remaining collateral in the MarketMaker
    const fullIndexSet = (1 << 0) | (1 << 1) | (1 << 2);
    const usdcPositionId = await conditionalTokens.getPositionId(
        MOCK_USDC_ADDRESS,
        await conditionalTokens.getCollectionId(ethers.constants.HashZero, conditionId, fullIndexSet)
    );
    const remainingCollateral = await conditionalTokens.balanceOf(marketMaker.address, usdcPositionId);

    console.log(`
      Collateral Check
      ----------------------------------------
      Total Required Payouts: ${ethers.utils.formatUnits(requiredCollateral, 6)} USDC
      MarketMaker Remaining Collateral: ${ethers.utils.formatUnits(remainingCollateral, 6)} USDC
      ----------------------------------------
    `);

    // Step 7: Ensure MarketMaker has enough collateral to cover payouts
    expect(remainingCollateral).to.be.gte(
        requiredCollateral.toNumber(),
        "MarketMaker does not have enough collateral for payouts!"
    );
  });


  it("Logs the FundsReturned event in LiquidityPool", async function () {

    const latestBlock = await ethers.provider.getBlockNumber();
    const fromBlock = latestBlock - 2000; 
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
    const MarketMakerAbi = [
      "function stage() external view returns (uint8)"
    ];
    marketMaker = new ethers.Contract(await predictionMarket.marketMaker(), MarketMakerAbi, user);
    const marketStage = await marketMaker.stage();

    expect(marketStage).to.equal(2, "MarketMaker stage is not closed!"); // 2 = Closed
    console.log(`MarketMaker stage is correctly set to Closed (2).`);
  });
});
