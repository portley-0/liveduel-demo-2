// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ILiquidityPool.sol";
import "./interfaces/ILMSRMarketMaker.sol";
import "./PredictionMarket.sol";
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
    mapping(uint256 => uint256) public matchTimestamps;   // Match ID to match timestamp
    mapping(uint256 => uint256) public matchRequestTimestamps; // Match ID to timestamp when result was requested
    mapping(uint256 => uint256) public deploymentTimestamps;   // Match ID to deployment timestamp

    uint256[] public allMatchIds; // Track all match IDs
    uint256[] public activeMatches; // List of active match IDs

    uint256 public platformProfitPool; // Platform profit pool

    ILiquidityPool public liquidityPool;
    IWhitelist public whitelist;
    IResultsConsumer public resultsConsumer;
    IERC20 public usdc;
    IConditionalTokens public conditionalTokens;
    ILMSRMarketMakerFactory public lmsrFactoryWrapper;

    uint256 public constant MATCH_DURATION = 120 * 60; // (120 minutes)
    bool public initialized;

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

        liquidityPool = ILiquidityPool(_liquidityPool);
        whitelist = IWhitelist(_whitelistWrapper);
        resultsConsumer = IResultsConsumer(_resultsConsumer);
        usdc = IERC20(_usdc);
        conditionalTokens = IConditionalTokens(_conditionalTokensWrapper);
        lmsrFactoryWrapper = ILMSRMarketMakerFactory(_lmsrFactoryWrapper);
    }

    function initialize() external onlyOwner {
        require(!initialized, "Already initialized");
        initialized = true;

        // Authorize the MarketFactory in the LiquidityPool
        liquidityPool.authorizeMarket(address(this));

        address[] memory whitelistArray = new address[](1);
        whitelistArray[0] = address(this);

        // Authorize the MarketFactory in the Whitelist
        whitelist.addToWhitelist(whitelistArray);
    }

    // Add to platform profit pool
    function addToPlatformProfit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        usdc.transferFrom(msg.sender, address(this), amount);
        platformProfitPool += amount;
    }

    // Function to retrieve platform profits (onlyOwner)
    function withdrawPlatformProfit(uint256 amount) external onlyOwner {
        require(amount <= platformProfitPool, "Amount exceeds platform profit pool");
        platformProfitPool -= amount;
        usdc.transfer(msg.sender, amount);
    }

    function deployPredictionMarket(uint256 matchId, uint256 matchTimestamp) external onlyOwner {
        require(predictionMarkets[matchId] == address(0), "Market already exists");

        require(matchTimestamp > block.timestamp, "Invalid timestamp");

        uint256 initialFunding = 5000 * 10**6; // 5000 USDC
        liquidityPool.withdrawLiquidity(initialFunding);

        usdc.approve(address(lmsrFactoryWrapper), initialFunding);

        bytes32 questionId = keccak256(abi.encodePacked("Match Result: ", matchId));
        conditionalTokens.prepareCondition(address(this), questionId, 3);

        bytes32 conditionId = conditionalTokens.getConditionId(address(this), questionId, 3);
        matchConditionIds[matchId] = conditionId;

        bytes32[] memory conditionIds = new bytes32[](1);
        conditionIds[0] = conditionId;

        address marketMaker = lmsrFactoryWrapper.createLMSRMarketMaker(
            address(conditionalTokens),
            address(usdc),
            conditionIds,
            0,                  // no fee
            address(whitelist), // whitelist
            initialFunding      // initialFunding
        );

        lmsrMarketMakers[matchId] = marketMaker;

        PredictionMarket predictionMarket = new PredictionMarket(
            matchId,
            address(liquidityPool),
            conditionId,
            questionId,
            address(usdc),
            address(conditionalTokens),
            marketMaker
        );

        address[] memory whitelistArray = new address[](1);
        whitelistArray[0] = address(predictionMarket);
        whitelist.addToWhitelist(whitelistArray);

        ILMSRMarketMaker(marketMaker).transferOwnership(address(predictionMarket));

        liquidityPool.authorizeMarket(address(predictionMarket));

        predictionMarkets[matchId] = address(predictionMarket);
        activeMatches.push(matchId);
        allMatchIds.push(matchId);
        matchTimestamps[matchId] = matchTimestamp;
        deploymentTimestamps[matchId] = block.timestamp;

        emit PredictionMarketDeployed(matchId, address(predictionMarket), matchTimestamp);
    }

    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256[] memory matchesToResolve = new uint256[](activeMatches.length);
        uint256[] memory matchesToCleanup = new uint256[](allMatchIds.length);

        uint256 countToResolve = 0;
        uint256 countToCleanup = 0;
        uint256 currentTime = block.timestamp;

        // Check for matches to resolve
        for (uint256 i = 0; i < activeMatches.length; i++) {
            uint256 matchId = activeMatches[i];
            uint256 matchEndTime = matchTimestamps[matchId] + MATCH_DURATION;

            if (currentTime >= matchEndTime) {
                matchesToResolve[countToResolve] = matchId;
                countToResolve++;
            }
        }

        // Check for old markets to clean up
        for (uint256 i = 0; i < allMatchIds.length; i++) {
            uint256 matchId = allMatchIds[i];
            if (currentTime > deploymentTimestamps[matchId] + 60 days) {
                matchesToCleanup[countToCleanup] = matchId;
                countToCleanup++;
            }
        }

        // If there are matches to resolve or clean up, prepare performData
        if (countToResolve > 0 || countToCleanup > 0) {
            upkeepNeeded = true;

            // Encode only the populated part of the arrays
            uint256[] memory finalMatchesToResolve = new uint256[](countToResolve);
            uint256[] memory finalMatchesToCleanup = new uint256[](countToCleanup);

            for (uint256 i = 0; i < countToResolve; i++) {
                finalMatchesToResolve[i] = matchesToResolve[i];
            }
            for (uint256 i = 0; i < countToCleanup; i++) {
                finalMatchesToCleanup[i] = matchesToCleanup[i];
            }

            performData = abi.encode(finalMatchesToResolve, finalMatchesToCleanup);
            return (true, performData);
        }

        return (false, "");
    }


    function performUpkeep(bytes calldata performData) external override {
        (uint256[] memory matchesToResolve, uint256[] memory matchesToCleanup) = abi.decode(performData, (uint256[], uint256[]));

        // Handle matches to resolve
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
                address predictionMarket = predictionMarkets[matchId];

                if (!resultsConsumer.matchResolved(matchId)) {
                    continue; // Skip if the result is not yet available
                }

                uint8 result = resultsConsumer.returnResult(matchId);
                PredictionMarket(predictionMarket).resolveMarket(result);

                if (i != activeMatches.length - 1) {
                    activeMatches[i] = activeMatches[activeMatches.length - 1];
                }
                activeMatches.pop();

                delete matchRequestTimestamps[matchId];
                delete lmsrMarketMakers[matchId];
                delete matchConditionIds[matchId];
                delete matchTimestamps[matchId];

                emit PredictionMarketResolved(matchId, result);
            }
        }

        // Handle old markets to clean up
        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < matchesToCleanup.length; i++) {
            uint256 matchId = matchesToCleanup[i];

            if (currentTime > deploymentTimestamps[matchId] + 60 days) {

                // Clean up mappings
                delete predictionMarkets[matchId];
                delete deploymentTimestamps[matchId];

                // Remove from allMatchIds array
                for (uint256 j = 0; j < allMatchIds.length; j++) {
                    if (allMatchIds[j] == matchId) {
                        allMatchIds[j] = allMatchIds[allMatchIds.length - 1];
                        allMatchIds.pop();
                        break;
                    }
                }
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

    function getAllActiveMatchesAndMarkets() external view returns (uint256[] memory, address[] memory) {
        uint256 length = activeMatches.length;
        uint256[] memory matchIds = new uint256[](length);
        address[] memory marketAddresses = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            uint256 matchId = activeMatches[i];
            matchIds[i] = matchId;
            marketAddresses[i] = predictionMarkets[matchId];
        }

        return (matchIds, marketAddresses);
    }

}