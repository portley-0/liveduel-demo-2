// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

contract DuelTokenFaucet {
    uint256 public constant MINT_AMOUNT = 0.1 ether;

    event Minted(address indexed recipient, uint256 amount);

    receive() external payable {}
    fallback() external payable {}

    function mint(address recipient) external {
        require(address(this).balance >= MINT_AMOUNT, "Insufficient funds in faucet");
        require(recipient != address(0), "Invalid recipient address");
        payable(recipient).transfer(MINT_AMOUNT);
        emit Minted(recipient, MINT_AMOUNT);
    }

    function faucetBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
