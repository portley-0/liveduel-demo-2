import "@nomiclabs/hardhat-ethers";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { ResultsConsumer } from "../typechain-types";

const { SecretsManager, createGist } = require("@chainlink/functions-toolkit");
require("@chainlink/env-enc").config();
const fs = require("fs");
const path = require("path");

async function deploy() {
    const privateKey = process.env.PRIVATE_KEY!;
    const provider = new ethers.providers.JsonRpcProvider(process.env.AVALANCHE_FUJI_RPC_URL);
    const signer: Signer = new ethers.Wallet(privateKey, provider);

    const functionsRouterAddress = "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0";
    let donId = "fun-avalanche-fuji-1";

    const source = fs.readFileSync("./API-request.js").toString();

    // Subscription ID is a unique identifier for the subscription
    const subscriptionId = 15388;

    const secretsManager = new SecretsManager({ signer, functionsRouterAddress, donId });
    await secretsManager.initialize();

    let encryptedSecretsReference = [];
    let gistUrl;

    const encryptedSecrets = await secretsManager.encryptSecrets({
        apiKey: process.env.API_KEY ?? ""
    });

    gistUrl = await createGist(process.env["GITHUB_API_TOKEN"], JSON.stringify(encryptedSecrets));
    encryptedSecretsReference = await secretsManager.encryptSecretsUrls([gistUrl]);

    const secrets = encryptedSecretsReference;
    const router = functionsRouterAddress;

    const ResultsConsumerFactory = await ethers.getContractFactory("ResultsConsumer");
    donId = ethers.utils.formatBytes32String('fun-avalanche-fuji-1');

    const resultsConsumer = (await ResultsConsumerFactory.deploy(
        router,
        donId,
        source,
        secrets,
        subscriptionId
    )) as ResultsConsumer; 

    await resultsConsumer.deployed();

    console.log("ResultsConsumer deployed to:", resultsConsumer.address);

    // Update .env file with deployment address
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

    setEnvVar("RESULTS_CONSUMER_ADDRESS", resultsConsumer.address);

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("\nDeployment addresses added to .env!");
}

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
