import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const registryAddress = process.env.L1_TELEPORTER_REGISTRY_ADDRESS;

  if (!registryAddress) {
    throw new Error("Missing TELEPORTER_REGISTRY_ADDRESS in .env");
  }

  console.log("Deploying TeleporterMessenger from:", await deployer.getAddress());

  const TeleporterMessenger = await ethers.getContractFactory("TeleporterMessenger");
  const messenger = await TeleporterMessenger.deploy(); // ⬅️ no args
  await messenger.waitForDeployment();

  const messengerAddress = await messenger.getAddress();
  console.log("TeleporterMessenger deployed at:", messengerAddress);

  updateEnv("L1_TELEPORTER_MESSENGER_ADDRESS", messengerAddress);
}

function updateEnv(key: string, value: string) {
  const envPath = path.resolve(__dirname, "../../.env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const regex = new RegExp(`^${key}=.*`, "m");
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  fs.writeFileSync(envPath, envContent, "utf8");
}

main().catch((error) => {
  console.error("Error deploying TeleporterMessenger:", error);
  process.exit(1);
});
