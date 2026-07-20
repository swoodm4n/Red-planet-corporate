/**
 * §22 — Unit Attention (per-unit, per-turn action budget) & building
 * available-action derivation. [D-056]–[D-061], with [D-062]/[D-063] for
 * implementation-level rulings.
 *
 * Every unit has one unit of attention per turn (`Personnel.attentionSpentThisTurn`,
 * absent === false === unspent). Taking an attention-gated action spends the
 * attention of the unit(s) that action *requires* (by TYPE + COUNT, never by a
 * player-chosen id). When more qualifying units are unspent than needed, the
 * **lowest-id** ones are chosen ([D-057]).
 *
 * This module is pure (state in, ids out). Phase 2 uses it to reserve attention in
 * declaration order (closing the duplicate-unit bug); Phase 4/5 spend the reserved
 * ids; `availableActions` uses the very same predicate so the offered list can never
 * disagree with the validator ([D-061]).
 */

import { RESOURCE_GENERATORS } from "./constants.js";
import {
  garrisonSetCount,
  hasActiveModule,
  isOperational,
  laborGarrisonMin,
} from "./helpers.js";
import type { BuildingActionOrder, BuildingActionType, UnitActionOrder } from "./orders.js";
import type {
  Building,
  BuildingType,
  Game,
  Personnel,
  PersonnelType,
  Subdivision,
  UnitStatus,
} from "./types.js";

/** A single (type, count) attention requirement resolved against a garrison. */
export interface AttentionGroup {
  type: PersonnelType;
  count: number;
}

/**
 * Canonical deterministic selection ([D-057], §22.3). Filters `candidates` to
 * unspent, unclaimed, currently-usable units of `type` in the required
 * `eligibleStatus`, sorts by ascending id, and returns the `count` lowest ids —
 * or `null` if fewer than `count` qualify (FAIL).
 */
export function selectAttentionUnits(
  candidates: readonly Personnel[],
  type: PersonnelType,
  count: number,
  turnNumber: number,
  claimed: ReadonlySet<number>,
  eligibleStatus: UnitStatus,
): number[] | null {
  if (count <= 0) return [];
  const pool = candidates
    .filter(
      (p) =>
        p.type === type &&
        p.status === eligibleStatus &&
        p.attentionSpentThisTurn !== true &&
        p.unavailableUntilTurn < turnNumber &&
        !claimed.has(p.id),
    )
    .sort((a, b) => a.id - b.id);
  if (pool.length < count) return null;
  return pool.slice(0, count).map((p) => p.id);
}

/**
 * Explicit-id attention check for actions whose acting unit(s) are fixed rather
 * than chosen by tie-break: a unit action's actor (`order.unitId`, count 1) and a
 * vehicle action's entire crew ([D-060], §22.7). Every listed unit must have
 * unspent, unclaimed attention and be usable this turn — otherwise FAIL (`null`),
 * and NOTHING is spent (atomic).
 */
export function selectActorAttention(
  sub: Subdivision,
  unitIds: readonly number[],
  turnNumber: number,
  claimed: ReadonlySet<number>,
): number[] | null {
  const picked: number[] = [];
  for (const id of unitIds) {
    const p = sub.personnel.find((x) => x.id === id);
    if (!p) return null;
    if (p.attentionSpentThisTurn === true) return null;
    if (p.unavailableUntilTurn >= turnNumber) return null;
    if (claimed.has(id)) return null;
    picked.push(id);
  }
  return picked;
}

/**
 * Which garrisoned units a building action requires (§22.8 table, [D-063]).
 * Requirements are type + count; counts derive from the row's labor min so they
 * track Automation reductions. Empty array === no attention gate (never happens
 * for the actions listed here; Harvest / Hold Territory are passive and issue no
 * order, so they never reach this function).
 */
