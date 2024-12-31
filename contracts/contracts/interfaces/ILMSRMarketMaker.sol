// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILMSRMarketMaker {
    function trade(int[] calldata tradeAmounts) external returns (uint);
    function calcNetCost(int[] calldata tradeAmounts) external view returns (uint);
    function calcMarginalPrice(uint8 outcomeIndex) external view returns (uint);
    function calcMarketFee(uint outcomeTokenCost) external view returns (uint);
    function changeFunding(int fundingChange) external;
    function changeFee(uint64 _fee) external;
    function pause() external;
    function resume() external;
    function close() external;
    function withdrawFees(address to) external returns (uint);
}
