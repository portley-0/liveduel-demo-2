// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./gnosis/LMSRMarketMaker.sol";
import "./gnosis/ConditionalTokens.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IMarketFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TournamentMarket is Initializable, OwnableUpgradeable, ERC1155Holder {

    uint256 public tournamentId;
    uint8 public totalTeams;
    uint256[] public teamIds;
    mapping(uint256 => uint8) public teamIdToPosition;

    bytes32 public questionId;
    bytes32 public conditionId;

    IERC20 public usdc;
    ConditionalTokens public conditionalTokens;
    LMSRMarketMaker public marketMaker;
    ILiquidityPool public liquidityPool;

    bool public isInitialized;
    bool public isResolved;
    uint8 public winningOutcome;

    uint256 public constant FEE_BPS = 400; // 4%
    uint256 public constant MAX_NET_BET = 500_000 * 1e6;

    address[] public bettors;
    mapping(address => bool) public isBettor;
    mapping(uint8 => uint256) public totalWageredPerOutcome;

    mapping(uint256 => bool) public fixtureExists;
    uint256 public resolvedFixturesCount;
    uint256 public finalMatchId;

    struct Fixture {
        uint256 matchId;
        bool fixtureResolved;
        uint8 winnerIndex;
        bool isRoundFinal;
        bool isTournamentFinal;
    }
    Fixture[] public fixtures;

    /// @dev maps a match's ID to its index in the `fixtures` array
    mapping(uint256 => uint256) public matchIdToIndex;

    event SharesPurchased(
        uint256 indexed tournamentId,
        address indexed buyer,
        uint8 indexed outcome,
        uint256 shares,
        int256 cost
    );
    event SharesSold(
        uint256 indexed tournamentId,
        address indexed seller,
        uint8 indexed outcome,
        uint256 shares,
        int actualGain
    );
    event OddsUpdated(
        uint256 indexed tournamentId,
        uint256[] marginalPrices
    );
    event MarketResolved(
        uint256 indexed tournamentId,
        uint8 indexed outcome
    );
    event PayoutRedeemed(
        uint256 indexed tournamentId,
        address indexed redeemer,
        uint8 indexed outcome,
        uint256 amount
    );
    event FixtureAdded(
        uint256 indexed tournamentId,
        uint256 indexed matchId,
        bool isRoundFinal,
        bool isTournamentFinal
    );
    event MatchResultRecorded(
        uint256 indexed tournamentId,
        uint256 indexed matchId,
        uint8 apiOutcome,
        uint8 winnerIndex
    );

    function initializeMarket(
        uint256 _tournamentId,
        uint256[] calldata _teamIds,
        bytes32 _questionId,
        bytes32 _conditionId,
        address _marketMaker,
        address _liquidityPool,
        address _usdc,
        address _conditionalTokens
    ) external initializer {
        __Ownable_init(msg.sender);
        require(_teamIds.length >= 2, "No teams");
        tournamentId = _tournamentId;
        totalTeams   = uint8(_teamIds.length);

        for (uint8 i = 0; i < totalTeams; i++) {
            teamIds.push(_teamIds[i]);
            teamIdToPosition[_teamIds[i]] = i;
        }

        questionId = _questionId;
        conditionId = _conditionId;
        marketMaker = LMSRMarketMaker(_marketMaker);
        liquidityPool = ILiquidityPool(_liquidityPool);
        usdc = IERC20(_usdc);
        conditionalTokens = ConditionalTokens(_conditionalTokens);
        conditionalTokens.setApprovalForAll(_marketMaker, true);
        isInitialized = true;
    }

    function buyShares(uint8 outcome, uint256 amount) external {
        require(isInitialized, "Not initialized");
        require(!isResolved, "Market resolved");
        require(outcome < totalTeams, "Bad outcome");
        require(amount > 0, "Amount=0");

        if (!isBettor[msg.sender]) {
            bettors.push(msg.sender);
            isBettor[msg.sender] = true;
        }

        uint256 otherOutcomesTotal = 0;
        for (uint8 i = 0; i < totalTeams; i++) {
            if (i != outcome) {
                otherOutcomesTotal += totalWageredPerOutcome[i];
            }
        }

        uint256 maxAllowedBet = MAX_NET_BET + otherOutcomesTotal - totalWageredPerOutcome[outcome];
        require(amount <= maxAllowedBet, "Bet exceeds maximum allowable amount");

        int256[] memory tradeAmounts = new int256[](totalTeams);
        tradeAmounts[outcome] = int256(amount);
        int256 netCost = marketMaker.calcNetCost(tradeAmounts);
        require(netCost > 0, "Invalid cost");

        uint256 fee = (uint256(netCost) * FEE_BPS) / 10_000;
        uint256 totalCost = uint256(netCost) + fee;
        uint256 halfFee = fee / 2;

        require(usdc.transferFrom(msg.sender, address(this), totalCost), "transferFrom failed");
        require(usdc.approve(address(marketMaker), uint256(netCost)), "approve failed");
        int256 actualCost = marketMaker.trade(tradeAmounts, netCost);

        uint256 indexSet = 1 << outcome;
        uint256 tokenId  = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );
        conditionalTokens.safeTransferFrom(address(this), msg.sender, tokenId, amount, "");

        require(usdc.approve(address(liquidityPool), halfFee), "approve LP failed");
        liquidityPool.addToRewardsPool(halfFee);
        require(usdc.approve(address(owner()), fee - halfFee), "approve profit failed");
        IMarketFactory(address(owner())).addToPlatformProfit(fee - halfFee);

        totalWageredPerOutcome[outcome] += uint256(actualCost);
        emit SharesPurchased(tournamentId, msg.sender, outcome, amount, actualCost);

        uint256[] memory prices = new uint256[](totalTeams);
        for (uint8 i = 0; i < totalTeams; i++) {
            prices[i] = marketMaker.calcMarginalPrice(i);
        }
        emit OddsUpdated(tournamentId, prices);
    }

    function buySharesWithPermit(
        uint8 outcome,
        uint256 amount,
        uint256 permitValue,
        uint256 permitDeadline,
        uint8  v,
        bytes32 r,
        bytes32 s
    ) external {
        require(isInitialized, "Not initialized");
        require(!isResolved, "Market resolved");
        require(outcome < totalTeams, "Bad outcome");
        require(amount > 0, "Amount=0");

        if (!isBettor[msg.sender]) {
            bettors.push(msg.sender);
            isBettor[msg.sender] = true;
        }

        uint256 otherOutcomesTotal = 0;
        for (uint8 i = 0; i < totalTeams; i++) {
            if (i != outcome) {
                otherOutcomesTotal += totalWageredPerOutcome[i];
            }
        }

        uint256 maxAllowedBet = MAX_NET_BET + otherOutcomesTotal - totalWageredPerOutcome[outcome];
        require(amount <= maxAllowedBet, "Bet exceeds maximum allowable amount");

        int256[] memory tradeAmounts = new int256[](totalTeams);
        tradeAmounts[outcome] = int256(amount);
        int256 netCost = marketMaker.calcNetCost(tradeAmounts);
        require(netCost > 0, "Invalid cost");

        uint256 fee       = (uint256(netCost) * FEE_BPS) / 10_000;
        uint256 totalCost = uint256(netCost) + fee;
        uint256 halfFee   = fee / 2;

        IERC20Permit(address(usdc)).permit(
            msg.sender,
            address(this),
            permitValue,
            permitDeadline,
            v, r, s
        );
        require(permitValue >= totalCost, "Permit amount too small");
        require(usdc.transferFrom(msg.sender, address(this), totalCost), "transferFrom failed");
        require(usdc.approve(address(marketMaker), uint256(netCost)), "approve failed");
        int256 actualCost = marketMaker.trade(tradeAmounts, netCost);

        uint256 indexSet = 1 << outcome;
        uint256 tokenId  = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );
        conditionalTokens.safeTransferFrom(address(this), msg.sender, tokenId, amount, "");

        require(usdc.approve(address(liquidityPool), halfFee), "approve LP failed");
        liquidityPool.addToRewardsPool(halfFee);
        require(usdc.approve(address(owner()), fee - halfFee), "approve profit failed");
        IMarketFactory(address(owner())).addToPlatformProfit(fee - halfFee);

        totalWageredPerOutcome[outcome] += uint256(actualCost);
        emit SharesPurchased(tournamentId, msg.sender, outcome, amount, actualCost);

        uint256[] memory prices = new uint256[](totalTeams);
        for (uint8 i = 0; i < totalTeams; i++) {
            prices[i] = marketMaker.calcMarginalPrice(i);
        }
        emit OddsUpdated(tournamentId, prices);
    }

    function sellShares(uint8 outcome, uint256 amount) external {
        require(isInitialized, "Not initialized");
        require(!isResolved,   "Market resolved");
        require(outcome < totalTeams, "Bad outcome");
        require(amount > 0, "Amount=0");

        uint256 indexSet = 1 << outcome;
        uint256 tokenId  = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );
        require(
            conditionalTokens.balanceOf(msg.sender, tokenId) >= amount,
            "Insufficient tokens"
        );

        int256[] memory tradeAmounts = new int256[](totalTeams);
        tradeAmounts[outcome] = -int256(amount);
        int256 netGain = marketMaker.calcNetCost(tradeAmounts);
        require(netGain < 0, "No gain possible");

        conditionalTokens.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        int256 actualGain = marketMaker.trade(tradeAmounts, netGain);

        require(usdc.transfer(msg.sender, uint256(-actualGain)), "USDC transfer failed");

        totalWageredPerOutcome[outcome] -= uint256(-actualGain);
        emit SharesSold(tournamentId, msg.sender, outcome, amount, -actualGain);

        uint256[] memory prices = new uint256[](totalTeams);
        for (uint8 i = 0; i < totalTeams; i++) {
            prices[i] = marketMaker.calcMarginalPrice(i);
        }
        emit OddsUpdated(tournamentId, prices);
    }

   
    function addFixture(
        uint256 _matchId,
        bool _isRoundFinal,
        bool _isTournamentFinal
    ) external onlyOwner {
        require(isInitialized, "Not initialized");
        require(!fixtureExists[_matchId], "Already added");
        fixtureExists[_matchId] = true;

        if (_isTournamentFinal) {
            finalMatchId = _matchId;
        }

        fixtures.push(Fixture({
            matchId:            _matchId,
            fixtureResolved:    false,
            winnerIndex:        type(uint8).max,
            isRoundFinal:       _isRoundFinal,
            isTournamentFinal:  _isTournamentFinal
        }));
        matchIdToIndex[_matchId] = fixtures.length - 1;

        emit FixtureAdded(
            tournamentId,
            _matchId,
            _isRoundFinal,
            _isTournamentFinal
        );
    }


    function recordMatchResult(
        uint256 _matchId,
        uint8   apiOutcome,
        uint256 homeId,
        uint256 awayId
    ) external onlyOwner {
        require(isInitialized, "Not initialized");
        uint256 idx = matchIdToIndex[_matchId];
        Fixture storage f = fixtures[idx];
        require(!f.fixtureResolved, "Already resolved");
        require(apiOutcome == 0 || apiOutcome == 2, "No draws");

        f.fixtureResolved = true;
        f.winnerIndex = (apiOutcome == 0)
            ? teamIdToPosition[homeId]
            : teamIdToPosition[awayId];

        emit MatchResultRecorded(tournamentId, _matchId, apiOutcome, f.winnerIndex);

        if (f.isTournamentFinal) {
            resolveMarket(f.winnerIndex);
        }
    }

    function isRoundFinalMatch(uint256 _matchId) external view returns (bool) {
        require(fixtureExists[_matchId], "Unknown fixture");
        return fixtures[matchIdToIndex[_matchId]].isRoundFinal;
    }

    function isTournamentFinalMatch(uint256 _matchId) external view returns (bool) {
        require(fixtureExists[_matchId], "Unknown fixture");
        return fixtures[matchIdToIndex[_matchId]].isTournamentFinal;
    }

    function resolveMarket(uint8 outcomeIndex) public onlyOwner {
        require(isInitialized, "Not initialized");
        require(!isResolved, "Already resolved");
        require(outcomeIndex < totalTeams, "Bad outcome");

        isResolved = true;
        winningOutcome = outcomeIndex;
        marketMaker.close();

        uint256 indexSet = 1 << outcomeIndex;
        uint256[] memory indexSetArray = new uint256[](1);
        indexSetArray[0] = indexSet;
        conditionalTokens.redeemPositions(
            usdc,
            bytes32(0),
            conditionId,
            indexSetArray
        );

        uint256 contractBalance = usdc.balanceOf(address(this));
        usdc.approve(address(liquidityPool), contractBalance);
        liquidityPool.returnLiquidity(contractBalance);
        liquidityPool.revokeMarket(address(this));

        IMarketFactory(address(owner())).removeActiveTournament(tournamentId);

        emit MarketResolved(tournamentId, outcomeIndex);
    }

    function redeemPayouts() external {
        require(isInitialized, "Not initialized");
        require(isResolved, "Not resolved");

        uint256 indexSet = 1 << winningOutcome;
        uint256 tokenId = conditionalTokens.getPositionId(
            usdc,
            conditionalTokens.getCollectionId(bytes32(0), conditionId, indexSet)
        );
        uint256 userBalance = conditionalTokens.balanceOf(msg.sender, tokenId);
        require(userBalance > 0, "No winning tokens");

        conditionalTokens.safeTransferFrom(msg.sender, address(this), tokenId, userBalance, "");

        uint256 beforeRedeem = usdc.balanceOf(address(this));

        uint256[] memory indexSetArray = new uint256[](1);
        indexSetArray[0] = indexSet;
        conditionalTokens.redeemPositions(
            usdc,
            bytes32(0),
            conditionId,
            indexSetArray
        );

        uint256 afterRedeem = usdc.balanceOf(address(this));
        uint256 payoutAmount = afterRedeem - beforeRedeem;
        require(payoutAmount > 0, "No payout");

        require(usdc.transfer(msg.sender, payoutAmount), "Transfer failed");
        emit PayoutRedeemed(tournamentId, msg.sender, winningOutcome, payoutAmount);
    }

    function getNetCost(uint8 outcome, int256 amount) external view returns (int256) {
        int256[] memory tradeAmounts = new int256[](totalTeams);
        tradeAmounts[outcome] = amount;
        return marketMaker.calcNetCost(tradeAmounts);
    }

    function getMarginalPrice(uint8 outcome) external view returns (uint256) {
        return marketMaker.calcMarginalPrice(outcome);
    }

    function getBettors() external view returns (address[] memory) {
        return bettors;
    }

    function getFixtureCount() external view returns (uint256) {
        return fixtures.length;
    }

    function getConditionId() external view returns (bytes32) {
        return conditionId;
    }

    function getQuestionId() external view returns (bytes32) {
        return questionId;
    }

    function getTotalTeams() external view returns (uint256) {
        return totalTeams;
    }

    function getWinnerIndex(uint256 teamId) external view returns (uint8) {
        require(teamIdToPosition[teamId] < totalTeams, "Invalid team ID");
        return teamIdToPosition[teamId];
    }


    function getFixture(uint256 arrayIndex)
        external view
        returns (
            uint256 matchId,
            bool    fixtureResolved,
            uint8   winnerIndex,
            bool    isRoundFinal,
            bool    isTournamentFinal
        )
    {
        Fixture storage f = fixtures[arrayIndex];
        return (
            f.matchId,
            f.fixtureResolved,
            f.winnerIndex,
            f.isRoundFinal,
            f.isTournamentFinal
        );
    }

}
