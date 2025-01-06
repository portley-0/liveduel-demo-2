// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IWhitelist.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WhitelistWrapper is Ownable {
    IWhitelist private whitelist;

    constructor(address _whitelistAddress) Ownable(msg.sender) {
        require(_whitelistAddress != address(0), "Invalid Whitelist address");
        whitelist = IWhitelist(_whitelistAddress);
    }

    function isUserWhitelisted(address user) external view returns (bool) {
        return whitelist.isWhitelisted(user);
    }

    function addToWhitelist(address[] calldata users) external onlyOwner {
        whitelist.addToWhitelist(users);
    }

    function removeFromWhitelist(address[] calldata users) external onlyOwner {
        whitelist.removeFromWhitelist(users);
    }
}
