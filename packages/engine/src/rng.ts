/**
 * Deterministic seeded RNG for Red Planet Corporate. [D-016] / GAME_SPEC §15.
 *
 * Seeding:  turnSeed = SplitMix64(gameSeed XOR (turnNumber * 0x9E3779B97F4A7C15))
 * Stream:   xoshiro256** initialised from four SplitMix64 outputs.
 *
 * All arithmetic is done with BigInt masked to 64 bits so results are identical
 * on every platform. NEVER use Math.random() anywhere in the engine.
 */

const MASK64 = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;

function u64(x: bigint): bigint {
  return x & MASK64;
}

function rotl(x: bigint, k: bigint): bigint {
  return u64((x << k) | (x >> (64n - k)));
}

/** SplitMix64 — advances `state` and returns a 64-bit output. */
function splitmix64(state: bigint): { value: bigint; state: bigint } {
  let z = u64(state + GOLDEN);
  const next = z;
  z = u64((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
  z = u64((z ^ (z >> 27n)) * 0x94d049bb133111ebn);
  z = z ^ (z >> 31n);
  return { value: u64(z), state: next };
}

/**
 * The single per-turn random stream. Construct once per turn via
 * {@link makeTurnRng} and consume in the canonical order defined by §15.
 */
export class Rng {
  private s0: bigint;
  private s1: bigint;
  private s2: bigint;
  private s3: bigint;
  private drawCount = 0;

  constructor(seed: bigint) {
    // Seed xoshiro256** state from SplitMix64 outputs (recommended init).
    let sm = u64(seed);
    const a = splitmix64(sm);
    this.s0 = a.value;
    sm = a.state;
    const b = splitmix64(sm);
    this.s1 = b.value;
    sm = b.state;
    const c = splitmix64(sm);
    this.s2 = c.value;
    sm = c.state;
    const d = splitmix64(sm);
    this.s3 = d.value;
  }

  /** Number of raw draws consumed so far (useful for tests / audit). */
  get draws(): number {
    return this.drawCount;
  }

  /** Raw 64-bit draw from xoshiro256**. */
  nextU64(): bigint {
    const result = u64(rotl(u64(this.s1 * 5n), 7n) * 9n);

    const t = u64(this.s1 << 17n);
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 45n);

    this.drawCount++;
    return result;
  }

  /** Float in [0, 1) with 53 bits of entropy. */
  nextFloat(): number {
    // Top 53 bits -> [0,1). Matches the standard xoshiro double conversion.
    const bits = this.nextU64() >> 11n;
    return Number(bits) / 9007199254740992; // 2^53
  }

  /** Integer in [0, n) via rejection sampling (unbiased, deterministic). */
  nextInt(n: number): number {
    if (n <= 0) throw new Error(`Rng.nextInt requires n > 0, got ${n}`);
    const N = BigInt(n);
    // Rejection threshold to remove modulo bias.
    const limit = MASK64 - (MASK64 % N);
    let x = this.nextU64();
    while (x > limit) {
      x = this.nextU64();
    }
    return Number(x % N);
  }

  /** Percent roll: returns an integer in [0, 100). `chance` (0..100) succeeds if roll < chance. */
  percentSuccess(chance: number): boolean {
    const roll = this.nextInt(100);
    return roll < chance;
  }
}

/** Derive the per-turn seed and construct the turn stream. §15 / [D-016]. */
export function makeTurnRng(gameSeed: bigint, turnNumber: number): Rng {
  const mixedInput = u64(u64(gameSeed) ^ u64(BigInt(turnNumber) * GOLDEN));
  const { value: turnSeed } = splitmix64(mixedInput);
  return new Rng(turnSeed);
}

export { u64, splitmix64 };
