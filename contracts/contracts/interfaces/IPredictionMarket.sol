// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPredictionMarket {
    event SharesPurchased(address indexed buyer, uint8 indexed outcome, uint256 shares, uint256 fee);
    event MarketResolved(uint8 indexed outcome);
    event PayoutRedeemed(address indexed redeemer, uint8 indexed outcome, uint256 amount);

    function matchId() external view returns (uint256);
    function liquidityPool() external view returns (address);
    function conditionId() external view returns (bytes32);
    function questionId() external view returns (bytes32);
    function usdc() external view returns (address);
    function conditionalTokens() external view returns (address);
    function marketMaker() external view returns (address);

    function isResolved() external view returns (bool);
    function resolvedOutcome() external view returns (uint8);

    function buyShares(uint8 outcome, uint256 amount) external;
    function resolveMarket(uint8 result) external;
    function redeemPayouts() external;
}
