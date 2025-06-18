import {
  binaryLog,
  pow2,
  EstimationMode,
  ONE,
} from "./fixed-192x64-math"; 


export interface MarketState {
  q: bigint[]; // Current quantities of outcome tokens held by the AMM
  b: bigint; // The liquidity parameter `b`, in fixed-point
}

export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
}

export interface OptimalTrade {
  hasProfitableTrade: boolean;
  tradeAmounts?: [number, number, number]; // User-facing trade amounts (integer shares)
}

const TERNARY_SEARCH_STEPS = 50; // Using 50 steps for good precision in bigint space
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
  const maxOtExpNum = otExpNums.reduce((max, val) => (val > max ? val : max));
  const offset = (maxOtExpNum * log2N) / b - EXP_LIMIT;

  const terms = otExpNums.map((num) => {
    const exponent = (num * log2N) / b - offset;
    return pow2(exponent, EstimationMode.Midpoint);
  });
  const sumOfTerms = terms.reduce((a, b) => a + b, 0n);

  if (sumOfTerms === 0n) return q.map(() => 0n);

  // Return probabilities as fixed-point numbers (scaled by ONE)
  return terms.map((term) => (term * ONE) / sumOfTerms);
}

/**
 * Calculates the optimal trade to align the market with target odds,
 * performing ALL calculations using high-precision fixed-point arithmetic.
 */
export function calculateOptimalTrade(
  marketState: MarketState,
  targetOdds: MarketOdds
): OptimalTrade {
  const { q, b } = marketState;
  if (b === 0n) {
    return { hasProfitableTrade: false };
  }

  // Convert user-facing decimal odds into fixed-point probabilities.
  const targetDecimalProbs = [
    1 / targetOdds.home,
    1 / targetOdds.draw,
    1 / targetOdds.away,
  ];
  const targetProbsFixed = targetDecimalProbs.map((p) =>
    BigInt(Math.round(p * Number(ONE)))
  );

  // Define the INVERSE function to calculate `q` from a probability `p`.
  // The correct inverse for the on-chain `pow2((q*log2N)/b)` is `q = (b * binaryLog(p)) / log2N`.
  const log2N = binaryLog(BigInt(q.length) * ONE, EstimationMode.Midpoint);

  const qFromProbs = (probs: bigint[]): bigint[] => {
    return probs.map((p) => {
      if (p <= 0n) return 0n; // Avoid binaryLog of non-positive number.
      const log2p = binaryLog(p, EstimationMode.Midpoint);
      // We add a negative sign because price is inversely related to the quantity held.
      return -((b * log2p) / log2N);
    });
  };

  // Calculate the implied quantities for both current and target states.
  const currentProbsFixed = predictProbabilities(marketState, [0n, 0n, 0n]);
  const currentQ = qFromProbs(currentProbsFixed);
  const targetQ = qFromProbs(targetProbsFixed);

  // Determine the direction of the required trade in fixed-point share quantities.
  const internalTradeDirection = targetQ.map((tq, i) => tq - currentQ[i]);

  // Define an error function that operates purely in the fixed-point domain.
  const getError = (k: bigint): bigint => {
    // `k` is a scaling factor from 0 to `b`.
    // The change to the AMM's `q` balances is `delta = direction * k / b`.
    const tempInternalDelta = internalTradeDirection.map(
      (d) => (d * k) / b
    ) as [bigint, bigint, bigint];

    const predictedProbs = predictProbabilities(marketState, tempInternalDelta);

    let error = 0n;
    for (let i = 0; i < 3; i++) {
      const diff = predictedProbs[i] - targetProbsFixed[i];
      // Use fixed-point multiplication for the square: error += diff^2
      error += (diff * diff) / ONE;
    }
    return error;
  };

  // Use ternary search to find the optimal scaling factor `k` that minimizes error.
  let low = 0n;
  let high = b; // The search space for k is from 0 to b.

  for (let i = 0; i < TERNARY_SEARCH_STEPS; i++) {
    const m1 = low + (high - low) / 3n;
    const m2 = high - (high - low) / 3n;
    if (getError(m1) < getError(m2)) {
      high = m2;
    } else {
      low = m1;
    }
  }
  const optimalK = (low + high) / 2n; // Use the midpoint for the best estimate

  const finalTradeFixed = internalTradeDirection.map(
    (d) => -((d * optimalK) / b)
  );

  const roundedTrade = finalTradeFixed.map((amount) =>
    Number(amount / ONE)
  ) as [number, number, number];

  const hasTrade = roundedTrade.some((amount) => Math.abs(amount) > 0);

  return {
    hasProfitableTrade: hasTrade,
    tradeAmounts: hasTrade ? roundedTrade : undefined,
  };
}