import { describe, it, expect } from "vitest";
import { resolveTurn } from "../src/resolveTurn.js";
import { makeTestGame } from "./fixtures.js";
import { cr } from "../src/money.js";
import { sharesHeld, setShares } from "../src/equity.js";
import type { Submission } from "../src/orders.js";
import type {
  Game,
  Module,
  Personnel,
  VehicleModule,
  HexCoord,
  HullClass,
} from "../src/types.js";

// ---- helpers ---------------------------------------------------------------

/** Stock food/water/energy so passive upkeep never starves the acting units. */
function provision(game: Game): Game {
  for (const s of game.subdivisions) {
    s.resources.FOOD = 200;
    s.resources.WATER = 200;
    s.resources.ENERGY = 200;
    s.resources.RESEARCH = 200; // Analysts consume 1 R/turn; avoid attrition culling them

  }
  return game;
}

function addVehicle(
  game: Game,
  subId: number,
  opts: { id: number; hex: HexCoord; hull?: HullClass; modules?: VehicleModule[] },
): void {
  const sub = game.subdivisions.find((s) => s.id === subId)!;
  sub.vehicles.push({
    id: opts.id,
    hull: opts.hull ?? "LIGHT",
    modules: opts.modules ?? [],
    crew: [], // populated by the garrison phase from a VEHICLE garrison order
    hex: { ...opts.hex },
    status: "ACTIVE",
    cargo: {},
  });
}

function vMod(name: string, category: VehicleModule["category"]): VehicleModule {
  return { id: 1, category, name, status: "ACTIVE" };
}

function mkModule(type: Module["type"]): Module {
  return { id: 1, type, status: "ACTIVE" };
}

function injectAnalyst(game: Game, subId: number, id: number): void {
  const sub = game.subdivisions.find((s) => s.id === subId)!;
  const p: Personnel = { id, type: "ANALYST", status: "AVAILABLE", unavailableUntilTurn: 0 };
  sub.personnel.push(p);
}

function emptyFor(subId: number): Submission {
  return { subdivisionId: subId, turnNumber: 1, garrison: [], buildingActions: [], unitActions: [] };
}

// Alpha (id 1) personnel: 1-5 Engineer, 6-7 Administrator, 8 Contractor, 9-10 Engineer.
// Beta (id 2) personnel: 11-15 Engineer, 16-17 Admin, 18 Contractor, 19 Analyst, 20 Contractor.
// Alpha buildings 1-4 (HQ, Habitat, Bio, Extraction). Beta buildings 5-8 (HQ, Habitat, Bio, Bio).

describe("Equity Trade Action end-to-end (§11.3 / [D-042])", () => {
  it("an Administrator BUY moves shares from the issuer treasury to the buyer", () => {
    const game = provision(makeTestGame());
    game.subdivisions[0]!.resources.CREDITS = cr(1000);
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [
        {
          unitId: 6, // Administrator
          action: "TRADE_ACTION",
          params: { equityIssuerSubdivisionId: 2, shares: 5, tradeKind: "BUY" },
        },
      ],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);

    expect(sharesHeld(newState.equity, 2, 1)).toBe(5); // Alpha now holds 5 of Beta
    expect(sharesHeld(newState.equity, 2, 2)).toBe(95); // Beta treasury drained by 5
    expect(turnLog.entries.some((e) => e.code === "TRADE_ACTION")).toBe(true);
  });

  it("a SELL returns shares to the issuer treasury and pays the seller", () => {
    const game = provision(makeTestGame());
    // Pre-seed Alpha with 10 shares of Beta (issuer treasury holds 90).
    setShares(game.equity, 2, 1, 10);
    setShares(game.equity, 2, 2, 90);
    game.subdivisions[1]!.resources.CREDITS = cr(1000); // Beta can buy back
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [
        {
          unitId: 7, // Administrator
          action: "TRADE_ACTION",
          params: { equityIssuerSubdivisionId: 2, shares: 4, tradeKind: "SELL" },
        },
      ],
    };
    const { newState } = resolveTurn(game, [alpha, emptyFor(2)]);
    expect(sharesHeld(newState.equity, 2, 1)).toBe(6);
    expect(sharesHeld(newState.equity, 2, 2)).toBe(94);
  });

  it("rejects a BUY the buyer cannot afford (validation)", () => {
    const game = provision(makeTestGame());
    game.subdivisions[0]!.resources.CREDITS = cr(5); // < 10 shares * 10 Cr
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [
        { unitId: 6, action: "TRADE_ACTION", params: { equityIssuerSubdivisionId: 2, shares: 10, tradeKind: "BUY" } },
      ],
    };
    const { newState } = resolveTurn(game, [alpha, emptyFor(2)]);
    expect(sharesHeld(newState.equity, 2, 1)).toBe(0); // no shares transferred
  });
});

