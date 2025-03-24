import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { MockUSDC } from "../typechain-types";
import { DuelToken } from "../typechain-types";
import { LiquidityPool } from "../typechain-types";
import { MarketFactory } from "../typechain-types";
import { Whitelist } from "../typechain-types";

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

    const whitelist = (await ethers.getContractAt("Whitelist", WHITELIST_ADDRESS)) as Whitelist;

    try {
        // --------------------------------------------------------------------
        // Deploy MockUSDC
        // --------------------------------------------------------------------
        console.log("\nDeploying MockUSDC...");
        const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = (await MockUSDCFactory.deploy()) as MockUSDC;
        await mockUSDC.deployed();
        console.log("MockUSDC deployed to:", mockUSDC.address);

        // --------------------------------------------------------------------
        // Deploy DuelToken
        // --------------------------------------------------------------------
        console.log("\nDeploying DuelToken...");
        const DuelTokenFactory = await ethers.getContractFactory("DuelToken");
        const duelToken = (await DuelTokenFactory.deploy(deployer.address)) as DuelToken;
        await duelToken.deployed();
        console.log("DuelToken deployed to:", duelToken.address);

        // --------------------------------------------------------------------
        // Deploy LiquidityPool
        // --------------------------------------------------------------------
        console.log("\nDeploying LiquidityPool...");
        const LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
        const liquidityPool = (await LiquidityPoolFactory.deploy(
            deployer.address,
            mockUSDC.address,
            duelToken.address
        )) as LiquidityPool;
        await liquidityPool.deployed();
        console.log("LiquidityPool deployed to:", liquidityPool.address);

        // --------------------------------------------------------------------
        // Deploy MarketFactory
        // --------------------------------------------------------------------
        console.log("\nDeploying MarketFactory...");
        const MarketFactoryFactory = await ethers.getContractFactory("MarketFactory");
        const marketFactory = (await MarketFactoryFactory.deploy(
            liquidityPool.address,
            WHITELIST_ADDRESS,
            RESULTS_CONSUMER_ADDRESS,
            mockUSDC.address,
            CONDITIONAL_TOKENS_ADDRESS,
            LMSR_MARKET_MAKER_FACTORY_ADDRESS
        )) as MarketFactory;
        await marketFactory.deployed();
        console.log("MarketFactory deployed to:", marketFactory.address);

        // Transfer ownership of Whitelist to MarketFactory
        console.log("\nTransferring Whitelist ownership to MarketFactory...");
        const whitelistTransferTx = await whitelist.transferOwnership(marketFactory.address);
        console.log("Transaction hash:", whitelistTransferTx.hash);
        await whitelistTransferTx.wait();
        console.log(`Whitelist ownership transferred to MarketFactory at ${marketFactory.address}`);

        // --------------------------------------------------------------------
        // Mint initial USDC and Duel, add initial liquidity
        // --------------------------------------------------------------------
        console.log("\nAdding initial liquidity...");

        const initialUSDC = ethers.utils.parseUnits("1000000", 6);
        const initialDUEL = ethers.utils.parseUnits("10000000", 18);

        console.log("Minting MockUSDC to deployer...");
        const mockUSDCMintTx = await mockUSDC.mint(initialUSDC);
        console.log("Transaction hash:", mockUSDCMintTx.hash);
        await mockUSDCMintTx.wait();
        console.log("MockUSDC minted to deployer.");

        console.log("Minting DuelToken to deployer...");
        const duelTokenMintTx = await duelToken.mint(deployer.address, initialDUEL);
        console.log("Transaction hash:", duelTokenMintTx.hash);
        await duelTokenMintTx.wait();
        console.log("DuelToken minted to deployer.");

        // Approve the LiquidityPool
        console.log("\nApproving LiquidityPool to spend MockUSDC...");
        await mockUSDC.connect(deployer).approve(liquidityPool.address, initialUSDC);
        console.log("MockUSDC approved for LiquidityPool.");

        console.log("Approving LiquidityPool to spend DuelToken...");
        await duelToken.connect(deployer).approve(liquidityPool.address, initialDUEL);
        console.log("DuelToken approved for LiquidityPool.");

        console.log("Transferring DuelToken ownership to LiquidityPool...");
        const transferDuelOwnershipTx = await duelToken.transferOwnership(liquidityPool.address);
        console.log("Transaction hash:", transferDuelOwnershipTx.hash);
        await transferDuelOwnershipTx.wait();
        console.log("DuelToken ownership transferred to LiquidityPool.");

        console.log("Calling addInitialLiquidity...");
        const liquidityTx = await liquidityPool.connect(deployer).addInitialLiquidity(
            initialUSDC,
            initialDUEL
        );
        console.log("Transaction hash:", liquidityTx.hash);
        await liquidityTx.wait();
        console.log("Initial liquidity added successfully!");

        // --------------------------------------------------------------------
        // Transfer LiquidityPool ownership -> MarketFactory
        // --------------------------------------------------------------------
        console.log("\nTransferring LiquidityPool ownership to MarketFactory...");
        const liquidityPoolTransferTx = await liquidityPool.transferOwnership(marketFactory.address);
        console.log("Transaction hash:", liquidityPoolTransferTx.hash);
        await liquidityPoolTransferTx.wait();
        console.log(`LiquidityPool ownership transferred to MarketFactory at ${marketFactory.address}`);

        // --------------------------------------------------------------------
        // Initialize MarketFactory
        // --------------------------------------------------------------------
        console.log("\nInitializing MarketFactory...");
        const initTx = await marketFactory.initialize();
        console.log("Transaction hash:", initTx.hash);
        await initTx.wait();
        console.log("MarketFactory initialized successfully.");

        // --------------------------------------------------------------------
        // WRITE DEPLOYED ADDRESSES TO .env
        // --------------------------------------------------------------------
        const envPath = path.resolve(__dirname, "../.env");
        let envContent = fs.readFileSync(envPath, "utf8");

        function setEnvVar(key: string, value: string) {
            const regex = new RegExp(`^${key}=.*`, "m");
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent += `\n${key}=${value}`;
            }
        }

        setEnvVar("MOCK_USDC_ADDRESS", mockUSDC.address);
        setEnvVar("DUEL_TOKEN_ADDRESS", duelToken.address);
        setEnvVar("LIQUIDITY_POOL_ADDRESS", liquidityPool.address);
        setEnvVar("MARKET_FACTORY_ADDRESS", marketFactory.address);

        fs.writeFileSync(envPath, envContent, "utf8");
        console.log("\nDeployment addresses added to .env!");

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