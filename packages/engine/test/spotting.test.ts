/**
 * Closed-border spotting of *units* (§14.4 / [D-028]). actions.test.ts covers
 * vehicle-move spotting; this file covers an Analyst crossing a rival's closed
 * border to Sabotage, and the capture outcome / chance formula.
 */

import { describe, it, expect } from "vitest";
import { resolveTurn } from "../src/resolveTurn.js";
import { makeTestGame } from "./fixtures.js";
import type { Game, Module, Personnel } from "../src/types.js";
import type { Submission } from "../src/orders.js";

function fort(): Module {
  return { id: 1, type: "FORTIFICATION", status: "ACTIVE" };
}

function provision(game: Game): Game {
  for (const s of game.subdivisions) {
    s.resources.FOOD = 200;
    s.resources.WATER = 200;
    s.resources.ENERGY = 200;
    s.resources.RESEARCH = 200;
  }
  return game;
}

function injectAnalyst(game: Game, subId: number, id: number): void {
  const sub = game.subdivisions.find((s) => s.id === subId)!;
  const p: Personnel = { id, type: "ANALYST", status: "AVAILABLE", unavailableUntilTurn: 0 };
  sub.personnel.push(p);
}

const emptyFor = (subId: number): Submission => ({
  subdivisionId: subId, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [],
});

describe("unit spotting on closed-border crossing (§14.4 / [D-028])", () => {
  it("an Analyst is CAPTURED crossing a border fortified enough to force a 100% spot", () => {
    const game = provision(makeTestGame());
    const beta = game.subdivisions[1]!;
    beta.closedBordersAgainst.add(1); // Beta closes borders against Alpha
    // 10 Fortifications on Beta HQ (building 5): 20 + 10*10 - 10(analyst) -> clamps to 100%.
    beta.buildings.find((b) => b.id === 5)!.modules = Array.from({ length: 10 }, fort);
    injectAnalyst(game, 1, 100); // Alpha attacker

    const alpha: Submission = {
      subdivisionId: 1, turnNumber: 1, garrison: [], buildingActions: [],
      unitActions: [{ unitId: 100, action: "SABOTAGE", targetSubdivisionId: 2, targetBuildingId: 5 }],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);

    // Captured: removed from Alpha, added to Beta's captured roster, sabotage cancelled.
    expect(turnLog.entries.some((e) => e.code === "SPOTTED_CAPTURED")).toBe(true);
    const a = newState.subdivisions.find((s) => s.id === 1)!;
    const b = newState.subdivisions.find((s) => s.id === 2)!;
    expect(a.personnel.some((p) => p.id === 100)).toBe(false);
    expect(b.capturedUnits.some((p) => p.id === 100)).toBe(true);
    // The sabotage did NOT land (building not disabled).
    expect(b.buildings.find((x) => x.id === 5)!.disabledUntilTurn).toBe(0);
  });

  it("no spotting roll happens when the target subdivision has open borders", () => {
    const game = provision(makeTestGame());
    const beta = game.subdivisions[1]!;
    // No closed border. Heavy fortification would spot, but borders are open.
    beta.buildings.find((b) => b.id === 5)!.modules = Array.from({ length: 10 }, fort);
    injectAnalyst(game, 1, 100);

    const alpha: Submission = {
      subdivisionId: 1, turnNumber: 1, garrison: [], buildingActions: [],
      unitActions: [{ unitId: 100, action: "SABOTAGE", targetSubdivisionId: 2, targetBuildingId: 5 }],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);

    // Not captured — the unit remains with Alpha (the sabotage simply resolves vs defense).
    expect(turnLog.entries.some((e) => e.code === "SPOTTED_CAPTURED")).toBe(false);
    const a = newState.subdivisions.find((s) => s.id === 1)!;
    expect(a.personnel.some((p) => p.id === 100)).toBe(true);
  });
});
