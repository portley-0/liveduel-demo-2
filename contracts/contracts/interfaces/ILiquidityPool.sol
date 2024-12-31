// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidityPool {
    event RewardsClaimed(uint256 amount);
    event FeeReceived(uint256 amount);
    event FundsWithdrawn(address indexed market, uint256 amount);
    event FundsReturned(address indexed market, uint256 amount);
    event DuelPurchased(address indexed account, uint256 amount);

    function usdc() external view returns (address);
    function duelToken() external view returns (address);
    function usdcReserve() external view returns (uint256);
    function duelReserve() external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function stakingRewardsPool() external view returns (uint256);

    function stakedBalances(address user) external view returns (uint256);
    function rewardsClaimed(address user) external view returns (uint256);
    function authorizedMarkets(address market) external view returns (bool);

    function addInitialLiquidity(uint256 _usdcAmount, uint256 _duelAmount) external;
    function buyDuel(uint256 _usdcAmount) external;
    function stake(uint256 _amount) external;
    function withdrawStake(uint256 _amount) external;
    function claimRewards() external;
    function calculateReward(address _staker) external view returns (uint256);
    function addToRewardsPool(uint256 _amount) external;
    function authorizeMarket(address _market) external;
    function revokeMarket(address _market) external;
    function withdrawLiquidity(uint256 _amount) external;
    function returnLiquidity(uint256 _amount) external;
    function getSwapAmount(uint256 _inputAmount, uint256 _inputReserve, uint256 _outputReserve) 
        external pure returns (uint256);
}