export function buildingActionGarrisonGroups(
  b: Building,
  action: BuildingActionType,
): AttentionGroup[] {
  const labor = laborGarrisonMin(b);
  const laborGroups = (mult: number): AttentionGroup[] =>
    (Object.keys(labor) as PersonnelType[])
      .filter((t) => (labor[t] ?? 0) > 0)
      .map((t) => ({ type: t, count: mult * (labor[t] ?? 0) }));

  switch (action) {
    // Passive-output boosts spend the surplus set's labor units (2× labor min).
    case "BOOST_OUTPUT":
      return laborGroups(2);
    // Emergency Extraction spends one labor-min set.
    case "EMERGENCY_EXTRACTION":
      return laborGroups(1);
    // Research Sprint spends 2× the Innovator min (surplus set).
    case "RESEARCH_SPRINT":
      return [{ type: "INNOVATOR", count: 2 * (labor.INNOVATOR ?? 0) }];
    // Fixed type + count rows (§22.8).
    case "MARKET_SALE":
    case "COLONIST_REQUISITION":
    case "TERRITORIAL_CLAIM":
      return [{ type: "ADMINISTRATOR", count: 1 }];
    case "AMPLIFY_CREDIT_YIELD":
      return [{ type: "ADMINISTRATOR", count: 2 }];
    case "RESOURCE_TRANSFER":
      return [{ type: "ENGINEER", count: 2 }];
    case "PRODUCE_VEHICLE":
      return [{ type: "ENGINEER", count: 3 }];
    case "PASSIVE_INTEL_SCAN":
      return [{ type: "ANALYST", count: 2 }];
    // Lockdown spends the Security Detail's contractor ([D-063]).
    case "LOCKDOWN":
      return [{ type: "CONTRACTOR", count: 1 }];
    default:
      return [];
  }
}

/**
 * Resolve a building action's attention against the building's garrison, honouring
 * the shared `claimed` reservation. Runs `selectAttentionUnits` once per group and
 * succeeds only if EVERY group succeeds; on any failure returns `null` and nothing
 * is reserved (atomic multi-group spend, [D-060]).
 */
export function pickBuildingActionAttention(
  sub: Subdivision,
  b: Building,
  action: BuildingActionType,
  turnNumber: number,
  claimed: ReadonlySet<number>,
): number[] | null {
  const groups = buildingActionGarrisonGroups(b, action);
  const candidates = sub.personnel.filter((p) => p.assignedBuildingId === b.id);
  const local = new Set<number>(claimed);
  const picked: number[] = [];
  for (const g of groups) {
    const ids = selectAttentionUnits(candidates, g.type, g.count, turnNumber, local, "GARRISONED");
    if (ids == null) return null;
    for (const id of ids) {
      local.add(id);
      picked.push(id);
    }
  }
  return picked;
}

/**
 * Resolve a unit action's attention. Vehicle actions require the vehicle's entire
 * current crew ([D-060]/§22.7); all other unit actions require the actor
 * (`order.unitId`). Returns the ids to reserve/spend, or `null` on FAIL.
 */
export function pickUnitActionAttention(
  sub: Subdivision,
  order: UnitActionOrder,
  turnNumber: number,
  claimed: ReadonlySet<number>,
): number[] | null {
  if (order.action === "VEHICLE_MOVE" || order.action === "VEHICLE_ATTACK") {
    const v = sub.vehicles.find((x) => x.id === order.vehicleId);
    if (!v) return null;
    return selectActorAttention(sub, v.crew, turnNumber, claimed);
  }
  return selectActorAttention(sub, [order.unitId], turnNumber, claimed);
}

/** Mark the given personnel ids as having spent their attention this turn. */
export function spendAttention(sub: Subdivision, ids: readonly number[]): void {
  for (const id of ids) {
    const p = sub.personnel.find((x) => x.id === id);
    if (p) p.attentionSpentThisTurn = true;
  }
}

// ---------------------------------------------------------------------------
// §22.9 — availableActions(B, S, turn) = base ∪ garrisonUnlocked ∪ moduleUnlocked,
// filtered by the SAME isOffered predicate Phase 2 uses ([D-061]).
// ---------------------------------------------------------------------------

/** (a) Intrinsic attention-gated actions offered by a building TYPE. */
const BASE_ACTIONS: Partial<Record<BuildingType, BuildingActionType[]>> = {
  POWER_FACILITY: ["BOOST_OUTPUT", "EMERGENCY_EXTRACTION"],
  EXTRACTION_SITE: ["BOOST_OUTPUT", "EMERGENCY_EXTRACTION"],
  WATER_RECLAMATION: ["BOOST_OUTPUT", "EMERGENCY_EXTRACTION"],
  BIO_FACILITY: ["BOOST_OUTPUT", "EMERGENCY_EXTRACTION"],
  RESEARCH_COMPLEX: ["BOOST_OUTPUT", "EMERGENCY_EXTRACTION", "RESEARCH_SPRINT"],
  TRANSIT_HUB: ["MARKET_SALE"],
  HEADQUARTERS: ["COLONIST_REQUISITION", "TERRITORIAL_CLAIM"],
  COMMERCIAL_HUB: ["AMPLIFY_CREDIT_YIELD"],
  COMMUNICATIONS_ARRAY: ["PASSIVE_INTEL_SCAN"],
  VEHICLE_WORKSHOP: ["PRODUCE_VEHICLE"],
  WAREHOUSE: ["RESOURCE_TRANSFER"],
};

