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
    const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || "";

    const ERC20TokenHomeFactory = await ethers.getContractFactory("ERC20TokenHome");
    const homeBridge = await ERC20TokenHomeFactory.deploy(
        TELEPORTER_REGISTRY,
        TELEPORTER_MANAGER,
        MIN_TELEPORTER_VERSION,
        MOCK_USDC_ADDRESS,
        6 // USDC decimals
    );
    await homeBridge.waitForDeployment();
    const homeBridgeAddress = await homeBridge.getAddress();

    console.log("ERC20TokenHome deployed to:", homeBridgeAddress);
    updateEnv("ERC20_TOKEN_HOME_ADDRESS", homeBridgeAddress);
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
    fs.writeFileSync(envPath, envContent, "utf8");
}

main().catch((error) => {
    console.error("Deployment error:", error);
    process.exit(1);
});
