import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying Gnosis ConditionalTokens, LMSRMarketMakerFactory, and Whitelist contracts...");

    // Deploy ConditionalTokens
    console.log("Deploying ConditionalTokens...");
    const ConditionalTokens = await ethers.getContractFactory("ConditionalTokens");
    const conditionalTokens = await ConditionalTokens.deploy();
    await conditionalTokens.deployed();
    console.log("ConditionalTokens deployed to:", conditionalTokens.address);

    // Deploy LMSRMarketMakerFactory
    console.log("Deploying LMSRMarketMakerFactory...");
    const LMSRMarketMakerFactory = await ethers.getContractFactory("LMSRMarketMakerFactory");
    const lmsrMarketMakerFactory = await LMSRMarketMakerFactory.deploy();
    await lmsrMarketMakerFactory.deployed();
    console.log("LMSRMarketMakerFactory deployed to:", lmsrMarketMakerFactory.address);

    // Deploy Whitelist
    console.log("Deploying Whitelist...");
    const Whitelist = await ethers.getContractFactory("Whitelist");
    const whitelist = await Whitelist.deploy();
    await whitelist.deployed();
    console.log("Whitelist deployed to:", whitelist.address);

    // Save deployment info
    console.log("Saving deployed addresses...");
    const deploymentInfo = {
        ConditionalTokens: conditionalTokens.address,
        LMSRMarketMakerFactory: lmsrMarketMakerFactory.address,
        Whitelist: whitelist.address,
    };

    console.log("Deployment info:", deploymentInfo);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error deploying contracts:", error);
        process.exit(1);
    });
