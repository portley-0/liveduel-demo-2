// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ILiquidityPool.sol";
import "./gnosis/LMSRMarketMaker.sol";
import "./PredictionMarket.sol"; 
import "./TournamentMarket.sol";
import "./RoundConsumer.sol";
import "./interfaces/IResultsConsumer.sol";
import "./gnosis/ConditionalTokens.sol";
import "./gnosis/LMSRMarketMakerFactory.sol";
import "./gnosis/Whitelist.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import { AutomationCompatibleInterface } from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

contract MarketFactory is Ownable, AutomationCompatibleInterface {

    using Clones for address;

    mapping(uint256 => address) public predictionMarkets; 
    mapping(uint256 => address) public lmsrMarketMakers; 
    mapping(uint256 => bytes32) public matchConditionIds; 
    mapping(uint256 => uint256) public matchTimestamps;   
    mapping(uint256 => uint256) public deploymentTimestamps; 
    mapping(uint256 => uint256) public lastResolutionAttempt;  
    mapping(uint256 => uint256) public lastRoundFetch;
    mapping(uint256 => uint256) public tournamentSeason;

    mapping(uint256 => bool) public roundReady;
    uint256[] public pendingRounds;

    uint256[] public allMatchIds;
    uint256[] public activeMatches;

    mapping(uint256 => address) public tournamentMarkets;
    uint256[] public activeTournaments;

    uint256 public platformProfitPool;

    ILiquidityPool public liquidityPool;
    Whitelist public whitelist;
    IResultsConsumer public resultsConsumer;
    RoundConsumer public roundConsumer;
    IERC20 public usdc;
    ConditionalTokens public conditionalTokens; 
    LMSRMarketMakerFactory public lmsrFactory;

    address public predictionMarketTemplate;
    address public tournamentMarketTemplate;

    mapping(uint256 => uint256) public fixtureTs;
    uint256[] public tournamentFixturesToResolve;

    uint256 public constant MATCH_DURATION = 120 * 60; // Accounting for halftime / injury time / extra time / penalties
    uint256 public constant RESOLUTION_COOLDOWN = 5 minutes;
    uint256 public constant ROUND_COOLDOWN = 1 days;

    bool public initialized;

    event PredictionMarketDeployed(uint256 matchId, address marketAddress, uint256 matchTimestamp);
    event TournamentDeployed(uint256 indexed tournamentId, address indexed marketAddress);
    event PredictionMarketResolved(uint256 matchId, uint8 outcome);
    event PlatformProfitAdded(uint256 amount);
    event RoundQueued(uint256 indexed tournamentId);
    event RoundProcessingFailed(uint256 indexed tournamentId);


    constructor(
        address _liquidityPool,
        address _whitelist,
        address _resultsConsumer,
        address _usdc,
        address _conditionalTokens,
        address _lmsrFactory,
        address _roundConsumer
    ) Ownable(msg.sender) {
        require(_liquidityPool != address(0), "Invalid LiquidityPool address");
        require(_whitelist != address(0), "Invalid Whitelist address");
        require(_resultsConsumer != address(0), "Invalid ResultsConsumer address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_conditionalTokens != address(0), "Invalid ConditionalTokens address");
        require(_lmsrFactory != address(0), "Invalid LMSRFactory address");

        liquidityPool = ILiquidityPool(_liquidityPool);
        whitelist = Whitelist(_whitelist);
        resultsConsumer = IResultsConsumer(_resultsConsumer);
        usdc = IERC20(_usdc);
        conditionalTokens = ConditionalTokens(_conditionalTokens);
        lmsrFactory = LMSRMarketMakerFactory(_lmsrFactory);

        if (_roundConsumer != address(0)) {
            roundConsumer = RoundConsumer(_roundConsumer);
        }

        predictionMarketTemplate  = address(new PredictionMarket());

        tournamentMarketTemplate = address(new TournamentMarket());
    }

    function setRoundConsumer(address _roundConsumer) external onlyOwner {
        require(_roundConsumer != address(0), "Invalid RoundConsumer address");
        roundConsumer = RoundConsumer(_roundConsumer);
    }

    function acceptRoundConsumerOwnership() external onlyOwner {
        roundConsumer.acceptOwnership();
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
        emit PlatformProfitAdded(amount);
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
        _createPredictionMarket(matchId, matchTimestamp);
    }

    function _createPredictionMarket(uint256 matchId, uint256 matchTimestamp) internal {
        require(predictionMarkets[matchId] == address(0), "Market already exists");

        uint256 initialFunding = 15000 * 1e6;
        liquidityPool.withdrawLiquidity(initialFunding);
        usdc.approve(address(lmsrFactory), initialFunding);

        address cloneAddress = predictionMarketTemplate.clone();

        PredictionMarket predictionMarket = PredictionMarket(cloneAddress);

        bytes32 questionId = keccak256(abi.encodePacked("Match Result: ", matchId));
        conditionalTokens.prepareCondition(address(this), questionId, 3);

        bytes32 conditionId = conditionalTokens.getConditionId(address(this), questionId, 3);  
        require(conditionId != bytes32(0), "Condition ID not found");

        matchConditionIds[matchId] = conditionId;

        bytes32[] memory conditionIds = new bytes32[](1);
        conditionIds[0] = conditionId;
        
        LMSRMarketMaker marketMaker = lmsrFactory.createLMSRMarketMaker(
            conditionalTokens,
            usdc,
            conditionIds,
            uint64(0),
            whitelist,
            initialFunding
        );

        lmsrMarketMakers[matchId] = address(marketMaker);
        predictionMarket.initializeMarket(
            matchId, 
            questionId, 
            conditionId, 
            address(marketMaker), 
            address(liquidityPool),
            address(usdc),
            address(conditionalTokens)
        );

        address[] memory whitelistArray = new address[](1);
        whitelistArray[0] = cloneAddress;
        whitelist.addToWhitelist(whitelistArray);

        marketMaker.transferOwnership(cloneAddress);
        liquidityPool.authorizeMarket(cloneAddress);

        predictionMarkets[matchId] = cloneAddress;
        activeMatches.push(matchId);
        allMatchIds.push(matchId);
        matchTimestamps[matchId] = matchTimestamp;
        deploymentTimestamps[matchId] = block.timestamp;

        emit PredictionMarketDeployed(matchId, cloneAddress, matchTimestamp);
    }

    function deployTournament(
        uint256 tournamentId,
        uint256[] calldata teamIds,
        uint256 season
    ) external onlyOwner {
        require(tournamentMarkets[tournamentId] == address(0), "Tournament exists");

        uint256 initialFunding = 20000 * 1e6;
        liquidityPool.withdrawLiquidity(initialFunding);
        usdc.approve(address(lmsrFactory), initialFunding);

        address cloneAddress = tournamentMarketTemplate.clone();

        TournamentMarket tm = TournamentMarket(cloneAddress);

        bytes32 questionId = keccak256(abi.encodePacked("Tournament Winner:", tournamentId));
        conditionalTokens.prepareCondition(cloneAddress, questionId, teamIds.length);
        bytes32 conditionId = conditionalTokens.getConditionId(cloneAddress, questionId, teamIds.length);

        bytes32[] memory conditionIds = new bytes32[](1);
        conditionIds[0] = conditionId;

        LMSRMarketMaker mm = lmsrFactory.createLMSRMarketMaker(
            conditionalTokens,
            usdc,
            conditionIds,
            uint64(0),
            whitelist,
            initialFunding
        );
        mm.transferOwnership(cloneAddress);
        address[] memory whitelistArray = new address[](1);
        whitelistArray[0] = cloneAddress;
        whitelist.addToWhitelist(whitelistArray);

        tm.initializeMarket(
            tournamentId, 
            teamIds, 
            questionId, 
            conditionId, 
            address(mm),
            address(liquidityPool),
            address(usdc),
            address(conditionalTokens)
        );
        liquidityPool.authorizeMarket(cloneAddress);

        tournamentMarkets[tournamentId] = cloneAddress;
        activeTournaments.push(tournamentId);

        emit TournamentDeployed(tournamentId, cloneAddress);

        tournamentSeason[tournamentId] = season;
        lastRoundFetch[tournamentId] = block.timestamp;
        roundConsumer.requestNextRound(tournamentId, season);
    }

    function onRawDataReady(uint256 tournamentId) external {
        require(msg.sender == address(roundConsumer), "Only RoundConsumer");
        if (tournamentMarkets[tournamentId] == address(0)) return;
        if (!roundReady[tournamentId]) {
            roundReady[tournamentId] = true;
            pendingRounds.push(tournamentId);
            emit RoundQueued(tournamentId);
        }
    }

    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256[] memory matchesToResolve = new uint256[](activeMatches.length);
        uint256[] memory tempTournamentFixturesToResolve = new uint256[](tournamentFixturesToResolve.length);
        uint256[] memory matchesToCleanup = new uint256[](allMatchIds.length);
        uint256[] memory tournamentsToFetch = new uint256[](activeTournaments.length);

        uint256 countToResolve = 0;
        uint256 countTournamentFixturesToResolve = 0;
        uint256 countToCleanup = 0;
        uint256 countToFetch  = 0;
        uint256 currentTime = block.timestamp;

        for (uint256 i = 0; i < activeMatches.length; i++) {
            uint256 matchId = activeMatches[i];

            if (currentTime < lastResolutionAttempt[matchId] + RESOLUTION_COOLDOWN) {
                continue;
            }

            if (currentTime >= matchTimestamps[matchId] + MATCH_DURATION) {
                matchesToResolve[countToResolve] = matchId;
                countToResolve++;
            }
        }

        for (uint256 i = 0; i < tournamentFixturesToResolve.length; i++) {
            uint256 matchId = tournamentFixturesToResolve[i];

            if (currentTime < lastResolutionAttempt[matchId] + RESOLUTION_COOLDOWN) {
                continue;
            }

            if (currentTime >= fixtureTs[matchId] + MATCH_DURATION) {
                tempTournamentFixturesToResolve[countTournamentFixturesToResolve] = matchId;
                countTournamentFixturesToResolve++;
            }
        }

        for (uint256 j = 0; j < allMatchIds.length; j++) {
            uint256 matchId = allMatchIds[j];
            if (currentTime > deploymentTimestamps[matchId] + 60 days) {
                matchesToCleanup[countToCleanup] = matchId;
                countToCleanup++;
            }
        }

        for (uint256 k = 0; k < activeTournaments.length; k++) {
            uint256 tournamentId = activeTournaments[k];
            if (currentTime >= lastRoundFetch[tournamentId] + ROUND_COOLDOWN) {
                tournamentsToFetch[countToFetch] = tournamentId;
                countToFetch++;
            }
        }

        uint256[] memory roundsToProcess = pendingRounds;

        if (countToResolve > 0 || countToCleanup > 0 || countToFetch > 0 || roundsToProcess.length > 0 || countTournamentFixturesToResolve > 0) {
            upkeepNeeded = true;
            uint256[] memory finalMatchesToResolve = new uint256[](countToResolve);
            uint256[] memory finalMatchesToCleanup = new uint256[](countToCleanup);
            uint256[] memory finalTournamentsToFetch = new uint256[](countToFetch);
            uint256[] memory finalTournamentFixturesToResolve = new uint256[](countTournamentFixturesToResolve);

            for (uint256 i = 0; i < countTournamentFixturesToResolve; i++) {
                finalTournamentFixturesToResolve[i] = tempTournamentFixturesToResolve[i];
            }
            for (uint256 k = 0; k < countToResolve; k++) {
                finalMatchesToResolve[k] = matchesToResolve[k];
            }
            for (uint256 m = 0; m < countToCleanup; m++) {
                finalMatchesToCleanup[m] = matchesToCleanup[m];
            }
            for (uint256 z = 0; z < countToFetch; z++) {
                finalTournamentsToFetch[z] = tournamentsToFetch[z];
            }

            performData = abi.encode(finalMatchesToResolve, finalMatchesToCleanup, finalTournamentsToFetch, roundsToProcess, finalTournamentFixturesToResolve);
        } else {
            upkeepNeeded = false;
            performData = "";
        }
    }

    function performUpkeep(bytes calldata performData) external override {
        (uint256[] memory finalMatchesToResolve, uint256[] memory finalMatchesToCleanup, uint256[] memory tournamentsToFetch, uint256[] memory roundsToProcess, uint256[] memory finalTournamentFixturesToResolve) =
            abi.decode(performData, (uint256[], uint256[], uint256[], uint256[], uint256[]));

        for (uint256 i = 0; i < finalMatchesToResolve.length; i++) {
            uint256 matchId = finalMatchesToResolve[i];
            lastResolutionAttempt[matchId] = block.timestamp;
            uint256 matchEndTime = matchTimestamps[matchId] + MATCH_DURATION;
            require(block.timestamp >= matchEndTime, "Match duration has not passed");

            if (resultsConsumer.matchResolved(matchId) == true) {
                try resultsConsumer.returnResult(matchId) returns (uint8 finalOutcome, uint256 homeId, uint256 awayId)  {
                    // Only do the payouts report if not already done
                    if (conditionalTokens.payoutNumerators(matchConditionIds[matchId], finalOutcome) == 0) {
                        bytes32 questionId = keccak256(abi.encodePacked("Match Result: ", matchId));
                        uint256[] memory payouts = new uint256[](3);
                        payouts[finalOutcome] = 1;
                        conditionalTokens.reportPayouts(questionId, payouts);
                    }

                    PredictionMarket(predictionMarkets[matchId]).resolveMarket(finalOutcome);

                    require(_removeActiveMatch(matchId), "Match Removal Fail");

                    emit PredictionMarketResolved(matchId, finalOutcome);
                } catch {
                   continue;
                }
            } else {
                try resultsConsumer.requestMatchResult(matchId) {
                } catch {
                    continue;
                }
            }
        }

        for (uint256 i = 0; i < finalTournamentFixturesToResolve.length; i++) {
            uint256 matchId = finalTournamentFixturesToResolve[i];
            lastResolutionAttempt[matchId] = block.timestamp;

            if (resultsConsumer.matchResolved(matchId)) {
                try resultsConsumer.returnResult(matchId) returns (uint8 outcome, uint256 homeId, uint256 awayId) {
                    bool recorded = false;
                    for (uint256 j = 0; j < activeTournaments.length; j++) {
                        uint256 tid = activeTournaments[j];
                        address tm = tournamentMarkets[tid];
                        if (TournamentMarket(tm).fixtureExists(matchId)) {
                            bool isRoundFinal = TournamentMarket(tm).isRoundFinalMatch(matchId);
                            bool isTournamentFinal = TournamentMarket(tm).isTournamentFinalMatch(matchId);
                            if (isTournamentFinal) {
                                bytes32 condId = TournamentMarket(tm).getConditionId();
                                bytes32 qId = TournamentMarket(tm).getQuestionId();
                                uint8 winnerIdx = (outcome == 0)
                                    ? TournamentMarket(tm).getWinnerIndex(homeId)
                                    : TournamentMarket(tm).getWinnerIndex(awayId);

                                uint256[] memory payouts = new uint256[](TournamentMarket(tm).getTotalTeams());
                                payouts[winnerIdx] = 1;

                                if (conditionalTokens.payoutNumerators(condId, winnerIdx) == 0) {
                                    conditionalTokens.reportPayouts(qId, payouts);
                                }

                            }
                            try TournamentMarket(tm).recordMatchResult(matchId, outcome, homeId, awayId) {
                                recorded = true;

                                if (isRoundFinal && !isTournamentFinal) {
                                    lastRoundFetch[tid] = block.timestamp;
                                    roundConsumer.requestNextRound(tid, tournamentSeason[tid]);
                                }

                            } catch {
                                continue;
                            }
                        }
                    }
                    
                    if (recorded) {
                        _removeTournamentFixture(matchId);
                    }

                } catch {
                    continue;
                }
            } else {
                try resultsConsumer.requestMatchResult(matchId) {} catch {}
            }
        }

        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < finalMatchesToCleanup.length; i++) {
            uint256 matchId = finalMatchesToCleanup[i];
            if (currentTime > deploymentTimestamps[matchId] + 60 days) {

                delete predictionMarkets[matchId];
                delete deploymentTimestamps[matchId];
                delete lmsrMarketMakers[matchId];
                delete lastResolutionAttempt[matchId];
                delete matchConditionIds[matchId];
                delete matchTimestamps[matchId];

                for (uint256 j = 0; j < allMatchIds.length; j++) {
                    if (allMatchIds[j] == matchId) {
                        allMatchIds[j] = allMatchIds[allMatchIds.length - 1];
                        allMatchIds.pop();
                        break;
                    }
                }
            }
        }

        for (uint256 i = 0; i < tournamentsToFetch.length; i++) {
            uint256 tid = tournamentsToFetch[i];
            lastRoundFetch[tid] = block.timestamp;
            roundConsumer.requestNextRound(tid, tournamentSeason[tid]);
        }

        for (uint256 i = 0; i < roundsToProcess.length; i++) {
            uint256 tid = roundsToProcess[i];
            try this._processSingleRound(tid) {
                // Success, do nothing
            } catch {
                // The round failed to process. Emit an event and continue.
                emit RoundProcessingFailed(tid);
                
                // We also need to clean up the flags for this failed round
                // to prevent it from being processed again unnecessarily.
                roundReady[tid] = false;
                roundConsumer.clearRawRoundData(tid);
                continue;
            }
        }
        
        delete pendingRounds;
    }

    function _processSingleRound(uint256 tid) public {
        address tm = tournamentMarkets[tid];

        bytes memory blob = roundConsumer.rawRoundData(tid);
        uint256 wordCount = blob.length / 4;
        require(blob.length % 4 == 0 && wordCount >= 2, "Bad round data");

        // N = number of fixtures
        uint256 N = (wordCount - 2) / 2;

        uint256 dataPtr;
        assembly { dataPtr := add(blob, 32) }

        // Read header: isEnd @ [0], lastIdx @ [1]
        uint32 isEnd32;
        uint32 lastIdx32;

        assembly ("memory-safe")  {
            isEnd32 := shr(224, mload(dataPtr))         // blob[0]
            lastIdx32 := shr(224, mload(add(dataPtr, 4)))  // blob[1]
        }
        bool isTourEnd = (isEnd32 == 1);
        uint256 lastIdx = uint256(lastIdx32);

        // Now unpack each fixtureId and timestamp
        for (uint256 j = 0; j < N; j++) {
            uint32 id32;
            uint32 ts32;
            assembly ("memory-safe")  {
                // fixtureId at blob[2 + j]
                let pId := add(dataPtr, mul(add(2, j), 4))
                id32 := shr(224, mload(pId))
                // timestamp at blob[2 + N + j]
                let pTs := add(dataPtr, mul(add(add(2, N), j), 4))
                ts32 := shr(224, mload(pTs))
            }
            uint256 fixtureId = uint256(id32);
            uint256 fixtureTimestamp = uint256(ts32);

            bool isRoundFinal      = (j == lastIdx);
            bool isTournamentFinal = (isTourEnd && j == lastIdx);
            TournamentMarket(tm).addFixture(fixtureId, isRoundFinal, isTournamentFinal);
            
            if (fixtureTs[fixtureId] == 0) {
                fixtureTs[fixtureId] = fixtureTimestamp;
                tournamentFixturesToResolve.push(fixtureId);
            }
        }

        roundReady[tid] = false;
        roundConsumer.clearRawRoundData(tid);
    }

    function _removeActiveMatch(uint256 matchId) internal returns (bool) {
        for (uint256 i = 0; i < activeMatches.length; i++) {
            if (activeMatches[i] == matchId) {
                if (i != activeMatches.length - 1) {
                    activeMatches[i] = activeMatches[activeMatches.length - 1];
                }
                activeMatches.pop();
                return true;  
            }
        }
        return false; 
    }

    function _removeTournamentFixture(uint256 matchId) internal returns (bool) {
        for (uint256 i = 0; i < tournamentFixturesToResolve.length; i++) {
            if (tournamentFixturesToResolve[i] == matchId) {
                if (i != tournamentFixturesToResolve.length - 1) {
                    tournamentFixturesToResolve[i] = tournamentFixturesToResolve[tournamentFixturesToResolve.length - 1];
                }
                tournamentFixturesToResolve.pop();
                delete fixtureTs[matchId];
                return true;
            }
        }
        return false;
    }

    function removeActiveTournament(uint256 tournamentId) external {
        require(msg.sender == tournamentMarkets[tournamentId], "Only the tournament itself");

        for (uint i = 0; i < activeTournaments.length; i++) {
            if (activeTournaments[i] == tournamentId) {
                activeTournaments[i] = activeTournaments[activeTournaments.length - 1];
                activeTournaments.pop();
                break;
            }
        }

    }

    function getActiveMatches() external view returns (uint256[] memory) {
        return activeMatches;
    }

    function getActiveTournaments() external view returns (uint256[] memory) {
        return activeTournaments;
    }

    function getPredictionMarket(uint256 matchId) external view returns (address) {
        require(predictionMarkets[matchId] != address(0), "Market does not exist for this match ID");
        return predictionMarkets[matchId];
    }

    function getTournamentMarket(uint256 tournamentId) external view returns (address) {
        require(tournamentMarkets[tournamentId] != address(0), "Market does not exist for this tournament ID");
        return tournamentMarkets[tournamentId];
    }
}