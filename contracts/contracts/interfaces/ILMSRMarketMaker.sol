// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILMSRMarketMaker {
    function trade(int[] memory tradeAmounts, int collateralLimit) external returns (int);
    function calcNetCost(int[] memory tradeAmounts) external view returns (int);
    function calcMarginalPrice(uint8 outcomeIndex) external view returns (uint);
    function calcMarketFee(uint outcomeTokenCost) external view returns (uint);
    function changeFunding(int fundingChange) external;
    function changeFee(uint64 _fee) external;
    function pause() external;
    function resume() external;
    function close() external;
    function withdrawFees(address to) external returns (uint);
    function transferOwnership(address newOwner) external;
}
