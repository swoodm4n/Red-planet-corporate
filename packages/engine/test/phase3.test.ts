import { describe, it, expect } from "vitest";
import { resolveTurn } from "../src/resolveTurn.js";
import { makeTestGame } from "./fixtures.js";
import { cr, toCr } from "../src/money.js";
import type { Submission } from "../src/orders.js";

/**
 * Alpha (UNIFIED_MINING perk A): buildings HQ(1), Habitat(2), Bio(3),
 * Extraction(4). Personnel ids 1-5 & 9-10 Engineer, 6-7 Administrator, 8 Contractor.
 */
function alphaGarrison(): Submission {
  return {
    subdivisionId: 1,
    turnNumber: 1,
    garrison: [
      { unitId: 6, target: { kind: "BUILDING", buildingId: 1 } }, // HQ admin
      { unitId: 7, target: { kind: "BUILDING", buildingId: 1 } }, // HQ admin
      { unitId: 8, target: { kind: "BUILDING", buildingId: 1 } }, // HQ contractor
      { unitId: 1, target: { kind: "BUILDING", buildingId: 3 } }, // Bio eng
      { unitId: 2, target: { kind: "BUILDING", buildingId: 3 } }, // Bio eng
      { unitId: 3, target: { kind: "BUILDING", buildingId: 4 } }, // Extraction eng
      { unitId: 4, target: { kind: "BUILDING", buildingId: 4 } }, // Extraction eng
      { unitId: 5, target: { kind: "BUILDING", buildingId: 4 } }, // Extraction eng
    ],
    buildingActions: [],
    unitActions: [],
  };
}

describe("Phase 3 passive systems (§16 / [D-004],[D-008],[D-009],[D-013])", () => {
  it("applies subsidy, production, income, and upkeep deterministically", () => {
    const game = makeTestGame();
    const { newState } = resolveTurn(game, [alphaGarrison()]);
    const alpha = newState.subdivisions.find((s) => s.id === 1)!;

    // Expected end-of-turn stockpiles (see phase3 derivation in tests).
    expect(alpha.resources.ENERGY).toBe(20);
    expect(alpha.resources.MINERALS).toBe(44);
    expect(alpha.resources.WATER).toBe(16);
    expect(alpha.resources.FOOD).toBe(18);
    expect(toCr(alpha.resources.CREDITS)).toBe(38);
    // No starvation: all 10 units survive.
    expect(alpha.personnel.filter((p) => p.status !== "LOST").length).toBe(10);
  });

  it("does not mutate the input game (immutability)", () => {
    const game = makeTestGame();
    const beforeMin = game.subdivisions[0]!.resources.MINERALS;
    resolveTurn(game, [alphaGarrison()]);
    expect(game.subdivisions[0]!.resources.MINERALS).toBe(beforeMin);
    expect(game.turnNumber).toBe(1); // input turn unchanged
  });

  it("is byte-for-byte reproducible for identical inputs + seed", () => {
    const g1 = makeTestGame();
    const g2 = makeTestGame();
    const a = resolveTurn(g1, [alphaGarrison()]);
    const b = resolveTurn(g2, [alphaGarrison()]);
    const norm = (s: any) =>
      JSON.stringify(s.newState.subdivisions.map((x: any) => x.resources)) ;
    expect(norm(a)).toEqual(norm(b));
    expect(a.newState.turnNumber).toBe(2);
  });

  it("without garrison, HQ is not operational so no subsidy is applied", () => {
    const game = makeTestGame();
    const empty: Submission = {
      subdivisionId: 1, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [],
    };
    const { newState } = resolveTurn(game, [empty]);
    const alpha = newState.subdivisions.find((s) => s.id === 1)!;
    // Energy started 20; no subsidy (+5) since HQ ungarrisoned; only upkeep drains.
    expect(alpha.resources.ENERGY).toBeLessThan(20);
  });

  it("starves units when Food/Water cannot cover upkeep", () => {
    const game = makeTestGame();
    const alpha = game.subdivisions[0]!;
    alpha.resources.FOOD = 0;
    alpha.resources.WATER = 0;
    // No garrison so no subsidy/production replenishes F/W.
    const empty: Submission = {
      subdivisionId: 1, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [],
    };
    const { newState } = resolveTurn(game, [empty]);
    const a = newState.subdivisions.find((s) => s.id === 1)!;
    expect(a.personnel.filter((p) => p.status === "LOST").length).toBeGreaterThan(0);
  });
});
