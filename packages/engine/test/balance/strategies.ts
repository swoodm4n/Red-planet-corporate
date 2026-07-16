/**
 * Hardcoded, deterministic player strategy scripts for the balance simulation.
 * NO AI / LLM anywhere: each strategy is a pure function that inspects the current
 * game state and emits a valid `Submission` per fixed rules (§10.6). Six archetypes:
 * economic rush, military/security, research, logistics, expansionist, intel.
 */

import { BUILDINGS } from "../../src/constants.js";
import { effectiveGarrisonMin, isOperational } from "../../src/helpers.js";
import type {
  Building,
  BuildingType,
  Game,
  HexCoord,
  Personnel,
  PersonnelType,
  Subdivision,
} from "../../src/types.js";
import type {
  BuildingActionOrder,
  GarrisonAssignment,
  Submission,
  UnitActionOrder,
} from "../../src/orders.js";

export type Archetype = "ECON" | "MIL" | "RESEARCH" | "LOGI" | "EXPAND" | "INTEL";

export interface SubSetup {
  id: number;
  name: string;
  parentCompany: Subdivision["parentCompany"];
  parentPerk: "A" | "B";
  choicePersonnel: [PersonnelType, PersonnelType];
  hqHex: HexCoord;
  freeBuildingHex: HexCoord;
  archetype: Archetype;
}

/** Landing Zone parked in a far corner so it never sits inside a build band. */
export const LANDING_ZONE: HexCoord = { col: 12, row: 8 };

/**
 * Six parent-distinct subdivisions, one per company (§5 / [D-048]). Each HQ owns a
 * two-column band [2i-1, 2i] so construction/claims never collide between rivals.
 */
export const SUB_SETUPS: SubSetup[] = [
  { id: 1, name: "EconRush", parentCompany: "STELLAR_DYNAMICS", parentPerk: "A", choicePersonnel: ["ADMINISTRATOR", "ADMINISTRATOR"], hqHex: { col: 1, row: 2 }, freeBuildingHex: { col: 2, row: 2 }, archetype: "ECON" },
  { id: 2, name: "MilSec", parentCompany: "OMEGA_SECURITY", parentPerk: "A", choicePersonnel: ["CONTRACTOR", "CONTRACTOR"], hqHex: { col: 3, row: 2 }, freeBuildingHex: { col: 4, row: 2 }, archetype: "MIL" },
  { id: 3, name: "ResLab", parentCompany: "HELIX_PHARMA", parentPerk: "A", choicePersonnel: ["INNOVATOR", "INNOVATOR"], hqHex: { col: 5, row: 2 }, freeBuildingHex: { col: 6, row: 2 }, archetype: "RESEARCH" },
  { id: 4, name: "Logistics", parentCompany: "UNIFIED_MINING", parentPerk: "A", choicePersonnel: ["ENGINEER", "ENGINEER"], hqHex: { col: 7, row: 2 }, freeBuildingHex: { col: 8, row: 2 }, archetype: "LOGI" },
  { id: 5, name: "Expansion", parentCompany: "TERRA_AGRICULTURAL", parentPerk: "A", choicePersonnel: ["ENGINEER", "ADMINISTRATOR"], hqHex: { col: 9, row: 2 }, freeBuildingHex: { col: 10, row: 2 }, archetype: "EXPAND" },
  { id: 6, name: "IntelGen", parentCompany: "GENESIS_TECH", parentPerk: "A", choicePersonnel: ["ANALYST", "ANALYST"], hqHex: { col: 11, row: 2 }, freeBuildingHex: { col: 12, row: 2 }, archetype: "INTEL" },
];

const cr = (n: number) => n * 10000;

// ---- shared helpers --------------------------------------------------------

/** Units that can be garrisoned/act this turn (not lost/captured/unhoused, arrived, available). */
function usableUnits(sub: Subdivision, turn: number): Personnel[] {
  return sub.personnel.filter(
    (p) =>
      p.status !== "LOST" &&
      p.status !== "CAPTURED" &&
      p.status !== "UNHOUSED" &&
      p.unavailableUntilTurn < turn &&
      !(p.arrivalTurn != null && p.arrivalTurn > turn),
  );
}