describe("Vehicle Move (§9 / [D-042])", () => {
  it("moves a crewed vehicle to an adjacent open hex", () => {
    const game = provision(makeTestGame());
    addVehicle(game, 1, { id: 1, hex: { col: 2, row: 2 } });
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [{ unitId: 9, target: { kind: "VEHICLE", vehicleId: 1 } }],
      buildingActions: [],
      unitActions: [{ unitId: 9, action: "VEHICLE_MOVE", vehicleId: 1, targetHex: { col: 2, row: 3 } }],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha]);
    const v = newState.subdivisions[0]!.vehicles.find((x) => x.id === 1)!;
    expect(v.hex).toEqual({ col: 2, row: 3 });
    expect(turnLog.entries.some((e) => e.code === "VEHICLE_MOVE")).toBe(true);
  });

  it("blocks a move beyond the hull's range", () => {
    const game = provision(makeTestGame());
    addVehicle(game, 1, { id: 1, hex: { col: 2, row: 2 } });
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [{ unitId: 9, target: { kind: "VEHICLE", vehicleId: 1 } }],
      buildingActions: [],
      // (5,5) is well beyond LIGHT hull range 1.
      unitActions: [{ unitId: 9, action: "VEHICLE_MOVE", vehicleId: 1, targetHex: { col: 5, row: 5 } }],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha]);
    const v = newState.subdivisions[0]!.vehicles.find((x) => x.id === 1)!;
    expect(v.hex).toEqual({ col: 2, row: 2 }); // unmoved
    expect(turnLog.entries.some((e) => e.code === "VEHICLE_MOVE_FAILED")).toBe(true);
  });

  it("crossing a rival CLOSED border triggers a spotting check; either cancelled at origin or it completes", () => {
    const game = provision(makeTestGame());
    game.subdivisions[1]!.closedBordersAgainst.add("ALL"); // Beta closes borders
    addVehicle(game, 1, { id: 1, hex: { col: 9, row: 6 } });
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [{ unitId: 9, target: { kind: "VEHICLE", vehicleId: 1 } }],
      buildingActions: [],
      // (10,6) is Beta's HQ hex (owned + closed) and is adjacent to (9,6).
      unitActions: [{ unitId: 9, action: "VEHICLE_MOVE", vehicleId: 1, targetHex: { col: 10, row: 6 } }],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);
    const v = newState.subdivisions[0]!.vehicles.find((x) => x.id === 1)!;
    const spotted = turnLog.entries.some((e) => e.code === "VEHICLE_SPOTTED");
    if (spotted) {
      expect(v.hex).toEqual({ col: 9, row: 6 }); // held at origin
    } else {
      expect(v.hex).toEqual({ col: 10, row: 6 }); // slipped through
      expect(turnLog.entries.some((e) => e.code === "VEHICLE_MOVE")).toBe(true);
    }
  });

  it("guaranteed spot (heavy Fortification) cancels the crossing at origin", () => {
    const game = provision(makeTestGame());
    const beta = game.subdivisions[1]!;
    beta.closedBordersAgainst.add(1);
    // 8 Fortifications on the target hex -> spot chance clamps to 100%.
    beta.buildings.find((b) => b.id === 5)!.modules = Array.from({ length: 8 }, () =>
      mkModule("FORTIFICATION"),
    );
    addVehicle(game, 1, { id: 1, hex: { col: 9, row: 6 } });
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [{ unitId: 9, target: { kind: "VEHICLE", vehicleId: 1 } }],
      buildingActions: [],
      unitActions: [{ unitId: 9, action: "VEHICLE_MOVE", vehicleId: 1, targetHex: { col: 10, row: 6 } }],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);
    const v = newState.subdivisions[0]!.vehicles.find((x) => x.id === 1)!;
    expect(turnLog.entries.some((e) => e.code === "VEHICLE_SPOTTED")).toBe(true);
    expect(v.hex).toEqual({ col: 9, row: 6 });
  });
});

