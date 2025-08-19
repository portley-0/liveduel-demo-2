import { EstimationMode, ONE, binaryLog, pow2 } from "@/lib/fixed-192x64-math.ts";

const MICRO = 1_000_000n;
const EXP_LIMIT = 337769972052787200000n; // stability offset

const toFixed = (micro: bigint) => (micro * ONE) / MICRO;      // micro -> 192.64
const fromFixedToMicro = (fx: bigint) => (fx * MICRO) / ONE;   // 192.64 -> micro
const clampExp = (x: bigint) => (x < -EXP_LIMIT ? -EXP_LIMIT : x > 0n ? 0n : x);

// probs (192.64) at q,b (both 192.64)
function predictProbsFixed(qFixed: bigint[], bFixed: bigint): bigint[] {
  const n = BigInt(qFixed.length);
  const log2N = binaryLog(n * ONE, EstimationMode.Midpoint);

  const exps = qFixed.map(qi => ((-qi) * log2N) / bFixed);
  const maxExp = exps.reduce((m, v) => (v > m ? v : m), exps[0] ?? 0n);

  // clamp (e - max) to [-EXP_LIMIT, 0]
  const shifted = exps.map(e => clampExp(e - maxExp));

  const terms = shifted.map(e => pow2(e, EstimationMode.Midpoint));
  const sum = terms.reduce((a, b) => a + b, 0n);
  if (sum === 0n) return qFixed.map(() => 0n);

  return terms.map(t => (t * ONE) / sum);
}

// C(q) in 192.64
function lmsrCostFixed(qFixed: bigint[], bFixed: bigint): bigint {
  const n = BigInt(qFixed.length);
  const log2N = binaryLog(n * ONE, EstimationMode.Midpoint);

  const exps = qFixed.map(qi => ((-qi) * log2N) / bFixed);
  const maxExp = exps.reduce((m, v) => (v > m ? v : m), exps[0] ?? 0n);

  // clamp (e - max) to [-EXP_LIMIT, 0]
  const shifted = exps.map(e => clampExp(e - maxExp));

  const sumPow = shifted.map(e => pow2(e, EstimationMode.Midpoint))
                        .reduce((a, b) => a + b, 0n);

  // log2(sum 2^(e - max)) + max
  const log2T = maxExp + binaryLog(sumPow, EstimationMode.Midpoint);
  return (bFixed * log2T) / log2N;
}


/** price (micro USDC per token) for outcome k at q,b (q,b are 192.64) */
function priceMicroAt(qFixed: [bigint, bigint, bigint], bFixed: bigint, k: 0|1|2): bigint {
  const probs = predictProbsFixed(qFixed, bFixed);
  return (probs[k] * MICRO) / ONE; // micro USDC per token
}

/**
 * SIGNED net cost in micro:
 * deltaSignedMicro > 0  => user BUYS delta, AMM q_k decreases
 * deltaSignedMicro < 0  => user SELLS |delta|, AMM q_k increases
 * Returns: + for user-pays, - for user-receives
 */
export function netCostSignedMicro(
  qMicro: [bigint, bigint, bigint],
  bMicro: bigint,
  k: 0|1|2,
  deltaSignedMicro: bigint
): bigint {
  if (deltaSignedMicro === 0n) return 0n;

  const qFixed = qMicro.map(toFixed) as [bigint, bigint, bigint];
  const bFixed = toFixed(bMicro);

  const C0 = lmsrCostFixed(qFixed, bFixed);
  const q1 = [...qFixed] as [bigint, bigint, bigint];
  q1[k] = q1[k] - toFixed(deltaSignedMicro); // buy: -, sell: -(-s)=+
  const C1 = lmsrCostFixed(q1, bFixed);

  return fromFixedToMicro(C1 - C0);
}

/** Convenience wrappers that return positive numbers for UI */
export const netCostBuyMicro = (
  q: [bigint, bigint, bigint], b: bigint, k: 0|1|2, buyAmount: bigint
) => (buyAmount <= 0n ? 0n : netCostSignedMicro(q, b, k, buyAmount)); // positive

export const netProceedsSellMicro = (
  q: [bigint, bigint, bigint], b: bigint, k: 0|1|2, sellAmount: bigint
) => (sellAmount <= 0n ? 0n : -netCostSignedMicro(q, b, k, -sellAmount)); // positive

