// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockResultsConsumer {
    mapping(bytes32 => uint256) public pendingRequests;
    mapping(uint256 => uint8) private matchResults;

    event RequestedResult(uint256 matchId, bytes32 requestId);
    event ResultReceived(uint256 matchId, uint8 result);

    function requestMatchResult(uint256 matchId) external returns (bytes32) {
        // Simulate the behavior of _sendRequest by creating a unique requestId
        bytes32 requestId = keccak256(abi.encodePacked(matchId, block.timestamp, block.difficulty));
        pendingRequests[requestId] = matchId;
        emit RequestedResult(matchId, requestId);
        return requestId;
    }

    function fulfillRequest(bytes32 requestId, uint8 result) external {
        uint256 matchId = pendingRequests[requestId];
        delete pendingRequests[requestId];
        matchResults[matchId] = result;
        emit ResultReceived(matchId, result);
    }

    function returnResult(uint256 matchId) public view returns (uint8) {
        return matchResults[matchId];
    }

    function setResult(uint256 matchId, uint8 result) external {
        matchResults[matchId] = result;
    }
}