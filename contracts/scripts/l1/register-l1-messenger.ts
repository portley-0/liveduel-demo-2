import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  const registryAddress = process.env.L1_TELEPORTER_REGISTRY_ADDRESS;
  const messengerAddress = process.env.L1_TELEPORTER_MESSENGER_ADDRESS;

  if (!registryAddress || !messengerAddress) {
    throw new Error("Missing L1_TELEPORTER_REGISTRY_ADDRESS or L1_TELEPORTER_MESSENGER_ADDRESS in .env");
  }

  console.log("📡 Registering L1 TeleporterMessenger with L1 TeleporterRegistry...");
  console.log("Registry:", registryAddress);
  console.log("Messenger:", messengerAddress);

  const registry = await ethers.getContractAt("TeleporterRegistry", registryAddress);
  const tx = await registry.registerLocalTeleporter(messengerAddress);
  await tx.wait();

  console.log("✅ Registered local TeleporterMessenger on L1 successfully.");
}

main().catch((err) => {
  console.error("❌ Error registering L1 Messenger:", err);
  process.exit(1);
});
