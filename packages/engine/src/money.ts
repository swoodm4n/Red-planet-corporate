/**
 * Fixed-point money. [D-002] / GAME_SPEC invariants.
 *
 * Credits, prices, dividends, and ER deltas are stored internally as integers in
 * units of 0.0001 Cr ("micro-credits", but scaled to 1/10000). We call this unit
 * a "fp" (fixed-point) value. Display rounds to 2 decimals, round-half-up.
 */

export const FP_SCALE = 10000; // 1 Cr == 10000 fp
export type Fp = number; // integer number of 0.0001-Cr units

/** Convert a whole-or-fractional Cr amount to fixed-point. */
export function cr(amount: number): Fp {
  return Math.round(amount * FP_SCALE);
}

/** Convert fixed-point back to a Cr number (may be fractional). */
export function toCr(fp: Fp): number {
  return fp / FP_SCALE;
}

/**
 * Multiply a fixed-point value by a real-valued factor, rounding half-up to the
 * nearest fp unit. Round-half-up per [D-002].
 */
export function fpMul(value: Fp, factor: number): Fp {
  return roundHalfUp(value * factor);
}

/** Round-half-up to nearest integer (0.5 -> 1, -0.5 -> 0). [D-002] */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** Round a fixed-point value to 2-decimal display Cr (round-half-up). */
export function displayCr(fp: Fp): number {
  // 100 fp == 0.01 Cr. Round to nearest 100 fp, half-up, then scale.
  const hundredths = roundHalfUp(fp / 100);
  return hundredths / 100;
}

/** Clamp a fixed-point value to a [min,max] range. */
export function clampFp(value: Fp, min: Fp, max: Fp): Fp {
  return value < min ? min : value > max ? max : value;
}
