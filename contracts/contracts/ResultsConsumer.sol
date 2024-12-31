// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

contract ResultsConsumer is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 private donId;
    string private source;
    bytes private secrets;
    uint64 private subscriptionId;

    mapping(bytes32 => uint256) public pendingRequests;
    mapping(uint256 => uint8) private matchResults;
    mapping(uint256 => bool) public matchResolved;

    event RequestedResult(uint256 matchId, bytes32 requestId);
    event ResultReceived(uint256 matchId, uint8 result);
    event RequestFailed(uint256 matchId, bytes32 requestId, string errorMessage);


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
        donId = _donId;
        source = _source;
        secrets = _secrets;
        subscriptionId = _subscriptionId;
    }

    function requestMatchResult(uint256 matchId) external {
        string[] memory args = new string[](1);
        args[0] = Strings.toString(matchId); 

        bytes32 requestId = _executeRequest(args);

        pendingRequests[requestId] = matchId;

        emit RequestedResult(matchId, requestId);
    }

    function _executeRequest(string[] memory args) internal returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequest(FunctionsRequest.Location.Inline, FunctionsRequest.CodeLanguage.JavaScript, source);
        req.addSecretsReference(secrets);
        
        if (args.length > 0) {
            req.setArgs(args);
        }
        
        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, 250000, donId);
    }

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        uint256 matchId = pendingRequests[requestId];

        delete pendingRequests[requestId];

        if (err.length > 0) {
            string memory errorMessage = string(err);
            emit RequestFailed(matchId, requestId, errorMessage);
            return;
        }

        uint8 result = abi.decode(response, (uint8));

        emit ResultReceived(matchId, result);

        matchResults[matchId] = result;
        matchResolved[matchId] = true;

    }

    function returnResult(uint256 matchId) public view returns (uint8) {
        require(matchResolved[matchId], "Result not yet available");
        uint8 result = matchResults[matchId];
        return result;
    }

}