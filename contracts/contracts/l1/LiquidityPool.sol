// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice A minimal USDC liquidity pool for prediction markets
contract LiquidityPool is Ownable {
    IERC20 public immutable usdc;

    uint256 public usdcReserve;

    mapping(address => bool) public authorizedMarkets;

    event FundsWithdrawn(address indexed market, uint256 amount);
    event FundsReturned(address indexed market, uint256 amount);
    event MarketAuthorized(address indexed market);
    event MarketRevoked(address indexed market);
    event LiquidityAdded(uint256 amount);

    constructor(address _initialOwner, address _usdcAddress) Ownable(_initialOwner) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(_usdcAddress);
    }

    /// @notice Add USDC to the pool
    function addLiquidity(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        usdc.transferFrom(msg.sender, address(this), amount);
        usdcReserve += amount;
        emit LiquidityAdded(amount);
    }

    /// @notice Authorize a market to pull USDC
    function authorizeMarket(address market) external onlyOwner {
        require(market != address(0), "Invalid address");
        authorizedMarkets[market] = true;
        emit MarketAuthorized(market);
    }

    /// @notice Revoke an authorized market
    function revokeMarket(address market) external onlyOwner {
        authorizedMarkets[market] = false;
        emit MarketRevoked(market);
    }

    /// @notice Markets withdraw USDC to fund payouts
    function withdrawLiquidity(uint256 amount) external {
        require(authorizedMarkets[msg.sender], "Not authorized");
        require(usdcReserve >= amount, "Insufficient reserve");
        usdc.transfer(msg.sender, amount);
        usdcReserve -= amount;
        emit FundsWithdrawn(msg.sender, amount);
    }

    /// @notice Markets return USDC to the reserve
    function returnLiquidity(uint256 amount) external {
        require(authorizedMarkets[msg.sender], "Not authorized");
        usdc.transferFrom(msg.sender, address(this), amount);
        usdcReserve += amount;
        emit FundsReturned(msg.sender, amount);
    }

    /// @notice View current USDC reserve
    function getReserve() external view returns (uint256) {
        return usdcReserve;
    }
}
