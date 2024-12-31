// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IWhitelist.sol";

contract WhitelistWrapper {
    IWhitelist private whitelist;

    constructor(address _whitelistAddress) {
        require(_whitelistAddress != address(0), "Invalid Whitelist address");
        whitelist = IWhitelist(_whitelistAddress);
    }

    function isUserWhitelisted(address user) external view returns (bool) {
        return whitelist.isWhitelisted(user);
    }

    function addToWhitelist(address[] calldata users) external {
        whitelist.addToWhitelist(users);
    }

    function removeFromWhitelist(address[] calldata users) external {
        whitelist.removeFromWhitelist(users);
    }
}
