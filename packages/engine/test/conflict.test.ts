import { describe, it, expect } from "vitest";
import { resolveConflict } from "../src/conflict.js";
import { Rng } from "../src/rng.js";

function rng() {
  return new Rng(12345n);
}

describe("conflict resolution (§14 / [D-017])", () => {
  it("A==0 always fails", () => {
    const r = resolveConflict(rng(), { attackerInvestment: 0, defenderInvestment: 3 });
    expect(r.success).toBe(false);
    expect(r.deterministic).toBe(true);
  });

  it("no defense -> attacker succeeds deterministically", () => {
    const r = resolveConflict(rng(), { attackerInvestment: 2, defenderInvestment: 0 });
    expect(r.success).toBe(true);
    expect(r.deterministic).toBe(true);
    expect(r.ratio).toBe(1);
  });

  it("large differential is deterministic (A>>D succeeds)", () => {
    // A=5, D=1 -> |4| >= 0.5*5=2.5 -> deterministic, A>D
    const r = resolveConflict(rng(), { attackerInvestment: 5, defenderInvestment: 1 });
    expect(r.deterministic).toBe(true);
    expect(r.success).toBe(true);
  });

  it("large differential is deterministic (D>>A fails)", () => {
    const r = resolveConflict(rng(), { attackerInvestment: 1, defenderInvestment: 5 });
    expect(r.deterministic).toBe(true);
    expect(r.success).toBe(false);
  });

  it("close differential uses the seeded stream", () => {
    // A=3, D=2 -> |1| < 0.5*3=1.5 -> close, ratio 0.6
    const r = resolveConflict(rng(), { attackerInvestment: 3, defenderInvestment: 2 });
    expect(r.deterministic).toBe(false);
    expect(r.ratio).toBeCloseTo(0.6, 5);
  });

  it("auto-defend forces attacker failure regardless of investment", () => {
    const r = resolveConflict(rng(), {
      attackerInvestment: 100,
      defenderInvestment: 0,
      defenderAutoDefend: true,
    });
    expect(r.success).toBe(false);
    expect(r.deterministic).toBe(true);
  });

  it("close case is reproducible for the same seed", () => {
    const a = resolveConflict(new Rng(1n), { attackerInvestment: 3, defenderInvestment: 2 });
    const b = resolveConflict(new Rng(1n), { attackerInvestment: 3, defenderInvestment: 2 });
    expect(a.success).toBe(b.success);
  });
});
