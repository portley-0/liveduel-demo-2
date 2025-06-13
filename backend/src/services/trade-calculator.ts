import { MarketState } from './onchain-reader';
import { MarketOdds } from './matchbook.api';

export interface OptimalTrade {
  hasProfitableTrade: boolean;
  tradeAmounts?: [number, number, number];
}

const SOLVER_ITERATIONS = 5;
const BINARY_SEARCH_STEPS = 20;

function predictOdds(marketState: MarketState, tradeDelta: number[]): MarketOdds {
  const { q, b } = marketState;
  const bNumber = Number(b);
  if (bNumber === 0) return { home: Infinity, draw: Infinity, away: Infinity };

  const newQ = q.map((q_i, i) => Number(q_i) + tradeDelta[i]);

  const numOutcomes = q.length; 
  const log2N = Math.log2(numOutcomes);

  const terms = newQ.map(q_i => Math.pow(2, (q_i * log2N) / bNumber));
  const sumOfTerms = terms.reduce((a, b) => a + b, 0);

  const probabilities = terms.map(term => term / sumOfTerms);

  return {
    home: 1 / probabilities[0],
    draw: 1 / probabilities[1],
    away: 1 / probabilities[2],
  };
}

export function calculateOptimalTrade(
  marketState: MarketState,
  targetOdds: MarketOdds
): OptimalTrade {
  const targetProbs = {
    home: 1 / targetOdds.home,
    draw: 1 / targetOdds.draw,
    away: 1 / targetOdds.away,
  };

  let tradeAmounts: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < SOLVER_ITERATIONS; i++) {
    tradeAmounts[0] = binarySearchForDelta(marketState, tradeAmounts, 0, targetProbs.home);
    
    tradeAmounts[1] = binarySearchForDelta(marketState, tradeAmounts, 1, targetProbs.draw);

    tradeAmounts[2] = binarySearchForDelta(marketState, tradeAmounts, 2, targetProbs.away);
  }

  const finalTrade = tradeAmounts.map(amount => Math.round(amount)) as [number, number, number];

  const hasTrade = finalTrade.some(amount => amount !== 0);

  return {
    hasProfitableTrade: hasTrade,
    tradeAmounts: hasTrade ? finalTrade : undefined,
  };
}


/**
 * A helper function that performs a binary search to find the ideal trade delta
 * for a single outcome to match its target probability.
 * @param marketState The initial on-chain state.
 * @param currentTrade The current guess for the trade amounts.
 * @param outcomeIndex The index to optimize (0=home, 1=draw, 2=away).
 * @param targetProb The target probability for this outcome.
 * @returns The ideal delta (change in shares) for this outcome.
 */
function binarySearchForDelta(
  marketState: MarketState,
  currentTrade: [number, number, number],
  outcomeIndex: number,
  targetProb: number
): number {
  let low = -50000; // Search range for shares, can be adjusted
  let high = 50000;
  let mid = 0;

  for (let i = 0; i < BINARY_SEARCH_STEPS; i++) {
    mid = (low + high) / 2;
    const tempTrade = [...currentTrade] as [number, number, number];
    tempTrade[outcomeIndex] = mid;

    const predictedProbs = predictOdds(marketState, tempTrade);
    const predictedProb = Object.values(predictedProbs)[outcomeIndex];

    if (predictedProb < targetProb) {
      // If the predicted probability is too low, we need to BUY more shares.
      // Buying means a more positive delta, so we increase our lower bound.
      low = mid;
    } else {
      // If the predicted probability is too high, we need to SELL shares.
      // Selling means a more negative delta, so we decrease our upper bound.
      high = mid;
    }
  }

  return mid; // Return the best delta found
}