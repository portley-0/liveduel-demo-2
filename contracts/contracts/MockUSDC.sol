// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MockUSDC is ERC20, ERC20Permit {
    constructor() ERC20("Mock USDC", "mUSDC") ERC20Permit("Mock USDC") {}

    uint256 public constant MINT_AMOUNT = 2000 *10**6;

    function decimals() public pure override returns (uint8) {
        return 6; 
    }

    function mint(uint256 amount) external {
        require(amount > 0, "Mint amount must be greater than zero");
        _mint(msg.sender, amount);
    }

    function mint(address recipient) external {
        _mint(recipient, MINT_AMOUNT);
    }
}
