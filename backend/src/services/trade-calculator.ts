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
 * Calculates the optimal trade to align the market with target odds
 * using a direct calculation model.
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

  // This is the theoretical change in the AMM's inventory, q.
  const deltaQ = targetProbsFixed.map((targetProb, i) => {
    const currentProb = currentProbsFixed[i];
    if (targetProb === 0n || currentProb === 0n) return 0n;

    // The change in q should be negative if the target probability is higher.
    const ratio = (targetProb * ONE) / currentProb;
    const log2Ratio = binaryLog(ratio, EstimationMode.Midpoint);
    return -((internalB * log2Ratio) / log2N);
  });

  // The user's trade is the opposite of the change to the AMM's inventory.
  const userTradeInternal = deltaQ.map(dq => -dq);

  const contractTradeAmounts = userTradeInternal.map((trade) => {
    return (trade * TOKEN_SCALE_FACTOR) / ONE;
  }) as [bigint, bigint, bigint];

  const hasTrade = contractTradeAmounts.some((amount) => amount !== 0n);

  return {
    hasProfitableTrade: hasTrade,
    tradeAmounts: hasTrade ? contractTradeAmounts : undefined,
  };
}