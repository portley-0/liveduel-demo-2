import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { LiquidityPool } from "../../typechain-types";
import { MarketFactory } from "../../typechain-types";
import { Whitelist } from "../../typechain-types";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\nDeploying L1 Core with:", deployer.address);

    const CONDITIONAL_TOKENS = process.env.CONDITIONAL_TOKENS_ADDRESS!;
    const LMSR_FACTORY = process.env.LMSR_MARKET_MAKER_FACTORY_ADDRESS!;
    const WHITELIST = process.env.WHITELIST_ADDRESS!;
    const USDC = process.env.ERC20_TOKEN_REMOTE_ADDRESS!;
    const TELEPORTER = process.env.TELEPORTER_ADDRESS!;
    const C_CHAIN_ID = process.env.C_CHAIN_BLOCKCHAIN_ID!;

    if (!CONDITIONAL_TOKENS || !LMSR_FACTORY || !WHITELIST || !USDC || !TELEPORTER || !C_CHAIN_ID) {
        throw new Error("Missing required .env values.");
    }

    const whitelist = await ethers.getContractAt("Whitelist", WHITELIST) as unknown as Whitelist;

    // Deploy LiquidityPool
    const LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPoolFactory.deploy(deployer.address, USDC) as LiquidityPool;
    await liquidityPool.waitForDeployment();
    const liquidityPoolAddress = await liquidityPool.getAddress();
    console.log("LiquidityPool deployed to:", liquidityPoolAddress);

    // Deploy MarketFactory
    const MarketFactoryFactory = await ethers.getContractFactory("MarketFactory");
    const marketFactory = await MarketFactoryFactory.deploy(
        liquidityPoolAddress,
        WHITELIST,
        USDC,
        CONDITIONAL_TOKENS,
        LMSR_FACTORY,
        TELEPORTER,
        C_CHAIN_ID
    ) as MarketFactory;
    await marketFactory.waitForDeployment();
    const marketFactoryAddress = await marketFactory.getAddress();
    console.log("MarketFactory deployed to:", marketFactoryAddress);

    // Transfer ownership of Whitelist
    const whitelistTx = await whitelist.transferOwnership(marketFactoryAddress);
    await whitelistTx.wait();
    console.log("Whitelist ownership transferred.");

    // Transfer LiquidityPool ownership
    const liquidityPoolTx = await liquidityPool.transferOwnership(marketFactoryAddress);
    await liquidityPoolTx.wait();
    console.log("LiquidityPool ownership transferred.");

    // Initialize MarketFactory
    const initTx = await marketFactory.initialize();
    await initTx.wait();
    console.log("MarketFactory initialized.");

    // --------------------------------------------------------------------
    // WRITE DEPLOYED ADDRESSES TO .env
    // --------------------------------------------------------------------
    const envPath = path.resolve(__dirname, "../../.env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

    function setEnvVar(key: string, value: string) {
        const regex = new RegExp(`^${key}=.*`, "m");
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    }

    setEnvVar("LIQUIDITY_POOL_ADDRESS", liquidityPoolAddress);
    setEnvVar("MARKET_FACTORY_ADDRESS", marketFactoryAddress);
    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("\n✔ Addresses written to .env");
}

main().catch((err) => {
    console.error("❌ Deployment error:", err);
    process.exit(1);
});
