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

    uint256 public constant MIN_REWARDS_THRESHOLD = 100; // Minimum rewards threshold for claiming

    mapping(address => uint256) public stakedBalances;
    mapping(address => uint256) public rewardsClaimed;
    mapping(address => bool) public authorizedMarkets;

    event RewardsClaimed(address indexed staker, uint256 amount);
    event DuelPurchased(address indexed buyer, uint256 duelAmount);
    event DebugBuyDuel(
        address indexed buyer,
        uint256 usdcAmount,
        uint256 duelAmount,
        uint256 usdcReserveBefore,
        uint256 duelReserveBefore,
        uint256 usdcReserveAfter,
        uint256 duelReserveAfter
    );
    event DebugClaimRewards(
        address indexed staker,
        uint256 stakerBalance,
        uint256 totalStaked,
        uint256 stakingRewardsPool,
        uint256 rewardShare,
        uint256 claimedReward,
        uint256 claimableReward
    );
    event FeeReceived(uint256 amount);
    event RewardsPoolUpdated(uint256 newAmount);
    event FundsWithdrawn(address indexed market, uint256 amount);
    event FundsReturned(address indexed market, uint256 amount);

    constructor(address _initialOwner, address _usdcAddress, address _duelTokenAddress) Ownable(_initialOwner) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_duelTokenAddress != address(0), "Invalid DuelToken address");

        usdc = IERC20(_usdcAddress);
        duelToken = DuelToken(_duelTokenAddress);
    }

    function addInitialLiquidity(uint256 _usdcAmount, uint256 _duelAmount) external onlyOwner {
        require(usdcReserve == 0 && duelReserve == 0, "Initial liquidity already provided");
        require(_usdcAmount > 0 && _duelAmount > 0, "Amounts must be greater than zero");
        require(_usdcAmount <= usdc.balanceOf(msg.sender), "Insufficient USDC balance");

        usdc.transferFrom(msg.sender, address(this), _usdcAmount);
        duelToken.mint(address(this), _duelAmount);

        usdcReserve += _usdcAmount;
        duelReserve += _duelAmount;
    }

    function buyDuel(uint256 _usdcAmount) external {
        require(_usdcAmount > 0, "USDC amount must be greater than zero");
        require(_usdcAmount <= usdc.balanceOf(msg.sender), "Insufficient USDC balance");
        require(usdcReserve > 0 && duelReserve > 0, "Liquidity pool reserves must be initialized");

        uint256 usdcReserveBefore = usdcReserve;
        uint256 duelReserveBefore = duelReserve;

        uint256 duelAmount = getSwapAmount(_usdcAmount, usdcReserve, duelReserve);

        // Transfer USDC from the buyer to the contract
        usdc.transferFrom(msg.sender, address(this), _usdcAmount);

        // Mint DUEL tokens to the buyer
        duelToken.mint(msg.sender, duelAmount);

        // Update the reserves
        usdcReserve += _usdcAmount;
        duelReserve += duelAmount;

        emit DebugBuyDuel(
            msg.sender,
            _usdcAmount,
            duelAmount,
            usdcReserveBefore,
            duelReserveBefore,
            usdcReserve,
            duelReserve
        );

        emit DuelPurchased(msg.sender, duelAmount);
    }

    function stake(uint256 _amount) external {
        require(_amount > 0, "Stake amount must be greater than zero");

        duelToken.transferFrom(msg.sender, address(this), _amount);
        stakedBalances[msg.sender] += _amount;
        totalStaked += _amount;
    }

    function withdrawStake(uint256 _amount) external {
        require(stakedBalances[msg.sender] >= _amount, "Insufficient stake balance");

        stakedBalances[msg.sender] -= _amount;
        totalStaked -= _amount;

        duelToken.transfer(msg.sender, _amount);
    }

    function claimRewards() external {
        require(totalStaked > 0, "No rewards available");
        require(stakingRewardsPool >= MIN_REWARDS_THRESHOLD, "Rewards pool too small to distribute");

        uint256 stakerBalance = stakedBalances[msg.sender];
        require(stakerBalance > 0, "No staked balance");

        uint256 rewardShare = (stakerBalance * stakingRewardsPool) / totalStaked;
        uint256 claimedReward = rewardsClaimed[msg.sender];
        require(rewardShare > claimedReward, "No new rewards to claim");

        uint256 claimable = rewardShare - claimedReward;

        rewardsClaimed[msg.sender] += claimable;
        stakingRewardsPool -= claimable;

        // Transfer USDC to the staker
        usdc.transfer(msg.sender, claimable);

        emit DebugClaimRewards(
            msg.sender,
            stakerBalance,
            totalStaked,
            stakingRewardsPool,
            rewardShare,
            claimedReward,
            claimable
        );

        emit RewardsClaimed(msg.sender, claimable);
    }

    function calculateReward(address _staker) public view returns (uint256) {
        if (totalStaked == 0 || stakingRewardsPool == 0) return 0;

        uint256 stakerBalance = stakedBalances[_staker];
        uint256 rewardShare = (stakerBalance * stakingRewardsPool) / totalStaked;
        uint256 claimedReward = rewardsClaimed[_staker];

        return (rewardShare > claimedReward) ? rewardShare - claimedReward : 0;
    }

    function addToRewardsPool(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than zero");

        usdc.transferFrom(msg.sender, address(this), _amount);
        stakingRewardsPool += _amount;

        emit FeeReceived(_amount);
        emit RewardsPoolUpdated(stakingRewardsPool);
    }

    function authorizeMarket(address _market) external onlyOwner {
        require(_market != address(0), "Invalid market address");
        authorizedMarkets[_market] = true;
    }

    function revokeMarket(address _market) external {
        require(authorizedMarkets[msg.sender], "Caller is not authorized");
        require(_market != address(0), "Invalid market address");
        authorizedMarkets[_market] = false;
    }

    function withdrawLiquidity(uint256 _amount) external {
        require(authorizedMarkets[msg.sender], "Caller is not authorized");
        require(usdcReserve >= _amount, "Insufficient reserve for withdrawal");

        usdc.transfer(msg.sender, _amount);
        usdcReserve -= _amount;

        emit FundsWithdrawn(msg.sender, _amount);
    }

    function returnLiquidity(uint256 _amount) external {
        require(authorizedMarkets[msg.sender], "Caller is not authorized");

        usdc.transferFrom(msg.sender, address(this), _amount);
        usdcReserve += _amount;

        emit FundsReturned(msg.sender, _amount);
    }

    function getSwapAmount(uint256 _inputAmount, uint256 _inputReserve, uint256 _outputReserve)
        public
        pure
        returns (uint256)
    {
        require(_inputReserve > 0 && _outputReserve > 0, "Reserves must be greater than zero");

        uint256 scaledInputAmount = _inputAmount * 1e18;
        uint256 numerator = scaledInputAmount * _outputReserve;
        uint256 denominator = (_inputReserve * 1e18) + scaledInputAmount;

        return numerator / denominator;
    }

    function getReserves() external view returns (uint256, uint256) {
        return (usdcReserve, duelReserve);
    }
}
