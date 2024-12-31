// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ILMSRMarketMaker.sol";
import "./interfaces/IConditionalTokens.sol";
import "./interfaces/ILiquidityPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PredictionMarket is Ownable {
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
    uint256 public constant HALF_FEE_BPS = 200; // 2% fee in basis points

    address[] public bettors;

    event SharesPurchased(address indexed buyer, uint8 indexed outcome, uint256 shares, uint256 fee);
    event MarketResolved(uint8 indexed outcome);
    event PayoutRedeemed(address indexed redeemer, uint8 indexed outcome, uint256 amount);

    constructor(
        uint256 _matchId,
        address _liquidityPool, 
        bytes32 _conditionId,
        bytes32 _questionId,
        address _usdc,
        address _conditionalTokens, 
        address _marketMaker
    ) Ownable() {
        require(_liquidityPool != address(0), "Invalid LiquidityPool address");
        require(_usdc != address(0), "Invalid USDC token address");
        require(_conditionalTokens != address(0), "Invalid ConditionalTokens address");
        require(_marketMaker != address(0), "Invalid LMSRMarketMaker address");

        matchId = _matchId;
        liquidityPool = LiquidityPool(_liquidityPool);
        conditionId = _conditionId;
        questionId = _questionId;
        usdc = IERC20(_usdc);
        conditionalTokens = IConditionalTokens(_conditionalTokens);
        marketMaker = ILMSRMarketMaker(_marketMaker);
    }

    function buyShares(uint8 outcome, uint256 amount) external {
        require(!isResolved, "Market already resolved");
        require(outcome < 3, "Invalid outcome");

        // Add the buyer to the bettors list if they haven't bet before
        if (!isBettor(msg.sender)) {
            bettors.push(msg.sender);
        }

        // Create the trade amounts array for three outcomes
        int[3] memory tradeAmounts;
        tradeAmounts[outcome] = int(amount);

        // Calculate the net cost of the trade
        int netCost = marketMaker.calcNetCost(tradeAmounts);
        require(netCost > 0, "Invalid trade cost");

        // Calculate the total cost including the fee
        uint256 totalCost = uint256(netCost).mul(10_000 + FEE_BPS).div(10_000);

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
            require(usdc.approve(address(marketMaker), shortfall), "Approval failed for MarketMaker");
            marketMaker.changeFunding(int(shortfall));

            // Resume the market maker
            marketMaker.resume();
        }

        // Transfer 104% of the cost from the buyer to the contract
        require(usdc.transferFrom(msg.sender, address(this), totalCost), "USDC transfer failed");

        // Approve the MarketMaker to spend the funds
        require(usdc.approve(address(marketMaker), uint256(netCost)), "Approval for MarketMaker failed");

        // Execute the trade
        marketMaker.trade(tradeAmounts, int(netCost));

        // Calculate the fee amount (4% of the net cost)
        uint256 fee = uint256(netCost).mul(FEE_BPS).div(10_000);

        // Split the fee: 2% to liquidity pool rewards and 2% to platform profit
        uint256 halfFee = fee.div(2);
        liquidityPool.addToRewardsPool(halfFee);

        MarketFactory(owner()).addToPlatformProfit(halfFee);

        emit SharesPurchased(msg.sender, outcome, amount, fee);
    }


    function isBettor(address user) internal view returns (bool) {
        for (uint256 i = 0; i < bettors.length; i++) {
            if (bettors[i] == user) {
                return true;
            }
        }
        return false;
    }

    function resolveMarket(uint8 result) external onlyOwner {
        require(!isResolved, "Market already resolved");
        require(result < 3, "Invalid outcome");

        isResolved = true;
        resolvedOutcome = result;

        // Report payouts to ConditionalTokens
        uint256[3] memory payouts;
        payouts[result] = 1;
        conditionalTokens.reportPayouts(questionId, payouts);

        emit MarketResolved(result);

        // Calculate the index set for the resolved outcome
        uint256 indexSet = 1 << resolvedOutcome;

        // Get the position ID for the winning outcome
        uint256 winningPositionId = conditionalTokens.getPositionId(
            address(usdc),
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
            require(
                usdc.transferFrom(address(marketMaker), address(this), excessCollateral),
                "Failed to withdraw excess collateral"
            );

            usdc.approve(address(liquidityPool), excessCollateral);
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

        // Redeem user's shares from ConditionalTokens
        uint256 payout = conditionalTokens.redeemPositions(
            address(usdc),
            bytes32(0), // Parent collection ID
            conditionId,
            indexSet // Index set for resolved outcome
        );

        // Transfer payout to user
        require(usdc.transfer(msg.sender, payout), "Payout transfer failed");

        emit PayoutRedeemed(msg.sender, resolvedOutcome, payout);
    }
}


  