// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DuelToken.sol";

contract LiquidityPool is Ownable {
    IERC20 public usdc;           // 6-decimal USDC externally
    DuelToken public duelToken;   // 18-decimal DUEL

    // Stored in 18-decimal units
    uint256 public usdcReserve;
    uint256 public duelReserve;
    uint256 public totalStaked;
    uint256 public stakingRewardsPool;

    uint256 public constant MIN_REWARDS_THRESHOLD = 100; 

    mapping(address => uint256) public stakedBalances;  
    mapping(address => uint256) public rewardsClaimed;  
    mapping(address => bool) public authorizedMarkets;

    event RewardsClaimed(address indexed staker, uint256 amountUSDC6);
    event DuelPurchased(address indexed buyer, uint256 duelAmount18);
    event DebugBuyDuel(
        address indexed buyer,
        uint256 usdcAmount6,
        uint256 duelAmount18,
        uint256 usdcReserveBefore18,
        uint256 duelReserveBefore18,
        uint256 usdcReserveAfter18,
        uint256 duelReserveAfter18
    );
    event DebugClaimRewards(
        address indexed staker,
        uint256 stakerBalance18,
        uint256 totalStaked18,
        uint256 stakingRewardsPool18,
        uint256 rewardShare18,
        uint256 claimedReward18,
        uint256 claimableReward18
    );
    event FeeReceived(uint256 amountUSDC6);
    event RewardsPoolUpdated(uint256 newPool18);
    event FundsWithdrawn(address indexed market, uint256 amount18);
    event FundsReturned(address indexed market, uint256 amount6);

    constructor(address _initialOwner, address _usdcAddress, address _duelTokenAddress) Ownable(_initialOwner) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_duelTokenAddress != address(0), "Invalid DuelToken address");

        usdc = IERC20(_usdcAddress);       
        duelToken = DuelToken(_duelTokenAddress);
    }

    function _from6to18(uint256 amount6) internal pure returns (uint256) {
        return amount6 * 1e12;
    }

    function _from18to6(uint256 amount18) internal pure returns (uint256) {
        return amount18 / 1e12;
    }

    function addInitialLiquidity(uint256 _usdcAmount6, uint256 _duelAmount18) external onlyOwner {
        require(usdcReserve == 0 && duelReserve == 0, "Already provided");
        require(_usdcAmount6 > 0 && _duelAmount18 > 0, "Zero amounts");
        require(_usdcAmount6 <= usdc.balanceOf(msg.sender), "Insufficient USDC");

        usdc.transferFrom(msg.sender, address(this), _usdcAmount6);
        uint256 usdcAmount18 = _from6to18(_usdcAmount6);

        duelToken.mint(address(this), _duelAmount18);

        usdcReserve += usdcAmount18;
        duelReserve += _duelAmount18;
    }

    function buyDuel(uint256 _usdcAmount6) external {
        require(_usdcAmount6 > 0, "Zero USDC");
        require(_usdcAmount6 <= usdc.balanceOf(msg.sender), "Insufficient USDC");
        require(usdcReserve > 0 && duelReserve > 0, "Not initialized");

        uint256 usdcReserveBefore = usdcReserve;
        uint256 duelReserveBefore = duelReserve;

        uint256 usdcAmount18 = _from6to18(_usdcAmount6);
        uint256 duelAmount18 = getSwapAmount(usdcAmount18, usdcReserve, duelReserve);

        usdc.transferFrom(msg.sender, address(this), _usdcAmount6);

        usdcReserve += usdcAmount18;
        duelReserve += duelAmount18;

        duelToken.mint(msg.sender, duelAmount18);

        emit DebugBuyDuel(
            msg.sender,
            _usdcAmount6,
            duelAmount18,
            usdcReserveBefore,
            duelReserveBefore,
            usdcReserve,
            duelReserve
        );

        emit DuelPurchased(msg.sender, duelAmount18);
    }

    function stake(uint256 _amount18) external {
        require(_amount18 > 0, "Zero stake");

        duelToken.transferFrom(msg.sender, address(this), _amount18);
        stakedBalances[msg.sender] += _amount18;
        totalStaked += _amount18;
    }

    function withdrawStake(uint256 _amount18) external {
        require(stakedBalances[msg.sender] >= _amount18, "Insufficient stake");

        stakedBalances[msg.sender] -= _amount18;
        totalStaked -= _amount18;

        duelToken.transfer(msg.sender, _amount18);
    }

    function claimRewards() external {
        require(totalStaked > 0, "No rewards");
        require(stakingRewardsPool >= (MIN_REWARDS_THRESHOLD * 1e12), "Pool too small");

        uint256 stakerBalance18 = stakedBalances[msg.sender];
        require(stakerBalance18 > 0, "No staked");

        uint256 rewardShare18 = (stakerBalance18 * stakingRewardsPool) / totalStaked;
        uint256 claimedReward18 = rewardsClaimed[msg.sender];
        require(rewardShare18 > claimedReward18, "No new rewards");

        uint256 claimable18 = rewardShare18 - claimedReward18;
        rewardsClaimed[msg.sender] += claimable18;
        stakingRewardsPool -= claimable18;

        uint256 claimable6 = _from18to6(claimable18);
        usdc.transfer(msg.sender, claimable6);

        emit DebugClaimRewards(
            msg.sender,
            stakerBalance18,
            totalStaked,
            stakingRewardsPool,
            rewardShare18,
            claimedReward18,
            claimable18
        );

        emit RewardsClaimed(msg.sender, claimable6);
    }

    function calculateReward(address _staker) public view returns (uint256) {
        if (totalStaked == 0 || stakingRewardsPool == 0) return 0;

        uint256 stakerBalance18 = stakedBalances[_staker];
        uint256 rewardShare18 = (stakerBalance18 * stakingRewardsPool) / totalStaked;
        uint256 claimedReward18 = rewardsClaimed[_staker];
        if (rewardShare18 > claimedReward18) {
            return rewardShare18 - claimedReward18;
        }
        return 0;
    }

    function addToRewardsPool(uint256 _amount6) external {
        require(_amount6 > 0, "Zero amount");
        usdc.transferFrom(msg.sender, address(this), _amount6);

        uint256 amount18 = _from6to18(_amount6);
        stakingRewardsPool += amount18;

        emit FeeReceived(_amount6);
        emit RewardsPoolUpdated(stakingRewardsPool);
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

    function withdrawLiquidity(uint256 _amount6) external {
        require(authorizedMarkets[msg.sender], "Not authorized");

        uint256 amount18 = _from6to18(_amount6);

        require(usdcReserve >= amount18, "Insufficient reserve");

        usdc.transfer(msg.sender, _amount6);
        usdcReserve -= amount18;

        emit FundsWithdrawn(msg.sender, amount18);
    }

    function returnLiquidity(uint256 _amount6) external {
        require(authorizedMarkets[msg.sender], "Not authorized");

        usdc.transferFrom(msg.sender, address(this), _amount6);
        uint256 amount18 = _from6to18(_amount6);
        usdcReserve += amount18;

        emit FundsReturned(msg.sender, _amount6);
    }

    function getSwapAmount(uint256 _inputAmount, uint256 _inputReserve, uint256 _outputReserve)
        public
        pure
        returns (uint256)
    {
        require(_inputReserve > 0 && _outputReserve > 0, "Zero reserves");

        uint256 scaledInputAmount = _inputAmount * 1e18;
        uint256 numerator = scaledInputAmount * _outputReserve;
        uint256 denominator = (_inputReserve * 1e18) + scaledInputAmount;
        return numerator / denominator;
    }

    function getReserves() external view returns (uint256, uint256) {
        return (usdcReserve, duelReserve);
    }
}