describe("Vehicle Attack (§14 / [D-030],[D-042])", () => {
  it("an armed vehicle disables an undefended rival building at range", () => {
    const game = provision(makeTestGame());
    addVehicle(game, 1, {
      id: 1,
      hex: { col: 10, row: 6 }, // co-located with Beta HQ (building 5)
      modules: [vMod("LIGHT_ARMAMENT", "WEAPON")],
    });
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [{ unitId: 9, target: { kind: "VEHICLE", vehicleId: 1 } }],
      buildingActions: [],
      unitActions: [
        { unitId: 9, action: "VEHICLE_ATTACK", vehicleId: 1, targetSubdivisionId: 2, targetBuildingId: 5 },
      ],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);
    const betaHq = newState.subdivisions[1]!.buildings.find((b) => b.id === 5)!;
    expect(betaHq.disabledUntilTurn).toBe(2); // disabled next turn
    expect(turnLog.entries.some((e) => e.code === "VEHICLE_ATTACK_SUCCESS")).toBe(true);
  });

  it("an out-of-range vehicle attack is a no-op", () => {
    const game = provision(makeTestGame());
    addVehicle(game, 1, {
      id: 1,
      hex: { col: 2, row: 2 }, // far from Beta
      modules: [vMod("LIGHT_ARMAMENT", "WEAPON")],
    });
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [{ unitId: 9, target: { kind: "VEHICLE", vehicleId: 1 } }],
      buildingActions: [],
      unitActions: [
        { unitId: 9, action: "VEHICLE_ATTACK", vehicleId: 1, targetSubdivisionId: 2, targetBuildingId: 5 },
      ],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);
    expect(newState.subdivisions[1]!.buildings.find((b) => b.id === 5)!.disabledUntilTurn).toBe(0);
    expect(turnLog.entries.some((e) => e.code === "VEHICLE_ATTACK_OUT_OF_RANGE")).toBe(true);
  });
});

describe("Patrol / Negotiate (§10.3 / [D-042])", () => {
  it("Patrol reports rival buildings within range of the patrolled hex", () => {
    const game = provision(makeTestGame());
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [{ unitId: 8, action: "PATROL", targetHex: { col: 10, row: 6 } }], // Contractor
    };
    const { turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);
    const entry = turnLog.entries.find((e) => e.code === "PATROL");
    expect(entry).toBeDefined();
    expect((entry!.data!.sighted as unknown[]).length).toBeGreaterThan(0);
  });

  it("Negotiate is recorded", () => {
    const game = provision(makeTestGame());
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [{ unitId: 6, action: "NEGOTIATE", targetSubdivisionId: 2 }], // Administrator
    };
    const { turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);
    expect(turnLog.entries.some((e) => e.code === "NEGOTIATE")).toBe(true);
  });
});

