// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IConditionalTokens {
    /// @dev Prepares a condition with the specified parameters.
    function prepareCondition(
        address oracle,
        bytes32 questionId,
        uint256 outcomeSlotCount
    ) external;

    /// @dev Reports the payouts for a condition by the oracle.
    function reportPayouts(
        bytes32 questionId,
        uint256[] calldata payouts
    ) external;

    /// @dev Splits positions based on the specified condition and partition.
    function splitPosition(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external;

    /// @dev Merges positions based on the specified condition and partition.
    function mergePositions(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external;

    /// @dev Redeems positions for the specified condition and index sets.
    function redeemPositions(
        IERC20 collateralToken, 
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata indexSets
    ) external;

    /// @dev Gets the balance of an ERC-1155 token for a given account and token ID.
    function balanceOf(address account, uint256 id) external view returns (uint256);

    /// @dev Gets the balances of multiple ERC-1155 tokens for multiple accounts.
    function balanceOfBatch(
        address[] calldata accounts,
        uint256[] calldata ids
    ) external view returns (uint256[] memory);

    /// @dev Transfers an ERC-1155 token from one account to another.
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    /// @dev Transfers multiple ERC-1155 tokens from one account to another.
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;

    /// @dev Approves or revokes approval for an operator to manage all of the caller's ERC-1155 tokens.
    function setApprovalForAll(address operator, bool approved) external;

    /// @dev Checks if an operator is approved to manage all of an account's ERC-1155 tokens.
    function isApprovedForAll(address account, address operator) external view returns (bool);

    /// @dev Constructs a condition ID from an oracle, a question ID, and outcome slot count.
    function getConditionId(
        address oracle,
        bytes32 questionId,
        uint256 outcomeSlotCount
    ) external pure returns (bytes32);

    /// @dev Constructs an outcome collection ID.
    function getCollectionId(
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256 indexSet
    ) external view returns (bytes32);

    /// @dev Constructs a position ID from a collateral token and an outcome collection.
    function getPositionId(
        IERC20 collateralToken,
        bytes32 collectionId
    ) external pure returns (uint);

    /// @dev Gets the outcome slot count for a condition.
    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint);

    /// @dev Gets the numerator used in payout fractions for a specific outcome in a condition.
    function payoutNumerators(bytes32 conditionId) external view returns (uint[] memory);

    /// @dev Gets the denominator used in payout fractions for a condition.
    function payoutDenominator(bytes32 conditionId) external view returns (uint);

    /// @dev Checks if a given interface is supported.
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
