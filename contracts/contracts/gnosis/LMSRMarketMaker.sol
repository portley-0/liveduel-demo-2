// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; 

import { Fixed192x64Math } from "./Fixed192x64Math.sol";
import { MarketMaker } from "./MarketMaker.sol";

/// @title LMSR market maker contract - Calculates share prices based on share distribution and initial funding
/// @author Alan Lu - <alan.lu@gnosis.pm>
contract LMSRMarketMaker is MarketMaker {
    /*
     *  Constants
     */
    uint constant ONE = 0x10000000000000000;
    int constant EXP_LIMIT = 337769972052787200000;

    /// @dev Calculates the net cost for executing a given trade.
    /// @param outcomeTokenAmounts Amounts of outcome tokens to buy from the market. If an amount is negative, represents an amount to sell to the market.
    /// @return netCost Net cost of trade. If positive, represents amount of collateral which would be paid to the market for the trade. If negative, represents amount of collateral which would be received from the market for the trade.
    function calcNetCost(int[] memory outcomeTokenAmounts)
        public
        view
        override
        returns (int netCost)
    {
        require(outcomeTokenAmounts.length == atomicOutcomeSlotCount, "Invalid outcomeTokenAmounts length");

        int[] memory otExpNums = new int[](atomicOutcomeSlotCount);
        for (uint i = 0; i < atomicOutcomeSlotCount; i++) {
            int balance = int(pmSystem.balanceOf(address(this), generateAtomicPositionId(i)));
            require(balance >= 0, "Balance cannot be negative");
            otExpNums[i] = outcomeTokenAmounts[i] - balance;  // Replacing SafeMath.sub with native subtraction
        }

        int log2N = Fixed192x64Math.binaryLog(atomicOutcomeSlotCount * ONE, Fixed192x64Math.EstimationMode.UpperBound);

        (uint sum, int offset, ) = sumExpOffset(log2N, otExpNums, 0, Fixed192x64Math.EstimationMode.UpperBound);
        netCost = Fixed192x64Math.binaryLog(sum, Fixed192x64Math.EstimationMode.UpperBound);
        netCost = netCost + offset;  // Replacing SafeMath.add with native addition
        netCost = (netCost * int(ONE) / log2N) * int(funding);  // Replacing SafeMath.mul with native multiplication

        // Integer division for negative numbers already uses ceiling,
        // so only check boundary condition for positive numbers
        if (netCost <= 0 || (netCost / int(ONE)) * int(ONE) == netCost) {
            netCost /= int(ONE);
        } else {
            netCost = (netCost / int(ONE)) + 1;
        }
    }

    /// @dev Returns marginal price of an outcome
    /// @param outcomeTokenIndex Index of outcome to determine marginal price of
    /// @return price Marginal price of an outcome as a fixed point number
    function calcMarginalPrice(uint8 outcomeTokenIndex)
        public
        view
        returns (uint price)
    {
        int[] memory negOutcomeTokenBalances = new int[](atomicOutcomeSlotCount);
        for (uint i = 0; i < atomicOutcomeSlotCount; i++) {
            int negBalance = -int(pmSystem.balanceOf(address(this), generateAtomicPositionId(i)));
            require(negBalance <= 0, "Negative balance must be non-positive");
            negOutcomeTokenBalances[i] = negBalance;
        }

        int log2N = Fixed192x64Math.binaryLog(negOutcomeTokenBalances.length * ONE, Fixed192x64Math.EstimationMode.Midpoint);

        // The price function is exp(quantities[i]/b) / sum(exp(q/b) for q in quantities)
        // To avoid overflow, calculate with
        // exp(quantities[i]/b - offset) / sum(exp(q/b - offset) for q in quantities)
        (uint sum, , uint outcomeExpTerm) = sumExpOffset(log2N, negOutcomeTokenBalances, outcomeTokenIndex, Fixed192x64Math.EstimationMode.Midpoint);
        price = outcomeExpTerm / (sum / ONE);
    }

    /*
     *  Private functions
     */
    /// @dev Calculates sum(exp(q/b - offset) for q in quantities), where offset is set
    ///      so that the sum fits in 248-256 bits
    /// @param log2N Binary logarithm of the number of outcomes
    /// @param otExpNums Numerators of the exponents, denoted as q in the aforementioned formula
    /// @param outcomeIndex Index of exponential term to extract (for use by marginal price function)
    /// @param estimationMode The estimation mode to be used for calculation.
    /// @return sum The sum of exponentials.
    /// @return offset The offset used in the exponential calculation.
    /// @return outcomeExpTerm The exponential term corresponding to the given outcomeIndex.
        function sumExpOffset(int log2N, int[] memory otExpNums, uint8 outcomeIndex, Fixed192x64Math.EstimationMode estimationMode)
        private
        view
        returns (uint sum, int offset, uint outcomeExpTerm)
    {
        require(log2N >= 0 && int(funding) >= 0, "Invalid log2N or funding");

        offset = Fixed192x64Math.max(otExpNums);
        offset = (offset * log2N) / int(funding);  // Replacing SafeMath.mul and SafeMath.div with native operators
        offset = offset - EXP_LIMIT;  // Replacing SafeMath.sub with native subtraction

        uint term;
        for (uint8 i = 0; i < otExpNums.length; i++) {
            term = Fixed192x64Math.pow2(((otExpNums[i] * log2N) / int(funding)) - offset, estimationMode);  // Replacing SafeMath.mul and SafeMath.sub
            if (i == outcomeIndex) {
                outcomeExpTerm = term;
            }
            sum += term;  
        }
    }
}