describe("Lobby (§10.3 / [D-042])", () => {
  it("adds weight to an active motion at 3 Cr/vote", () => {
    const game = provision(makeTestGame());
    game.subdivisions[0]!.resources.CREDITS = cr(100);
    game.activeMotions.push({
      id: 1,
      proposerSubdivisionId: 1,
      description: "test motion",
      votes: {},
      lobbyWeight: {},
      resolveOnTurn: 99, // survives this turn's tally
    });
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [
        { unitId: 6, action: "LOBBY", params: { motionId: 1, lobbyVotes: 2 } }, // Administrator
      ],
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);
    const motion = newState.activeMotions.find((m) => m.id === 1)!;
    expect(motion.lobbyWeight[1]).toBe(2);
    expect(turnLog.entries.some((e) => e.code === "LOBBY")).toBe(true);
  });
});

describe("Enforce Territory (§14.2 / [D-042])", () => {
  it("a Contractor seizes an undefended rival hex deterministically", () => {
    const game = provision(makeTestGame());
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [{ unitId: 8, action: "ENFORCE_TERRITORY", targetHex: { col: 10, row: 6 } }], // Beta HQ hex
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, emptyFor(2)]);
    const hex = newState.map.find((h) => h.coord.col === 10 && h.coord.row === 6)!;
    expect(hex.ownerSubdivisionId).toBe(1); // seized
    expect(turnLog.entries.some((e) => e.code === "ENFORCE_SUCCESS")).toBe(true);
  });
});

describe("Counter-Intel & Lockdown auto-defend (§14.1 / [D-042])", () => {
  it("Counter-Intel makes a Sabotage against the protected building auto-fail", () => {
    const game = provision(makeTestGame());
    injectAnalyst(game, 1, 100); // Alpha attacker
    const alpha: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [
        { unitId: 100, action: "SABOTAGE", targetSubdivisionId: 2, targetBuildingId: 7 },
      ],
    };
    const beta: Submission = {
      subdivisionId: 2,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [{ unitId: 19, action: "COUNTER_INTEL", targetBuildingId: 7 }], // Beta Analyst
    };
    const { newState, turnLog } = resolveTurn(game, [alpha, beta]);
    expect(turnLog.entries.some((e) => e.code === "COUNTER_INTEL")).toBe(true);
    expect(turnLog.entries.some((e) => e.code === "SABOTAGE_FAILED")).toBe(true);
    expect(newState.subdivisions[1]!.buildings.find((b) => b.id === 7)!.disabledUntilTurn).toBe(0);
  });

  it("Lockdown (building action) also auto-defends against Sabotage", () => {
    const game = provision(makeTestGame());
    const alpha = game.subdivisions[0]!;
    alpha.resources.CREDITS = cr(100);
    alpha.buildings.find((b) => b.id === 1)!.modules = [mkModule("SECURITY_DETAIL")];
    injectAnalyst(game, 2, 101); // Beta attacker
    const alphaSub: Submission = {
      subdivisionId: 1,
      turnNumber: 1,
      garrison: [
        { unitId: 6, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 7, target: { kind: "BUILDING", buildingId: 1 } },
        { unitId: 8, target: { kind: "BUILDING", buildingId: 1 } },
      ],
      buildingActions: [{ buildingId: 1, action: "LOCKDOWN" }],
      unitActions: [],
    };
    const beta: Submission = {
      subdivisionId: 2,
      turnNumber: 1,
      garrison: [],
      buildingActions: [],
      unitActions: [{ unitId: 101, action: "SABOTAGE", targetSubdivisionId: 1, targetBuildingId: 1 }],
    };
    const { newState, turnLog } = resolveTurn(game, [alphaSub, beta]);
    expect(turnLog.entries.some((e) => e.code === "LOCKDOWN")).toBe(true);
    expect(turnLog.entries.some((e) => e.code === "SABOTAGE_FAILED")).toBe(true);
    expect(newState.subdivisions[0]!.buildings.find((b) => b.id === 1)!.disabledUntilTurn).toBe(0);
  });
});
