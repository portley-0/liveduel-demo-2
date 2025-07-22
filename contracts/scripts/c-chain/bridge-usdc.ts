import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Bridging with:", signer.address);

    const tokenHomeAddress = process.env.ERC20_TOKEN_HOME_ADDRESS!;
    const usdcAddress = process.env.MOCK_USDC_ADDRESS!;
    const l1Recipient = process.env.LIQUIDITY_POOL_ADDRESS!;
    const l1BlockchainId = process.env.L1_BLOCKCHAIN_ID!;

    if (!tokenHomeAddress || !usdcAddress || !l1Recipient || !l1BlockchainId) {
        throw new Error("Missing required .env values: check ERC20_TOKEN_HOME_ADDRESS, MOCK_USDC_ADDRESS, LIQUIDITY_POOL_ADDRESS, L1_BLOCKCHAIN_ID");
    }

    const amount = ethers.parseUnits("10000000", 6); // 10000000 USDC

    const tokenHome = await ethers.getContractAt("ERC20TokenHome", tokenHomeAddress, signer as any);
    const usdc = await ethers.getContractAt("MockUSDC", usdcAddress, signer as any);

    console.log("Approving tokenHome to spend USDC...");
    const approveTx = await usdc.approve(tokenHomeAddress, amount);
    await approveTx.wait();
    console.log("✔ USDC approved");

    console.log("Bridging", ethers.formatUnits(amount, 6), "USDC to", l1Recipient);
    const bridgeTx = await tokenHome.bridgeTo(amount, l1Recipient, l1BlockchainId);
    await bridgeTx.wait();
    console.log("✅ USDC bridged successfully!");
}

main().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
});
