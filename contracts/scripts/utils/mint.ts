import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {

  const RPC = process.env.RPC_URL;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const TO = process.env.TO;
  const AMOUNT = process.env.AMOUNT;

  if (!RPC || !PRIVATE_KEY || !TO || !AMOUNT) {
    console.log("Error: Missing one or more variables")
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

  const tx = await wallet.sendTransaction({
    to: TO,
    value: ethers.utils.parseEther(AMOUNT),
  });

  console.log("tx:", tx.hash);
  await tx.wait();
  console.log("✅ sent");
}

main().catch((e) => { console.error(e); process.exit(1); });
