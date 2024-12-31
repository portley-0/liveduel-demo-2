// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DuelToken.sol";

contract LiquidityPool is Ownable {
    IERC20 public usdc;
    DuelToken public duelToken;

    uint256 public usdcReserve;
    uint256 public duelReserve;
    uint256 public totalStaked;
    uint256 public stakingRewardsPool;

    mapping(address => uint256) public stakedBalances;
    mapping(address => uint256) public rewardsClaimed;
    mapping(address => bool) public authorizedMarkets; // Tracks authorized PredictionMarket contracts

    event RewardsClaimed(uint256 amount);
    event FeeReceived(uint256 amount); 
    event FundsWithdrawn(address indexed market, uint256 amount);
    event FundsReturned(address indexed market, uint256 amount);
    event DuelPurchased(address indexed account, uint256 amount)


    constructor(address _initialOwner, address _usdcAddress, address _duelTokenAddress) Ownable(_initialOwner) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_duelTokenAddress != address(0), "Invalid DuelToken address");

        usdc = IERC20(_usdcAddress);
        duelToken = DuelToken(_duelTokenAddress);
    }

    // Add initial liquidity with a ratio
    function addInitialLiquidity(uint256 _usdcAmount, uint256 _duelAmount) external onlyOwner {
        require(usdcReserve == 0 && duelReserve == 0, "Initial liquidity already provided");
        require(_usdcAmount > 0 && _duelAmount > 0, "Amounts must be greater than zero");

        // Transfer USDC from the owner to the contract
        usdc.transferFrom(msg.sender, address(this), _usdcAmount);

        // Mint Duel tokens directly to the contract
        duelToken.mint(address(this), _duelAmount);

        usdcReserve += _usdcAmount;
        duelReserve += _duelAmount;
    }

    // Buy DuelToken with USDC
    function buyDuel(uint256 _usdcAmount) external {
        require(_usdcAmount > 0, "USDC amount must be greater than zero");

        // Calculate the DuelToken amount based on the AMM formula
        uint256 duelAmount = getSwapAmount(_usdcAmount, usdcReserve, duelReserve);

        // Transfer USDC from the buyer to the contract
        usdc.transferFrom(msg.sender, address(this), _usdcAmount);

        // Mint Duel tokens directly to the buyer
        duelToken.mint(msg.sender, duelAmount);

        usdcReserve += _usdcAmount;
        duelReserve += duelAmount;

        emit DuelPurchased(msg.sender, duelAmount);
    }

    // Stake DuelToken to earn rewards
    function stake(uint256 _amount) external {
        require(_amount > 0, "Stake amount must be greater than zero");

        // Transfer Duel tokens from the staker to the contract
        duelToken.transferFrom(msg.sender, address(this), _amount);

        // Update the staked balance and total staked amount
        stakedBalances[msg.sender] += _amount;
        totalStaked += _amount;
    }

    // Withdraw staked DuelToken
    function withdrawStake(uint256 _amount) external {
        require(stakedBalances[msg.sender] >= _amount, "Insufficient stake balance");

        // Update the staked balance and total staked amount
        stakedBalances[msg.sender] -= _amount;
        totalStaked -= _amount;

        // Transfer Duel tokens back to the staker
        duelToken.transfer(msg.sender, _amount);
    }

    // Claim staking rewards
    function claimRewards() external {
        require(totalStaked > 0, "No rewards available"); // Ensure total staked is non-zero
        require(stakingRewardsPool >= 1000, "Rewards pool too small to distribute"); // Minimum threshold check

        uint256 stakerBalance = stakedBalances[msg.sender];
        require(stakerBalance > 0, "No staked balance");

        // Calculate the total reward share for the staker
        uint256 rewardShare = (stakerBalance * stakingRewardsPool) / totalStaked;
        uint256 claimedReward = rewardsClaimed[msg.sender];

        // Ensure the user can only claim unclaimed rewards
        require(rewardShare > claimedReward, "No new rewards to claim");
        uint256 claimable = rewardShare - claimedReward;

        // Update rewardsClaimed and reduce stakingRewardsPool
        rewardsClaimed[msg.sender] += claimable;
        stakingRewardsPool -= claimable;

        // Transfer claimable rewards to the user in USDC
        usdc.transfer(msg.sender, claimable);

        emit  RewardsClaimed(claimable);
    }

    // Calculate staking rewards for a specific staker
    function calculateReward(address _staker) public view returns (uint256) {
        if (totalStaked == 0 || stakingRewardsPool == 0) {
            return 0; // No rewards available if total staked or rewards pool is empty
        }

        // Calculate the reward share based on staker's proportion
        uint256 stakerBalance = stakedBalances[_staker];
        uint256 rewardShare = (stakerBalance * stakingRewardsPool) / totalStaked;
        uint256 claimedReward = rewardsClaimed[_staker];

        // Ensure no underflow occurs
        if (claimedReward > rewardShare) {
            return 0;
        }

        return rewardShare - claimedReward;
    }

    // Add fees to the staking rewards pool (called by PredictionMarket)
    function addToRewardsPool(uint256 _amount) external {
        require(_amount > 0, "Fee amount must be greater than zero");

        // Transfer USDC from the caller to the contract
        usdc.transferFrom(msg.sender, address(this), _amount);

        // Increase the staking rewards pool
        stakingRewardsPool += _amount;

        emit FeeReceived(_amount);
    }

    // Authorize a PredictionMarket contract
    function authorizeMarket(address _market) external onlyOwner {
        require(_market != address(0), "Invalid market address");
        authorizedMarkets[_market] = true;
    }

    // Revoke authorization for a PredictionMarket contract
    function revokeMarket(address _market) external {
        require(authorizedMarkets[msg.sender], "Caller is not authorized");
        require(_market != address(0), "Invalid market address");
        authorizedMarkets[_market] = false;
    }

    // Withdraw funds 
    function withdrawLiquidity(uint256 _amount) external {
        require(authorizedMarkets[msg.sender], "Caller is not authorized");

        usdc.transfer(msg.sender, _amount);
        usdcReserve -= _amount;

        emit FundsWithdrawn(msg.sender, _amount);
    }

    // Return unused funds
    function returnLiquidity(uint256 _amount) external {
        require(authorizedMarkets[msg.sender], "Caller is not authorized");

        usdc.transferFrom(msg.sender, address(this), _amount);
        usdcReserve += _amount;

        emit FundsReturned(msg.sender, _amount);
    }

    // Uniswap-style AMM formula
    function getSwapAmount(uint256 _inputAmount, uint256 _inputReserve, uint256 _outputReserve)
        public
        pure
        returns (uint256)
    {
        // Scale the input amount 
        uint256 scaledInputAmount = _inputAmount * 1000; // Multiplied by 1000 for scaling 

        // Calculate the numerator and denominator for the AMM formula
        uint256 numerator = scaledInputAmount * _outputReserve; // Calculates proportional output amount
        uint256 denominator = (_inputReserve * 1000) + scaledInputAmount; // Adjusts for constant product

        return numerator / denominator; // Returns the final swap amount
    }
}
