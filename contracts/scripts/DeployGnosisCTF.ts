// scripts/deployGnosis.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    // Get the deployer signer
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // 1. Deploy Fixed192x64Math library
    const Fixed192x64MathFactory = await ethers.getContractFactory("Fixed192x64Math");
    const fixed192x64Math = await Fixed192x64MathFactory.deploy();
    await fixed192x64Math.deployed();
    console.log("Fixed192x64Math deployed to:", fixed192x64Math.address);

    // 2. Deploy ConditionalTokens contract
    const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
    const conditionalTokens = await ConditionalTokensFactory.deploy();
    await conditionalTokens.deployed();
    console.log("ConditionalTokens deployed to:", conditionalTokens.address);

    // 3. Deploy Whitelist contract
    const WhitelistFactory = await ethers.getContractFactory("Whitelist");
    const whitelist = await WhitelistFactory.deploy();
    await whitelist.deployed();
    console.log("Whitelist deployed to:", whitelist.address);

    // 4. Deploy LMSRMarketMakerFactory, linking Fixed192x64Math library.
    const LMSRMarketMakerFactoryFactory = await ethers.getContractFactory("LMSRMarketMakerFactory", {
        libraries: {
        Fixed192x64Math: fixed192x64Math.address,
        },
    });
    const lmsrMarketMakerFactory = await LMSRMarketMakerFactoryFactory.deploy();
    await lmsrMarketMakerFactory.deployed();
    console.log("LMSRMarketMakerFactory deployed to:", lmsrMarketMakerFactory.address);

    // --------------------------------------------------------------------
    // WRITE DEPLOYED ADDRESSES TO .env
    // --------------------------------------------------------------------
    const envPath = path.resolve(__dirname, "../.env");
    let envContent = "";
    try {
        envContent = fs.readFileSync(envPath, "utf8");
    } catch (error) {
        console.log(".env file not found, a new one will be created.");
    }

    function setEnvVar(key: string, value: string) {
        const regex = new RegExp(`^${key}=.*`, "m");
        if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
        envContent += `\n${key}=${value}`;
        }
    }

    setEnvVar("CONDITIONAL_TOKENS_ADDRESS", conditionalTokens.address);
    setEnvVar("WHITELIST_ADDRESS", whitelist.address);
    setEnvVar("LMSR_MARKET_MAKER_FACTORY_ADDRESS", lmsrMarketMakerFactory.address);

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("\nDeployment addresses added to .env!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment error:", error);
        process.exit(1);
    });
