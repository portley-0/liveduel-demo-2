// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IResultsConsumer {
    function requestMatchResult(uint256 matchId) external;
    function returnResult(uint256 matchId) external view returns (uint8);
}
