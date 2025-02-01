import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import * as fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

describe("SanityCheck", function () {
  let deployer: any;
  
  // Contract references
  let marketFactory: any;
  let liquidityPool: any;
  let mockUsdc: any;
  let duelToken: any;
  let whitelistWrapper: any;
  let conditionalTokensWrapper: any;
  let lmsrMarketMakerFactoryWrapper: any;
  let gnosisWhitelist: any;

  // Addresses from .env
  const MARKET_FACTORY_ADDRESS = process.env.MARKET_FACTORY_ADDRESS || "";
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS || "";
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || "";
  const DUEL_TOKEN_ADDRESS = process.env.DUEL_TOKEN_ADDRESS || "";
  const WHITELIST_WRAPPER_ADDRESS = process.env.WHITELIST_WRAPPER_ADDRESS || "";
  const CONDITIONAL_TOKENS_WRAPPER_ADDRESS = process.env.CONDITIONAL_TOKENS_WRAPPER_ADDRESS || "";
  const LMSR_MARKET_MAKER_FACTORY_WRAPPER_ADDRESS = process.env.LMSR_MARKET_MAKER_FACTORY_WRAPPER_ADDRESS || "";
  const WHITELIST_ADDRESS = process.env.WHITELIST_ADDRESS || "";
  const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS || "";
  const LMSR_MARKET_MAKER_FACTORY_ADDRESS = process.env.LMSR_MARKET_MAKER_FACTORY_ADDRESS || "";
  const RESULTS_CONSUMER_ADDRESS = process.env.RESULTS_CONSUMER_ADDRESS || "";

  // Utility for reading storage slots
  function parseAddressFromSlot(rawSlotValue: string): string {
    // rawSlotValue is 32 bytes in hex; address is the rightmost 20 bytes
    const addressHex = "0x" + rawSlotValue.slice(-40);
    return ethers.utils.getAddress(addressHex); 
  }

  before(async function () {
    [deployer] = await ethers.getSigners();

    marketFactory = await ethers.getContractAt("MarketFactory", MARKET_FACTORY_ADDRESS);
    liquidityPool = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL_ADDRESS);
    mockUsdc = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS);
    duelToken = await ethers.getContractAt("DuelToken", DUEL_TOKEN_ADDRESS);
    whitelistWrapper = await ethers.getContractAt("WhitelistWrapper", WHITELIST_WRAPPER_ADDRESS);
    conditionalTokensWrapper = await ethers.getContractAt("ConditionalTokensWrapper", CONDITIONAL_TOKENS_WRAPPER_ADDRESS);
    lmsrMarketMakerFactoryWrapper = await ethers.getContractAt(
      "LMSRMarketMakerFactoryWrapper",
      LMSR_MARKET_MAKER_FACTORY_WRAPPER_ADDRESS
    );

    const whitelistArtifactPath = path.resolve(
      __dirname,
      "../node_modules/@gnosis.pm/conditional-tokens-market-makers/build/contracts/Whitelist.json"
    );
    if (!fs.existsSync(whitelistArtifactPath)) {
      throw new Error("Cannot find Gnosis Whitelist artifact at " + whitelistArtifactPath);
    }
    const whitelistArtifact = JSON.parse(fs.readFileSync(whitelistArtifactPath, "utf8"));
    
    gnosisWhitelist = new ethers.Contract(WHITELIST_ADDRESS, whitelistArtifact.abi, deployer);
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
    const actualLmsr = (await marketFactory.lmsrFactoryWrapper()).toLowerCase();

    expect(actualPool).to.equal(LIQUIDITY_POOL_ADDRESS.toLowerCase());
    expect(actualWhitelist).to.equal(WHITELIST_WRAPPER_ADDRESS.toLowerCase());
    expect(actualResultsConsumer).to.equal(RESULTS_CONSUMER_ADDRESS.toLowerCase());
    expect(actualUsdc).to.equal(MOCK_USDC_ADDRESS.toLowerCase());
    expect(actualConditional).to.equal(CONDITIONAL_TOKENS_WRAPPER_ADDRESS.toLowerCase());
    expect(actualLmsr).to.equal(LMSR_MARKET_MAKER_FACTORY_WRAPPER_ADDRESS.toLowerCase());
  });

  it("should confirm ownership relationships", async function () {
    // LiquidityPool -> owner should be MarketFactory
    const poolOwner = (await liquidityPool.owner()).toLowerCase();
    expect(poolOwner).to.equal(MARKET_FACTORY_ADDRESS.toLowerCase());

    // DuelToken -> owner should be LiquidityPool
    const duelOwner = (await duelToken.owner()).toLowerCase();
    expect(duelOwner).to.equal(LIQUIDITY_POOL_ADDRESS.toLowerCase());

    // WhitelistWrapper -> owner should be MarketFactory
    const whitelistWrapperOwner = (await whitelistWrapper.owner()).toLowerCase();
    expect(whitelistWrapperOwner).to.equal(MARKET_FACTORY_ADDRESS.toLowerCase());
  });

  // ----------------------------------------------
  // LiquidityPool Checks
  // ----------------------------------------------
  it("should confirm LiquidityPool has correct USDC and DUEL reserves", async function () {
    const [usdcReserve, duelReserve] = await liquidityPool.getReserves();
    const initialUSDC = ethers.utils.parseUnits("10000", 18);
    const initialDUEL = ethers.utils.parseUnits("100000", 18);

    // Compare BigNumbers via eq()
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
  it("should confirm the WhitelistWrapper is the owner of the Gnosis Whitelist contract", async function () {
    const gnosisWhitelistOwner = (await gnosisWhitelist.owner()).toLowerCase();
    expect(gnosisWhitelistOwner).to.equal(WHITELIST_WRAPPER_ADDRESS.toLowerCase());
  });

  it("should confirm MarketFactory is actually whitelisted in Gnosis Whitelist", async function () {
    const isWhitelisted = await gnosisWhitelist.isWhitelisted(MARKET_FACTORY_ADDRESS);
    expect(isWhitelisted).to.be.true;
  });

  // ----------------------------------------------
  // Wrapper -> Underlying Address Checks (via Storage Slots)
  // ----------------------------------------------
  it("WhitelistWrapper: stored 'whitelist' address should match WHITELIST_ADDRESS", async function () {
    // WhitelistWrapper inherits from Ownable: 
    //   slot 0 = `_owner`, slot 1 = `whitelist`
    const rawSlot = await ethers.provider.getStorageAt(WHITELIST_WRAPPER_ADDRESS, 1);
    const storedAddress = parseAddressFromSlot(rawSlot).toLowerCase();
    expect(storedAddress).to.equal(WHITELIST_ADDRESS.toLowerCase());
  });

  it("ConditionalTokensWrapper: 'conditionalTokens' should match CONDITIONAL_TOKENS_ADDRESS", async function () {
    // No inheritance, so slot 0 is 'conditionalTokens'
    const rawSlot = await ethers.provider.getStorageAt(CONDITIONAL_TOKENS_WRAPPER_ADDRESS, 0);
    const storedAddress = parseAddressFromSlot(rawSlot).toLowerCase();
    expect(storedAddress).to.equal(CONDITIONAL_TOKENS_ADDRESS.toLowerCase());
  });

  it("LMSRMarketMakerFactoryWrapper: 'lmsrFactory' should match LMSR_MARKET_MAKER_FACTORY_ADDRESS", async function () {
    // Also no inheritance, so slot 0 is 'lmsrFactory'
    const rawSlot = await ethers.provider.getStorageAt(LMSR_MARKET_MAKER_FACTORY_WRAPPER_ADDRESS, 0);
    const storedAddress = parseAddressFromSlot(rawSlot).toLowerCase();
    expect(storedAddress).to.equal(LMSR_MARKET_MAKER_FACTORY_ADDRESS.toLowerCase());
  });
});
