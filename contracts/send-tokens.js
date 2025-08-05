require("dotenv/config");
const { ethers } = require("ethers");

const RPC_URL = "https://rpc-liveduel.cogitus.io/jqrUCybt4XforDsXXhOV/ext/bc/2MWwV2p26iaMu6GxJf2sCfwEVQCTSYA2rBBhAFGzHVdsxgVhxD/rpc"; 

const PRIVATE_KEY = process.env.DUEL_PRIVATE_KEY;

const RECIPIENT = "0xFE8Fe150A6F4903B0E8F0C5294bF34fEedAD3024";

const AMOUNT_TOKEN = "100"; // 100 DUEL

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Sending from:", await wallet.getAddress());

  const address = await wallet.getAddress();
  console.log("Sending from:", address);

  const balance = await provider.getBalance(address);
  console.log("Balance before:", ethers.formatEther(balance), "Native Token");


  const tx = await wallet.sendTransaction({
    to: RECIPIENT,
    value: ethers.parseEther(AMOUNT_TOKEN), 
  });

  console.log("Sent Tokens:", tx.hash);
  await tx.wait();
  console.log("✅ Transaction confirmed!");
}

main().catch((err) => {
  console.error("❌ Error sending Tokens:", err);
});
