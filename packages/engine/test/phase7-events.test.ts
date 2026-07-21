/**
 * Phase 7 event *dispatch* coverage (§16, §17 / [D-016]). The existing
 * effects.test.ts exercises the effect helpers directly; this file drives the real
 * `runPhase7` with a scripted RNG to verify the trigger→scope→tone→event selection
 * pipeline and that colony/regional/subdivision events actually apply their effects.
 */

import { describe, it, expect } from "vitest";
import { makeTestGame } from "./fixtures.js";
import { runPhase7 } from "../src/phases/phase7.js";
import type { TurnContext } from "../src/context.js";
import type { Rng } from "../src/rng.js";
import type { Game } from "../src/types.js";

/**
 * Deterministic RNG stub: draws are popped from a scripted queue. `percentSuccess`
 * and `nextInt` both consume one value; this lets a test dictate the exact
 * trigger/scope/tone/event/sub-roll path §15 consumes.
 */
class ScriptedRng {
  private q: number[];
  constructor(seq: number[]) {
    this.q = [...seq];
  }
  nextInt(n: number): number {
    const v = this.q.shift() ?? 0;
    return ((v % n) + n) % n;
  }
  percentSuccess(chance: number): boolean {
    const roll = this.q.shift() ?? 100;
    return roll < chance;
  }
}

function ctxWith(game: Game, seq: number[], turn = 1): TurnContext {
  return {
    game,
    rng: new ScriptedRng(seq) as unknown as Rng,
    turnNumber: turn,
    log: [],
    invalidOrders: [],
    turnStartResources: new Map(),
    plan: [],
    attentionPicks: new Map(),
    scratch: {
      hubSalesThisTurn: new Map(),
      amplifyActive: new Set(),
      autoDefendBuildings: new Set(),
    },
  };
}

