import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import dotenv from "dotenv";

dotenv.config();

describe("SanityCheck", function () {
  let deployer: any;
  
  // Contract references
  let marketFactory: any;
  let liquidityPool: any;
  let duelToken: any;
  let whitelist: any;
  let mockUsdc: any;
  let conditionalTokens: any; 
  let lmsrMarketMakerFactory: any;

  // Addresses from .env
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS || "";
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS || "";
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || "";
  const DUEL_TOKEN_ADDRESS = process.env.DUEL_TOKEN_ADDRESS || "";
  const WHITELIST_ADDRESS = process.env.WHITELIST_ADDRESS || "";
  const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS || "";
  const LMSR_MARKET_MAKER_FACTORY_ADDRESS = process.env.LMSR_MARKET_MAKER_FACTORY_ADDRESS || "";
  const RESULTS_CONSUMER_ADDRESS = process.env.RESULTS_CONSUMER_ADDRESS || "";

  before(async function () {
    [deployer] = await ethers.getSigners();

    marketFactory = await ethers.getContractAt("MarketFactory", MARKET_FACTORY_ADDRESS);
    liquidityPool = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL_ADDRESS);
    mockUsdc = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS);
    duelToken = await ethers.getContractAt("DuelToken", DUEL_TOKEN_ADDRESS);
    whitelist = await ethers.getContractAt("Whitelist", WHITELIST_ADDRESS);
    conditionalTokens = await ethers.getContractAt("ConditionalTokens", CONDITIONAL_TOKENS_ADDRESS);
    lmsrMarketMakerFactory = await ethers.getContractAt("LMSRMarketMakerFactory", LMSR_MARKET_MAKER_FACTORY_ADDRESS);

  });

  // ----------------------------------------------
  // Initialization Check
  // ----------------------------------------------
  it("should confirm MarketFactory is initialized", async function () {
    const initialized = await marketFactory.initialized();
    expect(initialized).to.be.true;
  });

  // ----------------------------------------------
  // Basic Setup & Ownership Checks
  // ----------------------------------------------
  it("should confirm MarketFactory references the correct external addresses", async function () {
    // Check each public reference in MarketFactory
    const actualPool = (await marketFactory.liquidityPool()).toLowerCase();
    const actualWhitelist = (await marketFactory.whitelist()).toLowerCase();
    const actualResultsConsumer = (await marketFactory.resultsConsumer()).toLowerCase();
    const actualUsdc = (await marketFactory.usdc()).toLowerCase(); 
    const actualConditional = (await marketFactory.conditionalTokens()).toLowerCase();
    const actualLmsr = (await marketFactory.lmsrFactory()).toLowerCase();

    expect(actualPool).to.equal(LIQUIDITY_POOL_ADDRESS.toLowerCase());
    expect(actualWhitelist).to.equal(WHITELIST_ADDRESS.toLowerCase());
    expect(actualResultsConsumer).to.equal(RESULTS_CONSUMER_ADDRESS.toLowerCase());
    expect(actualUsdc).to.equal(MOCK_USDC_ADDRESS.toLowerCase());
    expect(actualConditional).to.equal(CONDITIONAL_TOKENS_ADDRESS.toLowerCase());
    expect(actualLmsr).to.equal(LMSR_MARKET_MAKER_FACTORY_ADDRESS.toLowerCase());
  });

  it("should confirm ownership relationships", async function () {
    // LiquidityPool -> owner should be MarketFactory
    const poolOwner = (await liquidityPool.owner()).toLowerCase();
    expect(poolOwner).to.equal(MARKET_FACTORY_ADDRESS.toLowerCase());

    // DuelToken -> owner should be LiquidityPool
    const duelOwner = (await duelToken.owner()).toLowerCase();
    expect(duelOwner).to.equal(LIQUIDITY_POOL_ADDRESS.toLowerCase());

    // Whitelist -> owner should be MarketFactory
    const whitelistOwner = (await whitelist.owner()).toLowerCase();
    expect(whitelistOwner).to.equal(MARKET_FACTORY_ADDRESS.toLowerCase());
  });

  // ----------------------------------------------
  // LiquidityPool Checks
  // ----------------------------------------------
  it("should confirm LiquidityPool has correct USDC and DUEL reserves", async function () {
    const [usdcReserve, duelReserve] = await liquidityPool.getReserves();
    const initialUSDC = ethers.utils.parseUnits("100000", 6);
    const initialDUEL = ethers.utils.parseUnits("1000000", 18);

    expect(usdcReserve.eq(initialUSDC)).to.be.true;
    expect(duelReserve.eq(initialDUEL)).to.be.true;
  });

  it("should confirm MarketFactory is authorized in LiquidityPool", async function () {
    const isAuthorized = await liquidityPool.authorizedMarkets(MARKET_FACTORY_ADDRESS);
    expect(isAuthorized).to.be.true;
  });

  // ----------------------------------------------
  // Whitelist Checks
  // ----------------------------------------------

  it("should confirm MarketFactory is actually whitelisted in Whitelist", async function () {
    const isWhitelisted = await whitelist.isWhitelisted(MARKET_FACTORY_ADDRESS);
    expect(isWhitelisted).to.be.true;
  });

});
