/**
 * §22 Unit Attention economy & building available-action derivation.
 * Covers [D-056]–[D-063]: the deterministic lowest-id tie-break, the duplicate-unit
 * Phase-2 fix, garrison-assignment-does-not-spend, atomic multi-group / crew spend,
 * the Phase-8 reset, and the live `availableActions` predicate.
 */

import { describe, it, expect } from "vitest";
import { resolveTurn } from "../src/resolveTurn.js";
import { makeTestGame } from "./fixtures.js";
import { cr } from "../src/money.js";
import {
  availableActions,
  pickBuildingActionAttention,
  selectActorAttention,
  selectAttentionUnits,
  buildingActionGarrisonGroups,
} from "../src/attention.js";
import type { Submission } from "../src/orders.js";
import type { Building, Game, Personnel, Subdivision } from "../src/types.js";

// ---- helpers ---------------------------------------------------------------

function provision(game: Game): Game {
  for (const s of game.subdivisions) {
    s.resources.FOOD = 300;
    s.resources.WATER = 300;
    s.resources.ENERGY = 300;
    s.resources.RESEARCH = 300;
    s.resources.CREDITS = cr(500);
  }
  return game;
}

function emptyFor(subId: number): Submission {
  return { subdivisionId: subId, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [] };
}

function findB(sub: Subdivision, type: Building["type"]): Building {
  return sub.buildings.find((b) => b.type === type)!;
}

/** Station units into a building (state only — no attention spent). */
function garrisonInto(sub: Subdivision, b: Building, unitIds: number[]): void {
  for (const id of unitIds) {
    const p = sub.personnel.find((x) => x.id === id)!;
    p.status = "GARRISONED";
    p.assignedBuildingId = b.id;
    b.garrison[p.type] = (b.garrison[p.type] ?? 0) + 1;
  }
}

const mkP = (id: number, type: Personnel["type"], over: Partial<Personnel> = {}): Personnel => ({
  id,
  type,
  status: "GARRISONED",
  unavailableUntilTurn: 0,
  ...over,
});

// ---- selectAttentionUnits (pure, §22.3) ------------------------------------

describe("selectAttentionUnits — deterministic lowest-id tie-break ([D-057])", () => {
  it("picks the `count` lowest ids among unspent, eligible units", () => {
    const pool = [mkP(8, "ENGINEER"), mkP(2, "ENGINEER"), mkP(5, "ENGINEER")];
    expect(selectAttentionUnits(pool, "ENGINEER", 2, 1, new Set(), "GARRISONED")).toEqual([2, 5]);
  });

  it("FAILs (null) when fewer than `count` qualify", () => {
    const pool = [mkP(2, "ENGINEER"), mkP(5, "ENGINEER")];
    expect(selectAttentionUnits(pool, "ENGINEER", 3, 1, new Set(), "GARRISONED")).toBeNull();
  });

  it("excludes already-spent, claimed, unavailable, and wrong-status units", () => {
    const pool = [
      mkP(1, "ENGINEER", { attentionSpentThisTurn: true }),
      mkP(2, "ENGINEER", { unavailableUntilTurn: 5 }),
      mkP(3, "ENGINEER", { status: "AVAILABLE" }),
      mkP(4, "ENGINEER"),
      mkP(5, "ENGINEER"),
    ];
    // turn 1: unit 2 (unavailableUntil 5) is excluded; 1 spent; 3 wrong status; 5 claimed.
    const claimed = new Set<number>([5]);
    expect(selectAttentionUnits(pool, "ENGINEER", 1, 1, claimed, "GARRISONED")).toEqual([4]);
    // Only unit 4 remains -> requesting 2 fails.
    expect(selectAttentionUnits(pool, "ENGINEER", 2, 1, claimed, "GARRISONED")).toBeNull();
  });
});

// ---- atomic multi-group / crew spend ([D-060]) -----------------------------