describe("Phase 7 event dispatch (§16/§17)", () => {
  it("no event fires when the 15% trigger roll fails", () => {
    const game = makeTestGame();
    const ctx = ctxWith(game, [50]); // 50 >= 15 -> no trigger
    const ev = runPhase7(ctx);
    expect(ev!.scope).toBe("NONE");
    expect(ev!.name).toBe("No Event");
  });

  it("scope roll boundaries map to COLONY / REGIONAL / SUBDIVISION (20/35/45)", () => {
    // trigger=ok, scope roll, tone=neutral(80), then a benign event number.
    const colony = runPhase7(ctxWith(makeTestGame(), [0, 19, 80, 5])); // <20 colony, ev6 Quiet Skies
    expect(colony!.scope).toBe("COLONY");
    const regional = runPhase7(ctxWith(makeTestGame(), [0, 54, 80, 4])); // <55 regional, ev5 tension
    expect(regional!.scope).toBe("REGIONAL");
    const sub = runPhase7(ctxWith(makeTestGame(), [0, 55, 80, 0, 4])); // >=55 subdivision, pick, ev5
    expect(sub!.scope).toBe("SUBDIVISION");
  });

  it("COLONY Atmospheric Breakthrough adds +1 Food per operational Bio Facility", () => {
    const game = makeTestGame();
    const alpha = game.subdivisions[0]!; // 1 Bio Facility
    const beta = game.subdivisions[1]!; // starting Bio + free Terra Bio = 2
    const aFood = alpha.resources.FOOD;
    const bFood = beta.resources.FOOD;
    const aBios = alpha.buildings.filter((b) => b.type === "BIO_FACILITY" && b.status === "ACTIVE").length;
    const bBios = beta.buildings.filter((b) => b.type === "BIO_FACILITY" && b.status === "ACTIVE").length;

    // trigger, scope<20 colony, tone, nextInt(8)=3 -> event 4 Atmospheric Breakthrough.
    const ctx = ctxWith(game, [0, 5, 50, 3]);
    const ev = runPhase7(ctx);
    expect(ev!.name).toBe("Atmospheric Breakthrough");
    expect(alpha.resources.FOOD).toBe(aFood + aBios);
    expect(beta.resources.FOOD).toBe(bFood + bBios);
  });

  it("COLONY Dust Storm registers a 2-turn unshielded OUTPUT_DELTA effect", () => {
    const game = makeTestGame();
    const ctx = ctxWith(game, [0, 5, 10, 0]); // event 1 Dust Storm
    const ev = runPhase7(ctx);
    expect(ev!.name).toBe("Dust Storm Season");
    expect(game.activeEffects).toHaveLength(1);
    const e = game.activeEffects[0]!;
    expect(e.type).toBe("OUTPUT_DELTA");
    expect(e.scope).toBe("COLONY");
    expect(e.requiresUnshielded).toBe(true);
    expect(e.turnsRemaining).toBe(2);
  });

  it("COLONY Micrometeorite disables a random unshielded building per rolled subdivision", () => {
    const game = makeTestGame();
    // trigger, colony, tone, event5, then per-sub: Alpha hit(0)+pick(0), Beta miss(99).
    const ctx = ctxWith(game, [0, 5, 10, 4, 0, 0, 99]);
    const ev = runPhase7(ctx);
    expect(ev!.name).toBe("Micrometeorite Shower");
    expect(ev!.affectedSubdivisionIds).toContain(1);
    expect(ev!.affectedSubdivisionIds).not.toContain(2);
    const alpha = game.subdivisions[0]!;
    const disabled = alpha.buildings.filter((b) => b.disabledUntilTurn === 2);
    expect(disabled).toHaveLength(1);
  });

  it("REGIONAL Equipment Cache grants 5 Min + 5 Cr to the focus-region owner", () => {
    const game = makeTestGame();
    const alpha = game.subdivisions[0]!; // HQ at (2,2) => lowest row-major claimed hex => focus
    const min0 = alpha.resources.MINERALS;
    const cr0 = alpha.resources.CREDITS;
    // trigger, scope 30 regional, tone, nextInt(6)=3 -> event 4 Equipment Cache.
    const ctx = ctxWith(game, [0, 30, 50, 3]);
    const ev = runPhase7(ctx);
    expect(ev!.name).toBe("Equipment Cache");
    expect(ev!.affectedSubdivisionIds).toEqual([1]);
    expect(alpha.resources.MINERALS).toBe(min0 + 5);
    expect(alpha.resources.CREDITS).toBe(cr0 + 50000); // +5 Cr in fixed-point
  });

  it("REGIONAL Seismic registers a region OUTPUT_DELTA that ignores Redundant Systems", () => {
    const game = makeTestGame();
    const ctx = ctxWith(game, [0, 30, 10, 2]); // event 3 Seismic
    const ev = runPhase7(ctx);
    expect(ev!.name).toBe("Seismic Event");
    const e = game.activeEffects.find((x) => x.source === "Seismic Event")!;
    expect(e.scope).toBe("REGION");
    expect(e.requiresNoRedundant).toBe(true);
    expect((e.hexes ?? []).length).toBeGreaterThan(0);
  });

  it("SUBDIVISION Earth's Favor raises the risk-weighted target's Earth Relations by 1", () => {
    const game = makeTestGame();
    const alpha = game.subdivisions[0]!;
    const er0 = alpha.earthRelations;
    // trigger, scope 70 subdivision, tone, pick=0 -> Alpha, nextInt(8)=7 -> event 8 Earth's Favor.
    const ctx = ctxWith(game, [0, 70, 50, 0, 7]);
    const ev = runPhase7(ctx);
    expect(ev!.name).toBe("Earth's Favor");
    expect(ev!.affectedSubdivisionIds).toEqual([1]);
    expect(alpha.earthRelations).toBe(er0 + 1);
  });

  it("SUBDIVISION Surplus Shipment adds +5 Minerals to the targeted subdivision", () => {
    const game = makeTestGame();
    const alpha = game.subdivisions[0]!;
    const min0 = alpha.resources.MINERALS;
    // pick=0 -> Alpha, nextInt(8)=2 -> event 3 Surplus Shipment.
    const ctx = ctxWith(game, [0, 70, 50, 0, 2]);
    const ev = runPhase7(ctx);
    expect(ev!.name).toBe("Surplus Shipment");
    expect(alpha.resources.MINERALS).toBe(min0 + 5);
  });
});
