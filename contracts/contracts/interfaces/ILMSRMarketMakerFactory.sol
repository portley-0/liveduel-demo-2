// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILMSRMarketMakerFactory {
    function createLMSRMarketMaker(
        address conditionalTokens,
        address collateralToken,
        bytes32[] calldata conditionIds,
        uint fee,
        address whitelist,
        uint initialFunding
    ) external returns (address);
}
 