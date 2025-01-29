// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILMSRMarketMakerFactoryWrapper {

    function createLMSRMarketMaker(
        bytes32[] calldata conditionIds
    ) external returns (address);
}
