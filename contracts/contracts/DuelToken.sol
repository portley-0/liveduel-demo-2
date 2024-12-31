// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DuelToken is ERC20, Ownable {
    // Constructor to initialize the token with name and symbol
    constructor(address initialOwner) ERC20("LiveDuel Token", "$DUEL") Ownable(initialOwner) {}

    // Function to allow the owner (LiquidityPool) to mint new tokens
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
