// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidityPool {
    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event RewardsClaimed(address indexed staker, uint256 amount);
    event DuelPurchased(address indexed account, uint256 amount);
    event RewardsPoolUpdated(uint256 amount); 
    event FundsWithdrawn(address indexed market, uint256 amount);
    event FundsReturned(address indexed market, uint256 amount);

    // ------------------------------------------------------------------------
    // State variable getters
    // ------------------------------------------------------------------------
    function usdc() external view returns (address);
    function duelToken() external view returns (address);
    function usdcReserve() external view returns (uint256);
    function duelReserve() external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function stakedBalances(address user) external view returns (uint256);
    function authorizedMarkets(address market) external view returns (bool);

    // ------------------------------------------------------------------------
    // Liquidity / Trading
    // ------------------------------------------------------------------------
    function addInitialLiquidity(uint256 _usdcAmount, uint256 _duelAmount) external;
    function buyDuel(uint256 _usdcAmount) external;

    // ------------------------------------------------------------------------
    // Staking / Rewards
    // ------------------------------------------------------------------------
    function stake(uint256 _amount) external;
    function withdrawStake(uint256 _amount) external;
    function claimRewards() external;
    function pendingRewards(address _staker) external view returns (uint256);
    function addToRewardsPool(uint256 _amount) external;

    // ------------------------------------------------------------------------
    // Market Authorization
    // ------------------------------------------------------------------------
    function authorizeMarket(address _market) external;
    function revokeMarket(address _market) external;

    // ------------------------------------------------------------------------
    // Liquidity Movement (for authorized markets)
    // ------------------------------------------------------------------------
    function withdrawLiquidity(uint256 _amount) external;
    function returnLiquidity(uint256 _amount) external;

    // ------------------------------------------------------------------------
    // Utility
    // ------------------------------------------------------------------------
    function getSwapAmount(
        uint256 _inputAmount,
        uint256 _inputReserve,
        uint256 _outputReserve
    ) external pure returns (uint256);

    function getReserves() external view returns (uint256, uint256);
}
