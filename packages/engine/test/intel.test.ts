import { describe, it, expect } from "vitest";
import { makeTestGame } from "./fixtures.js";
import {
  computeEspionage,
  computeOpsec,
  computeIntelTier,
  intelTierFrom,
  getGatedTileView,
  getMapView,
  INTEL_TIER_LOW_MAX,
  INTEL_TIER_MEDIUM_MAX,
  INTEL_TIER_HIGH_MAX,
} from "../src/intel.js";
import type {
  Building,
  Game,
  HexCoord,
  Module,
  Personnel,
  PersonnelType,
  Subdivision,
  Vehicle,
} from "../src/types.js";

// ---- helpers ---------------------------------------------------------------

let nextId = 100000;
function id(): number {
  return nextId++;
}

function sub(game: Game, sid: number): Subdivision {
  const s = game.subdivisions.find((x) => x.id === sid);
  if (!s) throw new Error(`no sub ${sid}`);
  return s;
}

function mkPersonnel(type: PersonnelType, status: Personnel["status"] = "AVAILABLE"): Personnel {
  return { id: id(), type, status, unavailableUntilTurn: 0 };
}

function mkModule(type: Module["type"], status: Module["status"] = "ACTIVE"): Module {
  return { id: id(), type, status };
}

function mkBuilding(
  type: Building["type"],
  hex: HexCoord,
  extra: Partial<Building> = {},
): Building {
  return {
    id: id(),
    type,
    tier: "T1",
    hex,
    status: "ACTIVE",
    builtOnTurn: 0,
    modules: [],
    garrison: {},
    disabledUntilTurn: 0,
    dormantTurns: 0,
    ...extra,
  };
}

/** Force a subdivision's espionage to exactly `e` via base(1) + (e-1) analysts. */
function setEspionage(s: Subdivision, e: number): void {
  s.personnel = s.personnel.filter((p) => p.type !== "ANALYST");
  s.buildings = s.buildings.filter((b) => b.type !== "COMMUNICATIONS_ARRAY");
  for (const b of s.buildings) b.modules = b.modules.filter((m) => m.type !== "SENSOR_ARRAY");
  for (let i = 0; i < e - 1; i++) s.personnel.push(mkPersonnel("ANALYST"));
}

/** Force a subdivision's opsec to exactly `o` via base(1) + (o-1) contractors. */
function setOpsec(s: Subdivision, o: number): void {
  s.personnel = s.personnel.filter((p) => p.type !== "CONTRACTOR");
  for (const b of s.buildings) {
    b.modules = b.modules.filter((m) => m.type !== "SECURITY_DETAIL" && m.type !== "FORTIFICATION");
  }
  for (let i = 0; i < o - 1; i++) s.personnel.push(mkPersonnel("CONTRACTOR"));
}

// ---------------------------------------------------------------------------
// §21.4 tier boundary math (integer-exact)
// ---------------------------------------------------------------------------

