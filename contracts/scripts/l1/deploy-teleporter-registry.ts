import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  const messengerAddress = process.env.L1_TELEPORTER_MESSENGER_ADDRESS;
  if (!messengerAddress) throw new Error("Missing L1_TELEPORTER_MESSENGER_ADDRESS in .env");

  console.log("Deploying TeleporterRegistry from:", await deployer.getAddress());
  console.log("Registering messenger:", messengerAddress);

  const TeleporterRegistry = await ethers.getContractFactory("TeleporterRegistry");

  const initialEntries = [
    {
      version: 1,
      protocolAddress: messengerAddress,
    },
  ];

  const registry = await TeleporterRegistry.deploy(initialEntries);
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log("TeleporterRegistry deployed at:", registryAddress);

  updateEnv("L1_TELEPORTER_REGISTRY_ADDRESS", registryAddress);
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
  console.error("Error deploying TeleporterRegistry:", error);
  process.exit(1);
});
