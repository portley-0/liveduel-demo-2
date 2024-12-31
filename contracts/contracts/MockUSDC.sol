// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    // Public mint function
    function mint(uint256 amount) external {
        require(amount > 0, "Mint amount must be greater than zero");
        _mint(msg.sender, amount);
    }
}
