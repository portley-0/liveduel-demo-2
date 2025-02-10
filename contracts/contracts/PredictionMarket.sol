// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./gnosis/LMSRMarketMaker.sol";
import "./gnosis/ConditionalTokens.sol";
import "./interfaces/ILiquidityPool.sol";
import "./MarketFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PredictionMarket is Ownable, ERC1155Holder {

    uint256 public matchId;
    ILiquidityPool public liquidityPool;
    bytes32 public conditionId; 
    bytes32 public questionId;
    IERC20 public usdc;
    ConditionalTokens public conditionalTokens;
    LMSRMarketMaker public marketMaker;

    bool public initialized;

    bool public isResolved;
    uint8 public resolvedOutcome;

    uint256 public constant FEE_BPS = 400; 

    address[] public bettors;
    mapping(address => bool) public isBettor;

    event SharesPurchased(address indexed buyer, uint8 indexed outcome, uint256 shares, int actualCost);
    event MarketResolved(uint256 indexed matchId, uint8 indexed outcome);
    event PayoutRedeemed(address indexed redeemer, uint8 indexed outcome, uint256 amount);
    event OddsUpdated(uint256 indexed matchId, uint256 home, uint256 draw, uint256 away);

    constructor(
        uint256 _matchId,
        address _liquidityPool, 
        address _usdc,
        address _conditionalTokens
    ) Ownable(msg.sender) {
        require(_liquidityPool != address(0), "Invalid LiquidityPool address");
        require(_usdc != address(0), "Invalid USDC token address");
        require(_conditionalTokens != address(0), "Invalid ConditionalTokens address");

        matchId = _matchId;
        liquidityPool = ILiquidityPool(_liquidityPool);
        usdc = IERC20(_usdc);
        conditionalTokens = ConditionalTokens(_conditionalTokens);
    }

    function initializeMarket(bytes32 _questionId, bytes32 _conditionId, address _marketMaker) external onlyOwner {
        require(!initialized, "Market already initialized");
        conditionId = _conditionId;
        questionId = _questionId;
        marketMaker = LMSRMarketMaker(_marketMaker);
        conditionalTokens.setApprovalForAll(_marketMaker, true);
        initialized = true;
    }

    function buyShares(uint8 outcome, uint256 amount) external {
        require(!isResolved, "Market already resolved");
        require(outcome < 3, "Invalid outcome");
        require(amount > 0, "Amount must be greater than zero");

        if (!isBettor[msg.sender]) {
            bettors.push(msg.sender);
            isBettor[msg.sender] = true;
        }

        int[] memory tradeAmounts = new int[](3);
        tradeAmounts[outcome] = int(amount);
        int netCost = marketMaker.calcNetCost(tradeAmounts);
        require(netCost > 0, "Invalid trade cost");

        uint256 fee = ceilDiv(uint256(netCost) * FEE_BPS, 10_000);
        uint256 totalCost = uint256(netCost) + fee;
        uint256 halfFee = ceilDiv(fee, 2);

        uint256 buffer = _getDynamicBuffer(totalCost);
        uint256 deposit = totalCost + buffer;
        uint256 tradelimit = uint256(netCost) + buffer;

        uint256 availableCollateral = usdc.balanceOf(address(marketMaker));
        if (availableCollateral < deposit) {
            uint256 shortfall = deposit - availableCollateral;
            marketMaker.pause();
            liquidityPool.withdrawLiquidity(shortfall);
            usdc.approve(address(marketMaker), shortfall);
            marketMaker.changeFunding(int(shortfall));
            marketMaker.resume();
        }

        require(usdc.transferFrom(msg.sender, address(this), deposit), "transferFrom failed");
        require(usdc.approve(address(marketMaker), tradelimit), "approve to marketMaker failed");

        int actualCost = marketMaker.trade(tradeAmounts, int(tradelimit));

        // Forward the Outcome Tokens to the User 

        // Determine the token ID for the purchased outcome.
        uint256 indexSet = 1 << outcome;
        uint256 tokenId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );

        // Check that PredictionMarket holds enough tokens.
        uint256 tokenBalance = conditionalTokens.balanceOf(address(this), tokenId);
        require(tokenBalance >= amount, "Not enough outcome tokens received");

        // Transfer the outcome tokens to the user.
        conditionalTokens.safeTransferFrom(address(this), msg.sender, tokenId, amount, "");

        require(usdc.approve(address(liquidityPool), halfFee), "Approve to LiquidityPool failed");
        liquidityPool.addToRewardsPool(halfFee);

        require(usdc.approve(address(owner()), halfFee), "Approve to owner/MarketFactory failed");
        MarketFactory(address(owner())).addToPlatformProfit(halfFee);

        emit SharesPurchased(msg.sender, outcome, amount, actualCost);

        uint256 home = marketMaker.calcMarginalPrice(0);
        uint256 draw = marketMaker.calcMarginalPrice(1);
        uint256 away = marketMaker.calcMarginalPrice(2);

        emit OddsUpdated(matchId, home, draw, away);

        uint256 leftover = usdc.balanceOf(address(this));
        if (leftover > 0) {
            usdc.transfer(msg.sender, leftover);
        }
    }

    function ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a + b - 1) / b;
    }

    function getNetCost(uint8 outcome, uint256 amount) external view returns (int) {
        int[] memory tradeAmounts = new int[](3);
        tradeAmounts[outcome] = int(amount);
        return marketMaker.calcNetCost(tradeAmounts);
    }

    function resolveMarket(uint8 result) external onlyOwner {
        require(!isResolved, "Market already resolved");
        require(result < 3, "Invalid outcome");

        isResolved = true;
        resolvedOutcome = result;
        uint256[] memory payouts = new uint256[](3);
        payouts[result] = 1;
        conditionalTokens.reportPayouts(questionId, payouts);
        emit MarketResolved(matchId, result);

        uint256 indexSet = 1 << resolvedOutcome;
        uint256 winningPositionId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );
        uint256[] memory ids = new uint256[](bettors.length);
        for (uint256 i = 0; i < bettors.length; i++) {
            ids[i] = winningPositionId;
        }
        uint256[] memory balances = conditionalTokens.balanceOfBatch(bettors, ids);
        uint256 requiredCollateral = 0;
        for (uint256 i = 0; i < balances.length; i++) {
            requiredCollateral += balances[i];
        }
        uint256 remainingCollateral = usdc.balanceOf(address(marketMaker));
        require(remainingCollateral >= requiredCollateral, "Insufficient collateral for payouts");
        uint256 excessCollateral = remainingCollateral - requiredCollateral;
        if (excessCollateral > 0) {
            usdc.transferFrom(address(marketMaker), address(this), excessCollateral);
            usdc.approve(address(liquidityPool), excessCollateral);
            liquidityPool.returnLiquidity(excessCollateral);
        }
        liquidityPool.revokeMarket(address(this));
        marketMaker.close();
    }

    function redeemPayouts() external {
        require(isResolved, "Market not resolved"); 
        uint256 indexSet = 1 << resolvedOutcome;
        uint256[] memory indexSetArray = new uint256[](1);
        indexSetArray[0] = indexSet;
        uint256 winningPositionId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );
        uint256 userBalance = conditionalTokens.balanceOf(msg.sender, winningPositionId);
        uint outcomeCount = conditionalTokens.getOutcomeSlotCount(conditionId);
        uint[] memory payoutNumerators = new uint[](outcomeCount);
        for (uint i = 0; i < outcomeCount; i++) {
            payoutNumerators[i] = conditionalTokens.payoutNumerators(conditionId, i);
        }
        uint payoutDenominator = conditionalTokens.payoutDenominator(conditionId);
        uint256 payoutNumerator = payoutNumerators[resolvedOutcome];
        uint256 payout = (userBalance * payoutNumerator) / payoutDenominator;
        conditionalTokens.redeemPositions(
            usdc,
            bytes32(0),
            conditionId,
            indexSetArray 
        );
        emit PayoutRedeemed(msg.sender, resolvedOutcome, payout);
    }

    function _getDynamicBuffer(uint256 baseCost) internal pure returns (uint256) {
        if (baseCost < 1000e6) {
            return (baseCost * 3) / 100;
        } else if (baseCost < 10000e6) {
            return (baseCost * 6) / 100;
        } else {
            return (baseCost * 10) / 100;
        }
    }

}



  