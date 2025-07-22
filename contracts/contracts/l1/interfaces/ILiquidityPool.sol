// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidityPool {
    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event RewardsClaimed(address indexed staker, uint256 amount);
    event DuelPurchased(address indexed buyer, uint256 amount);
    event RewardsPoolUpdated(uint256 amount);
    event FundsWithdrawn(address indexed market, uint256 amount);
    event FundsReturned(address indexed market, uint256 amount);

    // ------------------------------------------------------------------------
    // State variable getters
    // ------------------------------------------------------------------------
    /// @return the USDC token contract
    function usdc() external view returns (address);
    /// @return how much DUEL (native) is available for swaps
    function duelReserve() external view returns (uint256);
    /// @return how much USDC is available for swaps
    function usdcReserve() external view returns (uint256);
    /// @return total DUEL staked by all users
    function totalStaked() external view returns (uint256);
    /// @return how much DUEL a given user has staked
    function stakedBalances(address user) external view returns (uint256);
    /// @return whether a given market is authorized
    function authorizedMarkets(address market) external view returns (bool);

    // ------------------------------------------------------------------------
    // Liquidity / Trading
    // ------------------------------------------------------------------------
    /// @notice Initialize the pool: send USDC and native DUEL
    function addInitialLiquidity(uint256 usdcAmount) external payable;
    /// @notice Swap USDC → native DUEL
    function buyDuel(uint256 usdcAmount) external;

    // ------------------------------------------------------------------------
    // Staking / Rewards
    // ------------------------------------------------------------------------
    /// @notice Stake native DUEL (send via msg.value)
    function stake() external payable;
    /// @notice Withdraw staked DUEL back to sender
    function withdrawStake(uint256 amount) external;
    /// @notice Claim any pending USDC rewards
    function claimRewards() external;
    /// @return pending USDC rewards for a given staker
    function pendingRewards(address staker) external view returns (uint256);
    /// @notice Top up the USDC reward pool
    function addToRewardsPool(uint256 amount) external;

    // ------------------------------------------------------------------------
    // Market Authorization
    // ------------------------------------------------------------------------
    function authorizeMarket(address market) external;
    function revokeMarket(address market) external;

    // ------------------------------------------------------------------------
    // Liquidity Movement (for authorized markets)
    // ------------------------------------------------------------------------
    function withdrawLiquidity(uint256 amount) external;
    function returnLiquidity(uint256 amount) external;

    // ------------------------------------------------------------------------
    // Utility
    // ------------------------------------------------------------------------
    /// @return how many `outReserve` tokens you get for `inAmount` + reserves
    function getSwapAmount(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    ) external pure returns (uint256);

    /// @return (usdcReserve, duelReserve)
    function getReserves() external view returns (uint256, uint256);
}
