import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying MockUSDC with account:", deployer.address);

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    const address = await mockUsdc.getAddress();

    console.log("MockUSDC deployed to:", address);
    updateEnv("MOCK_USDC_ADDRESS", address);
}

function updateEnv(key: string, value: string) {
    const envPath = path.resolve(__dirname, "../../.env");
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const re = new RegExp(`^${key}=.*`, "m");

    if (re.test(content)) {
        content = content.replace(re, `${key}=${value}`);
    } else {
        content += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, content, "utf8");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