/** Fast solver: shares to BUY for a target net cost (micro) */
export function solveBuySharesForCostMicro(
  qMicro: [bigint, bigint, bigint],
  bMicro: bigint,
  k: 0|1|2,
  targetCostMicro: bigint
): bigint {
  if (targetCostMicro <= 0n) return 0n;

  const qFixed = qMicro.map(toFixed) as [bigint, bigint, bigint];
  const bFixed = toFixed(bMicro);

  // initial guess: delta (micro-shares) ≈ cost / price(q)
  const p0 = priceMicroAt(qFixed, bFixed, k);
  let delta = p0 > 0n ? (targetCostMicro * MICRO) / p0 : 0n; // micro-shares

  // 2 Newton iterations
  for (let i = 0; i < 2; i++) {
    if (delta <= 0n) break;

    const cost = netCostBuyMicro(qMicro, bMicro, k, delta);   // > 0 (micro)
    const err = cost - targetCostMicro;                       // micro
    const aerr = err >= 0n ? err : -err;
    if (aerr <= 2n) break;

    // derivative in micro USDC/share -> convert to micro-shares step
    const q1 = [...qFixed] as [bigint, bigint, bigint];
    q1[k] = q1[k] - toFixed(delta);
    const p = priceMicroAt(q1, bFixed, k);                    // micro / share
    if (p === 0n) break;

    let stepMicro = (err * MICRO) / p;                        // (micro / (micro/share)) * MICRO = micro-shares
    if (stepMicro === 0n) stepMicro = err > 0n ? 1n : -1n;

    let next = delta - stepMicro;
    if (next <= 0n) next = delta / 2n;

    // cap large jumps
    const maxStep = (delta * 3n) / 4n + 1n;
    if (next + maxStep < delta) next = delta - maxStep;

    delta = next;
  }

  // Safety clamp: ensure final cost <= target
  const finalCost = netCostBuyMicro(qMicro, bMicro, k, delta);
  if (finalCost > targetCostMicro) {
    delta = (delta * targetCostMicro) / (finalCost || 1n);
  }
  return delta;
}

/** Solver: tokens to SELL for a target proceeds (micro) */
export function solveSellSharesForProceedsMicro(
  qMicro: [bigint, bigint, bigint],
  bMicro: bigint,
  k: 0|1|2,
  targetProceedsMicro: bigint
): bigint {
  if (targetProceedsMicro <= 0n) return 0n;

  const qFixed = qMicro.map(toFixed) as [bigint, bigint, bigint];
  const bFixed = toFixed(bMicro);

  // initial guess: s (micro-shares) ≈ proceeds / price(q)
  const p0 = priceMicroAt(qFixed, bFixed, k);
  let s = p0 > 0n ? (targetProceedsMicro * MICRO) / p0 : 0n;  // micro-shares

  for (let i = 0; i < 2; i++) {
    if (s <= 0n) break;

    const proceeds = netProceedsSellMicro(qMicro, bMicro, k, s); // > 0 (micro)
    const err = proceeds - targetProceedsMicro;                  // micro
    const aerr = err >= 0n ? err : -err;
    if (aerr <= 2n) break;

    // derivative ≈ price at q' after increasing q_k by s (selling)
    const q1 = [...qFixed] as [bigint, bigint, bigint];
    q1[k] = q1[k] + toFixed(s);
    const p = priceMicroAt(q1, bFixed, k);                      // micro / share
    if (p === 0n) break;

    let stepMicro = (err * MICRO) / p;                          // micro-shares
    if (stepMicro === 0n) stepMicro = err > 0n ? 1n : -1n;

    let next = s - stepMicro;
    if (next <= 0n) next = s / 2n;

    const maxStep = (s * 3n) / 4n + 1n;
    if (next + maxStep < s) next = s - maxStep;

    s = next;
  }

  // Safety clamp: ensure proceeds >= target
  const finalProceeds = netProceedsSellMicro(qMicro, bMicro, k, s);
  if (finalProceeds < targetProceedsMicro) {
    const up = (s * 101n) / 100n; // +1%
    const bumped = netProceedsSellMicro(qMicro, bMicro, k, up);
    s = bumped >= targetProceedsMicro ? up : s;
  }
  return s;
}
