// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarketFactory {
    function addToPlatformProfit(uint256 amount) external;
    function removeActiveTournament(uint256 tournamentId) external;
}