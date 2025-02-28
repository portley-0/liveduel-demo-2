import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { expect } from "chai";
import dotenv from "dotenv";
import { Signer } from "ethers";
import { PredictionMarket, ConditionalTokens, ERC20 } from "../typechain-types";

dotenv.config();

describe("PredictionMarket - Redeem Payouts Test", function () {
  this.timeout(120000);

  let user: Signer;
  let predictionMarket: PredictionMarket;
  let conditionalTokens: ConditionalTokens;
  let usdc: ERC20;

  const PREDICTION_MARKET_ADDRESS = process.env.TEST_PREDICTION_MARKET_ADDRESS!;
  const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS!;
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;

  let matchId: number;
  let resolvedOutcome: number;
  let conditionId: string;
  let winningPositionId: BigNumber;
  let payoutBefore: BigNumber;
  let usdcBefore: BigNumber;
  let erc1155Before: BigNumber;

  before(async function () {
    [user] = await ethers.getSigners();

    predictionMarket = (await ethers.getContractAt(
      "PredictionMarket",
      PREDICTION_MARKET_ADDRESS,
      user
    )) as PredictionMarket;

    conditionalTokens = (await ethers.getContractAt(
      "ConditionalTokens",
      CONDITIONAL_TOKENS_ADDRESS,
      user
    )) as ConditionalTokens;

    usdc = (await ethers.getContractAt(
      "ERC20",
      MOCK_USDC_ADDRESS,
      user
    )) as ERC20;

    // Get match details
    matchId = (await predictionMarket.matchId()).toNumber();
    conditionId = await predictionMarket.conditionId();
    resolvedOutcome = (await predictionMarket.resolvedOutcome());

    console.log(`Match ID: ${matchId}, Resolved Outcome: ${resolvedOutcome}`);
  });

  it("Logs user balances before redemption", async function () {
    const indexSet = 1 << resolvedOutcome;
    const collectionId = await conditionalTokens.getCollectionId(
      ethers.constants.HashZero,
      conditionId,
      indexSet
    );
    winningPositionId = await conditionalTokens.getPositionId(MOCK_USDC_ADDRESS, collectionId);

    erc1155Before = await conditionalTokens.balanceOf(await user.getAddress(), winningPositionId);
    usdcBefore = await usdc.balanceOf(await user.getAddress());

    console.log(`
      User Balances Before Redemption
      ----------------------------------------
      ERC1155 Winning Outcome Tokens: ${erc1155Before.toString()}
      USDC Balance: ${ethers.utils.formatUnits(usdcBefore, 6)} USDC
      ----------------------------------------
    `);

    expect(erc1155Before.toNumber()).to.be.gt(0, "User should have winning outcome tokens to redeem!");
  });

  it("Approves ERC1155 transfer to PredictionMarket", async function () {
    const tx = await conditionalTokens.setApprovalForAll(PREDICTION_MARKET_ADDRESS, true);
    await tx.wait();
  
    const isApproved = await conditionalTokens.isApprovedForAll(
      await user.getAddress(),
      PREDICTION_MARKET_ADDRESS
    );
  
    expect(isApproved).to.be.true;
    console.log("PredictionMarket successfully approved for ERC1155 transfers.");
  });

  it("Calls redeemPayouts() and verifies the PayoutRedeemed event", async function () {
    const tx = await predictionMarket.redeemPayouts();
    const receipt = await tx.wait(1);

    const event = receipt.events?.find((e) => e.event === "PayoutRedeemed");
    expect(event).to.not.be.undefined;

    payoutBefore = event?.args?.amount as BigNumber;
    console.log(`
      PayoutRedeemed Event
      ----------------------------------------
      Redeemer: ${event?.args?.redeemer}
      Outcome: ${event?.args?.outcome}
      Amount: ${ethers.utils.formatUnits(payoutBefore, 6)} USDC
      ----------------------------------------
    `);

    expect(event?.args?.redeemer).to.equal(await user.getAddress());
    expect(event?.args?.outcome).to.equal(resolvedOutcome);
    expect(payoutBefore.toNumber()).to.be.gt(0, "Payout amount should be greater than zero");
  });

  it("Logs user balances after redemption", async function () {
    const erc1155After = await conditionalTokens.balanceOf(await user.getAddress(), winningPositionId);
    const usdcAfter = await usdc.balanceOf(await user.getAddress());

    console.log(`
      User Balances After Redemption
      ----------------------------------------
      ERC1155 Winning Outcome Tokens: ${erc1155After.toString()}
      USDC Balance: ${ethers.utils.formatUnits(usdcAfter, 6)} USDC
      ----------------------------------------
    `);

    expect(erc1155After).to.equal(BigNumber.from(0), "User should have no winning outcome tokens after redemption");
    expect(usdcAfter.sub(usdcBefore)).to.equal(payoutBefore, "User should receive the correct payout in USDC");
  });
});