describe("intel tier boundary math (§21.4, integer-exact)", () => {
  it("named threshold constants match spec", () => {
    expect(INTEL_TIER_LOW_MAX).toBe(0.6);
    expect(INTEL_TIER_MEDIUM_MAX).toBe(0.75);
    expect(INTEL_TIER_HIGH_MAX).toBe(0.9);
  });

  it("score exactly 0.60 (3/5) is MEDIUM, not LOW (>= boundary)", () => {
    // e=3,o=2 -> 3/5 = 0.60
    expect(intelTierFrom(3, 2)).toBe("MEDIUM");
  });

  it("score exactly 0.75 (3/4) is HIGH, not MEDIUM", () => {
    // e=3,o=1 -> 3/4 = 0.75
    expect(intelTierFrom(3, 1)).toBe("HIGH");
  });

  it("score exactly 0.90 (9/10) is FULL, not HIGH", () => {
    // e=9,o=1 -> 9/10 = 0.90
    expect(intelTierFrom(9, 1)).toBe("FULL");
  });

  it("just below each boundary stays in the lower tier", () => {
    expect(intelTierFrom(2, 2)).toBe("LOW"); // 0.50 < 0.60
    expect(intelTierFrom(5, 2)).toBe("MEDIUM"); // 5/7 ≈ 0.714 < 0.75
    expect(intelTierFrom(8, 1)).toBe("HIGH"); // 8/9 ≈ 0.889 < 0.90
  });

  it("full progression LOW->MEDIUM->HIGH->FULL as espionage rises (opsec 2)", () => {
    expect(intelTierFrom(2, 2)).toBe("LOW"); // 0.50
    expect(intelTierFrom(3, 2)).toBe("MEDIUM"); // 0.60
    expect(intelTierFrom(6, 2)).toBe("HIGH"); // 0.75
    expect(intelTierFrom(18, 2)).toBe("FULL"); // 0.90
  });

  it("uses no floating point (large equal-ratio values agree with small ones)", () => {
    // 600/1000 == 3/5 exactly under integer cross-multiplication.
    expect(intelTierFrom(600, 400)).toBe("MEDIUM"); // exactly 0.60
    expect(intelTierFrom(599, 401)).toBe("LOW"); // just under 0.60
  });
});

// ---------------------------------------------------------------------------
// §21.3 espionage / opsec formulas
// ---------------------------------------------------------------------------

