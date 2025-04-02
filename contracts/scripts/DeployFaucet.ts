import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying TestnetAVAXFaucet with account:", deployer.address);

  const Faucet = await ethers.getContractFactory("TestnetAVAXFaucet");
  const faucet = await Faucet.deploy();

  await faucet.deployed();

  console.log("TestnetAVAXFaucet deployed at:", faucet.address);
}

main().catch((error) => {
  console.error("Deployment error:", error);
  process.exitCode = 1;
});
