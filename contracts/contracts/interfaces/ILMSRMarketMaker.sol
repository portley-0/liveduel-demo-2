// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILMSRMarketMaker {
    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------
    event AMMCreated(uint initialFunding);
    event AMMPaused();
    event AMMResumed();
    event AMMClosed();
    event AMMFundingChanged(int fundingChange);
    event AMMFeeChanged(uint64 newFee);
    event AMMFeeWithdrawal(uint fees);
    event AMMOutcomeTokenTrade(
        address indexed transactor,
        int[] outcomeTokenAmounts,
        int outcomeTokenNetCost,
        uint marketFees
    );

    // ------------------------------------------------------------------------
    // Public Constants / State Getters
    // ------------------------------------------------------------------------
    function FEE_RANGE() external pure returns (uint64);
    function pmSystem() external view returns (address);
    function collateralToken() external view returns (address);
    function conditionIds(uint index) external view returns (bytes32);
    function atomicOutcomeSlotCount() external view returns (uint);
    function fee() external view returns (uint64);
    function funding() external view returns (uint);
    /// Returns the numeric value of the Stage enum (0=Running,1=Paused,2=Closed).
    function stage() external view returns (uint8);
    function whitelist() external view returns (address);

    // ------------------------------------------------------------------------
    // Core LMSR Functions
    // ------------------------------------------------------------------------
    /// Trade outcome tokens: positive = buy, negative = sell
    function trade(int[] memory tradeAmounts, int collateralLimit) external returns (int);

    /// Cost of a prospective trade in the AMM
    function calcNetCost(int[] memory tradeAmounts) external view returns (int);

    /// Marginal price for a given outcome index
    function calcMarginalPrice(uint8 outcomeIndex) external view returns (uint);

    /// Fee calculation on a nominal trade cost
    function calcMarketFee(uint outcomeTokenCost) external view returns (uint);

    /// Increase or decrease the AMM’s funding; must be paused
    function changeFunding(int fundingChange) external;

    /// Update the fee; must be paused
    function changeFee(uint64 _fee) external;

    /// Pauses trading
    function pause() external;

    /// Resumes trading if paused
    function resume() external;

    /// Closes the AMM (no further trades). Unlocks all outcome tokens to owner
    function close() external;

    /// Withdraw any accrued collateral fees to the owner
    function withdrawFees() external returns (uint);

    // ------------------------------------------------------------------------
    // Ownership
    // ------------------------------------------------------------------------
    function transferOwnership(address newOwner) external;
}
