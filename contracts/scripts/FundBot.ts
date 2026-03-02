import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

const BOT_ADDRESS = "0xFE8Fe150A6F4903B0E8F0C5294bF34fEedAD3024";
const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;
const AMOUNT = ethers.utils.parseUnits("5000000", 6); // 5 million USDC

async function main() {
  if (!MOCK_USDC_ADDRESS) {
    throw new Error("MOCK_USDC_ADDRESS not set in .env");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Bot: ${BOT_ADDRESS}`);
  console.log(`MockUSDC: ${MOCK_USDC_ADDRESS}`);
  console.log(`Amount: 5,000,000 mUSDC\n`);

  const usdc = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS, deployer);

  // Mint to deployer
  console.log("Minting 5M mUSDC to deployer...");
  const mintTx = await usdc["mint(uint256)"](AMOUNT);
  await mintTx.wait();
  console.log(`Minted. TxHash: ${mintTx.hash}`);

  // Transfer to bot
  console.log("Transferring to bot...");
  const transferTx = await usdc.transfer(BOT_ADDRESS, AMOUNT);
  await transferTx.wait();
  console.log(`Transferred. TxHash: ${transferTx.hash}`);

  // Verify
  const botBalance = await usdc.balanceOf(BOT_ADDRESS);
  console.log(`\nBot mUSDC balance: ${ethers.utils.formatUnits(botBalance, 6)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
