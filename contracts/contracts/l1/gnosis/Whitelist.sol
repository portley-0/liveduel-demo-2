// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Whitelist
 * @notice Contract to add/remove addresses from a whitelist
 * @author 
 */
contract Whitelist is Ownable {
    constructor() Ownable(msg.sender) {
    }

    event UsersAddedToWhitelist(address[] users);
    event UsersRemovedFromWhitelist(address[] users);

    mapping(address => bool) public isWhitelisted;

    /**
     * @dev Adds given addresses to the whitelist
     * @param users The addresses to add
     */
    function addToWhitelist(address[] calldata users) external onlyOwner {
        for (uint i = 0; i < users.length; i++) {
            isWhitelisted[users[i]] = true;
        }
        emit UsersAddedToWhitelist(users);
    }

    /**
     * @dev Removes given addresses from the whitelist
     * @param users The addresses to remove
     */
    function removeFromWhitelist(address[] calldata users) external onlyOwner {
        for (uint i = 0; i < users.length; i++) {
            isWhitelisted[users[i]] = false;
        }
        emit UsersRemovedFromWhitelist(users);
    }
}
