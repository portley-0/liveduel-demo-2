// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ILMSRMarketMaker.sol";
import "./interfaces/IConditionalTokens.sol";
import "./interfaces/ILiquidityPool.sol";
import "./MarketFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PredictionMarket is Ownable {
    using SafeERC20 for IERC20;

    uint256 public matchId;
    ILiquidityPool public liquidityPool;
    bytes32 public conditionId;
    bytes32 public questionId;
    IERC20 public usdc;
    IConditionalTokens public conditionalTokens;
    ILMSRMarketMaker public marketMaker;

    bool public isResolved;
    uint8 public resolvedOutcome;

    uint256 public constant FEE_BPS = 400; // 4% fee in basis points

    address[] public bettors;
    mapping(address => bool) public isBettor;


    event SharesPurchased(address indexed buyer, uint8 indexed outcome, uint256 shares, uint256 totalCost);
    event MarketResolved(uint256 indexed matchId, uint8 indexed outcome);
    event PayoutRedeemed(address indexed redeemer, uint8 indexed outcome, uint256 amount);
    event OddsUpdated(uint256 indexed matchId, uint256 homePrice, uint256 drawPrice, uint256 awayPrice);

    constructor(
        uint256 _matchId,
        address _liquidityPool, 
        bytes32 _conditionId,
        bytes32 _questionId,
        address _usdc,
        address _conditionalTokens, 
        address _marketMaker
    ) Ownable(msg.sender) {
        require(_liquidityPool != address(0), "Invalid LiquidityPool address");
        require(_usdc != address(0), "Invalid USDC token address");
        require(_conditionalTokens != address(0), "Invalid ConditionalTokens address");
        require(_marketMaker != address(0), "Invalid LMSRMarketMaker address");

        matchId = _matchId;
        liquidityPool = ILiquidityPool(_liquidityPool);
        conditionId = _conditionId;
        questionId = _questionId;
        usdc = IERC20(_usdc);
        conditionalTokens = IConditionalTokens(_conditionalTokens);
        marketMaker = ILMSRMarketMaker(_marketMaker);
    }

    function buyShares(uint8 outcome, uint256 amount) external {
        require(!isResolved, "Market already resolved");
        require(outcome < 3, "Invalid outcome");
        require(amount > 0, "Amount must be greater than zero");

        // Add the buyer to the bettors list if they haven't bet before
        if (!isBettor[msg.sender]) {
            bettors.push(msg.sender);
            isBettor[msg.sender] = true;
        }

        // Create the trade amounts array for three outcomes
        int[] memory tradeAmounts = new int[](3);
        tradeAmounts[outcome] = int(amount);

        // Calculate the net cost of the trade
        int netCost = marketMaker.calcNetCost(tradeAmounts);
        require(netCost > 0, "Invalid trade cost");

        // // Total cost = net cost of shares + 4% fee
        uint256 totalCost = uint256(netCost) * (10_000 + FEE_BPS) / 10_000;

        // Check available collateral in LMSRMarketMaker
        uint256 availableCollateral = usdc.balanceOf(address(marketMaker));

        // If collateral is insufficient, withdraw from LiquidityPool
        if (availableCollateral < totalCost) {
            uint256 shortfall = totalCost - availableCollateral;

            // Pause the market maker before changing funding
            marketMaker.pause();

            // Withdraw liquidity from the liquidity pool
            liquidityPool.withdrawLiquidity(shortfall);

            // Approve and use the `changeFunding` method to add funds to the market maker
            usdc.safeApprove(address(marketMaker), shortfall);
            marketMaker.changeFunding(int(shortfall));

            // Resume the market maker
            marketMaker.resume();
        }

        // Transfer 104% of the cost from the buyer to the contract
        usdc.safeTransferFrom(msg.sender, address(this), totalCost);

        // Approve the MarketMaker to spend the funds
        usdc.safeApprove(address(marketMaker), uint256(netCost));

        // Execute the trade
        marketMaker.trade(tradeAmounts, int(netCost));

        // Calculate the fee amount (4% of the net cost)
        uint256 fee = uint256(netCost) * FEE_BPS / 10_000;

        // Split the fee: 2% to liquidity pool rewards and 2% to platform profit
        uint256 halfFee = fee / 2;
        liquidityPool.addToRewardsPool(halfFee);

        MarketFactory(address(owner())).addToPlatformProfit(halfFee);

        emit SharesPurchased(msg.sender, outcome, amount, totalCost);

        // Emit the updated odds for the match
        uint256 homePrice = marketMaker.calcMarginalPrice(0);
        uint256 drawPrice = marketMaker.calcMarginalPrice(1);
        uint256 awayPrice = marketMaker.calcMarginalPrice(2);

        emit OddsUpdated(matchId, homePrice, drawPrice, awayPrice);
    }

    function resolveMarket(uint8 result) external onlyOwner {
        require(!isResolved, "Market already resolved");
        require(result < 3, "Invalid outcome");

        isResolved = true;
        resolvedOutcome = result;

        // Report payouts to ConditionalTokens
        uint256[] memory payouts = new uint256[](3);
        payouts[result] = 1;
        conditionalTokens.reportPayouts(questionId, payouts);

        emit MarketResolved(matchId, result);

        // Calculate the index set for the resolved outcome
        uint256 indexSet = 1 << resolvedOutcome;

        // Get the position ID for the winning outcome
        uint256 winningPositionId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );

        uint256[] memory ids = new uint256[](bettors.length);
        for (uint256 i = 0; i < bettors.length; i++) {
            ids[i] = winningPositionId;
        }

        // Query balances using balanceOfBatch
        uint256[] memory balances = conditionalTokens.balanceOfBatch(bettors, ids);

        // Sum up the total required collateral
        uint256 requiredCollateral = 0;
        for (uint256 i = 0; i < balances.length; i++) {
            requiredCollateral += balances[i];
        }

        // Query remaining collateral in LMSRMarketMaker
        uint256 remainingCollateral = usdc.balanceOf(address(marketMaker));
        require(remainingCollateral >= requiredCollateral, "Insufficient collateral for payouts");

        // Calculate excess collateral
        uint256 excessCollateral = remainingCollateral - requiredCollateral;

        // Withdraw and return excess collateral to the LiquidityPool
        if (excessCollateral > 0) {

            usdc.safeTransferFrom(address(marketMaker), address(this), excessCollateral);
            usdc.safeApprove(address(liquidityPool), excessCollateral);
            liquidityPool.returnLiquidity(excessCollateral);
        }

        // Revoke authorization from the LiquidityPool
        liquidityPool.revokeMarket(address(this));

        // Close the MarketMaker
        marketMaker.close();
    }

    function redeemPayouts() external {
        require(isResolved, "Market not resolved"); 

        // Calculate the index set for the resolved outcome
        uint256 indexSet = 1 << resolvedOutcome;
        uint256[] memory indexSetArray = new uint256[](1);
        indexSetArray[0] = indexSet;

        // Get the position ID for the winning outcome
        uint256 winningPositionId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );
        uint256 userBalance = conditionalTokens.balanceOf(msg.sender, winningPositionId);

        uint[] memory payoutNumerators = conditionalTokens.payoutNumerators(conditionId);
        uint payoutDenominator = conditionalTokens.payoutDenominator(conditionId);

        // Calculate the payout for the resolved outcome
        uint256 payoutNumerator = payoutNumerators[resolvedOutcome];
        uint256 payout = (userBalance * payoutNumerator) / payoutDenominator;


        // Redeem user's shares from ConditionalTokens
        conditionalTokens.redeemPositions(
            usdc,
            bytes32(0), // Parent collection ID
            conditionId,
            indexSetArray 
        );

        emit PayoutRedeemed(msg.sender, resolvedOutcome, payout);
    }

}


  