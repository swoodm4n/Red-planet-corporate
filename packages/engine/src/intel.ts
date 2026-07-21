/**
 * Intelligence-gated visibility. GAME_SPEC §21.3-6 / [D-051], [D-052], [D-053],
 * [D-055].
 *
 * Espionage vs opsec produce a per-(viewer,target) intel *tier* that is a pure
 * derived function of current state — never stored on Game/Subdivision, always
 * recomputed live ([D-052]). The tier gates a per-tile `TileView` (§21.6).
 *
 * Determinism ([D-002]/[D-016]) forbids floats: the ratio thresholds are
 * evaluated as exact integer cross-multiplications (§21.4). The `INTEL_TIER_*_MAX`
 * numeric constants below are documentation / rebalance knobs only — the live
 * evaluation never divides.
 *
 * This system is fully DECOUPLED from spotting/closed borders ([D-054]): it never
 * reads border state, and border state never reads it. Own tiles are always fully
 * visible to their owner regardless of tier — that is not an "intel" question.
 */

import { BUILDINGS } from "./constants.js";
import { computePassiveOutput } from "./output.js";
import { getHex } from "./map.js";
import type {
  BuildStatus,
  Building,
  Game,
  HexCoord,
  HullClass,
  ModuleType,
  Personnel,
  PersonnelType,
  ResourceType,
  Subdivision,
  Terrain,
  Tier,
} from "./types.js";

// ---------------------------------------------------------------------------
// §21.3 named, rebalanceable constants
// ---------------------------------------------------------------------------

export const INTEL_ESPIONAGE_BASE = 1;
export const INTEL_OPSEC_BASE = 1;
export const INTEL_W_ANALYST = 1;
export const INTEL_W_SENSOR_ARRAY = 1;
export const INTEL_W_COMMS_ARRAY = 1;
export const INTEL_W_COMMAND_SUITE = 1;
export const INTEL_W_CONTRACTOR = 1;
export const INTEL_W_SECURITY_DETAIL = 1;
export const INTEL_W_FORTIFICATION = 1;

// §21.4 tier thresholds. Documentation of the fractions evaluated integer-exact.
export const INTEL_TIER_LOW_MAX = 0.6; // score <  0.60 -> LOW      (3/5)
export const INTEL_TIER_MEDIUM_MAX = 0.75; // score <  0.75 -> MEDIUM (3/4)
export const INTEL_TIER_HIGH_MAX = 0.9; // score <  0.90 -> HIGH     (9/10)
//                                          score >= 0.90 -> FULL

export type IntelTier = "LOW" | "MEDIUM" | "HIGH" | "FULL";
/** Tier reported for a tile view: "OWN" when the viewer is the owner. */
export type TileViewTier = "OWN" | IntelTier;

// ---------------------------------------------------------------------------
// §21.3 counting predicates
// ---------------------------------------------------------------------------

/** Active-roster personnel (can staff intel/security roles). §21.3 */
const ACTIVE_ROSTER_EXCLUDED: ReadonlySet<Personnel["status"]> = new Set([
  "CAPTURED",
  "LOST",
  "UNHOUSED",
]);

function countPersonnel(sub: Subdivision, type: PersonnelType): number {
  let n = 0;
  for (const p of sub.personnel) {
    if (p.type === type && !ACTIVE_ROSTER_EXCLUDED.has(p.status)) n += 1;
  }
  return n;
}

/** Active modules of a type across all the subdivision's buildings. §21.3 */
function countActiveModules(sub: Subdivision, type: ModuleType): number {
  let n = 0;
  for (const b of sub.buildings) {
    for (const m of b.modules) {
      if (m.status === "ACTIVE" && m.type === type) n += 1;
    }
  }
  return n;
}

function countActiveBuildings(sub: Subdivision, type: Building["type"]): number {
  return sub.buildings.filter((b) => b.type === type && b.status === "ACTIVE").length;
}