describe("atomic multi-group & crew attention ([D-060])", () => {
  it("a multi-group building action fails wholesale if any one group is short (no partial pick)", () => {
    // Comms Array labor min = ANALYST:2 + ENGINEER:1; BOOST spends 2x -> 4 Analyst + 2 Engineer.
    const b = { id: 99, type: "COMMUNICATIONS_ARRAY", modules: [] } as unknown as Building;
    expect(buildingActionGarrisonGroups(b, "BOOST_OUTPUT")).toEqual([
      { type: "ANALYST", count: 4 },
      { type: "ENGINEER", count: 2 },
    ]);
    const shortEng = {
      personnel: [
        mkP(1, "ANALYST", { assignedBuildingId: 99 }),
        mkP(2, "ANALYST", { assignedBuildingId: 99 }),
        mkP(3, "ANALYST", { assignedBuildingId: 99 }),
        mkP(4, "ANALYST", { assignedBuildingId: 99 }),
        mkP(5, "ENGINEER", { assignedBuildingId: 99 }), // only 1 engineer, need 2
      ],
    } as unknown as Subdivision;
    expect(pickBuildingActionAttention(shortEng, b, "BOOST_OUTPUT", 1, new Set())).toBeNull();

    const full = {
      personnel: [
        ...shortEng.personnel,
        mkP(6, "ENGINEER", { assignedBuildingId: 99 }),
      ],
    } as unknown as Subdivision;
    expect(pickBuildingActionAttention(full, b, "BOOST_OUTPUT", 1, new Set())).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("a crewed action requires the whole crew unspent; one spent member fails all", () => {
    const sub = {
      personnel: [
        mkP(9, "ENGINEER", { status: "CREWING" }),
        mkP(10, "ENGINEER", { status: "CREWING" }),
      ],
    } as unknown as Subdivision;
    expect(selectActorAttention(sub, [9, 10], 1, new Set())).toEqual([9, 10]);
    sub.personnel[1]!.attentionSpentThisTurn = true;
    expect(selectActorAttention(sub, [9, 10], 1, new Set())).toBeNull();
  });
});

// ---- duplicate-unit Phase-2 fix (§22.4) ------------------------------------

describe("Phase 2 attention accounting closes the duplicate-unit bug ([D-057])", () => {
  it("five Sabotage orders naming one Analyst -> 1 accepted, 4 rejected INVALID", () => {
    const game = provision(makeTestGame());
    const alpha = game.subdivisions[0]!;
    alpha.personnel.push({ id: 100, type: "ANALYST", status: "AVAILABLE", unavailableUntilTurn: 0 });
    const betaHq = findB(game.subdivisions[1]!, "HEADQUARTERS");
    const orders = Array.from({ length: 5 }, () => ({
      unitId: 100,
      action: "SABOTAGE" as const,
      targetSubdivisionId: 2,
      targetBuildingId: betaHq.id,
    }));
    const sub: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: orders,
    };
    const { turnLog } = resolveTurn(game, [sub, emptyFor(2)]);
    const rejects = turnLog.invalidOrders.filter(
      (o) => o.kind === "UNIT" && /insufficient unspent attention/.test(o.reason),
    );
    expect(rejects).toHaveLength(4);
    // Exactly one sabotage was resolved (success or fail — both count as executed).
    const executed = turnLog.entries.filter(
      (e) => e.code === "SABOTAGE_SUCCESS" || e.code === "SABOTAGE_FAILED",
    );
    expect(executed).toHaveLength(1);
  });

  it("two crewed vehicle actions sharing one crew -> the second is rejected", () => {
    const game = provision(makeTestGame());
    const alpha = game.subdivisions[0]!;
    alpha.vehicles.push({
      id: 1, hull: "LIGHT", modules: [], crew: [], hex: { col: 2, row: 2 }, status: "ACTIVE", cargo: {},
    });
    const sub: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [{ unitId: 9, target: { kind: "VEHICLE", vehicleId: 1 } }],
      buildingActions: [],
      unitActions: [
        { unitId: 9, action: "VEHICLE_MOVE", vehicleId: 1, targetHex: { col: 2, row: 3 } },
        { unitId: 9, action: "VEHICLE_MOVE", vehicleId: 1, targetHex: { col: 3, row: 2 } },
      ],
    };
    const { turnLog } = resolveTurn(game, [sub, emptyFor(2)]);
    expect(
      turnLog.invalidOrders.filter(
        (o) => o.kind === "UNIT" && /insufficient unspent attention/.test(o.reason),
      ),
    ).toHaveLength(1);
    expect(turnLog.entries.filter((e) => e.code === "VEHICLE_MOVE")).toHaveLength(1);
  });
});

// ---- garrison assignment does NOT spend attention ([D-058]) ----------------