type Pool = Record<PersonnelType, Personnel[]>;

function makePool(sub: Subdivision, turn: number): Pool {
  const pool: Pool = { ENGINEER: [], CONTRACTOR: [], ADMINISTRATOR: [], INNOVATOR: [], ANALYST: [] };
  for (const p of usableUnits(sub, turn)) pool[p.type].push(p);
  for (const k of Object.keys(pool) as PersonnelType[]) pool[k].sort((a, b) => a.id - b.id);
  return pool;
}

const GARRISON_PRIORITY: BuildingType[] = [
  "HEADQUARTERS",
  "BIO_FACILITY",
  "POWER_FACILITY",
  "WATER_RECLAMATION",
  "EXTRACTION_SITE",
  "RESEARCH_COMPLEX",
  "COMMERCIAL_HUB",
  "TRANSIT_HUB",
  "COMMUNICATIONS_ARRAY",
  "WAREHOUSE",
  "VEHICLE_WORKSHOP",
  "HABITAT_MODULE",
  "OUTPOST",
];

/**
 * Greedily staff every ACTIVE building to its effective garrison minimum (labor +
 * module-added), in priority order, keeping `reserve` units of each type free for
 * unit actions. Returns the assignments plus the leftover pool.
 */
function planGarrison(
  sub: Subdivision,
  turn: number,
  reserve: Partial<Record<PersonnelType, number>>,
): { garrison: GarrisonAssignment[]; pool: Pool } {
  const pool = makePool(sub, turn);
  const garrison: GarrisonAssignment[] = [];
  const buildings = [...sub.buildings]
    .filter((b) => b.status === "ACTIVE")
    .sort(
      (a, b) =>
        GARRISON_PRIORITY.indexOf(a.type) - GARRISON_PRIORITY.indexOf(b.type) || a.id - b.id,
    );

  for (const b of buildings) {
    const need = effectiveGarrisonMin(b) as Partial<Record<PersonnelType, number>>;
    const isHq = b.type === "HEADQUARTERS";
    const entries = Object.entries(need) as [PersonnelType, number][];
    // HQ is life-support (subsidy) — staff it ignoring the reserve; others respect it.
    const canStaff = entries.every(
      ([t, n]) => pool[t].length - (isHq ? 0 : reserve[t] ?? 0) >= n,
    );
    if (!canStaff) continue;
    for (const [t, n] of entries) {
      for (let i = 0; i < n; i++) {
        const u = pool[t].shift()!;
        garrison.push({ unitId: u.id, target: { kind: "BUILDING", buildingId: b.id } });
      }
    }
  }
  return { garrison, pool };
}

/** Hexes inside a subdivision's own band, excluding HQ / free-building / LZ. */
function bandHexes(setup: SubSetup): HexCoord[] {
  const cols = [2 * setup.id - 1, 2 * setup.id];
  const out: HexCoord[] = [];
  for (const row of [3, 4, 5, 6, 7, 8, 1]) {
    for (const col of cols) {
      if (col === LANDING_ZONE.col && row === LANDING_ZONE.row) continue;
      if (col === setup.hqHex.col && row === setup.hqHex.row) continue;
      if (col === setup.freeBuildingHex.col && row === setup.freeBuildingHex.row) continue;
      out.push({ col, row });
    }
  }
  return out;
}

function hqOf(sub: Subdivision, turn: number): Building | undefined {
  return sub.buildings.find((b) => b.type === "HEADQUARTERS" && isOperational(b, turn));
}

function firstOperational(sub: Subdivision, type: BuildingType, turn: number): Building | undefined {
  return sub.buildings.find((b) => b.type === type && isOperational(b, turn));
}

function affordBuild(sub: Subdivision, type: BuildingType): boolean {
  const cost = BUILDINGS[type].buildCost;
  const r = sub.resources as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(cost)) if ((r[k] ?? 0) < (v ?? 0)) return false;
  return true;
}

function countBuilt(sub: Subdivision, type: BuildingType): number {
  return sub.buildings.filter((b) => b.type === type).length;
}

