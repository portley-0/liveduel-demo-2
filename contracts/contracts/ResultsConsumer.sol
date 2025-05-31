// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { FunctionsClient } from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import { FunctionsRequest } from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { ConfirmedOwner } from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

contract ResultsConsumer is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 private donId;
    string  private source;
    bytes   private secrets;
    uint64  private subscriptionId;

    mapping(bytes32 => uint256) public pendingRequests;

    struct MatchResult {
      uint8   outcome;
      uint256 homeId;
      uint256 awayId;
    }
    mapping(uint256 => MatchResult) private matchResults;
    mapping(uint256 => bool)       public matchResolved;

    event RequestedResult(uint256 indexed matchId, bytes32 requestId);
    event ResultReceived(
      uint256 indexed matchId,
      uint8   outcome,
      uint256 homeId,
      uint256 awayId
    );
    event RequestFailed(uint256 indexed matchId, bytes32 requestId, string errorMessage);

    constructor(
        address router,
        bytes32 _donId,
        string memory _source,
        bytes memory _secrets,
        uint64 _subscriptionId
    )
        FunctionsClient(router)
        ConfirmedOwner(msg.sender)
    {
        donId          = _donId;
        source         = _source;
        secrets        = _secrets;
        subscriptionId = _subscriptionId;
    }

    function requestMatchResult(uint256 matchId) external {
        string [] memory args = new string[](1);
        args[0] = Strings.toString(matchId);

        bytes32 requestId = _executeRequest(args);
        pendingRequests[requestId] = matchId;
        emit RequestedResult(matchId, requestId);
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
        return _sendRequest(req.encodeCBOR(), subscriptionId, 250000, donId);
    }

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        uint256 matchId = pendingRequests[requestId];
        delete pendingRequests[requestId];

        if (err.length > 0) {
            emit RequestFailed(matchId, requestId, string(err));
            return;
        }

        uint32 rawOutcome;
        uint32 rawHomeId;
        uint32 rawAwayId;

        assembly ("memory-safe") {
            let dataPtr := add(response, 32) // Pointer to the start of the actual data

            // Load outcome (32 bytes starting at dataPtr + 0)
            rawOutcome := mload(dataPtr)
            // Load homeId (32 bytes starting at dataPtr + 32)
            rawHomeId := mload(add(dataPtr, 32))
            // Load awayId (32 bytes starting at dataPtr + 64)
            rawAwayId := mload(add(dataPtr, 64))
        }

        uint8   outcome = uint8(rawOutcome);
        uint256 homeId  = rawHomeId;
        uint256 awayId  = rawAwayId;

        matchResults[matchId] = MatchResult({
          outcome: outcome,
          homeId:  homeId,
          awayId:  awayId
        });
        matchResolved[matchId] = true;

        emit ResultReceived(matchId, outcome, homeId, awayId);
    }

    /// @return outcome 0=home,1=draw,2=away
    /// @return homeId  API’s home team ID
    /// @return awayId  API’s away team ID
    function returnResult(uint256 matchId)
      public
      view
      returns (uint8 outcome, uint256 homeId, uint256 awayId)
    {
        require(matchResolved[matchId], "Result not yet available");
        MatchResult memory r = matchResults[matchId];
        return (r.outcome, r.homeId, r.awayId);
    }
}
