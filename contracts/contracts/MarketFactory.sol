// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ILiquidityPool.sol";
import "./interfaces/ILMSRMarketMaker.sol";
import "./PredictionMarket.sol";
import "./interfaces/IResultsConsumer.sol";
import "./interfaces/IConditionalTokens.sol";
import "./interfaces/ILMSRMarketMakerFactoryWrapper.sol";
import "./interfaces/IWhitelist.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

contract MarketFactory is Ownable, AutomationCompatibleInterface {
    mapping(uint256 => address) public predictionMarkets; 
    mapping(uint256 => address) public lmsrMarketMakers; 
    mapping(uint256 => bytes32) public matchConditionIds; 
    mapping(uint256 => uint256) public matchTimestamps;   
    mapping(uint256 => uint256) public matchRequestTimestamps; 
    mapping(uint256 => uint256) public deploymentTimestamps;   

    uint256[] public allMatchIds;
    uint256[] public activeMatches;

    uint256 public platformProfitPool;

    ILiquidityPool public liquidityPool;
    IWhitelist public whitelist;
    IResultsConsumer public resultsConsumer;
    IERC20 public usdc;
    IConditionalTokens public conditionalTokens; 
    ILMSRMarketMakerFactoryWrapper public lmsrFactoryWrapper;
    address private adapterAddress;

    uint256 public constant MATCH_DURATION = 120 * 60; 
    bool public initialized;

    event PredictionMarketDeployed(uint256 matchId, address marketAddress, uint256 matchTimestamp);
    event PredictionMarketResolved(uint256 matchId, uint8 outcome);

    constructor(
        address _liquidityPool,
        address _whitelistWrapper,
        address _resultsConsumer,
        address _usdc,
        address _conditionalTokensWrapper,
        address _lmsrFactoryWrapper,
        address _adapterAddress
    ) Ownable(msg.sender) {
        require(_liquidityPool != address(0), "Invalid LiquidityPool address");
        require(_whitelistWrapper != address(0), "Invalid WhitelistWrapper address");
        require(_resultsConsumer != address(0), "Invalid ResultsConsumer address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_conditionalTokensWrapper != address(0), "Invalid ConditionalTokensWrapper address");
        require(_lmsrFactoryWrapper != address(0), "Invalid LMSRFactoryWrapper address");
        require(_adapterAddress != address(0), "Invalid adapter address");

        liquidityPool = ILiquidityPool(_liquidityPool);
        whitelist = IWhitelist(_whitelistWrapper);
        resultsConsumer = IResultsConsumer(_resultsConsumer);
        usdc = IERC20(_usdc);
        conditionalTokens = IConditionalTokens(_conditionalTokensWrapper);
        lmsrFactoryWrapper = ILMSRMarketMakerFactoryWrapper(_lmsrFactoryWrapper);
        adapterAddress = _adapterAddress;
    }

    function initialize() external onlyOwner {
        require(!initialized, "Already initialized");
        initialized = true;

        liquidityPool.authorizeMarket(address(this));

        address[] memory whitelistArray = new address[](1);
        whitelistArray[0] = address(this);
        whitelist.addToWhitelist(whitelistArray);
    }

    function addToPlatformProfit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        usdc.transferFrom(msg.sender, address(this), amount);
        platformProfitPool += amount;
    }

    function withdrawPlatformProfit(uint256 amount) external onlyOwner {
        require(amount <= platformProfitPool, "Amount exceeds platform profit pool");
        platformProfitPool -= amount;
        usdc.transfer(msg.sender, amount);
    } 

    function verifyUser(address user) external onlyOwner {
        address[] memory users = new address[](1);
        users[0] = user;
        whitelist.addToWhitelist(users);
    }

    function deployPredictionMarket(uint256 matchId, uint256 matchTimestamp) external onlyOwner {
        require(predictionMarkets[matchId] == address(0), "Market already exists");
        require(matchTimestamp > block.timestamp, "Invalid timestamp");

        uint256 initialFunding = 10000 * 10**6;
        liquidityPool.withdrawLiquidity(initialFunding);
        usdc.approve(address(lmsrFactoryWrapper), initialFunding);

        PredictionMarket predictionMarket = new PredictionMarket(
            matchId,
            address(liquidityPool),
            address(usdc),
            address(conditionalTokens)
        );

        bytes32 questionId = keccak256(abi.encodePacked("Match Result: ", matchId));
        conditionalTokens.prepareCondition(address(predictionMarket), questionId, 3);

        bytes32 conditionId = conditionalTokens.getConditionId(address(predictionMarket), questionId, 3);  

        matchConditionIds[matchId] = conditionId;

        bytes32[] memory conditionIds = new bytes32[](1);
        conditionIds[0] = conditionId;
        address marketMaker = lmsrFactoryWrapper.createLMSRMarketMaker(conditionIds);
        lmsrMarketMakers[matchId] = marketMaker;

        predictionMarket.setAdapterAddress(adapterAddress);
        predictionMarket.initializeMarket(questionId, conditionId, marketMaker);

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

    function checkUpkeep(bytes calldata)
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

        for (uint256 i = 0; i < activeMatches.length; i++) {
            uint256 matchId = activeMatches[i];
            if (currentTime >= matchTimestamps[matchId] + MATCH_DURATION) {
                matchesToResolve[countToResolve] = matchId;
                countToResolve++;
            }
        }

        for (uint256 j = 0; j < allMatchIds.length; j++) {
            uint256 matchId = allMatchIds[j];
            if (currentTime > deploymentTimestamps[matchId] + 60 days) {
                matchesToCleanup[countToCleanup] = matchId;
                countToCleanup++;
            }
        }

        if (countToResolve > 0 || countToCleanup > 0) {
            upkeepNeeded = true;
            uint256[] memory finalMatchesToResolve = new uint256[](countToResolve);
            uint256[] memory finalMatchesToCleanup = new uint256[](countToCleanup);

            for (uint256 k = 0; k < countToResolve; k++) {
                finalMatchesToResolve[k] = matchesToResolve[k];
            }
            for (uint256 m = 0; m < countToCleanup; m++) {
                finalMatchesToCleanup[m] = matchesToCleanup[m];
            }

            performData = abi.encode(finalMatchesToResolve, finalMatchesToCleanup);
        } else {
            upkeepNeeded = false;
            performData = "";
        }
    }

    function performUpkeep(bytes calldata performData) external override {
        (uint256[] memory finalMatchesToResolve, uint256[] memory finalMatchesToCleanup) =
            abi.decode(performData, (uint256[], uint256[]));

        for (uint256 i = 0; i < finalMatchesToResolve.length; i++) {
            uint256 matchId = finalMatchesToResolve[i];
            uint256 matchEndTime = matchTimestamps[matchId] + MATCH_DURATION;
            require(block.timestamp >= matchEndTime, "Match duration has not passed");

            uint256 requestTimestamp = matchRequestTimestamps[matchId];
            if (requestTimestamp == 0) {
                matchRequestTimestamps[matchId] = block.timestamp;
                resultsConsumer.requestMatchResult(matchId);
            } else if (block.timestamp >= requestTimestamp + 30) {
                if (!resultsConsumer.matchResolved(matchId)) {
                    continue;
                }
                address predictionMarket = predictionMarkets[matchId];
                uint8 result = resultsConsumer.returnResult(matchId);
                PredictionMarket(predictionMarket).resolveMarket(result);

                _removeActiveMatch(matchId);

                delete matchRequestTimestamps[matchId];
                delete lmsrMarketMakers[matchId];
                delete matchConditionIds[matchId];
                delete matchTimestamps[matchId];

                emit PredictionMarketResolved(matchId, result);
            }
        }

        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < finalMatchesToCleanup.length; i++) {
            uint256 matchId = finalMatchesToCleanup[i];
            if (currentTime > deploymentTimestamps[matchId] + 60 days) {
                delete predictionMarkets[matchId];
                delete deploymentTimestamps[matchId];

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

    function _removeActiveMatch(uint256 matchId) internal {
        for (uint256 i = 0; i < activeMatches.length; i++) {
            if (activeMatches[i] == matchId) {
                if (i != activeMatches.length - 1) {
                    activeMatches[i] = activeMatches[activeMatches.length - 1];
                }
                activeMatches.pop();
                return;
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
  