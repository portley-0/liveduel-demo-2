import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import * as chai from "chai";
import { ethers } from "hardhat";
import dotenv from "dotenv";
import { solidity } from "ethereum-waffle";
import {
  LiquidityPool,
  DuelToken,
  MockUSDC
} from "../typechain-types";

chai.use(solidity);

dotenv.config();

describe("Staking and DUEL Flows", function () {
  this.timeout(120000); 

  let deployer: any;
  let liquidityPool: LiquidityPool;
  let duelToken: DuelToken;
  let mockUsdc: MockUSDC;
  
  // Contract addresses from .env
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS || "";
  const DUEL_TOKEN_ADDRESS = process.env.DUEL_TOKEN_ADDRESS || "";
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || "";

  before(async function () {
    [deployer] = await ethers.getSigners();

    // Attach contracts
    liquidityPool = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL_ADDRESS) as LiquidityPool;
    duelToken = await ethers.getContractAt("DuelToken", DUEL_TOKEN_ADDRESS) as DuelToken;
    mockUsdc = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS) as MockUSDC;

    // Mint 10,000 USDC to deployer
    const mintAmount = ethers.utils.parseUnits("10000", 6);
    console.log(`\nMinting ${ethers.utils.formatUnits(mintAmount, 6)} USDC to deployer...`);
    await (await mockUsdc.connect(deployer).mint(mintAmount)).wait();

    const usdcBalance = await mockUsdc.balanceOf(deployer.address);
    console.log(`Deployer USDC Balance: ${ethers.utils.formatUnits(usdcBalance, 6)} USDC`);
  });

  async function logDuelPrice() {
    const oneUsdc = ethers.utils.parseUnits("1", 6);
    const [usdcReserve, duelReserve] = await liquidityPool.getReserves();
    const duelForOneUsdc = await liquidityPool.getSwapAmount(oneUsdc, usdcReserve, duelReserve);

    console.log(`
--------------------------------------
1 USDC → ${ethers.utils.formatUnits(duelForOneUsdc, 18)} DUEL
Reserves:
   - USDC: ${ethers.utils.formatUnits(usdcReserve, 6)}
   - DUEL: ${ethers.utils.formatUnits(duelReserve, 18)}
--------------------------------------`);
    }

  it("Full Staking, Rewards, and Unstaking Flow", async function () {
    /************************************
     * 1. BUY DUEL
     ************************************/
    console.log("\nSTEP 1: BUY DUEL");
    await logDuelPrice();

    const buyAmount = ethers.utils.parseUnits("10000", 6);
    await mockUsdc.connect(deployer).approve(liquidityPool.address, buyAmount);

    const duelBefore = await duelToken.balanceOf(deployer.address);
    console.log(`DUEL Before Buy: ${ethers.utils.formatUnits(duelBefore, 18)}`);

    const txBuy = await liquidityPool.connect(deployer).buyDuel(buyAmount);
    await txBuy.wait();
    
    const duelAfter = await duelToken.balanceOf(deployer.address);
    console.log(`DUEL After Buy: ${ethers.utils.formatUnits(duelAfter, 18)}`);

    await logDuelPrice();

    /************************************
     * 2️. STAKE DUEL
     ************************************/
    console.log("\nSTEP 2: STAKE DUEL");

    const stakeAmount = ethers.utils.parseUnits("9000", 18);
    await duelToken.connect(deployer).approve(liquidityPool.address, stakeAmount);

    const stakedBefore = await liquidityPool.stakedBalances(deployer.address);
    console.log(`Staked Before: ${ethers.utils.formatUnits(stakedBefore, 18)}`);

    await (await liquidityPool.connect(deployer).stake(stakeAmount)).wait();

    const stakedAfter = await liquidityPool.stakedBalances(deployer.address);
    console.log(`Staked After: ${ethers.utils.formatUnits(stakedAfter, 18)}`);

    expect(stakedAfter.sub(stakedBefore)).to.eq(stakeAmount);

    /************************************
     * 3️. ADD REWARDS
     ************************************/
    console.log("\nSTEP 3: ADD REWARDS");

    const rewardAmount = ethers.utils.parseUnits("10000", 6);
    await mockUsdc.connect(deployer).mint(rewardAmount);
    await mockUsdc.connect(deployer).approve(liquidityPool.address, rewardAmount);
    
    await (await liquidityPool.connect(deployer).addToRewardsPool(rewardAmount)).wait();

    console.log(`Added ${ethers.utils.formatUnits(rewardAmount, 6)} USDC to rewards pool.`);

    /************************************
     * 4️. CLAIM REWARDS
     ************************************/
    console.log("\nSTEP 4: CLAIM REWARDS");

    const usdcBeforeClaim = await mockUsdc.balanceOf(deployer.address);
    console.log(`USDC Before Claim: ${ethers.utils.formatUnits(usdcBeforeClaim, 6)}`);

    await (await liquidityPool.connect(deployer).claimRewards()).wait();

    const usdcAfterClaim = await mockUsdc.balanceOf(deployer.address);
    console.log(`Claimed: ${ethers.utils.formatUnits(usdcAfterClaim.sub(usdcBeforeClaim), 6)} USDC`);

    /************************************
     * 5️. PARTIAL UNSTAKE
     ************************************/
    console.log("\nSTEP 5: PARTIAL UNSTAKE");

    const partialUnstake = ethers.utils.parseUnits("2500", 18);
    const stakedBalBeforePartial = await liquidityPool.stakedBalances(deployer.address);
    
    await (await liquidityPool.connect(deployer).withdrawStake(partialUnstake)).wait();

    const stakedBalAfterPartial = await liquidityPool.stakedBalances(deployer.address);
    console.log(`Staked After Partial Unstake: ${ethers.utils.formatUnits(stakedBalAfterPartial, 18)}`);

    expect(stakedBalAfterPartial).to.eq(stakedBalBeforePartial.sub(partialUnstake));

    /************************************
     * 6️. FULL UNSTAKE
     ************************************/
    console.log("\nSTEP 6: FULL UNSTAKE");

    const stakedRemaining = await liquidityPool.stakedBalances(deployer.address);
    console.log(`Remaining Staked: ${ethers.utils.formatUnits(stakedRemaining, 18)} DUEL`);

    await (await liquidityPool.connect(deployer).withdrawStake(stakedRemaining)).wait();

    const stakedAfterFull = await liquidityPool.stakedBalances(deployer.address);
    console.log(`Staked After Full Unstake: ${ethers.utils.formatUnits(stakedAfterFull, 18)}`);

    expect(stakedAfterFull).to.eq(0);

    /************************************
     * 7️. FINAL CLAIM (NO REWARDS)
     ************************************/
    console.log("\nSTEP 7: FINAL CLAIM (NO STAKE = 0 REWARDS)");

    const usdcBeforeFinalClaim = await mockUsdc.balanceOf(deployer.address);
    await expect(liquidityPool.connect(deployer).claimRewards()).not.to.be.reverted;

    const usdcAfterFinalClaim = await mockUsdc.balanceOf(deployer.address);
    expect(usdcAfterFinalClaim.sub(usdcBeforeFinalClaim)).to.eq(0);

    console.log(`Confirmed final claim yields 0 rewards.`);
  });
});