/** Choose one build target from the archetype's rotation that is affordable + capped. */
function pickBuild(
  sub: Subdivision,
  wishlist: { type: BuildingType; max: number }[],
): BuildingType | undefined {
  for (const w of wishlist) {
    if (countBuilt(sub, w.type) >= w.max) continue;
    if (affordBuild(sub, w.type)) return w.type;
  }
  return undefined;
}

// ---- per-archetype build wishlists -----------------------------------------

const WISHLISTS: Record<Archetype, { type: BuildingType; max: number }[]> = {
  ECON: [
    { type: "EXTRACTION_SITE", max: 2 },
    { type: "COMMERCIAL_HUB", max: 1 },
    { type: "TRANSIT_HUB", max: 1 },
    { type: "POWER_FACILITY", max: 1 },
  ],
  MIL: [
    { type: "EXTRACTION_SITE", max: 2 },
    { type: "POWER_FACILITY", max: 1 },
    { type: "WAREHOUSE", max: 1 },
    { type: "VEHICLE_WORKSHOP", max: 1 },
  ],
  RESEARCH: [
    { type: "POWER_FACILITY", max: 1 },
    { type: "EXTRACTION_SITE", max: 1 },
    { type: "RESEARCH_COMPLEX", max: 2 },
  ],
  LOGI: [
    { type: "EXTRACTION_SITE", max: 2 },
    { type: "WAREHOUSE", max: 2 },
    { type: "TRANSIT_HUB", max: 1 },
    { type: "POWER_FACILITY", max: 1 },
  ],
  EXPAND: [
    { type: "EXTRACTION_SITE", max: 1 },
    { type: "POWER_FACILITY", max: 1 },
    { type: "WATER_RECLAMATION", max: 1 },
    { type: "OUTPOST", max: 2 },
  ],
  INTEL: [
    { type: "POWER_FACILITY", max: 1 },
    { type: "EXTRACTION_SITE", max: 1 },
    { type: "COMMUNICATIONS_ARRAY", max: 1 },
  ],
};

// ---- strategy entry point --------------------------------------------------

