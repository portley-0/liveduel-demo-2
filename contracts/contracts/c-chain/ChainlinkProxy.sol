// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ITeleporterMessenger, TeleporterMessageInput, TeleporterFeeInfo } from "../icm-contracts/teleporter/ITeleporterMessenger.sol";
import { ITeleporterReceiver } from "../icm-contracts/teleporter/ITeleporterReceiver.sol";
import { ConfirmedOwner } from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

interface IConfirmedOwner {
    function acceptOwnership() external;
}

interface IResultsConsumer {
    function requestMatchResult(uint256 matchId) external;
}

interface IRoundConsumer {
    function requestNextRound(uint256 tournamentId, uint256 season) external;
}

contract ChainlinkProxy is ITeleporterReceiver, ConfirmedOwner {

    enum MessageType {
        RequestMatchResult,
        RequestRoundData,
        FulfillMatchResult,
        FulfillRoundData,
        TriggerUpkeep
    }

    ITeleporterMessenger public immutable teleporterMessenger;
    bytes32 public immutable l1BlockchainID;
    address public marketFactoryOnL1;
    IResultsConsumer public immutable resultsConsumer;
    IRoundConsumer public immutable roundConsumer;

    event RequestReceivedFromL1(MessageType indexed requestType, bytes message);
    event ResultSentToL1(uint256 indexed matchId);
    event RoundDataSentToL1(uint256 indexed tournamentId);
    event UpkeepTriggeredOnL1();

    constructor(
        address _teleporterAddress,
        bytes32 _l1BlockchainID,
        address _resultsConsumerAddress,
        address _roundConsumerAddress
    ) ConfirmedOwner(msg.sender) {
        teleporterMessenger = ITeleporterMessenger(_teleporterAddress);
        l1BlockchainID = _l1BlockchainID;
        resultsConsumer = IResultsConsumer(_resultsConsumerAddress);
        roundConsumer = IRoundConsumer(_roundConsumerAddress);
    }

    function setMarketFactoryAddress(address _marketFactoryOnL1) external onlyOwner {
        require(marketFactoryOnL1 == address(0), "Already set");
        require(_marketFactoryOnL1 != address(0), "Zero address");
        marketFactoryOnL1 = _marketFactoryOnL1;
    }

    function acceptConsumerOwnerships() external onlyOwner {
        IConfirmedOwner(address(resultsConsumer)).acceptOwnership();
        IConfirmedOwner(address(roundConsumer)).acceptOwnership();
    }

    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override {
        require(msg.sender == address(teleporterMessenger), "ChainlinkProxy: Not the Teleporter");
        require(sourceBlockchainID == l1BlockchainID, "ChainlinkProxy: Unknown source chain");
        require(originSenderAddress == marketFactoryOnL1, "ChainlinkProxy: Not from MarketFactory");

        MessageType requestType = abi.decode(message, (MessageType));
        emit RequestReceivedFromL1(requestType, message);

        if (requestType == MessageType.RequestMatchResult) {
            (, uint256 matchId) = abi.decode(message, (MessageType, uint256));
            resultsConsumer.requestMatchResult(matchId);
        } else if (requestType == MessageType.RequestRoundData) {
            (, uint256 tournamentId, uint256 season) = abi.decode(message, (MessageType, uint256, uint256));
            roundConsumer.requestNextRound(tournamentId, season);
        }
    }

    function performUpkeep(bytes calldata /* performData */) external {
        bytes memory messagePayload = abi.encode(MessageType.TriggerUpkeep);
        _sendResponseToL1(messagePayload);
        emit UpkeepTriggeredOnL1();
    }

    function fulfillAndSendResult(uint256 matchId, uint8 outcome, uint256 homeId, uint256 awayId) external {
        require(msg.sender == address(resultsConsumer), "ChainlinkProxy: Caller is not ResultsConsumer");

        bytes memory messagePayload = abi.encode(MessageType.FulfillMatchResult, matchId, outcome, homeId, awayId);
        _sendResponseToL1(messagePayload);

        emit ResultSentToL1(matchId);
    }

    function fulfillAndSendRoundData(uint256 tournamentId, bytes calldata roundData) external {
        require(msg.sender == address(roundConsumer), "ChainlinkProxy: Caller is not RoundConsumer");

        bytes memory messagePayload = abi.encode(MessageType.FulfillRoundData, tournamentId, roundData);
        _sendResponseToL1(messagePayload);

        emit RoundDataSentToL1(tournamentId);
    }

    function _sendResponseToL1(bytes memory messagePayload) internal {
        TeleporterMessageInput memory messageInput = TeleporterMessageInput({
            destinationBlockchainID:    l1BlockchainID,
            destinationAddress:         marketFactoryOnL1,
            feeInfo:                    TeleporterFeeInfo({ feeTokenAddress: address(0), amount: 0 }),
            requiredGasLimit:           500000,
            allowedRelayerAddresses:    new address[](0),
            message:                    messagePayload
        });

        teleporterMessenger.sendCrossChainMessage(messageInput);
    }

}