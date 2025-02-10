// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IResultsConsumer
 * @notice Comprehensive interface for the ResultsConsumer contract.
 */
interface IResultsConsumer {
    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event RequestedResult(uint256 matchId, bytes32 requestId);
    event ResultReceived(uint256 matchId, uint8 result);
    event RequestFailed(uint256 matchId, bytes32 requestId, string errorMessage);

    // From Chainlink's ConfirmedOwner:
    event OwnershipTransferRequested(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ------------------------------------------------------------------------
    // Public State Variable Getters
    // ------------------------------------------------------------------------

    /**
     * @notice Tracks pending requests by requestId => matchId
     *         Auto-generated getter: pendingRequests(requestId) -> matchId
     */
    function pendingRequests(bytes32 requestId) external view returns (uint256);

    /**
     * @notice Whether a match is resolved: matchId => true/false
     */
    function matchResolved(uint256 matchId) external view returns (bool);

    // ------------------------------------------------------------------------
    // External/Public Functions
    // ------------------------------------------------------------------------

    /**
     * @notice Requests a match result from Chainlink Functions for the given matchId.
     * @param matchId The match ID to request a result for.
     */
    function requestMatchResult(uint256 matchId) external;

    /**
     * @notice Returns the result of a resolved match.
     * @dev Reverts if the match has not been resolved yet.
     * @param matchId The match ID to query.
     * @return result The outcome/result for that match (0,1,2, etc.)
     */
    function returnResult(uint256 matchId) external view returns (uint8);

    // ------------------------------------------------------------------------
    // Owner/ConfirmedOwner Functions
    // ------------------------------------------------------------------------
    /**
     * @notice Returns the current owner of the contract.
     */
    function owner() external view returns (address);

    /**
     * @notice Initiates ownership transfer to a new address.
     *         The new address must call acceptOwnership() to complete the transfer.
     */
    function transferOwnership(address to) external;

    /**
     * @notice Completes the ownership transfer process.
     *         Must be called by the address passed as `to` in transferOwnership().
     */
    function acceptOwnership() external;
}
