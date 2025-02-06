// SPDX-License-Identifier: MIT
pragma solidity ^0.5.1;

interface IConditionalTokens {
    function setApprovalForAll(address operator, bool approved) external returns (bool);
}

contract ConditionalTokensApprovalAdapter {
    // This function is designed to be used with delegatecall so that msg.sender remains the caller (PredictionMarket).
    function setApprovalForMarketMaker(address conditionalTokens, address marketMaker) public returns (bool) {
        return IConditionalTokens(conditionalTokens).setApprovalForAll(marketMaker, true);
    }
}
