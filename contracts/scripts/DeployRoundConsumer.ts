import "@nomiclabs/hardhat-ethers";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { RoundConsumer, MarketFactory } from "../typechain-types";

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

    const source = fs.readFileSync("./round-request.js").toString();

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

    const RoundConsumerFactory = await ethers.getContractFactory("RoundConsumer");
    donId = ethers.utils.formatBytes32String('fun-avalanche-fuji-1');

    const roundConsumer = (await RoundConsumerFactory.deploy(
        router,
        donId,
        source,
        secrets,
        subscriptionId,
        { gasLimit: 8_000_000 } 
    )) as RoundConsumer;

    await roundConsumer.deployed();

    console.log("RoundConsumer deployed to:", roundConsumer.address);

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

    setEnvVar("ROUND_CONSUMER_ADDRESS", roundConsumer.address);

    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("\nDeployment address added to .env!");

    interface EnvVars {
        [key: string]: string;
    }

    const envVars: EnvVars = fs.readFileSync(envPath, "utf8")
    .split("\n")
    .reduce((acc: EnvVars, line: string) => {
        const [key, value] = line.split("=");
        if (key && value) acc[key.trim()] = value.trim();
        return acc;
    }, {});

    const MARKET_FACTORY_ADDRESS = envVars["MARKET_FACTORY_ADDRESS"];
    const marketFactory = (await ethers.getContractAt("MarketFactory", MARKET_FACTORY_ADDRESS, signer)) as MarketFactory;

    console.log("\nTransferring RoundConsumer ownership to MarketFactory...");
    const transferTx = await roundConsumer.transferOwnership(MARKET_FACTORY_ADDRESS);
    await transferTx.wait();
    console.log("Ownership transferred.");

    console.log("Setting RoundConsumer in MarketFactory...");
    const setTx = await marketFactory.setRoundConsumer(roundConsumer.address);
    await setTx.wait();
    console.log("RoundConsumer linked to MarketFactory.");
    console.log("Accepting RoundConsumer ownership in MarketFactory...");
    await marketFactory.acceptRoundConsumerOwnership();
}

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
