// SPDX-License-Identifier: MIT

export enum EstimationMode {
  LowerBound,
  UpperBound,
  Midpoint,
}

export const ONE = 0x10000000000000000n;
export const LN2 = 0xb17217f7d1cf79acn;
export const LOG2_E = 0x171547652b82fe177n;

const MAX_POWER_POW2 = 3541774862152233910271n;
const MIN_POWER_POW2 = -1180591620717411303424n;

/**
 * Calculates bounds for 2^x, mimicking the Fixed192x64Math contract.
 * @param x The exponent in 192.64 fixed-point representation.
 * @returns A tuple containing the lower and upper bounds.
 */
export function pow2Bounds(x: bigint): [bigint, bigint] {
  if (x > MAX_POWER_POW2) {
    // Mimics: require(x <= MAX_POWER_POW2)
    throw new Error("pow2 input too large");
  }
  if (x < MIN_POWER_POW2) {
    return [0n, 1n];
  }

  // Separate x into integer and fractional parts
  let shift: bigint;
  let z: bigint;
  if (x >= 0) {
    shift = x / ONE;
    z = x % ONE;
  } else {
    shift = (x + 1n) / ONE - 1n;
    z = x - ONE * shift;
  }

  // The result is initialized with a scaling factor of 2^128
  let result = ONE << 64n;
  let zpow = z; // z is scaled by 2^64

  // Each term in the Taylor series is calculated and added to the result.
  // The coefficients from the contract are pre-shifted by a value `s`.
  // To match the result's scaling, we must right-shift each term by `s - 64`.

  // s = 64. shift = 64-64 = 0.
  result += 0xb17217f7d1cf79abn * zpow;
  zpow = (zpow * z) / ONE;

  // s = 66. shift = 66-64 = 2.
  result += (0xf5fdeffc162c7543n * zpow) >> 2n;
  zpow = (zpow * z) / ONE;

  // s = 68. shift = 68-64 = 4.
  result += (0xe35846b82505fc59n * zpow) >> 4n;
  zpow = (zpow * z) / ONE;

  // Continue for all terms with their respective shifts...
  result += (0x9d955b7dd273b94en * zpow) >> 6n;
  zpow = (zpow * z) / ONE;
  result += (0xaec3ff3c53398883n * zpow) >> 9n;
  zpow = (zpow * z) / ONE;
  result += (0xa184897c363c3b7an * zpow) >> 12n;
  zpow = (zpow * z) / ONE;
  result += (0xffe5fe2c45863435n * zpow) >> 16n;
  zpow = (zpow * z) / ONE;
  result += (0xb160111d2e411fecn * zpow) >> 19n;
  zpow = (zpow * z) / ONE;
  result += (0xda929e9caf3e1ed2n * zpow) >> 23n;
  zpow = (zpow * z) / ONE;
  result += (0xf267a8ac5c764fb7n * zpow) >> 27n;
  zpow = (zpow * z) / ONE;
  result += (0xf465639a8dd92607n * zpow) >> 31n;
  zpow = (zpow * z) / ONE;
  result += (0xe1deb287e14c2f15n * zpow) >> 35n;
  zpow = (zpow * z) / ONE;
  result += (0xc0b0c98b3687cb14n * zpow) >> 39n;
  zpow = (zpow * z) / ONE;
  result += (0x98a4b26ac3c54b9fn * zpow) >> 43n;
  zpow = (zpow * z) / ONE;
  result += (0xe1b7421d82010f33n * zpow) >> 48n;
  zpow = (zpow * z) / ONE;
  result += (0x9c744d73cfc59c91n * zpow) >> 52n;
  zpow = (zpow * z) / ONE;
  result += (0xcc2225a0e12d3eabn * zpow) >> 57n;
  zpow = (zpow * z) / ONE;
  result += (0xfb8bb5eda1b4aeb9n * zpow) >> 62n;

  // Apply the integer part of the exponent
  shift -= 64n;
  if (shift >= 0) {
    // Check for potential overflow before shifting
    if (result >> (256n - shift) !== 0n) {
      const maxUint256 = (1n << 256n) - 1n;
      return [maxUint256, maxUint256];
    }
    const lower = result << shift;
    // The error term from the contract is 8*ONE
    const errorTerm = 8n * ONE << shift;
    const upper = lower + errorTerm;
    // Handle overflow for the upper bound
    return [lower, upper > lower ? upper : (1n << 256n) - 1n];
  } else {
    const negativeShift = -shift;
    const lower = result >> negativeShift;
    // The error term from the contract is (8*ONE >> -shift) + 1
    const errorTerm = (8n * ONE >> negativeShift) + 1n;
    const upper = lower + errorTerm;
    return [lower, upper];
  }
}

/**
 * Calculates 2^x based on the estimation mode.
 * @param x The exponent in fixed-point representation.
 * @param estimationMode The estimation mode.
 * @returns The result of 2^x.
 */
export function pow2(x: bigint, estimationMode: EstimationMode): bigint {
  const [lower, upper] = pow2Bounds(x);
  if (estimationMode === EstimationMode.LowerBound) {
    return lower;
  }
  if (estimationMode === EstimationMode.UpperBound) {
    return upper;
  }
  return (upper - lower) / 2n + lower;
}

/**
 * Finds the integer part of the base-2 logarithm of a number.
 * @param x The number.
 * @returns The floor of log2(x).
 */
export function floorLog2(x: bigint): bigint {
  if (x === 0n) throw new Error("floorLog2 of 0 is undefined");
  let lo = -64n;
  let hi = 193n;
  while (lo + 1n < hi) {
    const mid = (hi + lo) >> 1n;
    const y = mid < 0 ? x << -mid : x >> mid;
    if (y < ONE) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return lo;
}

/**
 * Calculates the bounds for the base-2 logarithm.
 * @param x The input number.
 * @returns A tuple containing the lower and upper bounds of log2(x).
 */
export function log2Bounds(x: bigint): [bigint, bigint] {
  if (x <= 0n) {
    throw new Error("log2 input must be positive");
  }

  let lower = floorLog2(x);
  let y = lower < 0 ? x << -lower : x >> lower;
  lower *= ONE;

  for (let m = 1n; m <= 64n; m++) {
    if (y === ONE) {
      break;
    }
    y = (y * y) / ONE;
    if (y >= 2n * ONE) {
      lower += ONE >> m;
      y /= 2n;
    }
  }

  return [lower, lower + 4n];
}

/**
 * Calculates the base-2 logarithm.
 * @param x The input number.
 * @param estimationMode The estimation mode.
 * @returns The result of log2(x).
 */
export function binaryLog(x: bigint, estimationMode: EstimationMode): bigint {
    const [lower, upper] = log2Bounds(x);
    if (estimationMode === EstimationMode.LowerBound) {
        return lower;
    }
    if (estimationMode === EstimationMode.UpperBound) {
        return upper;
    }
    return (upper - lower) / 2n + lower;
}
