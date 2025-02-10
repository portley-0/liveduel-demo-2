// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IWhitelist
 * @notice Interface for the Whitelist contract, including ownership methods.
 */
interface IWhitelist {
    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event UsersAddedToWhitelist(address[] users);
    event UsersRemovedFromWhitelist(address[] users);

    // ------------------------------------------------------------------------
    // Whitelist Functions
    // ------------------------------------------------------------------------
    /**
     * @dev Returns true if the user is whitelisted.
     */
    function isWhitelisted(address user) external view returns (bool);

    /**
     * @dev Adds the given addresses to the whitelist (only the owner can call).
     */
    function addToWhitelist(address[] calldata users) external;

    /**
     * @dev Removes the given addresses from the whitelist (only the owner can call).
     */
    function removeFromWhitelist(address[] calldata users) external;

    // ------------------------------------------------------------------------
    // Ownable Functions (from OpenZeppelin)
    // ------------------------------------------------------------------------
    /**
     * @dev Returns the address of the current owner.
     */
    function owner() external view returns (address);

    /**
     * @dev Transfers ownership of the contract to a new account (only the owner can call).
     */
    function transferOwnership(address newOwner) external;

    /**
     * @dev Renounces ownership of the contract (only the owner can call).
     */
    function renounceOwnership() external;
}
