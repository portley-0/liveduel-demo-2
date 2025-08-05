// mintMockUSDC.js
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  // ── 1) CONFIG ────────────────────────────────────────────────────────────
  const RPC_URL     = process.env.AVALANCHE_FUJI_RPC_URL;      // e.g. https://api.avax-test.network/ext/bc/C/rpc
  const PRIVATE_KEY = process.env.PRIVATE_KEY;  // must be an account with mint rights

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

  const tokenAddress = "0x78FD2A3454A4F37C5518FE7E8AB07001DC0572Ce";
  const recipient    = "0xFE8Fe150A6F4903B0E8F0C5294bF34fEedAD3024";

  // ── 2) ABI WITH OVERLOADS ─────────────────────────────────────────────────
  const abi = [
    "function decimals() view returns (uint8)",
    "function mint(uint256 amount)",
    "function mint(address recipient)"
  ];

  const token = new ethers.Contract(tokenAddress, abi, wallet);

  // ── 3) CALCULATE BASE-UNITS FOR 1 000 000 000 000 TOKENS ───────────────────
  const decimals   = await token.decimals();
  const humanAmount= "1000000000000"; // 1 000 000 000 000
  const baseAmount = ethers.utils.parseUnits(humanAmount, decimals);
  console.log(`Minting ${humanAmount} (×10^${decimals} ⇒ ${baseAmount.toString()} base units)`);

  // ── 4) SEND TX ───────────────────────────────────────────────────────────
  const tx = await token["mint(uint256)"](baseAmount, {
    gasLimit: 200_000    // override as needed
  });
  console.log("Tx sent:", tx.hash);

  const receipt = await tx.wait();
  console.log(`✅ Minted in block ${receipt.blockNumber}`);
}

main().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