/** Module → the action it unlocks when installed AND active. */
const MODULE_UNLOCKED: { moduleType: Parameters<typeof hasActiveModule>[1]; action: BuildingActionType }[] = [
  { moduleType: "SECURITY_DETAIL", action: "LOCKDOWN" },
];

export function base(type: BuildingType): BuildingActionType[] {
  return BASE_ACTIONS[type] ?? [];
}

/**
 * (b) Actions unlocked purely by units currently garrisoned in B. This engine has
 * no such actions beyond the type-intrinsic set (all building actions are gated by
 * type + garrison via `isOffered`), so this source is currently empty — kept as an
 * explicit union member so future garrison-unlocked rows slot in without changing
 * `availableActions`.
 */
export function garrisonUnlocked(_b: Building, _sub: Subdivision): BuildingActionType[] {
  return [];
}

/** (c) Actions unlocked by installed ACTIVE modules on B. */
export function moduleUnlocked(b: Building): BuildingActionType[] {
  const out: BuildingActionType[] = [];
  for (const m of MODULE_UNLOCKED) {
    if (hasActiveModule(b, m.moduleType)) out.push(m.action);
  }
  return out;
}

/**
 * The shared structural `isOffered` predicate (§22.9). This is the SAME set of
 * gates Phase 2 applies — operational + not-built-this-turn ([D-022]) + set gating
 * (§10.2) + module gating + attention (via `pickBuildingActionAttention`, [D-057]).
 * Param-level checks (quantity>0, valid hull, target validity) remain per-order in
 * Phase 2 and are intentionally NOT part of the building-level availability query.
 */
export function buildingActionOffered(
  sub: Subdivision,
  b: Building,
  action: BuildingActionType,
  turnNumber: number,
  claimed: ReadonlySet<number>,
): boolean {
  if (b.builtOnTurn >= turnNumber) return false; // built this turn cannot act [D-022]
  if (!isOperational(b, turnNumber)) return false; // [D-012]
  // §10.2 surplus-set / module gating.
  switch (action) {
    case "BOOST_OUTPUT":
      if (!RESOURCE_GENERATORS.includes(b.type)) return false;
      if (garrisonSetCount(b) < 2) return false;
      break;
    case "EMERGENCY_EXTRACTION":
      if (!RESOURCE_GENERATORS.includes(b.type)) return false;
      break;
    case "RESEARCH_SPRINT":
      if (b.type !== "RESEARCH_COMPLEX" || garrisonSetCount(b) < 2) return false;
      break;
    case "LOCKDOWN":
      if (!hasActiveModule(b, "SECURITY_DETAIL")) return false;
      break;
    default:
      break;
  }
  // Attention: required garrisoned units must exist WITH unspent attention (§22.3).
  return pickBuildingActionAttention(sub, b, action, turnNumber, claimed) != null;
}

/**
 * §22.9 — the set of building actions currently fully valid on `building`. Reads
 * live `attentionSpentThisTurn` flags: once a garrisoned unit is spent, any action
 * that needed it drops off the list. Supersedes any standalone/global action list
 * ([D-061]). `turnNumber` and turn-start resources are taken from `game`/`sub`.
 */
export function availableActions(
  building: Building,
  sub: Subdivision,
  game: Game,
): BuildingActionType[] {
  const candidates = new Set<BuildingActionType>([
    ...base(building.type),
    ...garrisonUnlocked(building, sub),
    ...moduleUnlocked(building),
  ]);
  const empty: ReadonlySet<number> = new Set();
  const out: BuildingActionType[] = [];
  for (const a of candidates) {
    if (buildingActionOffered(sub, building, a, game.turnNumber, empty)) out.push(a);
  }
  return out;
}
