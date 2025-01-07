// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IWhitelist
/// @notice Interface for the Whitelist contract
interface IWhitelist {
    function isWhitelisted(address user) external view returns (bool);

    function addToWhitelist(address[] memory users) external;

    function removeFromWhitelist(address[] memory users) external;

    event UsersAddedToWhitelist(address[] users);
    event UsersRemovedFromWhitelist(address[] users);
}
