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
    bool public isFinalized;

    bool public isResolved;
    uint8 public resolvedOutcome;

    uint256 public constant FEE_BPS = 400; // 4%

    address[] public bettors;
    mapping(address => bool) public isBettor;

    mapping(uint8 => uint256) public totalWageredPerOutcome;

    event SharesPurchased(address indexed buyer, uint8 indexed outcome, uint256 shares, int actualCost);
    event MarketResolved(uint256 indexed matchId, uint8 indexed outcome);
    event PayoutRedeemed(address indexed redeemer, uint8 indexed outcome, uint256 amount);
    event OddsUpdated(uint256 indexed matchId, uint256 home, uint256 draw, uint256 away);
    event SharesSold(address indexed seller, uint8 indexed outcome, uint256 shares, int actualGain);
    event MarketFinalized(uint256 matchId, uint256 usdcAmount);

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

        uint256 otherOutcomesTotal = 0;
        for (uint8 i = 0; i < 3; i++) {
            if (i != outcome) {
                otherOutcomesTotal += totalWageredPerOutcome[i];
            }
        }
        //potential payout offset by other outcomes
        uint256 maxAllowedBet = 30000 * 1e6 + otherOutcomesTotal - totalWageredPerOutcome[outcome];
        require(amount <= maxAllowedBet, "Bet exceeds maximum allowable amount");

        totalWageredPerOutcome[outcome] += amount;

        int[] memory tradeAmounts = new int[](3);
        tradeAmounts[outcome] = int(amount);
        int netCost = marketMaker.calcNetCost(tradeAmounts);
        require(netCost > 0, "Invalid trade cost");

        uint256 fee = (uint256(netCost) * FEE_BPS) / 10_000; // 4% fee

        uint256 totalCost = uint256(netCost) + fee;
        uint256 halfFee = fee / 2; // 2% to LiquidityPool, 2% to Platform Profit

        require(usdc.transferFrom(msg.sender, address(this), totalCost), "transferFrom failed");
        require(usdc.approve(address(marketMaker), uint256(netCost)), "approve to marketMaker failed");

        int actualCost = marketMaker.trade(tradeAmounts, netCost);

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
    }

    function sellShares(uint8 outcome, uint256 amount) external {
        require(!isResolved, "Market already resolved");
        require(outcome < 3, "Invalid outcome");
        require(amount > 0, "Amount must be greater than zero");

        uint256 indexSet = 1 << outcome;
        uint256 tokenId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );

        require(conditionalTokens.balanceOf(msg.sender, tokenId) >= amount, "Insufficient outcome tokens");

        int[] memory tradeAmounts = new int[](3);
        tradeAmounts[outcome] = -int(amount); // Selling, so negative

        int netGain = marketMaker.calcNetCost(tradeAmounts);
        require(netGain < 0, "Invalid trade gain");

        conditionalTokens.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        int actualGain = marketMaker.trade(tradeAmounts, netGain);

        require(usdc.transfer(msg.sender, uint256(-actualGain)), "USDC transfer failed");

        totalWageredPerOutcome[outcome] -= amount;

        emit SharesSold(msg.sender, outcome, amount, -actualGain);

        uint256 home = marketMaker.calcMarginalPrice(0);
        uint256 draw = marketMaker.calcMarginalPrice(1);
        uint256 away = marketMaker.calcMarginalPrice(2);

        emit OddsUpdated(matchId, home, draw, away);
    }

    function getNetCost(uint8 outcome, uint256 amount) external view returns (int) {
        int[] memory tradeAmounts = new int[](3);
        tradeAmounts[outcome] = int(amount);
        return marketMaker.calcNetCost(tradeAmounts);
    }

    function getMarginalPrice(uint8 outcome) external view returns (uint256) {
        return marketMaker.calcMarginalPrice(outcome);
    }

    function getBettors() external view returns (address[] memory) {
        return bettors;
    }

    function resolveMarket(uint8 result) external onlyOwner {
        require(!isResolved, "Market already resolved");
        require(result < 3, "Invalid outcome");

        isResolved = true;
        resolvedOutcome = result;
        marketMaker.pause();

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

        uint256 remainingCollateral = 0;
        address[] memory allHolders = bettors;

        for (uint8 i = 0; i < 3; i++) {
            uint256 indexSet = 1 << i;

            // Get position ID for each outcome
            uint256 positionId = conditionalTokens.getPositionId(
                usdc,
                conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
            );

            remainingCollateral += conditionalTokens.balanceOf(address(marketMaker), positionId);

            remainingCollateral += conditionalTokens.balanceOf(address(this), positionId);

            for (uint256 j = 0; j < allHolders.length; j++) {
                address user = allHolders[j];
                remainingCollateral += conditionalTokens.balanceOf(user, positionId);
            }
        }

        require(remainingCollateral >= requiredCollateral, "Insufficient collateral for payouts");
        uint256 excessCollateral = remainingCollateral - requiredCollateral;
        if (excessCollateral > 0) {
            marketMaker.changeFunding(-int256(excessCollateral));
            usdc.approve(address(liquidityPool), excessCollateral);
            liquidityPool.returnLiquidity(excessCollateral);
        }
        liquidityPool.revokeMarket(address(this));
        emit MarketResolved(matchId, result);
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

        uint[] memory payoutNumerators = new uint[](3);
        for (uint i = 0; i < 3; i++) {
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

    function finalizeMarket() external onlyOwner {
        require(isResolved, "Market must be resolved before finalization");
        require(!isFinalized, "Market already finalized");
        isFinalized = true;

        marketMaker.close();

        // Redeem any remaining ERC1155 tokens for USDC
        for (uint8 i = 0; i < 3; i++) {
            uint256 indexSet = 1 << i;
            uint256 tokenId = conditionalTokens.getPositionId(
                usdc,
                conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
            );

            uint256 balance = conditionalTokens.balanceOf(address(this), tokenId);
            if (balance > 0) {
                uint256[] memory indexSetArray = new uint256[](1);
                indexSetArray[0] = indexSet;

                conditionalTokens.redeemPositions(
                    usdc,
                    bytes32(0),
                    conditionId,
                    indexSetArray
                );
            }
        }

        // Transfer any remaining USDC to the platform profit pool
        uint256 usdcBalance = usdc.balanceOf(address(this));
        if (usdcBalance > 0) {
            require(usdc.approve(owner(), usdcBalance), "USDC approve failed");
            MarketFactory(owner()).addToPlatformProfit(usdcBalance);

            emit MarketFinalized(matchId, usdcBalance);
        }
    }


}



  