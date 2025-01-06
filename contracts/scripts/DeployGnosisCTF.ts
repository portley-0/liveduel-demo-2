import "@nomiclabs/hardhat-ethers";
import { ethers, Signer } from "ethers";
import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    console.log("Deploying Gnosis ConditionalTokens, LMSRMarketMakerFactory, and Whitelist contracts...");

    // Get the first signer and cast it to `Signer`
    const [hardhatSigner] = await hre.ethers.getSigners();
    const signer = hardhatSigner as unknown as Signer; // Cast HardhatEthersSigner to Signer

    console.log("Deploying contracts with the account:", await signer.getAddress());

    // Load ConditionalTokens artifact
    const conditionalTokensArtifactPath = path.resolve(
        __dirname,
        "../node_modules/@gnosis.pm/conditional-tokens-contracts/build/contracts/ConditionalTokens.json"
    );
    const conditionalTokensArtifact = JSON.parse(fs.readFileSync(conditionalTokensArtifactPath, "utf-8"));

    // Deploy ConditionalTokens
    console.log("Deploying ConditionalTokens...");
    const ConditionalTokensFactory = new ethers.ContractFactory(
        conditionalTokensArtifact.abi,
        conditionalTokensArtifact.bytecode,
        signer
    );
    const conditionalTokens = await ConditionalTokensFactory.deploy();
    await conditionalTokens.deployed();
    console.log("ConditionalTokens deployed to:", conditionalTokens.address);

    // Load LMSRMarketMakerFactory artifact
    const lmsrMarketMakerFactoryArtifactPath = path.resolve(
        __dirname,
        "../node_modules/@gnosis.pm/conditional-tokens-market-makers/build/contracts/LMSRMarketMakerFactory.json"
    );
    const lmsrMarketMakerFactoryArtifact = JSON.parse(fs.readFileSync(lmsrMarketMakerFactoryArtifactPath, "utf-8"));

    // Deploy LMSRMarketMakerFactory
    console.log("Deploying LMSRMarketMakerFactory...");
    const LMSRMarketMakerFactoryFactory = new ethers.ContractFactory(
        lmsrMarketMakerFactoryArtifact.abi,
        lmsrMarketMakerFactoryArtifact.bytecode,
        signer
    );
    const lmsrMarketMakerFactory = await LMSRMarketMakerFactoryFactory.deploy();
    await lmsrMarketMakerFactory.deployed();
    console.log("LMSRMarketMakerFactory deployed to:", lmsrMarketMakerFactory.address);

    // Load Whitelist artifact
    const whitelistArtifactPath = path.resolve(
        __dirname,
        "../node_modules/@gnosis.pm/conditional-tokens-market-makers/build/contracts/Whitelist.json"
    );
    const whitelistArtifact = JSON.parse(fs.readFileSync(whitelistArtifactPath, "utf-8"));

    // Deploy Whitelist
    console.log("Deploying Whitelist...");
    const WhitelistFactory = new ethers.ContractFactory(
        whitelistArtifact.abi,
        whitelistArtifact.bytecode,
        signer
    );
    const whitelist = await WhitelistFactory.deploy();
    await whitelist.deployed();
    console.log("Whitelist deployed to:", whitelist.address);

    // Log deployment info
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
