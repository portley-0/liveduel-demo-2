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

    uint256 public accRewardPerShare; 
    mapping (address => uint256) public rewardDebt;
    mapping(address => uint256) public stakedBalances;
    mapping(address => bool) public authorizedMarkets;

    event RewardsClaimed(address indexed staker, uint256 amount);
    event DuelPurchased(address indexed buyer, uint256 amount);
    event RewardsPoolUpdated(uint256 amount);
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

    function updatePool(uint256 _rewardAmount) internal {
        if (totalStaked == 0) {
            return;
        }
        accRewardPerShare += (_rewardAmount * 1e12) / totalStaked;
    }

    function pendingRewards(address _staker) public view returns (uint256) {
        uint256 userStaked = stakedBalances[_staker];
        uint256 accumulated = (userStaked * accRewardPerShare) / 1e12;
        if (accumulated < rewardDebt[_staker]) {
            return 0;
        }
        return accumulated - rewardDebt[_staker];
    }

    function stake(uint256 _amount) external {
        require(_amount > 0, "Zero stake");
        _claimInternal(msg.sender);
        duelToken.transferFrom(msg.sender, address(this), _amount);
        stakedBalances[msg.sender] += _amount;
        totalStaked += _amount;
        rewardDebt[msg.sender] = (stakedBalances[msg.sender] * accRewardPerShare) / 1e12;
    }

    function withdrawStake(uint256 _amount) external {
        require(stakedBalances[msg.sender] >= _amount, "Insufficient stake");
        _claimInternal(msg.sender);
        stakedBalances[msg.sender] -= _amount;
        totalStaked -= _amount;
        duelToken.transfer(msg.sender, _amount);
        rewardDebt[msg.sender] = (stakedBalances[msg.sender] * accRewardPerShare) / 1e12;
    }

    function claimRewards() external {
        _claimInternal(msg.sender);
        rewardDebt[msg.sender] = (stakedBalances[msg.sender] * accRewardPerShare) / 1e12;
    }

    function _claimInternal(address _staker) internal {
        uint256 pending = pendingRewards(_staker);
        if (pending > 0) {
            require(usdc.balanceOf(address(this)) >= pending, "Insufficient USDC in pool");
            usdc.transfer(_staker, pending);
            emit RewardsClaimed(_staker, pending);
        }
    }

    function addToRewardsPool(uint256 _amount) external {
        require(_amount > 0, "Zero amount");
        usdc.transferFrom(msg.sender, address(this), _amount);
        updatePool(_amount);
        emit RewardsPoolUpdated(_amount);
    }

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
