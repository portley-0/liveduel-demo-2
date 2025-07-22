import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { Fixed192x64Math } from "../../typechain-types";
import { ConditionalTokens } from "../../typechain-types";
import { Whitelist } from "../../typechain-types";
import { LMSRMarketMakerFactory } from "../../typechain-types";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", balance.toString());

    // 1. Deploy Fixed192x64Math library
    const Fixed192x64MathFactory = await ethers.getContractFactory("Fixed192x64Math");
    const fixed192x64Math = (await Fixed192x64MathFactory.deploy()) as Fixed192x64Math;
    await fixed192x64Math.waitForDeployment();
    const fixed192x64MathAddress = await fixed192x64Math.getAddress();
    console.log("Fixed192x64Math deployed to:", fixed192x64MathAddress);

    // 2. Deploy ConditionalTokens contract
    const ConditionalTokensFactory = await ethers.getContractFactory("ConditionalTokens");
    const conditionalTokens = (await ConditionalTokensFactory.deploy()) as ConditionalTokens;
    await conditionalTokens.waitForDeployment();
    const conditionalTokensAddress = await conditionalTokens.getAddress();
    console.log("ConditionalTokens deployed to:", conditionalTokensAddress);

    // 3. Deploy Whitelist contract
    const WhitelistFactory = await ethers.getContractFactory("Whitelist");
    const whitelist = (await WhitelistFactory.deploy()) as Whitelist;
    await whitelist.waitForDeployment();
    const whitelistAddress = await whitelist.getAddress();
    console.log("Whitelist deployed to:", whitelistAddress);

    // 4. Deploy LMSRMarketMakerFactory, linking Fixed192x64Math library.
    const LMSRMarketMakerFactoryFactory = await ethers.getContractFactory("LMSRMarketMakerFactory", {
        libraries: {
            Fixed192x64Math: fixed192x64MathAddress,
        },
    });
    const lmsrMarketMakerFactory = (await LMSRMarketMakerFactoryFactory.deploy()) as LMSRMarketMakerFactory;
    await lmsrMarketMakerFactory.waitForDeployment();
    const lmsrMarketMakerFactoryAddress = await lmsrMarketMakerFactory.getAddress();
    console.log("LMSRMarketMakerFactory deployed to:", lmsrMarketMakerFactoryAddress);

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

    setEnvVar("CONDITIONAL_TOKENS_ADDRESS", conditionalTokensAddress);
    setEnvVar("WHITELIST_ADDRESS", whitelistAddress);
    setEnvVar("LMSR_MARKET_MAKER_FACTORY_ADDRESS", lmsrMarketMakerFactoryAddress);

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("\nDeployment addresses added to .env!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment error:", error);
        process.exit(1);
    });
