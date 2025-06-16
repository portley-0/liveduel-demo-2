import {
  binaryLog,
  pow2,
  EstimationMode,
  ONE,
} from "./fixed-192x64-math";

export interface MarketState {
  q: bigint[];
  b: bigint;
}

export interface MarketOdds {
  home: number;
  draw: number;
  away: number;
}

export interface OptimalTrade {
  hasProfitableTrade: boolean;
  tradeAmounts?: [number, number, number];
}

const TERNARY_SEARCH_STEPS = 40;
const EXP_LIMIT = 337769972052787200000n;

function predictProbabilities(
  marketState: MarketState,
  tradeDelta: bigint[]
): bigint[] {
  const { q, b } = marketState;
  if (b === 0n) return [0n, 0n, 0n];

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

  if (sumOfTerms === 0n) return [0n, 0n, 0n];

  return terms.map((term) => (term * ONE) / sumOfTerms);
}

// This is the definitive, stable solver.
export function calculateOptimalTrade(
  marketState: MarketState,
  targetOdds: MarketOdds
): OptimalTrade {
  if (marketState.b === 0n) {
    return { hasProfitableTrade: false };
  }

  const { b } = marketState;

  const targetProbs = [
    1 / targetOdds.home,
    1 / targetOdds.draw,
    1 / targetOdds.away,
  ];

  const bFactor = Number(b);
  const currentProbs = predictProbabilities(marketState, [0n, 0n, 0n]).map(p => Number(p) / Number(ONE));
  
  const targetQ = targetProbs.map(p => -bFactor * Math.log(p));
  const currentQ = currentProbs.map(p => p > 0 ? -bFactor * Math.log(p) : 0);

  // This is the change needed for the AMM's internal `q` balances.
  const internalTradeDirection = [
    targetQ[0] - currentQ[0],
    targetQ[1] - currentQ[1],
    targetQ[2] - currentQ[2],
  ];

  const getError = (k: bigint): bigint => {
    // This is the delta applied to the AMM's internal `q` array.
    const tempInternalDelta = internalTradeDirection.map(d => BigInt(Math.round(d * Number(k) / Number(b)))) as [bigint, bigint, bigint];
    const predictedProbs = predictProbabilities(marketState, tempInternalDelta);
    
    let error = 0n;
    for (let i = 0; i < 3; i++) {
        const target = BigInt(Math.round(targetProbs[i] * Number(ONE)));
        const diff = predictedProbs[i] - target;
        error += diff * diff;
    }
    return error;
  };

  // Ternary search finds the scaling factor `k` that minimizes the total error.
  let low = 0n;
  let high = b;

  for (let i = 0; i < TERNARY_SEARCH_STEPS; i++) {
    const m1 = low + (high - low) / 3n;
    const m2 = high - (high - low) / 3n;
    if (getError(m1) < getError(m2)) {
      high = m2;
    } else {
      low = m1;
    }
  }
  
  const optimalK = low;
  // A user BUY (+) means the internal AMM quantity `q` must DECREASE (-).
  // Therefore, the final user-facing trade is the NEGATIVE of the internal delta.
  const finalTrade = internalTradeDirection.map(d => -BigInt(Math.round(d * Number(optimalK) / Number(b)))) as [bigint, bigint, bigint];

  const roundedTrade = finalTrade.map(amount => Math.round(Number(amount))) as [number, number, number];
  const hasTrade = roundedTrade.some((amount) => amount !== 0);

  return {
    hasProfitableTrade: hasTrade,
    tradeAmounts: hasTrade ? roundedTrade : undefined,
  };
}