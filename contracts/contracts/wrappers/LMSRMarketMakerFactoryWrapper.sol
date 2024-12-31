// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ILMSRMarketMakerFactory.sol";

contract LMSRMarketMakerFactoryWrapper {
    ILMSRMarketMakerFactory private lmsrFactory;

    constructor(address _lmsrFactory) {
        require(_lmsrFactory != address(0), "Invalid LMSRMarketMakerFactory address");
        lmsrFactory = ILMSRMarketMakerFactory(_lmsrFactory);
    }

    function createLMSRMarketMaker(
        address conditionalTokens,
        address collateralToken,
        bytes32[] calldata conditionIds,
        uint fee,
        address whitelist,
        uint initialFunding
    ) external returns (address) {
        return lmsrFactory.createLMSRMarketMaker(
            conditionalTokens,
            collateralToken,
            conditionIds,
            fee,
            whitelist,
            initialFunding
        );
    }
}
