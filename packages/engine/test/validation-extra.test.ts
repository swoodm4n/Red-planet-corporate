/**
 * Additional Phase 2 order-validation coverage (§16 / [D-021], [D-022], [D-037]).
 * Extends validation.test.ts (which covers missing entities, over-sell, Appeal@ER0,
 * corporate-action cap) with operational gating, building-type mismatches, terrain
 * and module-allowed-on rejections, and garrison-surplus requirements.
 */

import { describe, it, expect } from "vitest";
import { resolveTurn } from "../src/resolveTurn.js";
import { makeTestGame } from "./fixtures.js";
import type { Game } from "../src/types.js";
import type { Submission } from "../src/orders.js";

function base(sub: number): Submission {
  return { subdivisionId: sub, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [] };
}

/** Fully staff Alpha's HQ (2 Admin + 1 Contractor: units 6,7,8) to make it operational. */
function hqGarrison(): Submission["garrison"] {
  return [
    { unitId: 6, target: { kind: "BUILDING", buildingId: 1 } },
    { unitId: 7, target: { kind: "BUILDING", buildingId: 1 } },
    { unitId: 8, target: { kind: "BUILDING", buildingId: 1 } },
  ];
}

describe("Phase 2 validation — extra edge cases", () => {
  it("rejects a building action on a non-operational (ungarrisoned) building", () => {
    const game = makeTestGame();
    // Extraction Site (building 4) is ungarrisoned -> not operational -> cannot act.
    const sub: Submission = {
      ...base(1),
      buildingActions: [{ buildingId: 4, action: "BOOST_OUTPUT" }],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(
      turnLog.invalidOrders.some((o) => o.kind === "BUILDING" && /not operational/.test(o.reason)),
    ).toBe(true);
  });

  it("rejects Boost Output without a second (surplus) labor garrison set", () => {
    const game = makeTestGame();
    // Bio (building 3) needs ENGINEER:2; staff exactly one set (units 1,2) -> operational,
    // but no surplus set, so Boost Output is invalid.
    const sub: Submission = {
      ...base(1),
      garrison: [
        { unitId: 1, target: { kind: "BUILDING", buildingId: 3 } },
        { unitId: 2, target: { kind: "BUILDING", buildingId: 3 } },
      ],
      buildingActions: [{ buildingId: 3, action: "BOOST_OUTPUT" }],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(
      turnLog.invalidOrders.some((o) => o.kind === "BUILDING" && /surplus garrison set/.test(o.reason)),
    ).toBe(true);
  });

  it("rejects Market Sale on a building that is not a Transit Hub", () => {
    const game = makeTestGame();
    const sub: Submission = {
      ...base(1),
      garrison: hqGarrison(),
      // HQ (operational) is not a Transit Hub.
      buildingActions: [{ buildingId: 1, action: "MARKET_SALE", params: { resource: "MINERALS", quantity: 5 } }],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(
      turnLog.invalidOrders.some((o) => o.kind === "BUILDING" && /requires Transit Hub/.test(o.reason)),
    ).toBe(true);
  });

  it("rejects Colonist Requisition / Territorial Claim issued from a non-HQ building", () => {
    const game = makeTestGame();
    const sub: Submission = {
      ...base(1),
      garrison: [
        { unitId: 1, target: { kind: "BUILDING", buildingId: 3 } },
        { unitId: 2, target: { kind: "BUILDING", buildingId: 3 } },
      ],
      buildingActions: [
        { buildingId: 3, action: "COLONIST_REQUISITION", params: { colonistCount: 2 } },
        { buildingId: 3, action: "TERRITORIAL_CLAIM", params: { targetHex: { col: 2, row: 3 } } },
      ],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(turnLog.invalidOrders.filter((o) => o.kind === "BUILDING").length).toBeGreaterThanOrEqual(2);
    expect(turnLog.invalidOrders.some((o) => /requires HQ/.test(o.reason))).toBe(true);
  });

  it("rejects construction on the Landing Zone hex", () => {
    const game = makeTestGame(); // LZ at (6,4)
    const sub: Submission = {
      ...base(1),
      unitActions: [
        { unitId: 9, action: "CONSTRUCT_BUILDING", targetHex: { col: 6, row: 4 }, params: { buildingType: "POWER_FACILITY" } },
      ],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(
      turnLog.invalidOrders.some((o) => o.kind === "UNIT" && /cannot build on this hex/.test(o.reason)),
    ).toBe(true);
  });

  it("rejects Install Module for a module not allowed on the target building type", () => {
    const game = makeTestGame();
    // GLOBAL_CONTRIBUTION is Bio-only; installing on HQ (building 1) is invalid.
    const sub: Submission = {
      ...base(1),
      unitActions: [
        { unitId: 9, action: "INSTALL_MODULE", targetBuildingId: 1, params: { moduleType: "GLOBAL_CONTRIBUTION" } },
      ],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(
      turnLog.invalidOrders.some((o) => o.kind === "UNIT" && /not allowed on/.test(o.reason)),
    ).toBe(true);
  });

  it("rejects a unit action from a garrisoned (non-AVAILABLE) unit [D-037]", () => {
    const game: Game = makeTestGame();
    // Unit 1 is garrisoned into Bio AND asked to Survey — a garrisoned unit cannot act.
    const sub: Submission = {
      ...base(1),
      garrison: [
        { unitId: 1, target: { kind: "BUILDING", buildingId: 3 } },
        { unitId: 2, target: { kind: "BUILDING", buildingId: 3 } },
      ],
      unitActions: [{ unitId: 1, action: "SURVEY_HEX", targetHex: { col: 2, row: 3 } }],
    };
    const { turnLog } = resolveTurn(game, [sub]);
    expect(
      turnLog.invalidOrders.some((o) => o.kind === "UNIT" && /not available/.test(o.reason)),
    ).toBe(true);
  });
});
