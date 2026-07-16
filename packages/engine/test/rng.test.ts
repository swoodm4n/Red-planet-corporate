import { describe, it, expect } from "vitest";
import { Rng, makeTurnRng } from "../src/rng.js";

describe("Rng determinism", () => {
  it("produces identical streams for the same seed", () => {
    const a = new Rng(123n);
    const b = new Rng(123n);
    const seqA = Array.from({ length: 20 }, () => a.nextU64().toString());
    const seqB = Array.from({ length: 20 }, () => b.nextU64().toString());
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = new Rng(1n);
    const b = new Rng(2n);
    expect(a.nextU64()).not.toEqual(b.nextU64());
  });

  it("makeTurnRng is deterministic per (gameSeed, turnNumber)", () => {
    const r1 = makeTurnRng(0xdeadbeefn, 5);
    const r2 = makeTurnRng(0xdeadbeefn, 5);
    const r3 = makeTurnRng(0xdeadbeefn, 6);
    expect(r1.nextFloat()).toEqual(r2.nextFloat());
    // Very unlikely to collide across turns.
    expect(makeTurnRng(0xdeadbeefn, 5).nextFloat()).not.toEqual(
      r3.nextFloat(),
    );
  });

  it("nextFloat is within [0,1)", () => {
    const r = new Rng(999n);
    for (let i = 0; i < 1000; i++) {
      const f = r.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("nextInt(n) is within [0,n) and reasonably uniform", () => {
    const r = new Rng(42n);
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 6000; i++) {
      const v = r.nextInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      counts[v]++;
    }
    for (const c of counts) {
      // Each bucket ~1000; allow generous tolerance.
      expect(c).toBeGreaterThan(700);
      expect(c).toBeLessThan(1300);
    }
  });

  it("percentSuccess(0) never succeeds and (100) always", () => {
    const r = new Rng(7n);
    for (let i = 0; i < 100; i++) {
      expect(r.percentSuccess(0)).toBe(false);
    }
    for (let i = 0; i < 100; i++) {
      expect(r.percentSuccess(100)).toBe(true);
    }
  });
});
