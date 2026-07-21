import { describe, it, expect } from "vitest";
import { makeTestGame } from "./fixtures.js";
import {
  addEffect,
  tickEffects,
  outputDeltaFor,
  moduleHalved,
  noIntelligenceActive,
  terrainExploitSuspended,
} from "../src/effects.js";
import { computePassiveOutput } from "../src/output.js";
import { resolveTurn } from "../src/resolveTurn.js";
import type { Building, Game, Module } from "../src/types.js";
import type { Submission } from "../src/orders.js";

function mkModule(type: Module["type"]): Module {
  return { id: 1, type, status: "ACTIVE" };
}

/** A staffed, prior-built Extraction Site (baseOutput 2, needs ENGINEER:3). */
function mkExtraction(overrides?: Partial<Building>): Building {
  return {
    id: 4,
    type: "EXTRACTION_SITE",
    tier: "T1",
    hex: { col: 2, row: 2 },
    status: "ACTIVE",
    builtOnTurn: 0,
    modules: [],
    garrison: { ENGINEER: 3 },
    disabledUntilTurn: 0,
    dormantTurns: 0,
    ...overrides,
  };
}

describe("durational status effects (§17 / [D-042])", () => {
  it("addEffect assigns an id and appends to game.activeEffects", () => {
    const game = makeTestGame();
    const e = addEffect(game, {
      type: "OUTPUT_DELTA",
      scope: "COLONY",
      source: "Test",
      magnitude: -1,
      turnsRemaining: 2,
      registeredTurn: game.turnNumber,
    });
    expect(e.id).toBeGreaterThan(0);
    expect(game.activeEffects).toHaveLength(1);
    expect(game.nextIds.effect).toBe(e.id + 1);
  });

  it("does not tick the effect on the turn it was registered, then counts down and expires", () => {
    const game = makeTestGame(); // turnNumber 1
    addEffect(game, {
      type: "OUTPUT_DELTA",
      scope: "COLONY",
      source: "Dust Storm",
      magnitude: -1,
      turnsRemaining: 2,
      registeredTurn: game.turnNumber,
    });

    // Phase 8 of the registration turn: no tick (registeredTurn === turnNumber).
    tickEffects(game);
    expect(game.activeEffects[0]!.turnsRemaining).toBe(2);

    // Advance to turn 2 and tick -> 1 remaining.
    game.turnNumber = 2;
    tickEffects(game);
    expect(game.activeEffects[0]!.turnsRemaining).toBe(1);

    // Turn 3 tick -> 0 remaining, effect removed.
    game.turnNumber = 3;
    tickEffects(game);
    expect(game.activeEffects).toHaveLength(0);
  });

  it("Dust Storm OUTPUT_DELTA reduces unshielded output but spares Hazard-Shield buildings", () => {
    const game = makeTestGame();
    addEffect(game, {
      type: "OUTPUT_DELTA",
      scope: "COLONY",
      source: "Dust Storm",
      magnitude: -1,
      requiresUnshielded: true,
      turnsRemaining: 2,
      registeredTurn: game.turnNumber,
    });

    const unshielded = mkExtraction();
    expect(outputDeltaFor(game, unshielded, 1)).toBe(-1);
    const out = computePassiveOutput(unshielded, game, 1);
    expect(out.amount).toBe(1); // base 2 - 1

    const shielded = mkExtraction({ modules: [mkModule("HAZARD_SHIELD")] });
    expect(outputDeltaFor(game, shielded, 1)).toBe(0);
    expect(computePassiveOutput(shielded, game, 1).amount).toBe(2);
  });

  it("MODULE_HALF_EFFECT (Equipment Recall) halves the named module's contribution", () => {
    const game = makeTestGame();
    addEffect(game, {
      type: "MODULE_HALF_EFFECT",
      scope: "COLONY",
      source: "Equipment Recall",
      moduleType: "EFFICIENCY",
      turnsRemaining: 1,
      registeredTurn: game.turnNumber,
    });
    const b = mkExtraction({ modules: [mkModule("EFFICIENCY"), mkModule("EFFICIENCY")] });
    expect(moduleHalved(game, b, 1, "EFFICIENCY")).toBe(true);
    // base 2 + floor(2 efficiency * 0.5 => 1) = 3
    expect(computePassiveOutput(b, game, 1).amount).toBe(3);
  });

  it("TERRAIN_EXPLOIT_SUSPEND flags apply by region scope", () => {
    const game = makeTestGame();
    const b = mkExtraction({ hex: { col: 5, row: 5 } });
    addEffect(game, {
      type: "TERRAIN_EXPLOIT_SUSPEND",
      scope: "REGION",
      source: "Ice Deposit Shift",
      hexes: [{ col: 5, row: 5 }],
      turnsRemaining: 1,
      registeredTurn: game.turnNumber,
    });
    expect(terrainExploitSuspended(game, b, 1)).toBe(true);
    const elsewhere = mkExtraction({ hex: { col: 1, row: 1 } });
    expect(terrainExploitSuspended(game, elsewhere, 1)).toBe(false);
  });

  it("NO_INTELLIGENCE (Solar Flare) blocks by scope", () => {
    const game = makeTestGame();
    expect(noIntelligenceActive(game, 1)).toBe(false);
    addEffect(game, {
      type: "NO_INTELLIGENCE",
      scope: "SUBDIVISION",
      subdivisionId: 1,
      source: "Solar Flare",
      turnsRemaining: 1,
      registeredTurn: game.turnNumber,
    });
    expect(noIntelligenceActive(game, 1)).toBe(true);
    expect(noIntelligenceActive(game, 2)).toBe(false);
  });
});

