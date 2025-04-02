// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

contract TestnetAVAXFaucet {
    uint256 public constant MINT_AMOUNT = 0.1 ether;

    event Minted(address indexed recipient, uint256 amount);

    receive() external payable {}
    fallback() external payable {}

    function mint() external {
        require(address(this).balance >= MINT_AMOUNT, "Insufficient funds in faucet");
        payable(msg.sender).transfer(MINT_AMOUNT);
        emit Minted(msg.sender, MINT_AMOUNT);
    }

    function faucetBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