describe("garrison assignment does not spend attention ([D-058])", () => {
  it("a unit garrisoned this same turn can still back a building action this turn", () => {
    const game = provision(makeTestGame());
    const sub: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      // Admins/contractor garrisoned into HQ THIS turn.
      garrison: [
        { unitId: 6, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 7, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 8, target: { kind: "BUILDING", buildingId: 1 } },
      ],
      buildingActions: [
        { buildingId: 1, action: "TERRITORIAL_CLAIM", params: { targetHex: { col: 2, row: 3 } } },
      ],
      unitActions: [],
    };
    const { turnLog } = resolveTurn(game, [sub, emptyFor(2)]);
    expect(turnLog.entries.some((e) => e.code === "TERRITORIAL_CLAIM")).toBe(true);
    expect(turnLog.invalidOrders.filter((o) => o.kind === "BUILDING")).toHaveLength(0);
  });
});

// ---- Phase 8 reset ([D-056]) -----------------------------------------------

describe("Phase 8 resets attention for the next turn ([D-056])", () => {
  it("every unit's attentionSpentThisTurn is false in the resolved state", () => {
    const game = provision(makeTestGame());
    // Pretend several units spent attention on a prior (in-progress) resolution.
    for (const p of game.subdivisions[0]!.personnel) p.attentionSpentThisTurn = true;
    for (const p of game.subdivisions[1]!.personnel.slice(0, 3)) p.attentionSpentThisTurn = true;
    const { newState } = resolveTurn(game, [emptyFor(1), emptyFor(2)]);
    for (const s of newState.subdivisions) {
      for (const p of s.personnel) {
        expect(p.attentionSpentThisTurn, `unit ${p.id}`).toBe(false);
      }
    }
  });
});

// ---- availableActions (§22.9 / [D-061]) ------------------------------------

describe("availableActions — live building action list ([D-061])", () => {
  it("offers a base action on an operational generator and drops it as attention is spent", () => {
    const game = provision(makeTestGame());
    const alpha = game.subdivisions[0]!;
    const bio = findB(alpha, "BIO_FACILITY"); // labor min ENGINEER:2
    // Two full sets (4 engineers) -> surplus set present, Boost gate met.
    garrisonInto(alpha, bio, [1, 2, 3, 4]);

    let actions = availableActions(bio, alpha, game);
    expect(actions).toContain("BOOST_OUTPUT"); // needs 2x2 = 4 unspent engineers
    expect(actions).toContain("EMERGENCY_EXTRACTION"); // needs 2 unspent engineers

    // Spend two of the four engineers' attention (as an earlier accepted order would).
    alpha.personnel.find((p) => p.id === 1)!.attentionSpentThisTurn = true;
    alpha.personnel.find((p) => p.id === 2)!.attentionSpentThisTurn = true;

    actions = availableActions(bio, alpha, game);
    expect(actions).not.toContain("BOOST_OUTPUT"); // only 2 unspent < 4 required -> drops off
    expect(actions).toContain("EMERGENCY_EXTRACTION"); // 2 unspent still satisfies

    // Spend the remaining two -> Emergency Extraction also drops.
    alpha.personnel.find((p) => p.id === 3)!.attentionSpentThisTurn = true;
    alpha.personnel.find((p) => p.id === 4)!.attentionSpentThisTurn = true;
    expect(availableActions(bio, alpha, game)).not.toContain("EMERGENCY_EXTRACTION");
  });

  it("does not offer actions on a non-operational (ungarrisoned) building", () => {
    const game = provision(makeTestGame());
    const alpha = game.subdivisions[0]!;
    const ext = findB(alpha, "EXTRACTION_SITE"); // ungarrisoned by default
    expect(availableActions(ext, alpha, game)).toEqual([]);
  });

  it("offers a module-unlocked action (Lockdown) only when Security Detail is active AND its unit is unspent", () => {
    const game = provision(makeTestGame());
    const alpha = game.subdivisions[0]!;
    const hq = findB(alpha, "HEADQUARTERS"); // labor min ADMIN:2 + CONTRACTOR:1
    garrisonInto(alpha, hq, [6, 7, 8]); // 2 admins + 1 contractor -> operational

    // Without Security Detail: Lockdown is not even a candidate.
    expect(availableActions(hq, alpha, game)).not.toContain("LOCKDOWN");

    hq.modules.push({ id: 1, type: "SECURITY_DETAIL", status: "ACTIVE" });
    expect(availableActions(hq, alpha, game)).toContain("LOCKDOWN");

    // Spend the garrisoned contractor's attention -> Lockdown drops off.
    alpha.personnel.find((p) => p.id === 8)!.attentionSpentThisTurn = true;
    expect(availableActions(hq, alpha, game)).not.toContain("LOCKDOWN");
  });
});
