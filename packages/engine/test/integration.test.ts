import { describe, it, expect } from "vitest";
import { resolveTurn } from "../src/resolveTurn.js";
import { makeTestGame } from "./fixtures.js";
import { cr, toCr } from "../src/money.js";
import type { Submission } from "../src/orders.js";

/**
 * Full multi-phase integration: garrison -> production -> building action ->
 * unit construction -> corporate action -> event -> reporting, across 2 turns.
 */
describe("full turn integration (§16 all phases)", () => {
  it("resolves a rich turn and produces a complete turn log", () => {
    const game = makeTestGame();
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [
        { unitId: 6, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 7, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 8, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 1, target: { kind: "BUILDING", buildingId: 3 } },
        { unitId: 2, target: { kind: "BUILDING", buildingId: 3 } },
        { unitId: 3, target: { kind: "BUILDING", buildingId: 4 } },
        { unitId: 4, target: { kind: "BUILDING", buildingId: 4 } },
        { unitId: 5, target: { kind: "BUILDING", buildingId: 4 } },
      ],
      buildingActions: [
        // HQ claims a new hex (territory).
        { buildingId: 1, action: "TERRITORIAL_CLAIM", params: { targetHex: { col: 2, row: 3 } } },
      ],
      unitActions: [
        // Available engineer (unit 9) constructs a Power Facility.
        {
          unitId: 9,
          action: "CONSTRUCT_BUILDING",
          targetHex: { col: 1, row: 2 },
          params: { buildingType: "POWER_FACILITY" },
        },
      ],
      corporateActions: [{ action: "CORPORATE_AUDIT", params: { targetSubdivisionId: 2 } }],
      politicalAction: { action: "PUBLIC_STATEMENT", params: { text: "hello colony" } },
    };
    const beta: Submission = {
      subdivisionId: 2, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [],
    };

    const { newState, turnLog } = resolveTurn(game, [alpha, beta]);

    // Turn advanced.
    expect(newState.turnNumber).toBe(2);

    // Scoreboard: both active subdivisions ranked 1 and 2.
    expect(turnLog.scoreboard).toHaveLength(2);
    expect(turnLog.scoreboard.map((s) => s.rank).sort()).toEqual([1, 2]);

    // Event field always present.
    expect(turnLog.event).toBeDefined();
    expect(["NONE", "COLONY", "REGIONAL", "SUBDIVISION"]).toContain(turnLog.event!.scope);

    // Category leaders present.
    expect(turnLog.categoryLeaders.economic).toBeTypeOf("number");

    // Territorial claim registered (col2,row3 now owned by Alpha).
    const claimed = newState.map.find((h) => h.coord.col === 2 && h.coord.row === 3);
    expect(claimed?.ownerSubdivisionId).toBe(1);

    // Power Facility constructed as PENDING.
    const a = newState.subdivisions.find((s) => s.id === 1)!;
    const pf = a.buildings.find((b) => b.type === "POWER_FACILITY");
    expect(pf).toBeDefined();
    expect(pf!.status).toBe("PENDING");

    // Corporate Audit cost 4 Cr was charged (log entry present).
    expect(turnLog.entries.some((e) => e.code === "CORPORATE_AUDIT")).toBe(true);
    expect(turnLog.entries.some((e) => e.code === "TERRITORIAL_CLAIM")).toBe(true);
    expect(turnLog.entries.some((e) => e.code === "CONSTRUCT_BUILDING")).toBe(true);
  });

  it("PENDING buildings activate at the start of the next turn ([D-022]/[D-038])", () => {
    const game = makeTestGame();
    const alpha: Submission = {
      subdivisionId: 1, turnNumber: 1,
      garrison: [
        { unitId: 6, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 7, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 8, target: { kind: "BUILDING", buildingId: 1 } },
      ],
      buildingActions: [],
      unitActions: [
        { unitId: 9, action: "CONSTRUCT_BUILDING", targetHex: { col: 1, row: 2 }, params: { buildingType: "POWER_FACILITY" } },
      ],
    };
    const r1 = resolveTurn(game, [alpha]);
    const pfId = r1.newState.subdivisions[0]!.buildings.find((b) => b.type === "POWER_FACILITY")!.id;
    expect(r1.newState.subdivisions[0]!.buildings.find((b) => b.id === pfId)!.status).toBe("PENDING");

    // Turn 2: no orders; activation happens at start of processing.
    const r2 = resolveTurn(r1.newState, []);
    const pf2 = r2.newState.subdivisions[0]!.buildings.find((b) => b.id === pfId)!;
    expect(pf2.status).toBe("ACTIVE");
  });

  it("Market Sale routes to Earth at live x 0.80 and accrues market flow", () => {
    const game = makeTestGame();
    // Give Alpha a Transit Hub building (id assigned next).
    const alpha = game.subdivisions[0]!;
    const thId = game.nextIds.building++;
    alpha.buildings.push({
      id: thId, type: "TRANSIT_HUB", tier: "T1", hex: { col: 2, row: 2 },
      status: "ACTIVE", builtOnTurn: 0, modules: [], garrison: { ENGINEER: 2, ADMINISTRATOR: 1 },
      disabledUntilTurn: 0, dormantTurns: 0,
    });
    alpha.resources.MINERALS = 50;
    const startCredits = alpha.resources.CREDITS;

    const sub: Submission = {
      subdivisionId: 1, turnNumber: 1,
      garrison: [
        // Staff the Transit Hub so it is operational.
        { unitId: 1, target: { kind: "BUILDING", buildingId: thId } },
        { unitId: 2, target: { kind: "BUILDING", buildingId: thId } },
        { unitId: 6, target: { kind: "BUILDING", buildingId: thId } },
      ],
      buildingActions: [
        { buildingId: thId, action: "MARKET_SALE", params: { resource: "MINERALS", quantity: 10 } },
      ],
      unitActions: [],
    };
    const { newState, turnLog } = resolveTurn(game, [sub]);
    // 10 Minerals sold at 0.50 * 0.80 = 0.40 each -> 4 Cr.
    expect(turnLog.entries.some((e) => e.code === "MARKET_SALE")).toBe(true);
    // Market recorded sold flow this turn then rolled to cumulative in Phase 8.
    expect(newState.market.cumulativeSold.MINERALS).toBe(10);
    // Price dropped from selling 10 (net -10).
    expect(newState.market.livePrice.MINERALS).toBeLessThan(cr(0.5));
    const a = newState.subdivisions.find((s) => s.id === 1)!;
    expect(a.cum.resourcesSoldUnits).toBe(10);
    expect(toCr(a.cum.creditsEarnedFromSales)).toBeCloseTo(4, 5);
    void startCredits;
  });
});