describe("espionage & opsec formulas (§21.3)", () => {
  it("espionage = 1 + analysts + sensor arrays + comms arrays + command suites", () => {
    const game = makeTestGame();
    const s = sub(game, 1);
    setEspionage(s, 1); // strip analysts/comms/sensor -> base only
    expect(computeEspionage(s, game)).toBe(1);

    s.personnel.push(mkPersonnel("ANALYST"), mkPersonnel("ANALYST"));
    const comms = mkBuilding("COMMUNICATIONS_ARRAY", { col: 2, row: 2 });
    comms.modules.push(mkModule("COMMAND_SUITE"), mkModule("SENSOR_ARRAY"));
    s.buildings.push(comms);
    // 1 base + 2 analysts + 1 comms building + 1 command suite + 1 sensor array = 6
    expect(computeEspionage(s, game)).toBe(6);
  });

  it("command suite only counts on an ACTIVE comms array", () => {
    const game = makeTestGame();
    const s = sub(game, 1);
    setEspionage(s, 1);
    const comms = mkBuilding("COMMUNICATIONS_ARRAY", { col: 2, row: 2 }, { status: "DISABLED" });
    comms.modules.push(mkModule("COMMAND_SUITE"));
    s.buildings.push(comms);
    // disabled comms array: neither the +1 building nor its command suite counts
    expect(computeEspionage(s, game)).toBe(1);
  });

  it("opsec = 1 + contractors + security details + fortifications", () => {
    const game = makeTestGame();
    const s = sub(game, 1);
    setOpsec(s, 1);
    expect(computeOpsec(s, game)).toBe(1);
    s.personnel.push(mkPersonnel("CONTRACTOR"));
    const hq = s.buildings[0]!;
    hq.modules.push(mkModule("SECURITY_DETAIL"), mkModule("FORTIFICATION"));
    // 1 base + 1 contractor + 1 security + 1 fort = 4
    expect(computeOpsec(s, game)).toBe(4);
  });

  it("captured/lost/unhoused personnel are not counted (active roster only)", () => {
    const game = makeTestGame();
    const s = sub(game, 1);
    setEspionage(s, 1);
    s.personnel.push(
      mkPersonnel("ANALYST", "CAPTURED"),
      mkPersonnel("ANALYST", "LOST"),
      mkPersonnel("ANALYST", "UNHOUSED"),
      mkPersonnel("ANALYST", "GARRISONED"),
    );
    // only the GARRISONED analyst is on the active roster
    expect(computeEspionage(s, game)).toBe(2);
  });

  it("inactive (PENDING/DISABLED) modules do not count", () => {
    const game = makeTestGame();
    const s = sub(game, 1);
    setOpsec(s, 1);
    const hq = s.buildings[0]!;
    hq.modules.push(mkModule("FORTIFICATION", "PENDING"), mkModule("SECURITY_DETAIL", "DISABLED"));
    expect(computeOpsec(s, game)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §21.4 critical start invariant
// ---------------------------------------------------------------------------

describe("start invariant: every player starts LOW against everyone (§21.4)", () => {
  it("default roster -> espionage 1, opsec 2, tier LOW (worked example)", () => {
    const game = makeTestGame();
    // Alpha choicePersonnel are non-analyst; Beta chose one analyst -> raise its espionage.
    // Use a fully-default matchup: both parents with non-analyst choices, no Genesis.
    const a = sub(game, 1); // UNIFIED_MINING, choices ENGINEER,ENGINEER
    const b = sub(game, 2); // TERRA_AGRICULTURAL, choices ANALYST,CONTRACTOR
    // Alpha is the canonical "bare" default start.
    expect(computeEspionage(a, game)).toBe(1);
    expect(computeOpsec(a, game)).toBe(2); // base + 1 starting contractor
    expect(computeIntelTier(a, b, game)).toBe("LOW");
    expect(computeIntelTier(b, a, game)).toBe("LOW");
  });

  it("equal espionage == opsec ⇒ score 0.5 ⇒ LOW", () => {
    expect(intelTierFrom(1, 1)).toBe("LOW");
    expect(intelTierFrom(2, 2)).toBe("LOW");
    expect(intelTierFrom(5, 5)).toBe("LOW");
  });

  it("Genesis free Comms Array symmetric case 2/2 is still LOW", () => {
    const game = makeTestGame({
      subdivisions: [
        {
          id: 1,
          name: "G1",
          parentCompany: "GENESIS_TECH",
          parentPerk: "A", // free Comms Array
          choicePersonnel: ["ENGINEER", "ENGINEER"],
          hqHex: { col: 2, row: 2 },
          freeBuildingHex: { col: 3, row: 2 },
        },
        {
          id: 2,
          name: "G2",
          parentCompany: "GENESIS_TECH",
          parentPerk: "A",
          choicePersonnel: ["ENGINEER", "ENGINEER"],
          hqHex: { col: 10, row: 6 },
          freeBuildingHex: { col: 9, row: 6 },
        },
      ],
    });
    const a = sub(game, 1);
    const b = sub(game, 2);
    expect(computeEspionage(a, game)).toBe(2); // base + comms array
    expect(computeOpsec(b, game)).toBe(2); // base + starting contractor
    expect(computeIntelTier(a, b, game)).toBe("LOW"); // 2/(2+2) = 0.5
  });

  it("a deliberate 2-Analyst opening reaches MEDIUM vs a bare target (intended)", () => {
    const game = makeTestGame();
    const viewer = sub(game, 1);
    const target = sub(game, 2);
    setEspionage(viewer, 3); // base + 2 analysts
    setOpsec(target, 2); // base + 1 contractor
    expect(computeIntelTier(viewer, target, game)).toBe("MEDIUM"); // 3/5 = 0.60
  });
});

// ---------------------------------------------------------------------------
// §21.6 gated tile view shape per tier
// ---------------------------------------------------------------------------

/**
 * Set up viewer (id1) vs target (id2), placing target content on tile {10,6}
 * (Beta's HQ tile). Returns the tile view at a chosen espionage/opsec.
 */
function viewAtTier(e: number, o: number): {
  game: Game;
  tile: HexCoord;
  view: NonNullable<ReturnType<typeof getGatedTileView>>;
} {
  const game = makeTestGame();
  const viewer = sub(game, 1);
  const target = sub(game, 2);
  setEspionage(viewer, e);
  setOpsec(target, o);
  // Use a clean, unclaimed tile (Beta's HQ tile already holds setup buildings).
  const tile: HexCoord = { col: 11, row: 7 };
  const hex = game.map.find((h) => h.coord.col === tile.col && h.coord.row === tile.row)!;
  hex.ownerSubdivisionId = target.id;
  // A producing power facility (2 energy) staffed by 2 engineers, plus an outpost.
  const power = mkBuilding("POWER_FACILITY", tile, { garrison: { ENGINEER: 2 } });
  const outpost = mkBuilding("OUTPOST", tile);
  target.buildings.push(power, outpost);
  // Two engineers garrisoned in the power facility, on-tile.
  const eng1 = mkPersonnel("ENGINEER", "GARRISONED");
  eng1.assignedBuildingId = power.id;
  const eng2 = mkPersonnel("ENGINEER", "GARRISONED");
  eng2.assignedBuildingId = power.id;
  target.personnel.push(eng1, eng2);
  // A vehicle on the tile crewed by an analyst (does NOT perturb target opsec).
  const crew = mkPersonnel("ANALYST", "CREWING");
  const veh: Vehicle = {
    id: id(),
    hull: "MEDIUM",
    modules: [],
    crew: [crew.id],
    hex: tile,
    status: "ACTIVE",
    cargo: {},
  };
  crew.assignedVehicleId = veh.id;
  target.vehicles.push(veh);
  target.personnel.push(crew);
  const view = getGatedTileView(viewer.id, tile, game)!;
  return { game, tile, view };
}

describe("gated tile view — reveal shape per tier (§21.6)", () => {
  it("LOW reveals nothing beyond public map fields", () => {
    const { view } = viewAtTier(1, 2); // 1/3 = LOW
    expect(view.intelTier).toBe("LOW");
    // public fields present
    expect(view.owner).toBe(2);
    expect(view.terrain).toBeDefined();
    expect(view.hasOutpost).toBe(true); // outpost icon is public
    // nothing private
    expect(view.buildingCount).toBeUndefined();
    expect(view.buildings).toBeUndefined();
    expect(view.unitCount).toBeUndefined();
    expect(view.resourceOutput).toBeUndefined();
    expect(view.units).toBeUndefined();
    expect(view.ownBuildings).toBeUndefined();
  });

  it("MEDIUM adds buildingCount only (non-DERELICT, includes iconned buildings)", () => {
    const { view } = viewAtTier(3, 2); // 3/5 = 0.60 MEDIUM
    expect(view.intelTier).toBe("MEDIUM");
    expect(view.buildingCount).toBe(2); // power + outpost
    expect(view.buildings).toBeUndefined();
    expect(view.unitCount).toBeUndefined();
    expect(view.resourceOutput).toBeUndefined();
    expect(view.units).toBeUndefined();
  });

  it("HIGH adds building type list + aggregate unitCount, but no output/types", () => {
    const { view } = viewAtTier(6, 2); // 6/8 = 0.75 HIGH
    expect(view.intelTier).toBe("HIGH");
    expect(view.buildingCount).toBe(2);
    expect(view.buildings).toEqual(["POWER_FACILITY", "OUTPOST"]); // id order
    // 2 garrisoned engineers + 1 crewing analyst + 1 vehicle
    expect(view.unitCount).toBe(4);
    expect(view.resourceOutput).toBeUndefined();
    expect(view.units).toBeUndefined();
  });

  it("FULL adds resourceOutput (capacity) + unit type/hull counts", () => {
    const { view } = viewAtTier(18, 2); // 18/20 = 0.90 FULL
    expect(view.intelTier).toBe("FULL");
    expect(view.resourceOutput).toEqual({ ENERGY: 2 }); // power facility base output
    expect(view.units).toEqual({
      personnel: { ENGINEER: 2, ANALYST: 1 },
      vehicles: { MEDIUM: 1 },
    });
  });

  it("FULL never leaks personnel identity or vehicle module loadouts", () => {
    const { view } = viewAtTier(18, 2);
    // units is type/hull counts only — no ids, no module arrays.
    const unitsJson = JSON.stringify(view.units);
    expect(unitsJson).not.toContain("id");
    expect(unitsJson).not.toContain("module");
    // resourceOutput is capacity, not stockpiles (no CREDITS pool leak).
    expect(view.resourceOutput).not.toHaveProperty("CREDITS");
  });

  it("DERELICT buildings are excluded from counts and lists", () => {
    const { game, tile, view } = viewAtTier(18, 2);
    void view;
    const target = sub(game, 2);
    target.buildings.push(mkBuilding("WAREHOUSE", tile, { status: "DERELICT" }));
    const v2 = getGatedTileView(1, tile, game)!;
    expect(v2.buildingCount).toBe(2); // still just power + outpost
    expect(v2.buildings).toEqual(["POWER_FACILITY", "OUTPOST"]);
  });
});

// ---------------------------------------------------------------------------
// §21.6 own tiles + map-level split + unclaimed
// ---------------------------------------------------------------------------

describe("own tiles, unclaimed tiles, map-level split (§21.5-6)", () => {
  it("own tile is always full detail regardless of computed tier", () => {
    const game = makeTestGame();
    const owner = sub(game, 1);
    // Owner has weak espionage; irrelevant for its own tiles.
    setEspionage(owner, 1);
    const hqHex = owner.buildings[0]!.hex;
    const view = getGatedTileView(owner.id, hqHex, game)!;
    expect(view.intelTier).toBe("OWN");
    expect(view.hasHQ).toBe(true);
    expect(view.ownBuildings).toBeDefined();
    expect(view.ownBuildings!.length).toBeGreaterThan(0);
    // Own detail includes per-building modules/status/garrison structure.
    const hq = view.ownBuildings!.find((b) => b.type === "HEADQUARTERS")!;
    expect(hq).toHaveProperty("modules");
    expect(hq).toHaveProperty("garrison");
    expect(hq).toHaveProperty("status");
    expect(view.resourceOutput).toBeDefined();
    expect(view.units).toBeDefined();
  });

  it("unclaimed tile returns public terrain only, tier LOW, no private data", () => {
    const game = makeTestGame();
    const empty: HexCoord = { col: 5, row: 5 }; // not an HQ / claimed tile
    const view = getGatedTileView(1, empty, game)!;
    expect(view.owner).toBeNull();
    expect(view.intelTier).toBe("LOW");
    expect(view.hasHQ).toBe(false);
    expect(view.hasOutpost).toBe(false);
    expect(view.buildingCount).toBeUndefined();
    expect(view.ownBuildings).toBeUndefined();
  });

  it("off-map tile returns null", () => {
    const game = makeTestGame();
    expect(getGatedTileView(1, { col: 99, row: 99 }, game)).toBeNull();
  });

  it("map view exposes only public markers (HQ/Outpost) for all 96 tiles", () => {
    const game = makeTestGame();
    const markers = getMapView(1, game);
    expect(markers).toHaveLength(96);
    const hqMarker = markers.find((m) => m.hasHQ && m.owner === 1);
    expect(hqMarker).toBeDefined();
    // Map markers never carry building lists / counts / outputs.
    for (const m of markers) {
      expect(m).not.toHaveProperty("buildingCount");
      expect(m).not.toHaveProperty("buildings");
      expect(m).not.toHaveProperty("resourceOutput");
    }
    // Own HQ tile is marked OWN; an opponent tile at default start is LOW.
    expect(hqMarker!.intelTier).toBe("OWN");
    const oppHq = markers.find((m) => m.hasHQ && m.owner === 2);
    expect(oppHq!.intelTier).toBe("LOW");
  });
});