describe("Redundant Systems 50% output floor (§7.3 / [D-042])", () => {
  function gameAt(turn: number): Game {
    const g = makeTestGame();
    g.turnNumber = turn;
    return g;
  }

  it("disabled-this-turn building with Redundant Systems runs at 50% (floor), else 0", () => {
    const game = gameAt(2);
    const disabled = mkExtraction({ disabledUntilTurn: 2 }); // disabled this turn
    // Without Redundant Systems: fully disabled -> 0.
    expect(computePassiveOutput(disabled, game, 1).amount).toBe(0);

    // With Redundant Systems: floor(2 * 0.5) = 1.
    const redundant = mkExtraction({
      disabledUntilTurn: 2,
      modules: [mkModule("REDUNDANT_SYSTEMS")],
    });
    expect(computePassiveOutput(redundant, game, 1).amount).toBe(1);
  });

  it("floor also halves the building's Research-Link contribution", () => {
    const game = gameAt(2);
    const b: Building = {
      id: 9,
      type: "BIO_FACILITY", // baseOutput 2, primary FOOD, needs ENGINEER:2
      tier: "T1",
      hex: { col: 2, row: 2 },
      status: "ACTIVE",
      builtOnTurn: 0,
      modules: [
        mkModule("REDUNDANT_SYSTEMS"),
        mkModule("RESEARCH_LINK"),
        mkModule("RESEARCH_LINK"),
      ],
      garrison: { ENGINEER: 2 },
      disabledUntilTurn: 2,
      dormantTurns: 0,
    };
    const out = computePassiveOutput(b, game, 1);
    // 2 Research Links -> floor(2 * 0.5) = 1.
    expect(out.researchLinkBonus).toBe(1);
  });

  it("Phase 8 ticks a live effect once per resolved turn and expires it (end-to-end)", () => {
    const game = makeTestGame();
    // Seed a 2-turn effect registered before the current turn so it ticks in Phase 8.
    addEffect(game, {
      type: "OUTPUT_DELTA",
      scope: "COLONY",
      source: "Pre-seeded",
      magnitude: -1,
      turnsRemaining: 2,
      registeredTurn: 0,
    });
    const empty: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [],
    };

    const r1 = resolveTurn(game, [empty]);
    expect(r1.newState.activeEffects).toHaveLength(1);
    expect(r1.newState.activeEffects[0]!.turnsRemaining).toBe(1);

    const r2 = resolveTurn(r1.newState, [{ ...empty, turnNumber: 2 }]);
    expect(r2.newState.activeEffects).toHaveLength(0); // expired
  });

  it("garrison-unmet or built-this-turn buildings still yield 0 regardless of Redundant Systems", () => {
    const game = gameAt(2);
    const unstaffed = mkExtraction({
      garrison: {},
      modules: [mkModule("REDUNDANT_SYSTEMS")],
    });
    expect(computePassiveOutput(unstaffed, game, 1).amount).toBe(0);

    const builtThisTurn = mkExtraction({
      builtOnTurn: 2,
      modules: [mkModule("REDUNDANT_SYSTEMS")],
    });
    expect(computePassiveOutput(builtThisTurn, game, 1).amount).toBe(0);
  });
});
