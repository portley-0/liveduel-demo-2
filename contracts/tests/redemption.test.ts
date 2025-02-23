import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

describe("PredictionMarket - Redeem Payouts Test", function () {
  this.timeout(120000);

  let user: any;
  let predictionMarket: any;
  let conditionalTokens: any;
  let usdc: any;

  const PREDICTION_MARKET_ADDRESS = process.env.TEST_PREDICTION_MARKET_ADDRESS!;
  const CONDITIONAL_TOKENS_ADDRESS = process.env.CONDITIONAL_TOKENS_ADDRESS!;
  const MOCK_USDC_ADDRESS = process.env.MOCK_USDC_ADDRESS!;

  let matchId: number;
  let resolvedOutcome: number;
  let conditionId: string;
  let winningPositionId: number;
  let payoutBefore: number;
  let usdcBefore: number;
  let erc1155Before: number;

  before(async function () {
    [user] = await ethers.getSigners();

    const PredictionMarketAbi = [
      "function matchId() external view returns (uint256)",
      "function isResolved() external view returns (bool)",
      "function resolvedOutcome() external view returns (uint8)",
      "function conditionId() external view returns (bytes32)",
      "function redeemPayouts() external",
      "event PayoutRedeemed(address indexed redeemer, uint8 indexed outcome, uint256 amount)"
    ];

    const ConditionalTokensAbi = [
      "function getCollectionId(bytes32, bytes32, uint) external view returns (bytes32)",
      "function getPositionId(address, bytes32) external view returns (uint256)",
      "function balanceOf(address account, uint256 id) external view returns (uint256)"
    ];

    const UsdcAbi = [
      "function balanceOf(address account) external view returns (uint256)"
    ];

    predictionMarket = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PredictionMarketAbi, user);
    conditionalTokens = new ethers.Contract(CONDITIONAL_TOKENS_ADDRESS, ConditionalTokensAbi, user);
    usdc = new ethers.Contract(MOCK_USDC_ADDRESS, UsdcAbi, user);

    matchId = await predictionMarket.matchId();
    conditionId = await predictionMarket.conditionId();
    resolvedOutcome = await predictionMarket.resolvedOutcome();
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

    expect(erc1155Before).to.be.gt(0, "User should have winning outcome tokens to redeem!");
  });

  it("Calls redeemPayouts() and verifies the PayoutRedeemed event", async function () {
    const tx = await predictionMarket.redeemPayouts();
    const receipt = await tx.wait();

    const event = receipt.events?.find((e: any) => e.event === "PayoutRedeemed");
    expect(event).to.not.be.undefined;

    payoutBefore = event?.args?.amount;
    console.log(`
      PayoutRedeemed Event
      ----------------------------------------
      Redeemer: ${event?.args?.redeemer}
      Outcome: ${event?.args?.outcome}
      Amount: ${ethers.utils.formatUnits(event?.args?.amount, 6)} USDC
      ----------------------------------------
    `);

    expect(event?.args?.redeemer).to.equal(await user.getAddress());
    expect(event?.args?.outcome).to.equal(resolvedOutcome);
    expect(event?.args?.amount).to.be.gt(0, "Payout amount should be greater than zero");
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

    expect(erc1155After).to.equal(0, "User should have no winning outcome tokens after redemption");
    expect(usdcAfter.sub(usdcBefore)).to.equal(payoutBefore, "User should receive the correct payout in USDC");
  });
});
