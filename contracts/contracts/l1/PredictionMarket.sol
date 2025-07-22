// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./gnosis/LMSRMarketMaker.sol";
import "./gnosis/ConditionalTokens.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IMarketFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract PredictionMarket is Initializable, OwnableUpgradeable, ERC1155Holder {

    uint256 public matchId; 
    ILiquidityPool public liquidityPool;
    bytes32 public conditionId; 
    bytes32 public questionId;
    IERC20 public usdc;
    ConditionalTokens public conditionalTokens;
    LMSRMarketMaker public marketMaker;
    address public botAddress;

    bool public isInitialized;
    bool public isResolved;
    uint8 public resolvedOutcome;

    uint256 public constant FEE_BPS = 400; // 4% in basis points

    address[] public bettors;
    mapping(address => bool) public isBettor;

    mapping(uint8 => uint256) public totalWageredPerOutcome;

    event SharesPurchased(address indexed buyer, uint8 indexed outcome, uint256 shares, int actualCost);
    event MarketResolved(uint256 indexed matchId, uint8 indexed outcome);
    event PayoutRedeemed(address indexed redeemer, uint8 indexed outcome, uint256 amount);
    event OddsUpdated(uint256 indexed matchId, uint256 home, uint256 draw, uint256 away);
    event SharesSold(address indexed seller, uint8 indexed outcome, uint256 shares, int actualGain);
    event TradeExecuted(address indexed user, int[] tradeAmounts, int netCostOrGain);
    event BotAddressSet(address indexed newBotAddress);

    modifier onlyBot() {
        require(msg.sender == botAddress, "Caller is not the authorized bot");
        _;
    }

    function initializeMarket(
        uint256 _matchId, 
        bytes32 _questionId, 
        bytes32 _conditionId, 
        address _marketMaker,       
        address _liquidityPool, 
        address _usdc,
        address _conditionalTokens) external initializer {
        __Ownable_init(msg.sender);
        matchId      = _matchId;
        conditionId = _conditionId;
        questionId = _questionId;
        marketMaker = LMSRMarketMaker(_marketMaker);
        liquidityPool = ILiquidityPool(_liquidityPool);
        usdc = IERC20(_usdc);
        conditionalTokens = ConditionalTokens(_conditionalTokens);
        conditionalTokens.setApprovalForAll(_marketMaker, true);
        isInitialized = true;
    }

    function buyShares(uint8 outcome, uint256 amount) external {
        require(isInitialized, "Not initialized");
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
    
        uint256 maxAllowedBet = 500000 * 1e6 + otherOutcomesTotal - totalWageredPerOutcome[outcome];
        require(amount <= maxAllowedBet, "Bet exceeds maximum allowable amount");

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
        IMarketFactory(address(owner())).addToPlatformProfit(halfFee);

        totalWageredPerOutcome[outcome] += uint256(actualCost);

        emit SharesPurchased(msg.sender, outcome, amount, actualCost);

        uint256 home = marketMaker.calcMarginalPrice(0);
        uint256 draw = marketMaker.calcMarginalPrice(1);
        uint256 away = marketMaker.calcMarginalPrice(2);

        emit OddsUpdated(matchId, home, draw, away);
    }

    function buySharesWithPermit(
        uint8 outcome,
        uint256 amount,
        uint256 value, // Approval amount (totalCost)
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(isInitialized, "Not initialized");
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
    
        uint256 maxAllowedBet = 500000 * 1e6 + otherOutcomesTotal - totalWageredPerOutcome[outcome];
        require(amount <= maxAllowedBet, "Bet exceeds maximum allowable amount");

        int[] memory tradeAmounts = new int[](3);
        tradeAmounts[outcome] = int(amount);
        int netCost = marketMaker.calcNetCost(tradeAmounts);
        require(netCost > 0, "Invalid trade cost");

        uint256 fee = (uint256(netCost) * FEE_BPS) / 10_000; // 4% fee
        uint256 totalCost = uint256(netCost) + fee;
        uint256 halfFee = fee / 2;

        // Use permit to approve USDC transfer
        IERC20Permit(address(usdc)).permit(
            msg.sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );

        // Transfer USDC using the permit approval
        require(usdc.transferFrom(msg.sender, address(this), totalCost), "transferFrom failed");
        require(usdc.approve(address(marketMaker), uint256(netCost)), "approve to marketMaker failed");

        int actualCost = marketMaker.trade(tradeAmounts, netCost);

        uint256 indexSet = 1 << outcome;
        uint256 tokenId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );

        uint256 tokenBalance = conditionalTokens.balanceOf(address(this), tokenId);
        require(tokenBalance >= amount, "Not enough outcome tokens received");

        conditionalTokens.safeTransferFrom(address(this), msg.sender, tokenId, amount, "");

        require(usdc.approve(address(liquidityPool), halfFee), "Approve to LiquidityPool failed");
        liquidityPool.addToRewardsPool(halfFee);

        require(usdc.approve(address(owner()), halfFee), "Approve to owner/MarketFactory failed");
        IMarketFactory(address(owner())).addToPlatformProfit(halfFee);

        totalWageredPerOutcome[outcome] += uint256(actualCost);

        emit SharesPurchased(msg.sender, outcome, amount, actualCost);

        uint256 home = marketMaker.calcMarginalPrice(0);
        uint256 draw = marketMaker.calcMarginalPrice(1);
        uint256 away = marketMaker.calcMarginalPrice(2);

        emit OddsUpdated(matchId, home, draw, away);
    }

    function sellShares(uint8 outcome, uint256 amount) external {
        require(isInitialized, "Not initialized");
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

        totalWageredPerOutcome[outcome] -= uint256(-actualGain);

        emit SharesSold(msg.sender, outcome, amount, -actualGain);

        uint256 home = marketMaker.calcMarginalPrice(0);
        uint256 draw = marketMaker.calcMarginalPrice(1);
        uint256 away = marketMaker.calcMarginalPrice(2);

        emit OddsUpdated(matchId, home, draw, away);
    }

    function setBotAddress(address _botAddress) external onlyOwner {
        require(_botAddress != address(0), "Bot address cannot be the zero address");
        botAddress = _botAddress;
        emit BotAddressSet(_botAddress);
    }

    function trade(int[] calldata tradeAmounts, int collateralLimit) external onlyBot {
        require(isInitialized, "Not initialized");
        require(!isResolved, "Market already resolved");
        require(tradeAmounts.length == 3, "Invalid trade amounts length");

        for (uint8 i = 0; i < tradeAmounts.length; i++) {
            if (tradeAmounts[i] < 0) {
                uint256 indexSet = 1 << i;
                uint256 tokenId = conditionalTokens.getPositionId(
                    usdc,
                    conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
                );
                uint256 amountToSell = uint(-tradeAmounts[i]);
                require(conditionalTokens.balanceOf(msg.sender, tokenId) >= amountToSell, "Insufficient outcome tokens to sell");
                conditionalTokens.safeTransferFrom(msg.sender, address(this), tokenId, amountToSell, "");
            }
        }

        int netCost = marketMaker.calcNetCost(tradeAmounts);

        if (netCost > 0) {
            uint256 totalCost = uint256(netCost); // Fee is 0 for the bot
            require(usdc.transferFrom(msg.sender, address(this), totalCost), "USDC transferFrom failed");
            require(usdc.approve(address(marketMaker), totalCost), "Approve to marketMaker failed");
        }

        int actualCostOrGain = marketMaker.trade(tradeAmounts, collateralLimit);

        if (actualCostOrGain < 0) {
            require(usdc.transfer(msg.sender, uint(-actualCostOrGain)), "USDC transfer failed");
        }

        for (uint8 i = 0; i < tradeAmounts.length; i++) {
            if (tradeAmounts[i] > 0) {
                uint256 amountToBuy = uint(tradeAmounts[i]);
                uint256 indexSet = 1 << i;
                uint256 tokenId = conditionalTokens.getPositionId(
                    usdc,
                    conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
                );
                
                uint256 tokenBalance = conditionalTokens.balanceOf(address(this), tokenId);
                require(tokenBalance >= amountToBuy, "Not enough outcome tokens received from trade");
                conditionalTokens.safeTransferFrom(address(this), msg.sender, tokenId, amountToBuy, "");
            }
        }
        
        emit TradeExecuted(msg.sender, tradeAmounts, actualCostOrGain);

        uint256 home = marketMaker.calcMarginalPrice(0);
        uint256 draw = marketMaker.calcMarginalPrice(1);
        uint256 away = marketMaker.calcMarginalPrice(2);

        emit OddsUpdated(matchId, home, draw, away);
    }

    function getNetCost(uint8 outcome, int256 amount) external view returns (int) {
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
        require(isInitialized, "Not initialized");
        require(!isResolved, "Market already resolved");
        require(result < 3, "Invalid outcome");

        isResolved = true;
        resolvedOutcome = result;
        marketMaker.close();

        uint256 indexSet = 1 << resolvedOutcome;
        uint256[] memory indexSetArray = new uint256[](1);
        indexSetArray[0] = indexSet;

        conditionalTokens.redeemPositions(
            usdc,
            bytes32(0),
            conditionId,
            indexSetArray 
        );

        uint256 redeemedBalance = usdc.balanceOf(address(this));

        usdc.approve(address(liquidityPool), redeemedBalance);
        liquidityPool.returnLiquidity(redeemedBalance);
        
        liquidityPool.revokeMarket(address(this));
        emit MarketResolved(matchId, result);
    }

    function redeemPayouts() external {
        require(isInitialized, "Not initialized");
        require(isResolved, "Market not resolved"); 
        uint256 indexSet = 1 << resolvedOutcome;
        uint256[] memory indexSetArray = new uint256[](1);
        indexSetArray[0] = indexSet;
        uint256 winningPositionId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );
        uint256 userBalance = conditionalTokens.balanceOf(msg.sender, winningPositionId);
        require(userBalance > 0, "No winning outcome tokens to redeem");
        conditionalTokens.safeTransferFrom(msg.sender, address(this), winningPositionId, userBalance, "");

        uint256 usdcBefore = usdc.balanceOf(address(this));

        conditionalTokens.redeemPositions(
            usdc,
            bytes32(0),
            conditionId,
            indexSetArray 
        );
       
        uint256 usdcAfter = usdc.balanceOf(address(this));
        uint256 payout = usdcAfter - usdcBefore;
        require(payout > 0, "Redemption failed, no payout received");

        require(usdc.transfer(msg.sender, payout), "USDC transfer to user failed");

        emit PayoutRedeemed(msg.sender, resolvedOutcome, payout);
    }
}
 