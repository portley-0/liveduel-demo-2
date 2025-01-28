// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IConditionalTokens.sol";
import "../interfaces/IWhitelist.sol";

interface ILMSRMarketMakerFactory {

    function createLMSRMarketMaker(
        IConditionalTokens pmSystem,
        IERC20 collateralToken,
        bytes32[] calldata conditionIds,
        uint64 fee,
        IWhitelist whitelist,
        uint funding
    ) external returns (address);
}
