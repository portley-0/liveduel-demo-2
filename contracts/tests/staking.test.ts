import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import * as chai from "chai";
import { ethers } from "hardhat";
import dotenv from "dotenv";
import { solidity } from "ethereum-waffle";
chai.use(solidity);

dotenv.config();

describe("Staking and DUEL Flows ", function () {
  this.timeout(120000); // 2 minutes

  let deployer: any;
  let liquidityPool: any;
  let duelToken: any;
  let mockUsdc: any;

  // Addresses from .env
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS || "";
  const DUEL_TOKEN_ADDRESS = process.env.DUEL_TOKEN_ADDRESS || "";
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || "";

  before(async function () {
    [deployer] = await ethers.getSigners();

    // Attach to deployed contracts
    liquidityPool = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL_ADDRESS);
    duelToken = await ethers.getContractAt("DuelToken", DUEL_TOKEN_ADDRESS);
    mockUsdc = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS);

    const mintAmount = ethers.utils.parseUnits("10000", 6);
    console.log(
      `\n--- Minting ${ethers.utils.formatUnits(mintAmount, 6)} USDC (6 decimals) to deployer...`
    );
    const txMint = await mockUsdc.connect(deployer).mint(mintAmount);
    const receiptMint = await txMint.wait();
    console.log(`Mint TX status: ${receiptMint.status === 1 ? "Success" : "Fail"}`);

    const usdcBalance = await mockUsdc.balanceOf(deployer.address);
    console.log(
      `Deployer USDC Balance: ${ethers.utils.formatUnits(usdcBalance, 6)} (6 decimals)`
    );
  });

  // Log DUEL price + reserves in correct decimals
  async function logDuelPrice() {
    // For 1 USDC in 6 decimals => 1 * 10^6 = 1e6
    const oneUsdc = ethers.utils.parseUnits("1", 6);

    const [usdcReserve, duelReserve] = await liquidityPool.getReserves();
    // Check how many DUEL for 1 USDC
    const duelForOneUsdc = await liquidityPool.getSwapAmount(oneUsdc, usdcReserve, duelReserve);

    console.log(
      `DUEL Price => 1 USDC (6 dec) -> ${ethers.utils.formatUnits(duelForOneUsdc, 18)} DUEL`
    );
    console.log(
      `Reserves => USDC: ${ethers.utils.formatUnits(usdcReserve, 6)} (6 dec), ` +
      `DUEL: ${ethers.utils.formatUnits(duelReserve, 18)} (18 dec)`
    );
  }

  it("Scenario: Buy DUEL → Stake → Add Rewards → Claim → Partial Unstake → Full Unstake → Final Claim (0 Rewards)", async function () {
    /********************************************************************
     * Step 1: BUY DUEL
     ********************************************************************/
    console.log("\n--- STEP 1: BUY DUEL ---");

    await logDuelPrice();

    // Buying 10,000 USDC worth at 6 decimals
    const buyAmount = ethers.utils.parseUnits("10000", 6);
    await mockUsdc.connect(deployer).approve(liquidityPool.address, buyAmount);

    const duelBefore = await duelToken.balanceOf(deployer.address);
    console.log(`DUEL Before Buy: ${ethers.utils.formatUnits(duelBefore, 18)}`);

    // Perform buy
    const txBuy = await liquidityPool.connect(deployer).buyDuel(buyAmount);
    const receiptBuy = await txBuy.wait();
    console.log(`Buy TX status: ${receiptBuy.status === 1 ? "Success" : "Fail"}`);

    const duelAfter = await duelToken.balanceOf(deployer.address);
    console.log(`DUEL After Buy: ${ethers.utils.formatUnits(duelAfter, 18)}`);
    expect(duelAfter.sub(duelBefore)).to.be.gt(0);

    const buyEvent = receiptBuy.events?.find((e: any) => e.event === "DuelPurchased");
    expect(buyEvent).to.not.be.undefined;

    await logDuelPrice();

    /********************************************************************
     * Step 2: STAKE SOME DUEL
     ********************************************************************/
    console.log("\n--- STEP 2: STAKE DUEL ---");
    // 9,000 DUEL at 18 decimals
    const stakeAmount = ethers.utils.parseUnits("9000", 18);

    const approveTx = await duelToken.connect(deployer).approve(liquidityPool.address, stakeAmount);
    const approveReceipt = await approveTx.wait();
    console.log(`Approve TX status: ${approveReceipt.status === 1 ? "Success" : "Fail"}`);

    const stakedBefore = await liquidityPool.stakedBalances(deployer.address);
    console.log(`Staked Before: ${ethers.utils.formatUnits(stakedBefore, 18)}`);

    const txStake = await liquidityPool.connect(deployer).stake(stakeAmount);
    const receiptStake = await txStake.wait();
    console.log(`Stake TX status: ${receiptStake.status === 1 ? "Success" : "Fail"}`);

    const stakedAfter = await liquidityPool.stakedBalances(deployer.address);
    console.log(`Staked After: ${ethers.utils.formatUnits(stakedAfter, 18)}`);

    expect(stakedAfter.sub(stakedBefore)).to.eq(stakeAmount);

    /********************************************************************
     * Step 3: ADD REWARDS 
     ********************************************************************/
    console.log("\n--- STEP 3: ADD REWARDS ---");
    const rewardAmount = ethers.utils.parseUnits("10000", 6);

    const txMintRewards = await mockUsdc.connect(deployer).mint(rewardAmount);
    const rcptMintRewards = await txMintRewards.wait();
    console.log(`Mint Rewards TX status: ${rcptMintRewards.status === 1 ? "Success" : "Fail"}`);

    const txApproveRewards = await mockUsdc.connect(deployer).approve(liquidityPool.address, rewardAmount);
    const rcptApproveRewards = await txApproveRewards.wait();
    console.log(`Approve Rewards TX status: ${rcptApproveRewards.status === 1 ? "Success" : "Fail"}`);

    const txAddRewards = await liquidityPool.connect(deployer).addToRewardsPool(rewardAmount);
    const rcptAddRewards = await txAddRewards.wait();
    console.log(`AddToRewardsPool TX status: ${rcptAddRewards.status === 1 ? "Success" : "Fail"}`);

    console.log(
      `Added ${ethers.utils.formatUnits(rewardAmount, 6)} USDC (6 decimals) to rewards pool.`
    );

    /********************************************************************
     * Step 4: CLAIM REWARDS (Should Succeed while staked)
     ********************************************************************/
    console.log("\n--- STEP 4: CLAIM REWARDS (SUCCESS) ---");
    const usdcBeforeClaim = await mockUsdc.balanceOf(deployer.address);
    console.log(
      `USDC Before Claim: ${ethers.utils.formatUnits(usdcBeforeClaim, 6)} (6 decimals)`
    );

    const poolBalance = await mockUsdc.balanceOf(liquidityPool.address);
    console.log(
      "Pool's USDC (raw):",
      poolBalance.toString(),
      "=>",
      `${ethers.utils.formatUnits(poolBalance, 6)} (6 decimals)`
    );

    const txClaim = await liquidityPool.connect(deployer).claimRewards();
    const rcptClaim = await txClaim.wait();
    console.log(`Claim TX status: ${rcptClaim.status === 1 ? "Success" : "Fail"}`);

    const claimEvent = rcptClaim.events?.find((e: any) => e.event === "RewardsClaimed");
    expect(claimEvent).to.not.be.undefined;
    console.log(
      "Already Claimed (USDC):",
      ethers.utils.formatUnits(claimEvent?.args.amount, 6)
    );

    const usdcAfterClaim = await mockUsdc.balanceOf(deployer.address);
    const claimed = usdcAfterClaim.sub(usdcBeforeClaim);
    console.log(
      `Deployer claimed: ${ethers.utils.formatUnits(claimed, 6)} USDC (6 decimals)`
    );
    expect(claimed).to.be.gt(0);

    /********************************************************************
     * Step 5: PARTIAL UNSTAKE (DUEL)
     ********************************************************************/
    console.log("\n--- STEP 5: PARTIAL UNSTAKE ---");
    // 2,500 DUEL at 18 decimals
    const partialUnstake = ethers.utils.parseUnits("2500", 18);

    const stakedBalBeforePartial = await liquidityPool.stakedBalances(deployer.address);
    console.log(
      `Staked Before Partial Unstake: ${ethers.utils.formatUnits(stakedBalBeforePartial, 18)}`
    );

    const txPartialUnstake = await liquidityPool
      .connect(deployer)
      .withdrawStake(partialUnstake);
    const rcptPartialUnstake = await txPartialUnstake.wait();
    console.log(`Partial Unstake TX status: ${rcptPartialUnstake.status === 1 ? "Success" : "Fail"}`);

    const stakedBalAfterPartial = await liquidityPool.stakedBalances(deployer.address);
    console.log(
      `Staked After Partial Unstake: ${ethers.utils.formatUnits(stakedBalAfterPartial, 18)}`
    );

    expect(stakedBalAfterPartial).to.eq(stakedBalBeforePartial.sub(partialUnstake));

    /********************************************************************
     * Step 6: FULL UNSTAKE (Remaining DUEL)
     ********************************************************************/
    console.log("\n--- STEP 6: FULL UNSTAKE ---");
    const stakedRemaining = await liquidityPool.stakedBalances(deployer.address);
    console.log(
      `Remaining staked: ${ethers.utils.formatUnits(stakedRemaining, 18)} DUEL (18 decimals)`
    );

    console.log("User wants to unstake:", ethers.utils.formatUnits(stakedRemaining, 18));

    const txFullUnstake = await liquidityPool.connect(deployer).withdrawStake(stakedRemaining);
    const rcptFullUnstake = await txFullUnstake.wait();
    console.log(`Full Unstake TX status: ${rcptFullUnstake.status === 1 ? "Success" : "Fail"}`);

    const stakedAfterFull = await liquidityPool.stakedBalances(deployer.address);
    console.log(`Staked After Full Unstake: ${ethers.utils.formatUnits(stakedAfterFull, 18)}`);
    expect(stakedAfterFull).to.eq(0);

    /********************************************************************
     * Step 7: FINAL CLAIM (NO STAKE => 0 REWARDS)
     ********************************************************************/
    console.log("\n--- STEP 7: FINAL CLAIM (NO STAKE => 0 REWARDS) ---");
    const usdcBeforeFinalClaim = await mockUsdc.balanceOf(deployer.address);
    await expect(liquidityPool.connect(deployer).claimRewards()).not.to.be.reverted;
    const usdcAfterFinalClaim = await mockUsdc.balanceOf(deployer.address);
    expect(usdcAfterFinalClaim.sub(usdcBeforeFinalClaim)).to.eq(0);
    console.log("Confirmed final claim yields 0, no revert!");
  });
});
