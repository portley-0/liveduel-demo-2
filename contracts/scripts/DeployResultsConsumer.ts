import "@nomiclabs/hardhat-ethers";
import { Signer } from "ethers";
import { ethers } from "hardhat"

const { SecretsManager, createGist } = require("@chainlink/functions-toolkit")

require("@chainlink/env-enc").config()

const fs = require("fs")

async function deploy() {

    const privateKey = process.env.PRIVATE_KEY!;
    const provider = new ethers.providers.JsonRpcProvider(process.env.AVALANCHE_FUJI_RPC_URL);
    const signer: Signer = new ethers.Wallet(privateKey, provider);


    const functionsRouterAddress = "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0";
    let donId = "fun-avalanche-fuji-1";

    const source = fs.readFileSync("./API-request.js").toString();

    const subscriptionId = 12321;

    const secretsManager = new SecretsManager({ signer, functionsRouterAddress, donId});
    await secretsManager.initialize();


    let encryptedSecretsReference = [];
    let gistUrl;

    const encryptedSecrets = await secretsManager.encryptSecrets({ apiKey: process.env.API_KEY ?? "" });

    gistUrl = await createGist(process.env["GITHUB_API_TOKEN"], JSON.stringify(encryptedSecrets));
    encryptedSecretsReference = await secretsManager.encryptSecretsUrls([gistUrl]);

    const secrets = encryptedSecretsReference;

    const router = functionsRouterAddress;

    const ResultsConsumerFactory = await ethers.getContractFactory("ResultsConsumer");

    donId = ethers.utils.formatBytes32String('fun-avalanche-fuji-1');

    const resultsConsumer = await ResultsConsumerFactory.deploy(router, donId, source, secrets, subscriptionId);
    await resultsConsumer.deployed();

    console.log("ResultsConsumer deployed to:", resultsConsumer.address);

} 

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
