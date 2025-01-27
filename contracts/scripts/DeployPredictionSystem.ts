import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("\n=====================================================================================");
    console.log("Deploying contracts with deployer address:", deployer.address);
    console.log("=====================================================================================\n");

    const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS || "";
    const LMSR_MARKET_MAKER_FACTORY_ADDRESS = process.env.LMSR_MARKET_MAKER_FACTORY_ADDRESS || "";
    const WHITELIST_ADDRESS = process.env.WHITELIST_ADDRESS || "";
    const RESULTS_CONSUMER_ADDRESS = process.env.RESULTS_CONSUMER_ADDRESS || "";

    try {
        // Load Whitelist artifact
        const whitelistArtifactPath = path.resolve(
            __dirname,
            "../node_modules/@gnosis.pm/conditional-tokens-market-makers/build/contracts/Whitelist.json"
        );

        if (!fs.existsSync(whitelistArtifactPath)) {
            throw new Error("Whitelist artifact not found at: " + whitelistArtifactPath);
        }

        const whitelistArtifact = JSON.parse(fs.readFileSync(whitelistArtifactPath, "utf8"));

        console.log("Attaching to deployed Whitelist...");
        const Whitelist = new ethers.Contract(WHITELIST_ADDRESS, whitelistArtifact.abi, deployer);
        console.log("Attached to Whitelist at:", WHITELIST_ADDRESS);

        // Deploy MockUSDC
        console.log("\nDeploying MockUSDC...");
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();
        await mockUSDC.deployed();
        console.log("MockUSDC deployed to:", mockUSDC.address);

        // Deploy DuelToken
        console.log("\nDeploying DuelToken...");
        const DuelToken = await ethers.getContractFactory("DuelToken");
        const duelToken = await DuelToken.deploy(deployer.address);
        await duelToken.deployed();
        console.log("DuelToken deployed to:", duelToken.address);

        // Deploy ConditionalTokensWrapper
        console.log("\nDeploying ConditionalTokensWrapper...");
        const ConditionalTokensWrapper = await ethers.getContractFactory("ConditionalTokensWrapper");
        const conditionalTokensWrapper = await ConditionalTokensWrapper.deploy(CONDITIONAL_TOKENS_ADDRESS);
        await conditionalTokensWrapper.deployed();
        console.log("ConditionalTokensWrapper deployed to:", conditionalTokensWrapper.address);

        // Deploy LMSRMarketMakerFactoryWrapper
        console.log("\nDeploying LMSRMarketMakerFactoryWrapper...");
        const LMSRMarketMakerFactoryWrapper = await ethers.getContractFactory("LMSRMarketMakerFactoryWrapper");
        const lmsrMarketMakerFactoryWrapper = await LMSRMarketMakerFactoryWrapper.deploy(LMSR_MARKET_MAKER_FACTORY_ADDRESS, mockUSDC.address);
        await lmsrMarketMakerFactoryWrapper.deployed();
        console.log("LMSRMarketMakerFactoryWrapper deployed to:", lmsrMarketMakerFactoryWrapper.address);

        // Deploy LiquidityPool
        console.log("\nDeploying LiquidityPool...");
        const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
        const liquidityPool = await LiquidityPool.deploy(
            deployer.address,
            mockUSDC.address,
            duelToken.address
        );
        await liquidityPool.deployed();
        console.log("LiquidityPool deployed to:", liquidityPool.address);

        // Deploy WhitelistWrapper
        console.log("\nDeploying WhitelistWrapper...");
        const WhitelistWrapper = await ethers.getContractFactory("WhitelistWrapper");
        const whitelistWrapper = await WhitelistWrapper.deploy(WHITELIST_ADDRESS);
        await whitelistWrapper.deployed();
        console.log("WhitelistWrapper deployed to:", whitelistWrapper.address);

        // Transfer ownership of Whitelist to WhitelistWrapper
        console.log("\nTransferring Whitelist ownership to WhitelistWrapper...");
        const transferTx = await Whitelist.connect(deployer).transferOwnership(whitelistWrapper.address);
        console.log("Transaction hash:", transferTx.hash);
        await transferTx.wait();
        console.log("Whitelist ownership transferred to WhitelistWrapper.");

        // Deploy MarketFactory
        console.log("\nDeploying MarketFactory...");
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

        // Transfer ownership of WhitelistWrapper to MarketFactory
        console.log("\nTransferring WhitelistWrapper ownership to MarketFactory...");
        const whitelistWrapperTransferTx = await whitelistWrapper.transferOwnership(marketFactory.address);
        console.log("Transaction hash:", whitelistWrapperTransferTx.hash);
        await whitelistWrapperTransferTx.wait();
        console.log(`WhitelistWrapper ownership transferred to MarketFactory at ${marketFactory.address}`);

        // Add initial liquidity
        console.log("\nAdding initial liquidity...");
        const initialUSDC = ethers.utils.parseUnits("10000", 6);
        const initialDUEL = ethers.utils.parseUnits("100000", 18);

        console.log("Minting MockUSDC...");
        const mockUSDCMintTx = await mockUSDC.mint(initialUSDC.toString());
        console.log("Transaction hash:", mockUSDCMintTx.hash);
        await mockUSDCMintTx.wait();
        console.log("MockUSDC minted to deployer.");

        console.log("Minting DuelToken...");
        const duelTokenMintTx = await duelToken.mint(deployer.address, initialDUEL.toString());
        console.log("Transaction hash:", duelTokenMintTx.hash);
        await duelTokenMintTx.wait();
        console.log("DuelToken minted to deployer.");

        console.log("Approving LiquidityPool to spend MockUSDC...");
        await mockUSDC.connect(deployer).approve(liquidityPool.address, initialUSDC.toString());
        console.log("MockUSDC approved for LiquidityPool.");

        console.log("Approving LiquidityPool to spend DuelToken...");
        await duelToken.connect(deployer).approve(liquidityPool.address, initialDUEL.toString());
        console.log("DuelToken approved for LiquidityPool.");

        console.log("Transferring DuelToken ownership to LiquidityPool...");
        const transferDuelOwnershipTx = await duelToken.transferOwnership(liquidityPool.address);
        console.log("Transaction hash:", transferDuelOwnershipTx.hash);
        await transferDuelOwnershipTx.wait();
        console.log("DuelToken ownership transferred to LiquidityPool.");

        console.log("Adding liquidity...");
        const liquidityTx = await liquidityPool.connect(deployer).addInitialLiquidity(
            initialUSDC.toString(),
            initialDUEL.toString()
        );
        console.log("Transaction hash:", liquidityTx.hash);
        await liquidityTx.wait();
        console.log("Initial liquidity added successfully!");

        // Transfer ownership of LiquidityPool to MarketFactory
        console.log("\nTransferring LiquidityPool ownership to MarketFactory...");
        const liquidityPoolTransferTx = await liquidityPool.transferOwnership(marketFactory.address);
        console.log("Transaction hash:", liquidityPoolTransferTx.hash);
        await liquidityPoolTransferTx.wait();
        console.log(`LiquidityPool ownership transferred to MarketFactory at ${marketFactory.address}`);
        
        // Initialize MarketFactory
        console.log("\nInitializing MarketFactory...");
        const initTx = await marketFactory.initialize();
        console.log("Transaction hash:", initTx.hash);
        await initTx.wait();
        console.log("MarketFactory initialized successfully.");

    } catch (error) {
        console.error("\nError during deployment:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\nError in main execution:", error);
        process.exit(1);
    });
