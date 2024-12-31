// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IPredictionMarket.sol";
import "./interfaces/IResultsConsumer.sol";
import "./interfaces/IConditionalTokens.sol";
import "./interfaces/ILMSRMarketMakerFactory.sol";
import "./interfaces/IWhitelist.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

contract MarketFactory is Ownable, AutomationCompatibleInterface {
    mapping(uint256 => address) public predictionMarkets; // Match ID to PredictionMarket address
    mapping(uint256 => address) public lmsrMarketMakers; // Match ID to LMSR Market Maker address
    mapping(uint256 => bytes32) public matchConditionIds; // Match ID to Condition ID
    mapping(uint256 => uint256) public matchTimestamps; // Match ID to match timestamp
    mapping(uint256 => uint256) public matchRequestTimestamps; // Match ID to timestamp when result was requested
    uint256[] public activeMatches; // List of active match IDs

    uint256 public platformProfitPool; // Platform profit pool

    LiquidityPool public liquidityPool;
    IWhitelist public whitelist;
    IResultsConsumer public resultsConsumer;
    IERC20 public usdc;
    IConditionalTokens public conditionalTokens;
    ILMSRMarketMakerFactory public lmsrFactory;

    uint256 public constant MATCH_DURATION = 120 * 60; // Soccer match duration in seconds (120 minutes)

    event PredictionMarketDeployed(uint256 matchId, address marketAddress, uint256 matchTimestamp);
    event PredictionMarketResolved(uint256 matchId, uint8 outcome);

    constructor(
        address _liquidityPool,
        address _whitelistWrapper,
        address _resultsConsumer,
        address _usdc,
        address _conditionalTokensWrapper,
        address _lmsrFactoryWrapper
    ) Ownable(msg.sender) {
        require(_liquidityPool != address(0), "Invalid LiquidityPool address");
        require(_whitelistWrapper != address(0), "Invalid WhitelistWrapper address");
        require(_resultsConsumer != address(0), "Invalid ResultsConsumer address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_conditionalTokensWrapper != address(0), "Invalid ConditionalTokensWrapper address");
        require(_lmsrFactoryWrapper != address(0), "Invalid LMSRFactoryWrapper address");

        liquidityPool = LiquidityPool(_liquidityPool);
        whitelist = IWhitelist(_whitelistWrapper);
        resultsConsumer = IResultsConsumer(_resultsConsumer);
        usdc = IERC20(_usdc);
        conditionalTokens = IConditionalTokens(_conditionalTokensWrapper);
        lmsrFactory = ILMSRMarketMakerFactory(_lmsrFactoryWrapper);

        // Authorize the MarketFactory in the LiquidityPool
        liquidityPool.authorizeMarket(address(this));

        // Authorize the MarketFactory in the Whitelist
        whitelist.addToWhitelist([address(this)]);
    }

    // Add to platform profit pool
    function addToPlatformProfit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        // Transfer USDC from the sender to the MarketFactory contract
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

        // Increment the platform profit pool
        platformProfitPool += amount;

        emit PlatformProfitAdded(amount);
    }

    // Function to retrieve platform profits (onlyOwner)
    function withdrawPlatformProfit(uint256 amount) external onlyOwner {
        require(amount <= platformProfitPool, "Amount exceeds platform profit pool");

        // Decrement the platform profit pool
        platformProfitPool -= amount;

        // Transfer the amount to the owner
        require(usdc.transfer(msg.sender, amount), "USDC transfer failed");
    }

    function deployPredictionMarket(uint256 matchId, uint256 matchTimestamp) external onlyOwner {
        require(predictionMarkets[matchId] == address(0), "Market already exists for this match ID");
        require(matchTimestamp > block.timestamp, "Invalid match timestamp");

        // Withdraw initial funding from the liquidity pool
        uint256 initialFunding = 5000 * 10**6; // 5000 USDC
        liquidityPool.withdrawLiquidity(initialFunding);

        // Prepare a Gnosis condition via the wrapper
        bytes32 questionId = keccak256(abi.encodePacked("Match Result: ", matchId));
        conditionalTokens.prepareCondition(address(this), questionId, 3); 
        bytes32 conditionId = conditionalTokens.getConditionId(address(this), questionId, 3);

        // Store conditionId
        matchConditionIds[matchId] = conditionId;

        bytes32[1] memory conditionIds;
        conditionIds[0] = conditionId;

        // Create LMSR Market Maker using the wrapper
        address marketMaker = lmsrFactory.createLMSRMarketMaker(
            address(conditionalTokens),
            address(usdc),
            conditionIds,
            0,                  // no fee
            address(whitelist), // whitelist
            initialFunding // Initial funding 
        );

        // Save the LMSR Market Maker address
        lmsrMarketMakers[matchId] = marketMaker;

        // Deploy the PredictionMarket contract
        PredictionMarket predictionMarket = new PredictionMarket(
            matchId,
            address(liquidityPool),
            conditionId,
            questionId, 
            address(usdc),
            address(conditionalTokens),
            marketMaker
        );

        // Authorize the PredictionMarket on the whitelist
        whitelist.addToWhitelist([address(predictionMarket)]);

        // Authorize the PredictionMarket in the LiquidityPool
        liquidityPool.authorizeMarket(address(predictionMarket));

        predictionMarkets[matchId] = address(predictionMarket);
        activeMatches.push(matchId);
        matchTimestamps[matchId] = matchTimestamp;

        emit PredictionMarketDeployed(matchId, address(predictionMarket), matchTimestamp);
    }

    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256[] memory matchesToResolve = new uint256[](activeMatches.length);
        uint256 count = 0;

        for (uint256 i = 0; i < activeMatches.length; i++) {
            uint256 matchId = activeMatches[i];
            uint256 matchEndTime = matchTimestamps[matchId] + MATCH_DURATION;

            // Check if the match duration has passed and it's time to request or resolve
            if (block.timestamp >= matchEndTime ) {
                matchesToResolve[count] = matchId;
                count++;
            } 
        }

        if (count > 0) {
            bytes memory data = abi.encode(matchesToResolve);
            return (true, data);
        }

        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256[] memory matchesToResolve = abi.decode(performData, (uint256[]));

        for (uint256 i = 0; i < matchesToResolve.length; i++) {
            uint256 matchId = matchesToResolve[i];
            uint256 matchEndTime = matchTimestamps[matchId] + MATCH_DURATION;
            uint256 requestTimestamp = matchRequestTimestamps[matchId];

            require(block.timestamp >= matchEndTime, "Match duration has not passed");

            if (requestTimestamp == 0) {
                // Request result if not already requested
                matchRequestTimestamps[matchId] = block.timestamp;
                resultsConsumer.requestMatchResult(matchId);
            } else if (block.timestamp >= requestTimestamp + 30) {
                // Resolve result after 30 seconds delay
                bytes32 conditionId = matchConditionIds[matchId];
                address predictionMarket = predictionMarkets[matchId];

                if (!resultsConsumer.matchResolved(matchId)) {
                    continue; // Skip if the result is not yet available
                }

                uint8 result = resultsConsumer.returnResult(matchId);
                PredictionMarket(predictionMarket).resolveMarket(result);

                activeMatches[i] = activeMatches[activeMatches.length - 1];
                activeMatches.pop();
                delete matchRequestTimestamps[matchId];

                emit PredictionMarketResolved(matchId, result);
            }
        }
    }

    function getActiveMatches() external view returns (uint256[] memory) {
        return activeMatches;
    }

    function getPredictionMarket(uint256 matchId) external view returns (address) {
        require(predictionMarkets[matchId] != address(0), "Market does not exist for this match ID");
        return predictionMarkets[matchId];
    }
}
