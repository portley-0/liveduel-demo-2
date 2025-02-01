// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DuelToken.sol";

contract LiquidityPool is Ownable {
    IERC20 public usdc;
    DuelToken public duelToken;

    uint256 public usdcReserve;  // For your buyDuel logic
    uint256 public duelReserve;  // For your buyDuel logic
    uint256 public totalStaked;  // Total DUEL tokens staked

    // ----------------------------
    // Reward-per-share accounting:
    // ----------------------------
    uint256 public accRewardPerShare;  // Scaled by 1e12 for precision
    // For each staker, how much they've "accounted for" so far
    mapping (address => uint256) public rewardDebt;

    // stakedBalances is used to track how many DUEL tokens each user has staked
    mapping(address => uint256) public stakedBalances;

    // For your old approach, we had "rewardsClaimed"; not needed in MasterChef style.
    // If you still want to track total claimed historically, you can keep it, but it's not required to calculate "pending" now.
    // mapping(address => uint256) public rewardsClaimed;

    // For demonstration, we still keep your "authorizedMarkets" logic, etc.
    mapping(address => bool) public authorizedMarkets;

    // Constants & events
    uint256 public constant MIN_REWARDS_THRESHOLD = 100 ether;

    event RewardsClaimed(address indexed staker, uint256 amount);
    event DuelPurchased(address indexed buyer, uint256 amount);
    event FeeReceived(uint256 amount);
    event RewardsPoolUpdated(uint256 newPool);
    event FundsWithdrawn(address indexed market, uint256 amount);
    event FundsReturned(address indexed market, uint256 amount);

    constructor(
        address _initialOwner,
        address _usdcAddress,
        address _duelTokenAddress
    ) Ownable(_initialOwner)
    {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_duelTokenAddress != address(0), "Invalid DuelToken address");

        usdc = IERC20(_usdcAddress);
        duelToken = DuelToken(_duelTokenAddress);
    }

    // ----------------------------------
    // BuyDuel + Liquidity logic (unchanged)
    // ----------------------------------
    function addInitialLiquidity(uint256 _usdcAmount, uint256 _duelAmount)
        external
        onlyOwner
    {
        require(usdcReserve == 0 && duelReserve == 0, "Already provided");
        require(_usdcAmount > 0 && _duelAmount > 0, "Zero amounts");
        require(_usdcAmount <= usdc.balanceOf(msg.sender), "Insufficient USDC");

        usdc.transferFrom(msg.sender, address(this), _usdcAmount);
        duelToken.mint(address(this), _duelAmount);

        usdcReserve += _usdcAmount;
        duelReserve += _duelAmount;
    }

    function buyDuel(uint256 _usdcAmount) external {
        require(_usdcAmount > 0, "Zero USDC");
        require(_usdcAmount <= usdc.balanceOf(msg.sender), "Insufficient USDC");
        require(usdcReserve > 0 && duelReserve > 0, "Not initialized");

        uint256 duelAmount = getSwapAmount(_usdcAmount, usdcReserve, duelReserve);

        usdc.transferFrom(msg.sender, address(this), _usdcAmount);

        usdcReserve += _usdcAmount;
        duelReserve += duelAmount;

        duelToken.mint(msg.sender, duelAmount);

        emit DuelPurchased(msg.sender, duelAmount);
    }

    // -------------------------------------
    // Staking logic using reward-per-share
    // -------------------------------------

    /**
     * @dev Updates the global 'accRewardPerShare' by distributing any newly added USDC
     * to current stakers. This example *requires* you call 'addToRewardsPool' which calls
     * 'updatePool' with the newly added reward.
     */
    function updatePool(uint256 _rewardAmount) internal {
        // If nobody is staked, do nothing
        if (totalStaked == 0) {
            return;
        }
        // Increase accRewardPerShare by (reward * 1e12 / totalStaked)
        // scale by 1e12 to avoid integer rounding
        accRewardPerShare += (_rewardAmount * 1e12) / totalStaked;
    }

    /**
     * @dev View function to see pending rewards for a staker.
     */
    function pendingRewards(address _staker) public view returns (uint256) {
        uint256 userStaked = stakedBalances[_staker];
        // userRewardDebt = rewardDebt[_staker]

        // The total reward the user is *entitled to* in scaled form is:
        //   userStaked * accRewardPerShare / 1e12
        uint256 accumulated = (userStaked * accRewardPerShare) / 1e12;

        // The difference between that and 'rewardDebt' is the pending reward
        // that is not yet paid out
        return accumulated - rewardDebt[_staker];
    }

    /**
     * @dev Stake DUEL tokens. We first "harvest" any pending reward, then update staked balance.
     */
    function stake(uint256 _amount) external {
        require(_amount > 0, "Zero stake");

        // 1. Harvest any pending reward
        _claimInternal(msg.sender);

        // 2. Transfer DUEL to this contract
        duelToken.transferFrom(msg.sender, address(this), _amount);

        // 3. Update staked balance + totalStaked
        stakedBalances[msg.sender] += _amount;
        totalStaked += _amount;

        // 4. Update the user's rewardDebt
        rewardDebt[msg.sender] = (stakedBalances[msg.sender] * accRewardPerShare) / 1e12;
    }

    /**
     * @dev Withdraw (unstake) DUEL. Again, harvest first, then reduce stake.
     */
    function withdrawStake(uint256 _amount) external {
        require(stakedBalances[msg.sender] >= _amount, "Insufficient stake");

        // 1. Harvest any pending reward
        _claimInternal(msg.sender);

        // 2. Subtract staked balance + totalStaked
        stakedBalances[msg.sender] -= _amount;
        totalStaked -= _amount;

        // 3. Transfer DUEL back to the user
        duelToken.transfer(msg.sender, _amount);

        // 4. Update rewardDebt
        rewardDebt[msg.sender] = (stakedBalances[msg.sender] * accRewardPerShare) / 1e12;
    }

    /**
     * @dev Claim any pending rewards without changing stake amount.
     */
    function claimRewards() external {
        // 1. Harvest
        _claimInternal(msg.sender);

        // 2. Update user rewardDebt
        rewardDebt[msg.sender] = (stakedBalances[msg.sender] * accRewardPerShare) / 1e12;
    }

    /**
     * @dev Internal function to pay out pending rewards to a user.
     */
    function _claimInternal(address _staker) internal {
        // Calculate pending
        uint256 pending = pendingRewards(_staker);
        if (pending > 0) {
            // Transfer USDC out
            // Make sure this contract has enough USDC in its balance to pay out
            // (We've distributed it via updatePool, so the contract should hold it)
            usdc.transfer(_staker, pending);

            emit RewardsClaimed(_staker, pending);
        }
    }

    // -----------------------------------
    // The new "addToRewardsPool" function
    // -----------------------------------
    /**
     * @dev When we add new rewards, we distribute them across 'accRewardPerShare' so that
     * current stakers can claim them. Then the new reward is effectively "locked" for stakers.
     */
    function addToRewardsPool(uint256 _amount) external {
        require(_amount > 0, "Zero amount");
        require(totalStaked > 0, "No stakers currently"); 
        // Because if totalStaked == 0, the user would deposit free money that nobody can claim.
        // You could allow it, but typically you'd want at least 1 staker.

        // Transfer USDC into this contract
        usdc.transferFrom(msg.sender, address(this), _amount);

        // 1. Distribute the newly added reward among stakers
        updatePool(_amount);

        // Optional: If you want a "minimum threshold" for new additions,
        // you can do require(_amount >= MIN_REWARDS_THRESHOLD, "Add more!");
        // But that's separate from checking the "pool is big enough to claim"

        emit FeeReceived(_amount);

        // This is purely for reference if you want, or remove "RewardsPoolUpdated":
        emit RewardsPoolUpdated(_amount);
    }

    // -----------------------------
    // Market Authorization & Liquidity
    // -----------------------------
    function authorizeMarket(address _market) external onlyOwner {
        require(_market != address(0), "Invalid market");
        authorizedMarkets[_market] = true;
    }

    function revokeMarket(address _market) external {
        require(authorizedMarkets[msg.sender], "Not authorized");
        require(_market != address(0), "Invalid market");
        authorizedMarkets[_market] = false;
    }

    function withdrawLiquidity(uint256 _amount) external {
        require(authorizedMarkets[msg.sender], "Not authorized");
        require(usdcReserve >= _amount, "Insufficient reserve");

        usdc.transfer(msg.sender, _amount);
        usdcReserve -= _amount;

        emit FundsWithdrawn(msg.sender, _amount);
    }

    function returnLiquidity(uint256 _amount) external {
        require(authorizedMarkets[msg.sender], "Not authorized");

        usdc.transferFrom(msg.sender, address(this), _amount);
        usdcReserve += _amount;

        emit FundsReturned(msg.sender, _amount);
    }

    // -----------------------------
    // Simple swap formula (unchanged)
    // -----------------------------
    function getSwapAmount(
        uint256 _inputAmount,
        uint256 _inputReserve,
        uint256 _outputReserve
    ) public pure returns (uint256) {
        require(_inputReserve > 0 && _outputReserve > 0, "Zero reserves");

        uint256 numerator = _inputAmount * _outputReserve;
        uint256 denominator = _inputReserve + _inputAmount;
        return numerator / denominator;
    }

    function getReserves() external view returns (uint256, uint256) {
        return (usdcReserve, duelReserve);
    }
}
