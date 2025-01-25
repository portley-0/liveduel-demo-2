import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

describe("Staking and DUEL Flows", function () {
  let deployer: any;
  let user1: any;

  let liquidityPool: any;
  let duelToken: any;
  let mockUsdc: any;

  // Addresses from .env
  const LIQUIDITY_POOL_ADDRESS = process.env.LIQUIDITY_POOL_ADDRESS || "";
  const DUEL_TOKEN_ADDRESS = process.env.DUEL_TOKEN_ADDRESS || "";
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS || "";

  before(async function () {
    // Acquire signers
    [deployer, user1] = await ethers.getSigners();

    // Attach to deployed contracts
    liquidityPool = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL_ADDRESS);
    duelToken = await ethers.getContractAt("DuelToken", DUEL_TOKEN_ADDRESS);
    mockUsdc = await ethers.getContractAt("MockUSDC", MOCK_USDC_ADDRESS);

    // Optional: Mint some USDC to user1 for testing
    const mintAmount = ethers.utils.parseUnits("5000", 18);
    await mockUsdc.connect(deployer).mint(mintAmount);
    await mockUsdc.connect(deployer).transfer(user1.address, mintAmount);
  });

  // Helper to log DUEL price
  async function logDuelPrice() {
    const oneUsdc = ethers.utils.parseUnits("1", 18);
    const [usdcReserve, duelReserve] = await liquidityPool.getReserves();
    const duelForOneUsdc = await liquidityPool.getSwapAmount(oneUsdc, usdcReserve, duelReserve);

    console.log(
      `DUEL Price => 1 USDC -> ${ethers.utils.formatUnits(duelForOneUsdc, 18)} DUEL`
    );
    console.log(`Reserves => USDC: ${ethers.utils.formatUnits(usdcReserve, 18)}, DUEL: ${ethers.utils.formatUnits(duelReserve, 18)}`);
  }

  describe("DUEL Purchase Flow", function () {
    it("should allow user1 to buy DUEL", async function () {
      console.log("\n--- Initial Price ---");
      await logDuelPrice();

      const buyAmount = ethers.utils.parseUnits("100", 18); // user1 buys 100 USDC worth
      await mockUsdc.connect(user1).approve(liquidityPool.address, buyAmount);

      const duelBefore = await duelToken.balanceOf(user1.address);
      await liquidityPool.connect(user1).buyDuel(buyAmount);
      const duelAfter = await duelToken.balanceOf(user1.address);

      console.log(`User1 acquired ${ethers.utils.formatUnits(duelAfter.sub(duelBefore), 18)} DUEL.`);

      console.log("\n--- Price After Purchase ---");
      await logDuelPrice();

      expect(duelAfter.sub(duelBefore)).to.be.gt(0);
    });

    it("should revert if user tries to buy DUEL with 0 USDC", async function () {
      await expect(
        liquidityPool.connect(user1).buyDuel(0)
      ).to.be.revertedWith("USDC amount must be greater than zero");
    });
  });

  describe("Staking and Rewards Flow", function () {
    it("should allow user1 to stake DUEL", async function () {
      const stakeAmount = ethers.utils.parseUnits("50", 18); 
      await duelToken.connect(user1).approve(liquidityPool.address, stakeAmount);

      const stakedBefore = await liquidityPool.stakedBalances(user1.address);
      await liquidityPool.connect(user1).stake(stakeAmount);
      const stakedAfter = await liquidityPool.stakedBalances(user1.address);

      expect(stakedAfter.sub(stakedBefore).eq(stakeAmount)).to.be.true;
      console.log(`User1 staked 50 DUEL.`);
    });

    it("should allow adding rewards and let user1 claim them", async function () {
      const rewardAmount = ethers.utils.parseUnits("1000", 18);

      await mockUsdc.connect(deployer).mint(rewardAmount);
      await mockUsdc.connect(deployer).approve(liquidityPool.address, rewardAmount);
      await liquidityPool.connect(deployer).addToRewardsPool(rewardAmount);

      const user1UsdcBefore = await mockUsdc.balanceOf(user1.address);
      await liquidityPool.connect(user1).claimRewards();
      const user1UsdcAfter = await mockUsdc.balanceOf(user1.address);

      const claimed = user1UsdcAfter.sub(user1UsdcBefore);
      console.log(`User1 claimed ${ethers.utils.formatUnits(claimed, 18)} USDC in rewards.`);
      expect(claimed).to.be.gt(0);
    });

    it("should allow user1 to partially unstake DUEL", async function () {
      const user1StakedBefore = await liquidityPool.stakedBalances(user1.address);
      const unstakeAmount = user1StakedBefore.div(2);

      await liquidityPool.connect(user1).withdrawStake(unstakeAmount);
      const user1StakedAfter = await liquidityPool.stakedBalances(user1.address);

      expect(user1StakedAfter).to.eq(user1StakedBefore.sub(unstakeAmount));
      console.log(`User1 partially unstaked. Remaining staked: ${ethers.utils.formatUnits(user1StakedAfter, 18)} DUEL.`);
    });

    it("should allow user1 to fully unstake", async function () {
      const user1StakedBefore = await liquidityPool.stakedBalances(user1.address);
      await liquidityPool.connect(user1).withdrawStake(user1StakedBefore);

      const user1StakedAfter = await liquidityPool.stakedBalances(user1.address);
      expect(user1StakedAfter).to.eq(0);
      console.log(`User1 fully unstaked all DUEL.`);
    });
  });
});