export function buildSubmission(game: Game, setup: SubSetup): Submission {
  const sub = game.subdivisions.find((s) => s.id === setup.id)!;
  const turn = game.turnNumber;
  const arche = setup.archetype;

  // Builders keep 1 engineer free for construction; intel keeps none (analysts man comms).
  const reserve: Partial<Record<PersonnelType, number>> =
    arche === "RESEARCH" || arche === "INTEL" ? { ENGINEER: 1 } : { ENGINEER: 1 };
  const { garrison, pool } = planGarrison(sub, turn, reserve);

  const buildingActions: BuildingActionOrder[] = [];
  const unitActions: UnitActionOrder[] = [];

  const band = bandHexes(setup);
  const nextHex = band[countBuilt(sub, "OUTPOST") + sub.buildings.length % band.length] ?? band[0]!;

  const takeEngineer = (): Personnel | undefined => pool.ENGINEER.shift();

  // ---- construction (one building per turn, affordability-gated) ----
  const wish = pickBuild(sub, WISHLISTS[arche]);
  if (wish) {
    const eng = takeEngineer();
    if (eng) {
      unitActions.push({
        unitId: eng.id,
        action: wish === "OUTPOST" ? "PLACE_OUTPOST" : "CONSTRUCT_BUILDING",
        targetHex: nextHex,
        params: wish === "OUTPOST" ? undefined : { buildingType: wish },
      });
    }
  }

  // ---- archetype-specific building actions & unit actions ----
  switch (arche) {
    case "ECON": {
      const hub = firstOperational(sub, "COMMERCIAL_HUB", turn);
      if (hub) buildingActions.push({ buildingId: hub.id, action: "AMPLIFY_CREDIT_YIELD" });
      const th = firstOperational(sub, "TRANSIT_HUB", turn);
      if (th && sub.resources.MINERALS > 30) {
        buildingActions.push({
          buildingId: th.id,
          action: "MARKET_SALE",
          params: { resource: "MINERALS", quantity: Math.min(10, sub.resources.MINERALS - 25) },
        });
      }
      const hq = hqOf(sub, turn);
      if (hq && countBuilt(sub, "OUTPOST") + claimedHexes(game, sub.id) < 4) {
        buildingActions.push({ buildingId: hq.id, action: "TERRITORIAL_CLAIM", params: { targetHex: nextHex } });
      }
      break;
    }
    case "MIL": {
      // Install a Security Detail then a Fortification on HQ for defensive/security score.
      const hq = sub.buildings.find((b) => b.type === "HEADQUARTERS");
      if (hq) {
        const hasSecurity = hq.modules.some((m) => m.type === "SECURITY_DETAIL");
        const hasFort = hq.modules.some((m) => m.type === "FORTIFICATION");
        const eng = takeEngineer();
        if (eng && !hasSecurity && sub.resources.MINERALS >= 6 && sub.resources.CREDITS >= cr(6)) {
          unitActions.push({ unitId: eng.id, action: "INSTALL_MODULE", targetBuildingId: hq.id, params: { moduleType: "SECURITY_DETAIL" } });
        } else if (eng && hasSecurity && !hasFort && sub.resources.MINERALS >= 10 && sub.resources.CREDITS >= cr(6)) {
          unitActions.push({ unitId: eng.id, action: "INSTALL_MODULE", targetBuildingId: hq.id, params: { moduleType: "FORTIFICATION" } });
        }
      }
      // Idle contractors patrol their own frontier (records intel, no cost).
      const patroller = pool.CONTRACTOR.shift();
      if (patroller) unitActions.push({ unitId: patroller.id, action: "PATROL", targetHex: setup.hqHex });
      break;
    }
    case "RESEARCH": {
      // Early: requisition innovators so the Research Complex reaches its 3-Innovator min.
      const hq = hqOf(sub, turn);
      const innovators = sub.personnel.filter(
        (p) => p.type === "INNOVATOR" && p.status !== "LOST" && p.status !== "CAPTURED",
      ).length;
      if (hq && turn <= 2 && innovators < 4 && sub.resources.CREDITS >= cr(20)) {
        buildingActions.push({ buildingId: hq.id, action: "COLONIST_REQUISITION", params: { colonistCount: 2, colonistType: "INNOVATOR" } });
      }
      // Idle innovators do Field Research (+1 R each).
      let idle = pool.INNOVATOR.shift();
      while (idle) {
        unitActions.push({ unitId: idle.id, action: "FIELD_RESEARCH", targetHex: setup.hqHex });
        idle = pool.INNOVATOR.shift();
      }
      break;
    }
    case "LOGI": {
      const th = firstOperational(sub, "TRANSIT_HUB", turn);
      if (th && sub.resources.MINERALS > 28) {
        buildingActions.push({
          buildingId: th.id,
          action: "MARKET_SALE",
          params: { resource: "MINERALS", quantity: Math.min(10, sub.resources.MINERALS - 22) },
        });
      }
      const wh = firstOperational(sub, "WAREHOUSE", turn);
      if (wh) buildingActions.push({ buildingId: wh.id, action: "RESOURCE_TRANSFER" });
      break;
    }
    case "EXPAND": {
      const hq = hqOf(sub, turn);
      if (hq && claimedHexes(game, sub.id) < 8) {
        buildingActions.push({ buildingId: hq.id, action: "TERRITORIAL_CLAIM", params: { targetHex: nextHex } });
      }
      if (hq && turn >= 2 && turn <= 5 && sub.resources.CREDITS >= cr(20)) {
        buildingActions.push({ buildingId: hq.id, action: "COLONIST_REQUISITION", params: { colonistCount: 2, colonistType: "ENGINEER" } });
      }
      break;
    }
    case "INTEL": {
      const comms = firstOperational(sub, "COMMUNICATIONS_ARRAY", turn);
      if (comms) buildingActions.push({ buildingId: comms.id, action: "PASSIVE_INTEL_SCAN" });
      break;
    }
  }

  return {
    subdivisionId: setup.id,
    turnNumber: turn,
    garrison,
    buildingActions,
    unitActions,
  };
}

function claimedHexes(game: Game, subId: number): number {
  return game.map.filter((h) => h.ownerSubdivisionId === subId).length;
}
