import {
  binaryLog,
  pow2,
  EstimationMode,
  ONE,
} from "./fixed-192x64-math";

export interface MarketState {
  q: bigint[]; // Current quantities of outcome tokens held by the AMM
  b: bigint; // The liquidity parameter `b`
}

export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
}

export interface OptimalTrade {
  hasProfitableTrade: boolean;
  tradeAmounts?: [bigint, bigint, bigint];
}

const TOKEN_SCALE_FACTOR = 10n ** 6n;
const EXP_LIMIT = 337769972052787200000n;

// The maximum number of shares for any single outcome the bot is bootstrapped with.
// This acts as the inventory limit for any sell order.
const MAX_BOT_INVENTORY_PER_OUTCOME = 15000n * TOKEN_SCALE_FACTOR;


function predictProbabilities(
  marketState: MarketState,
  tradeDelta: bigint[]
): bigint[] {
  const { q, b } = marketState;
  if (b === 0n) return q.map(() => 0n);

  const newQ = q.map((q_i, i) => q_i + tradeDelta[i]);
  const numOutcomes = BigInt(q.length);
  const log2N = binaryLog(numOutcomes * ONE, EstimationMode.Midpoint);

  const otExpNums = newQ.map((q_i) => -q_i);
  const maxOtExpNum = otExpNums.reduce((max, val) => (val > max ? val : max), otExpNums[0] || 0n);
  const offset = (maxOtExpNum * log2N) / b - EXP_LIMIT;

  const terms = otExpNums.map((num) => {
    const exponent = (num * log2N) / b - offset;
    return pow2(exponent, EstimationMode.Midpoint);
  });
  const sumOfTerms = terms.reduce((a, b) => a + b, 0n);

  if (sumOfTerms === 0n) return q.map(() => 0n);

  return terms.map((term) => (term * ONE) / sumOfTerms);
}

/**
 * Calculates the optimal trade to align the market with target odds,
 * constrained by the bot's maximum inventory for sell orders.
 */
export function calculateOptimalTrade(
  marketState: MarketState,
  targetOdds: MarketOdds
): OptimalTrade {
  const { q, b } = marketState;
  if (b === 0n) {
    return { hasProfitableTrade: false };
  }

  const internalQ = q.map((quantity) => (quantity * ONE) / TOKEN_SCALE_FACTOR);
  const internalB = (b * ONE) / TOKEN_SCALE_FACTOR;
  const internalMarketState: MarketState = { q: internalQ, b: internalB };

  const currentProbsFixed = predictProbabilities(internalMarketState, [0n, 0n, 0n]);
  const targetDecimalProbs = [1 / targetOdds.home, 1 / targetOdds.draw, 1 / targetOdds.away];
  const targetProbsFixed = targetDecimalProbs.map((p) => BigInt(Math.round(p * Number(ONE))));

  const log2N = binaryLog(BigInt(q.length) * ONE, EstimationMode.Midpoint);

  const deltaQ = targetProbsFixed.map((targetProb, i) => {
    const currentProb = currentProbsFixed[i];
    if (targetProb === 0n || currentProb === 0n) return 0n;
    const ratio = (targetProb * ONE) / currentProb;
    const log2Ratio = binaryLog(ratio, EstimationMode.Midpoint);
    return -((internalB * log2Ratio) / log2N);
  });

  const userTradeInternal = deltaQ.map(dq => -dq);

  const idealTradeAmounts = userTradeInternal.map((trade) => {
    return (trade * TOKEN_SCALE_FACTOR) / ONE;
  }) as [bigint, bigint, bigint];
  
  // If any sell order exceeds the bot's inventory, the entire trade must be scaled down.
  let scalingFactor = 1.0;

  for (const amount of idealTradeAmounts) {
    // A negative amount indicates a sell order from the bot.
    if (amount < 0n) {
      const sellAmount = -amount; // The absolute amount to sell.
      if (sellAmount > MAX_BOT_INVENTORY_PER_OUTCOME) {
        // This sell order is too large. Calculate by how much we need to scale it down.
        const requiredScaling = Number(MAX_BOT_INVENTORY_PER_OUTCOME) / Number(sellAmount);
        
        // We need to apply the *most restrictive* scaling factor to the whole trade.
        if (requiredScaling < scalingFactor) {
            scalingFactor = requiredScaling;
        }
      }
    }
  }
  
  let constrainedTradeAmounts: [bigint, bigint, bigint];

  if (scalingFactor < 1.0) {
    // A scaling factor less than 1 means at least one sell was too large.
    // We scale down the entire trade proportionally to maintain its balance.
    // We use a large integer to preserve precision during scaling.
    const precision = 1_000_000_000n;
    const scalingFactorBigInt = BigInt(Math.floor(scalingFactor * Number(precision)));

    constrainedTradeAmounts = idealTradeAmounts.map(amount => {
        return (amount * scalingFactorBigInt) / precision;
    }) as [bigint, bigint, bigint];
    console.log(`Trade constrained. Original: [${idealTradeAmounts.join(', ')}], Scaled: [${constrainedTradeAmounts.join(', ')}]`);

  } else {
    // If no scaling was needed, the ideal trade is the final trade.
    constrainedTradeAmounts = idealTradeAmounts;
  }

  const hasTrade = constrainedTradeAmounts.some((amount) => amount !== 0n);

  return {
    hasProfitableTrade: hasTrade,
    tradeAmounts: hasTrade ? constrainedTradeAmounts : undefined,
  };
}
