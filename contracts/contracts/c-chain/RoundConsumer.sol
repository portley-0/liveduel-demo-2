// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { FunctionsClient } from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import { FunctionsRequest } from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ConfirmedOwner } from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

interface IChainlinkProxy {
    function fulfillAndSendRoundData(uint256 tournamentId, bytes calldata roundData) external;
}

contract RoundConsumer is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 private donId;
    string private source;
    bytes private secrets;
    uint64 private subscriptionId;

    mapping(bytes32 => uint256) public pendingRequests;

    event RequestedRound(uint256 indexed tournamentId, uint256 indexed season, bytes32 requestId);
    event RawRoundReady(uint256 indexed tournamentId);
    event RequestFailed(uint256 indexed tournamentId, bytes32 requestId, string errorMessage);

    constructor(
        address router,
        bytes32 _donId,
        string memory _source,
        bytes memory _secrets,
        uint64 _subscriptionId
    ) FunctionsClient(router) ConfirmedOwner(msg.sender) {
        donId = _donId;
        source = _source;
        secrets = _secrets;
        subscriptionId = _subscriptionId;
    }

    function requestNextRound(uint256 tournamentId, uint256 season) external {
        string[] memory args = new string[](2);
        args[0] = Strings.toString(tournamentId);
        args[1] = Strings.toString(season);

        bytes32 reqId = _executeRequest(args);
        pendingRequests[reqId] = tournamentId;
        emit RequestedRound(tournamentId, season, reqId);
    }

    function _executeRequest(string[] memory args) internal returns (bytes32) {
        FunctionsRequest.Request memory req;
        req.initializeRequest(
            FunctionsRequest.Location.Inline,
            FunctionsRequest.CodeLanguage.JavaScript,
            source
        );
        req.addSecretsReference(secrets);
        if (args.length > 0) {
            req.setArgs(args);
        }
        return _sendRequest(req.encodeCBOR(), subscriptionId, 300000, donId);
    }

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        uint256 tid = pendingRequests[requestId];
        delete pendingRequests[requestId];

        if (err.length > 0) {
            emit RequestFailed(tid, requestId, string(err));
            return;
        }

        emit RawRoundReady(tid);

        IChainlinkProxy(owner()).fulfillAndSendRoundData(tid, response);
    }
}