/** Active COMMAND_SUITE modules mounted on an active COMMUNICATIONS_ARRAY. §21.3 */
function countActiveCommandSuitesOnCommsArrays(sub: Subdivision): number {
  let n = 0;
  for (const b of sub.buildings) {
    if (b.type !== "COMMUNICATIONS_ARRAY" || b.status !== "ACTIVE") continue;
    for (const m of b.modules) {
      if (m.status === "ACTIVE" && m.type === "COMMAND_SUITE") n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// §21.3 espionage / opsec
// ---------------------------------------------------------------------------

/** Espionage of a subdivision (live-recomputed, small non-negative integer). §21.3 */
export function computeEspionage(sub: Subdivision, _game?: Game): number {
  let e = INTEL_ESPIONAGE_BASE;
  e += INTEL_W_ANALYST * countPersonnel(sub, "ANALYST");
  e += INTEL_W_SENSOR_ARRAY * countActiveModules(sub, "SENSOR_ARRAY");
  e += INTEL_W_COMMS_ARRAY * countActiveBuildings(sub, "COMMUNICATIONS_ARRAY");
  e += INTEL_W_COMMAND_SUITE * countActiveCommandSuitesOnCommsArrays(sub);
  return e;
}

/** Operational security of a subdivision (live-recomputed). §21.3 */
export function computeOpsec(sub: Subdivision, _game?: Game): number {
  let o = INTEL_OPSEC_BASE;
  o += INTEL_W_CONTRACTOR * countPersonnel(sub, "CONTRACTOR");
  o += INTEL_W_SECURITY_DETAIL * countActiveModules(sub, "SECURITY_DETAIL");
  o += INTEL_W_FORTIFICATION * countActiveModules(sub, "FORTIFICATION");
  return o;
}

// ---------------------------------------------------------------------------
// §21.4 intel tier (integer-exact)
// ---------------------------------------------------------------------------

/**
 * Intel tier of `viewer` over `target`, from espionage/opsec. §21.4 / [D-051].
 * intelScore = e/(e+o); thresholds evaluated by exact integer cross-multiplication
 * (0.60=3/5, 0.75=3/4, 0.90=9/10) so no floats enter the deterministic path.
 */
export function intelTierFrom(e: number, o: number): IntelTier {
  if (2 * e < 3 * o) return "LOW"; // e/(e+o) <  0.60
  if (1 * e < 3 * o) return "MEDIUM"; // e/(e+o) <  0.75  (and >= 0.60)
  if (1 * e < 9 * o) return "HIGH"; // e/(e+o) <  0.90  (and >= 0.75)
  return "FULL"; // e/(e+o) >= 0.90
}

/**
 * Intel tier of the viewer subdivision over the target subdivision. §21.4-5.
 * Self is not an intel question — callers use "OWN". This is global per opponent
 * (one tier for all the target's tiles). Pure; never stored. [D-052]
 */
export function computeIntelTier(
  viewer: Subdivision,
  target: Subdivision,
  game?: Game,
): IntelTier {
  return intelTierFrom(computeEspionage(viewer, game), computeOpsec(target, game));
}

// ---------------------------------------------------------------------------
// §21.6 gated tile view
// ---------------------------------------------------------------------------

/** Non-DERELICT standing structure predicate for tile counting. §21.6 / [D-053] */
const STANDING_STATUSES: ReadonlySet<BuildStatus> = new Set(["ACTIVE", "PENDING", "DISABLED"]);
function isStanding(b: Building): boolean {
  return STANDING_STATUSES.has(b.status);
}

/** Full per-building detail exposed only on OWN tiles. §21.6 */
export interface TileViewBuildingDetail {
  id: number;
  type: Building["type"];
  tier: Tier;
  status: BuildStatus;
  modules: { id: number; type: ModuleType; status: BuildStatus }[];
  garrison: Partial<Record<PersonnelType, number>>;
}

export interface TileViewUnits {
  personnel: Partial<Record<PersonnelType, number>>;
  vehicles: Partial<Record<HullClass, number>>;
}

/**
 * A single tile's inspection view, gated by the viewer's intel tier (§21.6).
 * Public fields are always present; gated fields are added additively per tier.
 */
export interface TileView {
  coord: HexCoord;
  terrain: Terrain;
  owner: number | null;
  isLandingZone: boolean;
  hasHQ: boolean;
  hasOutpost: boolean;
  intelTier: TileViewTier;
  // --- gated, additive by tier (opponent tiles) ---
  buildingCount?: number; // MEDIUM+
  buildings?: Building["type"][]; // HIGH+ (id-ordered, duplicates listed)
  unitCount?: number; // HIGH+
  resourceOutput?: Partial<Record<ResourceType, number>>; // FULL+
  units?: TileViewUnits; // FULL+
  // --- OWN only: complete detail ---
  ownBuildings?: TileViewBuildingDetail[];
}

/** Standing (non-DERELICT) buildings on `coord`, ordered by building id. §21.6 */
function standingBuildingsOnTile(sub: Subdivision, coord: HexCoord): Building[] {
  return sub.buildings
    .filter((b) => b.hex.col === coord.col && b.hex.row === coord.row && isStanding(b))
    .sort((a, b) => a.id - b.id);
}

/** Personnel garrisoned/crewing physically on `coord`. §21.6 */
function personnelOnTile(sub: Subdivision, coord: HexCoord): Personnel[] {
  const buildingIdsOnTile = new Set(
    sub.buildings
      .filter((b) => b.hex.col === coord.col && b.hex.row === coord.row)
      .map((b) => b.id),
  );
  const vehicleIdsOnTile = new Set(
    sub.vehicles
      .filter((v) => v.hex.col === coord.col && v.hex.row === coord.row)
      .map((v) => v.id),
  );
  return sub.personnel.filter((p) => {
    if (p.status === "GARRISONED") {
      return p.assignedBuildingId != null && buildingIdsOnTile.has(p.assignedBuildingId);
    }
    if (p.status === "CREWING") {
      return p.assignedVehicleId != null && vehicleIdsOnTile.has(p.assignedVehicleId);
    }
    return false;
  });
}

function vehiclesOnTile(sub: Subdivision, coord: HexCoord) {
  return sub.vehicles.filter((v) => v.hex.col === coord.col && v.hex.row === coord.row);
}

/** Per-resource passive per-turn output of the tile's buildings (capacity). §21.6 */
function tileResourceOutput(
  buildings: Building[],
  game: Game,
  ownerId: number,
): Partial<Record<ResourceType, number>> {
  const out: Partial<Record<ResourceType, number>> = {};
  for (const b of buildings) {
    const po = computePassiveOutput(b, game, ownerId);
    if (po.resource && po.amount) {
      out[po.resource] = (out[po.resource] ?? 0) + po.amount;
    }
    if (po.researchLinkBonus) {
      out.RESEARCH = (out.RESEARCH ?? 0) + po.researchLinkBonus;
    }
  }
  return out;
}

function unitBreakdown(personnel: Personnel[], vehicles: ReturnType<typeof vehiclesOnTile>): TileViewUnits {
  const p: Partial<Record<PersonnelType, number>> = {};
  for (const u of personnel) p[u.type] = (p[u.type] ?? 0) + 1;
  const veh: Partial<Record<HullClass, number>> = {};
  for (const v of vehicles) veh[v.hull] = (veh[v.hull] ?? 0) + 1;
  return { personnel: p, vehicles: veh };
}

/**
 * Produce the tier-appropriate `TileView` for `viewerSubdivisionId` inspecting the
 * tile at `targetHex`. §21.6 / [D-053], [D-055].
 *
 * - Own tiles: full detail unconditionally (intelTier "OWN"), requirement 2.
 * - Unclaimed / RETIRED-owner tiles: public terrain fields only, tier "LOW"
 *   (no private content exists to reveal). [D-055]
 * - Opponent tiles: additive reveal by computed intel tier.
 *
 * Returns `null` only if `targetHex` is off-map.
 */
export function getGatedTileView(
  viewerSubdivisionId: number,
  targetHex: HexCoord,
  game: Game,
): TileView | null {
  const hex = getHex(game.map, targetHex);
  if (!hex) return null;

  const coord: HexCoord = { col: targetHex.col, row: targetHex.row };
  const isLandingZone = hex.terrain === "LANDING_ZONE";
  const ownerId = hex.ownerSubdivisionId ?? null;

  const ownerSub =
    ownerId != null ? game.subdivisions.find((s) => s.id === ownerId) : undefined;

  // Public fields need the owner's standing buildings to know HQ/Outpost icons.
  const standing = ownerSub && ownerSub.status === "ACTIVE"
    ? standingBuildingsOnTile(ownerSub, coord)
    : [];
  const hasHQ = standing.some((b) => b.type === "HEADQUARTERS");
  const hasOutpost = standing.some((b) => b.type === "OUTPOST");

  const base: TileView = {
    coord,
    terrain: hex.terrain,
    owner: ownerSub && ownerSub.status === "ACTIVE" ? ownerId : null,
    isLandingZone,
    hasHQ,
    hasOutpost,
    intelTier: "LOW",
  };

  // Unclaimed or RETIRED owner: public only, tier LOW. [D-055]
  if (!ownerSub || ownerSub.status !== "ACTIVE") {
    return base;
  }

  // Own tile: always full detail. §21.6 requirement 2.
  if (ownerId === viewerSubdivisionId) {
    return buildOwnTileView(base, ownerSub, coord, game);
  }

  // Opponent tile: additive reveal by computed tier.
  const viewerSub = game.subdivisions.find((s) => s.id === viewerSubdivisionId);
  const tier: IntelTier = viewerSub
    ? computeIntelTier(viewerSub, ownerSub, game)
    : "LOW";
  return buildOpponentTileView(base, ownerSub, coord, game, tier, standing);
}

function buildOwnTileView(
  base: TileView,
  owner: Subdivision,
  coord: HexCoord,
  game: Game,
): TileView {
  const standing = standingBuildingsOnTile(owner, coord);
  const personnel = personnelOnTile(owner, coord);
  const vehicles = vehiclesOnTile(owner, coord);
  return {
    ...base,
    intelTier: "OWN",
    buildingCount: standing.length,
    buildings: standing.map((b) => b.type),
    unitCount: personnel.length + vehicles.length,
    resourceOutput: tileResourceOutput(standing, game, owner.id),
    units: unitBreakdown(personnel, vehicles),
    ownBuildings: standing.map((b) => ({
      id: b.id,
      type: b.type,
      tier: b.tier,
      status: b.status,
      modules: b.modules.map((m) => ({ id: m.id, type: m.type, status: m.status })),
      garrison: { ...b.garrison },
    })),
  };
}

function buildOpponentTileView(
  base: TileView,
  owner: Subdivision,
  coord: HexCoord,
  game: Game,
  tier: IntelTier,
  standing: Building[],
): TileView {
  const view: TileView = { ...base, intelTier: tier };
  if (tier === "LOW") return view; // public fields only

  // MEDIUM+: building count.
  view.buildingCount = standing.length;
  if (tier === "MEDIUM") return view;

  // HIGH+: building type list + aggregate unit count.
  const personnel = personnelOnTile(owner, coord);
  const vehicles = vehiclesOnTile(owner, coord);
  view.buildings = standing.map((b) => b.type);
  view.unitCount = personnel.length + vehicles.length;
  if (tier === "HIGH") return view;

  // FULL: resource output (capacity, not stockpiles) + unit type/hull counts.
  view.resourceOutput = tileResourceOutput(standing, game, owner.id);
  view.units = unitBreakdown(personnel, vehicles);
  return view;
}

// ---------------------------------------------------------------------------
// §21.5-6 map-level rendering split (HQ/Outpost icons only)
// ---------------------------------------------------------------------------

/** Public, map-level marker for a single tile: icons + public claim only. §21.5 */
export interface MapTileMarker {
  coord: HexCoord;
  terrain: Terrain;
  owner: number | null;
  isLandingZone: boolean;
  hasHQ: boolean;
  hasOutpost: boolean;
  /** Viewer's tier vs owner ("OWN" if self, "LOW" if unclaimed). */
  intelTier: TileViewTier;
}

/**
 * Map-level projection: for each of the 96 tiles, only the public fields the map
 * needs to render (terrain, owner claim, HQ/Outpost icons) plus the viewer's tier.
 * No building lists, counts, or outputs leak here — those come from
 * {@link getGatedTileView} on tile inspection. §21.5 / [D-053].
 */
export function getMapView(viewerSubdivisionId: number, game: Game): MapTileMarker[] {
  return game.map.map((hex) => {
    const view = getGatedTileView(viewerSubdivisionId, hex.coord, game);
    // getGatedTileView never returns null for an in-map tile.
    const v = view as TileView;
    return {
      coord: v.coord,
      terrain: v.terrain,
      owner: v.owner,
      isLandingZone: v.isLandingZone,
      hasHQ: v.hasHQ,
      hasOutpost: v.hasOutpost,
      intelTier: v.intelTier,
    };
  });
}
