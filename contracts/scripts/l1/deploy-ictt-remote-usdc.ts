import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    const TELEPORTER_REGISTRY = process.env.TELEPORTER_REGISTRY_ADDRESS || "";
    const TELEPORTER_MANAGER = process.env.TELEPORTER_MANAGER || "";
    const MIN_TELEPORTER_VERSION = Number(process.env.MIN_TELEPORTER_VERSION) || 1;
    const ERC20_TOKEN_HOME_ADDRESS = process.env.ERC20_TOKEN_HOME_ADDRESS || "";
    const C_CHAIN_BLOCKCHAIN_ID = process.env.C_CHAIN_BLOCKCHAIN_ID || "";

    const settings = {
        teleporterRegistryAddress: TELEPORTER_REGISTRY,
        teleporterManager: TELEPORTER_MANAGER,
        minTeleporterVersion: MIN_TELEPORTER_VERSION,
        blockchainID: C_CHAIN_BLOCKCHAIN_ID,
        tokenHomeAddress: ERC20_TOKEN_HOME_ADDRESS,
    };

    const ERC20TokenRemoteFactory = await ethers.getContractFactory("ERC20TokenRemote");
    const remoteBridge = await ERC20TokenRemoteFactory.deploy(
        settings,
        "USDC",
        "USDC",
        6 // USDC decimals
    );
    await remoteBridge.waitForDeployment();
    const remoteBridgeAddress = await remoteBridge.getAddress();

    console.log("ERC20TokenRemote deployed to:", remoteBridgeAddress);
    updateEnv("ERC20_TOKEN_REMOTE_ADDRESS", remoteBridgeAddress);
}

function updateEnv(key: string, value: string) {
    const envPath = path.resolve(__dirname, "../../.env");
    let envContent = fs.readFileSync(envPath, "utf8");
    const regex = new RegExp(`^${key}=.*`, "m");
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
        envContent += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, envContent, "utf8")
};

main().catch((error) => {
    console.error("Deployment error:", error);
    process.exit(1);
});
