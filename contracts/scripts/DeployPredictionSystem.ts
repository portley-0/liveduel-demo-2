import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    // Hardcoded Gnosis contract addresses
    const CONDITIONAL_TOKENS_ADDRESS = "0xD6824aaeaf8a42EacdE96D931c5712519fD06103";
    const LMSR_MARKET_MAKER_FACTORY_ADDRESS = "0x3143a32AD5d927217EB493A17A4B99C5Bd5C4A54";

    // Hardcoded Whitelist address
    const WHITELIST_ADDRESS = "0x74290391d8035b1F0b99E4C9B7F22dD490703600";
    
    // Hardcoded ResultsConsumer address 
    const RESULTS_CONSUMER_ADDRESS = "0x798DB79459CD33fF7B09a8e7D0B5EA85b89bEdD1";

    console.log("Deploying contracts with deployer address:", deployer.address);

    // Deploy MockUSDC
    console.log("Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();
    console.log("MockUSDC deployed to:", mockUSDC.address);
 
    // Deploy DuelToken
    console.log("Deploying DuelToken...");
    const DuelToken = await ethers.getContractFactory("DuelToken");
    const duelToken = await DuelToken.deploy(deployer.address);
    await duelToken.deployed();
    console.log("DuelToken deployed to:", duelToken.address);

    // Deploy ConditionalTokensWrapper
    console.log("Deploying ConditionalTokensWrapper...");
    const ConditionalTokensWrapper = await ethers.getContractFactory("ConditionalTokensWrapper");
    const conditionalTokensWrapper = await ConditionalTokensWrapper.deploy(CONDITIONAL_TOKENS_ADDRESS);
    await conditionalTokensWrapper.deployed();
    console.log("ConditionalTokensWrapper deployed to:", conditionalTokensWrapper.address);

    // Deploy LMSRMarketMakerFactoryWrapper
    console.log("Deploying LMSRMarketMakerFactoryWrapper...");
    const LMSRMarketMakerFactoryWrapper = await ethers.getContractFactory("LMSRMarketMakerFactoryWrapper");
    const lmsrMarketMakerFactoryWrapper = await LMSRMarketMakerFactoryWrapper.deploy(LMSR_MARKET_MAKER_FACTORY_ADDRESS);
    await lmsrMarketMakerFactoryWrapper.deployed();
    console.log("LMSRMarketMakerFactoryWrapper deployed to:", lmsrMarketMakerFactoryWrapper.address);

    // Deploy LiquidityPool
    console.log("Deploying LiquidityPool...");
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(
        deployer.address,
        mockUSDC.address,
        duelToken.address
    );
    await liquidityPool.deployed();
    console.log("LiquidityPool deployed to:", liquidityPool.address);

    // Deploy WhitelistWrapper
    console.log("Deploying WhitelistWrapper...");
    const WhitelistWrapper = await ethers.getContractFactory("WhitelistWrapper");
    const whitelistWrapper = await WhitelistWrapper.deploy(WHITELIST_ADDRESS);
    await whitelistWrapper.deployed();
    console.log("WhitelistWrapper deployed to:", whitelistWrapper.address);

    // Deploy MarketFactory
    console.log("Deploying MarketFactory...");
    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    const marketFactory = await MarketFactory.deploy(
        liquidityPool.address,
        whitelistWrapper.address,
        RESULTS_CONSUMER_ADDRESS,
        mockUSDC.address,
        conditionalTokensWrapper.address,
        lmsrMarketMakerFactoryWrapper.address 
    );
    await marketFactory.deployed();
    console.log("MarketFactory deployed to:", marketFactory.address);

    // Transfer ownership of LiquidityPool to MarketFactory
    console.log("Transferring LiquidityPool ownership to MarketFactory...");
    await liquidityPool.transferOwnership(marketFactory.address);
    console.log(`LiquidityPool ownership transferred to MarketFactory at ${marketFactory.address}`);

    console.log("Transferring Whitelist ownership to MarketFactory...");
    const whitelistContract = await ethers.getContractAt("Whitelist", WHITELIST_ADDRESS);
    await whitelistContract.transferOwnership(marketFactory.address);
    console.log("Whitelist ownership transferred to MarketFactory at:", marketFactory.address);

    // Transfer ownership of DuelToken to LiquidityPool
    console.log("Transferring DuelToken ownership to LiquidityPool...");
    await duelToken.transferOwnership(liquidityPool.address);
    console.log(`DuelToken ownership transferred to LiquidityPool at ${liquidityPool.address}`);

    // Add initial liquidity
    console.log("Adding initial liquidity...");
    const initialUSDC = ethers.utils.parseUnits("10000", 18);
    const initialDUEL = ethers.utils.parseUnits("100000", 18);

    // Mint MockUSDC and DuelToken for deployer
    await mockUSDC.mint(deployer.address, initialUSDC);
    await duelToken.connect(deployer).mint(deployer.address, initialDUEL);

    // Approve LiquidityPool to spend MockUSDC and DuelToken
    await mockUSDC.connect(deployer).approve(liquidityPool.address, initialUSDC);
    await duelToken.connect(deployer).approve(liquidityPool.address, initialDUEL);

    // Add liquidity
    await liquidityPool.connect(deployer).addInitialLiquidity(initialUSDC, initialDUEL);
    console.log("Initial liquidity added successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error deploying contracts:", error);
        process.exit(1);
    });
