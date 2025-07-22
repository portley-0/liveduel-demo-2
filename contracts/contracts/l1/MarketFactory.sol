// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../icm-contracts/teleporter/ITeleporterMessenger.sol";
import "../icm-contracts/teleporter/ITeleporterReceiver.sol";

import "./interfaces/ILiquidityPool.sol";
import "./PredictionMarket.sol"; 
import "./TournamentMarket.sol";

import "./gnosis/ConditionalTokens.sol";
import "./gnosis/LMSRMarketMakerFactory.sol";
import "./gnosis/LMSRMarketMaker.sol";
import "./gnosis/Whitelist.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract MarketFactory is Ownable, ITeleporterReceiver {

    using Clones for address;

    enum MessageType {
        RequestMatchResult,
        RequestRoundData,
        FulfillMatchResult,
        FulfillRoundData,
        TriggerUpkeep
    }

    ITeleporterMessenger public teleporterMessenger;
    address public cChainProxyAddress;
    bytes32 public cChainBlockchainID;

    mapping(uint256 => address) public predictionMarkets; 
    mapping(uint256 => address) public lmsrMarketMakers; 
    mapping(uint256 => bytes32) public matchConditionIds; 
    mapping(uint256 => uint256) public matchTimestamps;   
    mapping(uint256 => uint256) public deploymentTimestamps; 
    mapping(uint256 => uint256) public lastResolutionAttempt;  
    mapping(uint256 => uint256) public lastRoundFetch;
    mapping(uint256 => uint256) public tournamentSeason;

    uint256[] public allMatchIds;
    uint256[] public activeMatches;

    mapping(uint256 => address) public tournamentMarkets;
    uint256[] public activeTournaments;

    uint256 public platformProfitPool;

    ILiquidityPool public liquidityPool;
    Whitelist public whitelist;
    IERC20 public usdc;
    ConditionalTokens public conditionalTokens; 
    LMSRMarketMakerFactory public lmsrFactory;

    address public predictionMarketTemplate;
    address public tournamentMarketTemplate;

    address public botAddress;

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
    event RoundProcessed(uint256 indexed tournamentId);
    event RequestSentToProxy(MessageType requestType, bytes message);


    constructor(
        address _liquidityPool,
        address _whitelist,
        address _usdc,
        address _conditionalTokens,
        address _lmsrFactory,
        address _teleporterAddress,
        bytes32 _cChainBlockchainID
    ) Ownable(msg.sender) {
        liquidityPool = ILiquidityPool(_liquidityPool);
        whitelist = Whitelist(_whitelist);
        usdc = IERC20(_usdc);
        conditionalTokens = ConditionalTokens(_conditionalTokens);
        lmsrFactory = LMSRMarketMakerFactory(_lmsrFactory);

        teleporterMessenger = ITeleporterMessenger(_teleporterAddress);
        cChainBlockchainID = _cChainBlockchainID;

        predictionMarketTemplate  = address(new PredictionMarket());
        tournamentMarketTemplate = address(new TournamentMarket());
    }

    function setBotAddress(address _botAddress) external onlyOwner {
        require(_botAddress != address(0), "MarketFactory: Bot address cannot be the zero address");
        botAddress = _botAddress;
    }

    function setCChainProxyAddress(address _cChainProxyAddress) external onlyOwner {
        require(cChainProxyAddress == address(0), "Already set");
        require(_cChainProxyAddress != address(0), "Zero address");
        cChainProxyAddress = _cChainProxyAddress;
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
        require(predictionMarkets[matchId] == address(0), "Market already exists");

        uint256 initialFunding = 10000 * 1e6;
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
        require(botAddress != address(0), "Bot address cannot be the zero address");
        predictionMarket.setBotAddress(botAddress);

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

        uint256 initialFunding = 10000 * 1e6;
        liquidityPool.withdrawLiquidity(initialFunding);
        usdc.approve(address(lmsrFactory), initialFunding);

        address cloneAddress = tournamentMarketTemplate.clone();

        TournamentMarket tm = TournamentMarket(cloneAddress);

        bytes32 questionId = keccak256(abi.encodePacked("Tournament Winner:", tournamentId));
        conditionalTokens.prepareCondition(address(this), questionId, teamIds.length);
        bytes32 conditionId = conditionalTokens.getConditionId(address(this), questionId, teamIds.length);

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
        bytes memory messagePayload = abi.encode(MessageType.RequestRoundData, tournamentId, season);
        _sendRequestToProxy(messagePayload);
    }

    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override {
        require(msg.sender == address(teleporterMessenger), "MarketFactory: Not the Teleporter");
        require(sourceBlockchainID == cChainBlockchainID, "MarketFactory: Unknown source chain");
        require(originSenderAddress == cChainProxyAddress, "MarketFactory: Not from C-Chain Proxy");

        MessageType responseType = abi.decode(message, (MessageType));

        if (responseType == MessageType.FulfillMatchResult) {
            (, uint256 matchId, uint8 outcome, uint256 homeId, uint256 awayId) = abi.decode(
                message,
                (MessageType, uint256, uint8, uint256, uint256)
            );
            _resolveMatch(matchId, outcome, homeId, awayId);
        } else if (responseType == MessageType.FulfillRoundData) {
            (, uint256 tournamentId, bytes memory roundData) = abi.decode(
                message,
                (MessageType, uint256, bytes)
            );
            _processSingleRound(tournamentId, roundData);
        } else if (responseType == MessageType.TriggerUpkeep) {
            (bool upkeepNeeded, bytes memory performData) = checkUpkeep(bytes(""));
            if (upkeepNeeded) {
                performUpkeep(performData);
            }
        }
    }

    function checkUpkeep(bytes memory)
        public
        view
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


        if (countToResolve > 0 || countToCleanup > 0 || countToFetch > 0 || countTournamentFixturesToResolve > 0) {
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

            performData = abi.encode(finalMatchesToResolve, finalMatchesToCleanup, finalTournamentsToFetch, finalTournamentFixturesToResolve);
        } else {
            upkeepNeeded = false;
            performData = "";
        }
    }

    function performUpkeep(bytes memory performData) public {
        (
            uint256[] memory finalMatchesToResolve,
            uint256[] memory finalMatchesToCleanup,
            uint256[] memory tournamentsToFetch,
            uint256[] memory finalTournamentFixturesToResolve
        ) = abi.decode(performData, (uint256[], uint256[], uint256[], uint256[]));

        for (uint256 i = 0; i < finalMatchesToResolve.length; i++) {
            uint256 matchId = finalMatchesToResolve[i];
            lastResolutionAttempt[matchId] = block.timestamp;
            bytes memory messagePayload = abi.encode(MessageType.RequestMatchResult, matchId);
            _sendRequestToProxy(messagePayload);

        }

        for (uint256 i = 0; i < finalTournamentFixturesToResolve.length; i++) {
            uint256 matchId = finalTournamentFixturesToResolve[i];
            lastResolutionAttempt[matchId] = block.timestamp;
            bytes memory messagePayload = abi.encode(MessageType.RequestMatchResult, matchId);
            _sendRequestToProxy(messagePayload);
        }

        for (uint256 i = 0; i < tournamentsToFetch.length; i++) {
            uint256 tournamentId = tournamentsToFetch[i];
            lastRoundFetch[tournamentId] = block.timestamp;
            uint256 season = tournamentSeason[tournamentId];
            bytes memory messagePayload = abi.encode(MessageType.RequestRoundData, tournamentId, season);
            _sendRequestToProxy(messagePayload);
        }

        for (uint256 i = 0; i < finalMatchesToCleanup.length; i++) {
            uint256 matchId = finalMatchesToCleanup[i];
            
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

    
    function _sendRequestToProxy(bytes memory messagePayload) internal {
        TeleporterMessageInput memory messageInput = TeleporterMessageInput({
            destinationBlockchainID: cChainBlockchainID,
            destinationAddress: cChainProxyAddress,
            feeInfo: TeleporterFeeInfo({ feeTokenAddress: address(0), amount: 0 }),
            requiredGasLimit: 200000,
            allowedRelayerAddresses: new address[](0),
            message: messagePayload
        });
        teleporterMessenger.sendCrossChainMessage(messageInput);
        emit RequestSentToProxy(abi.decode(messagePayload, (MessageType)), messagePayload);
    }


    function _resolveMatch(uint256 matchId, uint8 outcome, uint256 homeId, uint256 awayId) internal {
        if (predictionMarkets[matchId] != address(0)) {
            if (conditionalTokens.payoutNumerators(matchConditionIds[matchId], outcome) == 0) {
                bytes32 questionId = keccak256(abi.encodePacked("Match Result: ", matchId));
                uint256[] memory payouts = new uint256[](3);
                payouts[outcome] = 1;
                conditionalTokens.reportPayouts(questionId, payouts);
            }
            PredictionMarket(predictionMarkets[matchId]).resolveMarket(outcome);
            _removeActiveMatch(matchId);
     
            delete predictionMarkets[matchId]; 
            emit PredictionMarketResolved(matchId, outcome);
            return;
        }

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
                TournamentMarket(tm).recordMatchResult(matchId, outcome, homeId, awayId);
                recorded = true;

                if (isRoundFinal && !isTournamentFinal) {
                    lastRoundFetch[tid] = block.timestamp;
                    bytes memory messagePayload = abi.encode(MessageType.RequestRoundData, tid, tournamentSeason[tid]);
                    _sendRequestToProxy(messagePayload);
                }
            }
        }
        if (recorded) {
            _removeTournamentFixture(matchId);
        }
    }
   
    function _processSingleRound(uint256 tid, bytes memory blob) internal {
        address tm = tournamentMarkets[tid];
        require(tm != address(0), "Tournament does not exist");

        uint256 wordCount = blob.length / 4;
        require(blob.length % 4 == 0 && wordCount >= 2, "Bad round data");

        uint256 N = (wordCount - 2) / 2;
        uint256 dataPtr;
        assembly { dataPtr := add(blob, 32) }

        uint32 isEnd32;
        uint32 lastIdx32;
        assembly ("memory-safe")  {
            isEnd32 := shr(224, mload(dataPtr))
            lastIdx32 := shr(224, mload(add(dataPtr, 4)))
        }
        bool isTourEnd = (isEnd32 == 1);
        uint256 lastIdx = uint256(lastIdx32);

        for (uint256 j = 0; j < N; j++) {
            uint32 id32;
            uint32 ts32;
            assembly ("memory-safe")  {
                let pId := add(dataPtr, mul(add(2, j), 4))
                id32 := shr(224, mload(pId))
                let pTs := add(dataPtr, mul(add(add(2, N), j), 4))
                ts32 := shr(224, mload(pTs))
            }
            uint256 fixtureId = uint256(id32);
            uint256 fixtureTimestamp = uint256(ts32);

            bool isRoundFinal = (j == lastIdx);
            bool isTournamentFinal = (isTourEnd && j == lastIdx);
            TournamentMarket(tm).addFixture(fixtureId, isRoundFinal, isTournamentFinal);
            
            if (fixtureTs[fixtureId] == 0) {
                fixtureTs[fixtureId] = fixtureTimestamp;
                tournamentFixturesToResolve.push(fixtureId);
            }
        }
        emit RoundProcessed(tid);
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