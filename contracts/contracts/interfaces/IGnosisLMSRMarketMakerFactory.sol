// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGnosisLMSRMarketMakerFactory {

    function createLMSRMarketMaker(
        address pmSystem,
        address collateralToken,
        bytes32[] calldata conditionIds,
        uint64 fee,
        address whitelist,
        uint funding
    ) external returns (address);
}
