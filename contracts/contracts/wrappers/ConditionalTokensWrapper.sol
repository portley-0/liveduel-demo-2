// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IConditionalTokens.sol";

contract ConditionalTokensWrapper {
    IConditionalTokens private conditionalTokens;

    constructor(address _conditionalTokens) {
        require(_conditionalTokens != address(0), "Invalid ConditionalTokens address");
        conditionalTokens = IConditionalTokens(_conditionalTokens);
    }

    // Wrapper for prepareCondition
    function prepareCondition(
        address oracle,
        bytes32 questionId,
        uint256 outcomeSlotCount
    ) external {
        conditionalTokens.prepareCondition(oracle, questionId, outcomeSlotCount);
    }

    // Wrapper for getConditionId
    function getConditionId(
        address oracle,
        bytes32 questionId,
        uint256 outcomeSlotCount
    ) external view returns (bytes32) {
        return conditionalTokens.getConditionId(oracle, questionId, outcomeSlotCount);
    }

    // Wrapper for reportPayouts
    function reportPayouts(
        bytes32 questionId,
        uint256[] memory payouts
    ) external {
        conditionalTokens.reportPayouts(questionId, payouts);
    }

    // Wrapper for redeemPositions
    function redeemPositions(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] memory indexSets
    ) external {
        conditionalTokens.redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets);
    }

    // Wrapper for splitPosition
    function splitPosition(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] memory partition,
        uint256 amount
    ) external {
        conditionalTokens.splitPosition(collateralToken, parentCollectionId, conditionId, partition, amount);
    }

    // Wrapper for mergePositions
    function mergePositions(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] memory partition,
        uint256 amount
    ) external {
        conditionalTokens.mergePositions(collateralToken, parentCollectionId, conditionId, partition, amount);
    }

    // Wrapper for getOutcomeSlotCount
    function getOutcomeSlotCount(
        bytes32 conditionId
    ) external view returns (uint256) {
        return conditionalTokens.getOutcomeSlotCount(conditionId);
    }

    // Wrapper for getCollectionId
    function getCollectionId(
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256 indexSet
    ) external view returns (bytes32) {
        return conditionalTokens.getCollectionId(parentCollectionId, conditionId, indexSet);
    }

    // Wrapper for getPositionId
    function getPositionId(
        IERC20 collateralToken,
        bytes32 collectionId
    ) external view returns (uint256) {
        return conditionalTokens.getPositionId(collateralToken, collectionId);
    }

    // ERC-1155 helper: balanceOf
    function balanceOf(
        address account,
        uint256 id
    ) external view returns (uint256) {
        return conditionalTokens.balanceOf(account, id);
    }

    // ERC-1155 helper: balanceOfBatch
    function balanceOfBatch(
        address[] memory accounts,
        uint256[] memory ids
    ) external view returns (uint256[] memory) {
        return conditionalTokens.balanceOfBatch(accounts, ids);
    }

    // ERC-1155 helper: safeTransferFrom
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external {
        conditionalTokens.safeTransferFrom(from, to, id, amount, data);
    }

    // ERC-1155 helper: safeBatchTransferFrom
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external {
        conditionalTokens.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    // ERC-1155 helper: setApprovalForAll
    function setApprovalForAll(address operator, bool approved) external {
        conditionalTokens.setApprovalForAll(operator, approved);
    }

    // ERC-1155 helper: isApprovedForAll
    function isApprovedForAll(
        address account,
        address operator
    ) external view returns (bool) {
        return conditionalTokens.isApprovedForAll(account, operator);
    }

    // Wrapper for payoutDenominator
    function payoutDenominator(bytes32 conditionId) external view returns (uint) {
        return conditionalTokens.payoutDenominator(conditionId);
    }

    // Wrapper for payoutNumerators
    function payoutNumerators(bytes32 conditionId) external view returns (uint[] memory) {
        return conditionalTokens.payoutNumerators(conditionId);
    }

    // Wrapper for supportsInterface
    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        return conditionalTokens.supportsInterface(interfaceId);
    }
}
