import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { DuelTokenFaucet } from "typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying DuelTokenFaucet with account:", deployer.address);

  const Faucet = await ethers.getContractFactory("DuelTokenFaucet");
  const faucet = (await Faucet.deploy()) as DuelTokenFaucet;

  await faucet.waitForDeployment();

  const faucetAddress = await faucet.getAddress();
  console.log("DuelTokenFaucet deployed at:", faucetAddress);

  // --------------------------------------------------------------------
  // WRITE DEPLOYED ADDRESS TO .env
  // --------------------------------------------------------------------
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = "";
  try {
    envContent = fs.readFileSync(envPath, "utf8");
  } catch (error) {
    console.log(".env file not found, a new one will be created.");
  }

  function setEnvVar(key: string, value: string) {
    const regex = new RegExp(`^${key}=.*`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  setEnvVar("DUEL_TOKEN_FAUCET_ADDRESS", faucetAddress);

  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("\nDeployment address added to .env!");
}

main().catch((error) => {
  console.error("Deployment error:", error);
  process.exitCode = 1;
});