import { describe, it, expect } from "vitest";
import { resolveTurn } from "../src/resolveTurn.js";
import { makeTestGame } from "./fixtures.js";
import type { Submission } from "../src/orders.js";

describe("Phase 2 validation (§16 / [D-021])", () => {
  it("drops orders referencing non-existent units/buildings", () => {
    const game = makeTestGame();
    const sub: Submission = {
      subdivisionId: 1, turnNumber: 1,
      garrison: [{ unitId: 999, target: { kind: "BUILDING", buildingId: 1 } }],
      buildingActions: [{ buildingId: 999, action: "BOOST_OUTPUT" }],
      unitActions: [{ unitId: 999, action: "SURVEY_HEX", targetHex: { col: 1, row: 1 } }],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(turnLog.invalidOrders.length).toBeGreaterThanOrEqual(3);
    const kinds = turnLog.invalidOrders.map((o) => o.kind);
    expect(kinds).toContain("GARRISON");
    expect(kinds).toContain("BUILDING");
    expect(kinds).toContain("UNIT");
  });

  it("rejects a Market Sale exceeding held resources", () => {
    const game = makeTestGame();
    // Give Alpha a Transit Hub so the action type check passes, but sell too much.
    const sub: Submission = {
      subdivisionId: 1, turnNumber: 1, garrison: [],
      buildingActions: [
        { buildingId: 1, action: "MARKET_SALE", params: { resource: "MINERALS", quantity: 9999 } },
      ],
      unitActions: [],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(turnLog.invalidOrders.some((o) => o.kind === "BUILDING")).toBe(true);
  });

  it("rejects Appeal to Earth at ER 0", () => {
    const game = makeTestGame();
    game.subdivisions[0]!.earthRelations = 0;
    const sub: Submission = {
      subdivisionId: 1, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [],
      politicalAction: { action: "APPEAL_TO_EARTH", params: { resource: "FOOD" } },
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(turnLog.invalidOrders.some((o) => o.kind === "POLITICAL")).toBe(true);
  });

  it("caps corporate actions at 1 unless ER==30", () => {
    const game = makeTestGame();
    const sub: Submission = {
      subdivisionId: 1, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [],
      corporateActions: [
        { action: "CORPORATE_AUDIT" },
        { action: "CORPORATE_AUDIT" },
      ],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(turnLog.invalidOrders.some((o) => o.kind === "CORPORATE")).toBe(true);
  });

  it("allows 2 corporate actions when ER==30", () => {
    const game = makeTestGame();
    game.subdivisions[0]!.earthRelations = 30;
    game.subdivisions[0]!.resources.CREDITS = 1000000;
    const sub: Submission = {
      subdivisionId: 1, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [],
      corporateActions: [
        { action: "CORPORATE_AUDIT" },
        { action: "CORPORATE_AUDIT" },
      ],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(turnLog.invalidOrders.some((o) => o.kind === "CORPORATE")).toBe(false);
  });
});
