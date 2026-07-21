/**
 * Phase 2 — Simultaneous Resolution Check (validation, read-only). §16 / [D-021].
 * Validates every order against turn-start state; invalid orders are dropped
 * atomically and recorded. Produces the validated plan phases operate on.
 */

import { pickBuildingActionAttention, pickUnitActionAttention } from "./attention.js";
import { BUILDINGS, HULLS, MODULE_ALLOWED_ON, VEHICLE_MODULES } from "./constants.js";
import type { TurnContext, ValidatedSubmission } from "./context.js";
import { appealAvailable, universalBonusActive } from "./earthRelations.js";
import { noIntelligenceActive } from "./effects.js";
import {
  garrisonSetCount,
  hasActiveModule,
  isOperational,
  laborGarrisonMin,
} from "./helpers.js";
import { getHex, isAdjacent, sameCoord } from "./map.js";
import type {
  BuildingActionOrder,
  CorporateActionOrder,
  InvalidOrder,
  PoliticalActionOrder,
  Submission,
  UnitActionOrder,
} from "./orders.js";
import type { Building, Personnel, ResourceBundle, Subdivision } from "./types.js";

function affordable(res: ResourceBundle, cost: Partial<ResourceBundle>): boolean {
  for (const key of Object.keys(cost) as (keyof ResourceBundle)[]) {
    if (res[key] < (cost[key] ?? 0)) return false;
  }
  return true;
}

export function findSubdivision(ctx: TurnContext, id: number): Subdivision | undefined {
  return ctx.game.subdivisions.find((s) => s.id === id);
}

function findBuilding(sub: Subdivision, id: number): Building | undefined {
  return sub.buildings.find((b) => b.id === id);
}

function findUnit(sub: Subdivision, id: number): Personnel | undefined {
  return sub.personnel.find((p) => p.id === id);
}

function reject(
  ctx: TurnContext,
  subId: number,
  kind: InvalidOrder["kind"],
  reason: string,
  order: unknown,
): void {
  ctx.invalidOrders.push({ subdivisionId: subId, kind, reason, order });
}

/**
 * Pass 1 — validate garrison assignments and seed ctx.plan. Runs before garrison
 * application so the applier consumes validated assignments. Missing/late
 * submissions default to "repeat last garrison, no new actions" (§16 P1).
 */
export function validateGarrisonPhase(ctx: TurnContext, submissions: Submission[]): void {
  for (const sub of ctx.game.subdivisions) {
    if (sub.status !== "ACTIVE") continue;
    const submission = submissions.find((s) => s.subdivisionId === sub.id);
    const validated: ValidatedSubmission = {
      subdivisionId: sub.id,
      garrison: [],
      buildingActions: [],
      unitActions: [],
      corporateActions: [],
      raw:
        submission ??
        ({
          subdivisionId: sub.id,
          turnNumber: ctx.turnNumber,
          garrison: [],
          buildingActions: [],
          unitActions: [],
        } as Submission),
    };
    validated.garrison = submission
      ? validateGarrison(ctx, sub, submission)
      : deriveCurrentGarrison(sub);
    ctx.plan.push(validated);
  }
}

/**
 * Pass 2 — validate building/unit/political/corporate actions. Runs AFTER
 * garrison application so operational checks reflect this turn's garrison.
 */
export function validateActionsPhase(ctx: TurnContext, submissions: Submission[]): void {
  for (const validated of ctx.plan) {
    const sub = ctx.game.subdivisions.find((s) => s.id === validated.subdivisionId);
    if (!sub || sub.status !== "ACTIVE") continue;
    const submission = submissions.find((s) => s.subdivisionId === sub.id);
    if (!submission) continue; // late submission: no new actions

    // §22.4: reserve attention in submission-declaration order via a per-subdivision
    // `claimed` set so a later order cannot reuse a unit an earlier accepted order
    // already spent (closes the duplicate-unit bug, [D-057]). Building- and
    // unit-action candidate pools are disjoint (GARRISONED vs AVAILABLE/CREWING), so
    // sharing one `claimed` set is safe and turn-global ([D-059]).
    const claimed = new Set<number>();

    const acceptedBuilding: BuildingActionOrder[] = [];
    for (const a of submission.buildingActions) {
      if (!validateBuildingAction(ctx, sub, a)) continue;
      const b = findBuilding(sub, a.buildingId);
      if (!b) continue; // already rejected inside validateBuildingAction
      const picks = pickBuildingActionAttention(sub, b, a.action, ctx.turnNumber, claimed);
      if (picks == null) {
        reject(ctx, sub.id, "BUILDING", `insufficient unspent attention`, a);
        continue;
      }
      for (const id of picks) claimed.add(id);
      ctx.attentionPicks.set(a, picks);
      acceptedBuilding.push(a);
    }
    validated.buildingActions = acceptedBuilding;

    const acceptedUnit: UnitActionOrder[] = [];
    for (const a of submission.unitActions) {
      if (!validateUnitAction(ctx, sub, a)) continue;
      const picks = pickUnitActionAttention(sub, a, ctx.turnNumber, claimed);
      if (picks == null) {
        reject(ctx, sub.id, "UNIT", `insufficient unspent attention`, a);
        continue;
      }
      for (const id of picks) claimed.add(id);
      ctx.attentionPicks.set(a, picks);
      acceptedUnit.push(a);
    }
    validated.unitActions = acceptedUnit;
    if (submission.politicalAction) {
      if (validatePoliticalAction(ctx, sub, submission.politicalAction)) {
        validated.politicalAction = submission.politicalAction;
      }
    }
    validated.corporateActions = validateCorporateActions(
      ctx,
      sub,
      submission.corporateActions ?? [],
    );
  }
}

/** Reconstruct garrison assignments from current state (for repeat-last default). */
function deriveCurrentGarrison(sub: Subdivision): ValidatedSubmission["garrison"] {
  const out: ValidatedSubmission["garrison"] = [];
  for (const p of sub.personnel) {
    if (p.status === "GARRISONED" && p.assignedBuildingId != null) {
      out.push({ unitId: p.id, target: { kind: "BUILDING", buildingId: p.assignedBuildingId } });
    } else if (p.status === "CREWING" && p.assignedVehicleId != null) {
      out.push({ unitId: p.id, target: { kind: "VEHICLE", vehicleId: p.assignedVehicleId } });
    }
  }
  return out;
}

function validateGarrison(
  ctx: TurnContext,
  sub: Subdivision,
  submission: Submission,
): ValidatedSubmission["garrison"] {
  const out: ValidatedSubmission["garrison"] = [];
  const seen = new Set<number>();
  for (const g of submission.garrison) {
    const unit = findUnit(sub, g.unitId);
    if (!unit) {
      reject(ctx, sub.id, "GARRISON", `unit ${g.unitId} not found`, g);
      continue;
    }
    if (seen.has(g.unitId)) {
      reject(ctx, sub.id, "GARRISON", `unit ${g.unitId} assigned twice`, g);
      continue;
    }
    if (unit.status === "CAPTURED" || unit.status === "LOST" || unit.status === "UNHOUSED") {
      reject(ctx, sub.id, "GARRISON", `unit ${g.unitId} is ${unit.status}`, g);
      continue;
    }
    if (unit.unavailableUntilTurn >= ctx.turnNumber) {
      reject(ctx, sub.id, "GARRISON", `unit ${g.unitId} unavailable this turn`, g);
      continue;
    }
    if (g.target.kind === "BUILDING") {
      const b = findBuilding(sub, g.target.buildingId);
      if (!b || b.status === "DERELICT") {
        reject(ctx, sub.id, "GARRISON", `building ${g.target.buildingId} not found`, g);
        continue;
      }
    } else if (g.target.kind === "VEHICLE") {
      const vid = g.target.vehicleId;
      const v = sub.vehicles.find((x) => x.id === vid);
      if (!v) {
        reject(ctx, sub.id, "GARRISON", `vehicle ${vid} not found`, g);
        continue;
      }
    }
    seen.add(g.unitId);
    out.push(g);
  }
  return out;
}

function validateBuildingAction(
  ctx: TurnContext,
  sub: Subdivision,
  order: BuildingActionOrder,
): boolean {
  const b = findBuilding(sub, order.buildingId);
  if (!b) {
    reject(ctx, sub.id, "BUILDING", `building ${order.buildingId} not found`, order);
    return false;
  }
  // A building completed this turn cannot act. [D-022]
  if (b.builtOnTurn >= ctx.turnNumber) {
    reject(ctx, sub.id, "BUILDING", `building ${order.buildingId} built this turn cannot act`, order);
    return false;
  }
  if (!isOperational(b, ctx.turnNumber) && order.action !== "PRODUCE_VEHICLE") {
    reject(ctx, sub.id, "BUILDING", `building ${order.buildingId} not operational`, order);
    return false;
  }
  const start = ctx.turnStartResources.get(sub.id)!;

  switch (order.action) {
    case "MARKET_SALE": {
      if (b.type !== "TRANSIT_HUB") {
        reject(ctx, sub.id, "BUILDING", `Market Sale requires Transit Hub`, order);
        return false;
      }
      const qty = order.params?.quantity ?? 0;
      const res = order.params?.resource;
      if (!res || qty <= 0) {
        reject(ctx, sub.id, "BUILDING", `Market Sale needs resource+quantity`, order);
        return false;
      }
      if (start[res] < qty) {
        reject(ctx, sub.id, "BUILDING", `insufficient ${res} to sell`, order);
        return false;
      }
      return true;
    }
    case "BOOST_OUTPUT": {
      if (garrisonSetCount(b) < 2) {
        reject(ctx, sub.id, "BUILDING", `Boost Output needs a surplus garrison set`, order);
        return false;
      }
      return true;
    }
    case "COLONIST_REQUISITION": {
      if (b.type !== "HEADQUARTERS") {
        reject(ctx, sub.id, "BUILDING", `Colonist Requisition requires HQ`, order);
        return false;
      }
      const count = order.params?.colonistCount ?? 0;
      if (count <= 0 || count > 5) {
        reject(ctx, sub.id, "BUILDING", `Colonist Requisition count must be 1..5`, order);
        return false;
      }
      return true;
    }
    case "TERRITORIAL_CLAIM": {
      if (b.type !== "HEADQUARTERS") {
        reject(ctx, sub.id, "BUILDING", `Territorial Claim requires HQ`, order);
        return false;
      }
      return true;
    }
    case "PRODUCE_VEHICLE": {
      if (b.type !== "VEHICLE_WORKSHOP" || !isOperational(b, ctx.turnNumber)) {
        reject(ctx, sub.id, "BUILDING", `Produce Vehicle requires operational Vehicle Workshop`, order);
        return false;
      }
      const hull = order.params?.hull;
      if (!hull || !HULLS[hull]) {
        reject(ctx, sub.id, "BUILDING", `Produce Vehicle needs a valid hull`, order);
        return false;
      }
      // Validate module slots.
      const mods = order.params?.vehicleModules ?? [];
      let usedSlots = 0;
      for (const m of mods) {
        const spec = VEHICLE_MODULES[m];
        if (!spec) {
          reject(ctx, sub.id, "BUILDING", `unknown vehicle module ${m}`, order);
          return false;
        }
        usedSlots += spec.slots;
      }
      if (usedSlots > HULLS[hull].slots) {
        reject(ctx, sub.id, "BUILDING", `vehicle modules exceed hull slots`, order);
        return false;
      }
      return true;
    }
    case "AMPLIFY_CREDIT_YIELD":
      if (b.type !== "COMMERCIAL_HUB") {
        reject(ctx, sub.id, "BUILDING", `Amplify requires Commercial Hub`, order);
        return false;
      }
      return true;
    case "RESEARCH_SPRINT":
      if (b.type !== "RESEARCH_COMPLEX" || garrisonSetCount(b) < 2) {
        reject(ctx, sub.id, "BUILDING", `Research Sprint needs surplus Innovator set`, order);
        return false;
      }
      return true;
    case "LOCKDOWN": {
      if (!hasActiveModule(b, "SECURITY_DETAIL")) {
        reject(ctx, sub.id, "BUILDING", `Lockdown requires a Security Detail module`, order);
        return false;
      }
      return true;
    }
    case "RESOURCE_TRANSFER":
    case "PASSIVE_INTEL_SCAN":
    case "EMERGENCY_EXTRACTION":
      return true;
    default:
      return true;
  }
}

function validateUnitAction(
  ctx: TurnContext,
  sub: Subdivision,
  order: UnitActionOrder,
): boolean {
  // Vehicle actions act through a crewed vehicle, not an available personnel. §8.2
  if (order.action === "VEHICLE_MOVE" || order.action === "VEHICLE_ATTACK") {
    return validateVehicleAction(ctx, sub, order);
  }

  const unit = findUnit(sub, order.unitId);
  if (!unit) {
    reject(ctx, sub.id, "UNIT", `unit ${order.unitId} not found`, order);
    return false;
  }
  // Only AVAILABLE units can take unit actions. [D-037]
  if (unit.status !== "AVAILABLE") {
    reject(ctx, sub.id, "UNIT", `unit ${order.unitId} not available (${unit.status})`, order);
    return false;
  }
  if (unit.unavailableUntilTurn >= ctx.turnNumber) {
    reject(ctx, sub.id, "UNIT", `unit ${order.unitId} unavailable this turn`, order);
    return false;
  }

  const start = ctx.turnStartResources.get(sub.id)!;
  const requireType = (t: Personnel["type"], label: string): boolean => {
    if (unit.type !== t) {
      reject(ctx, sub.id, "UNIT", `${label} requires ${t}`, order);
      return false;
    }
    return true;
  };
  const requireEngineer = (): boolean => {
    if (unit.type !== "ENGINEER") {
      reject(ctx, sub.id, "UNIT", `${order.action} requires an Engineer`, order);
      return false;
    }
    return true;
  };

  switch (order.action) {
    case "CONSTRUCT_BUILDING": {
      if (!requireEngineer()) return false;
      const bt = order.params?.buildingType;
      if (!bt || !BUILDINGS[bt]) {
        reject(ctx, sub.id, "UNIT", `Construct needs a valid buildingType`, order);
        return false;
      }
      if (!order.targetHex) {
        reject(ctx, sub.id, "UNIT", `Construct needs a targetHex`, order);
        return false;
      }
      const hex = getHex(ctx.game.map, order.targetHex);
      if (!hex || hex.terrain === "IMPASSABLE" || hex.terrain === "LANDING_ZONE") {
        reject(ctx, sub.id, "UNIT", `cannot build on this hex`, order);
        return false;
      }
      if (!affordable(start, BUILDINGS[bt].buildCost)) {
        reject(ctx, sub.id, "UNIT", `insufficient resources to build ${bt}`, order);
        return false;
      }
      return true;
    }
    case "INSTALL_MODULE": {
      if (!requireEngineer()) return false;
      const mt = order.params?.moduleType;
      const b = order.targetBuildingId != null ? findBuilding(sub, order.targetBuildingId) : undefined;
      if (!mt || !b) {
        reject(ctx, sub.id, "UNIT", `Install Module needs moduleType + target building`, order);
        return false;
      }
      if (!MODULE_ALLOWED_ON[mt].includes(b.type)) {
        reject(ctx, sub.id, "UNIT", `${mt} not allowed on ${b.type}`, order);
        return false;
      }
      if (b.modules.length >= BUILDINGS[b.type].slots) {
        reject(ctx, sub.id, "UNIT", `no free module slots on building ${b.id}`, order);
        return false;
      }
      return true;
    }
    case "TIER_UPGRADE": {
      if (!requireEngineer()) return false;
      const b = order.targetBuildingId != null ? findBuilding(sub, order.targetBuildingId) : undefined;
      if (!b || b.type !== "OUTPOST") {
        reject(ctx, sub.id, "UNIT", `Tier Upgrade requires an Outpost`, order);
        return false;
      }
      return true;
    }
    case "PLACE_OUTPOST": {
      if (!requireEngineer()) return false;
      if (!order.targetHex) {
        reject(ctx, sub.id, "UNIT", `Place Outpost needs a targetHex`, order);
        return false;
      }
      const hex = getHex(ctx.game.map, order.targetHex);
      if (!hex || hex.terrain === "IMPASSABLE" || hex.terrain === "LANDING_ZONE") {
        reject(ctx, sub.id, "UNIT", `cannot place outpost here`, order);
        return false;
      }
      return true;
    }
    case "SURVEY_HEX":
    case "FIELD_RESEARCH":
    case "DEMOLISH":
    case "REPAIR_BUILDING":
      return true;
    case "SABOTAGE": {
      if (!requireType("ANALYST", "Sabotage")) return false;
      if (order.targetSubdivisionId == null || order.targetBuildingId == null) {
        reject(ctx, sub.id, "UNIT", `Sabotage needs target subdivision + building`, order);
        return false;
      }
      // Solar Flare blocks colony-wide Intelligence actions. [D-042]
      if (noIntelligenceActive(ctx.game, sub.id)) {
        reject(ctx, sub.id, "UNIT", `Intelligence actions blocked this turn (Solar Flare)`, order);
        return false;
      }
      return true;
    }
    case "INTERCEPT":
      return requireType("CONTRACTOR", "Intercept");
    case "PATROL":
      return requireType("CONTRACTOR", "Patrol");
    case "ENFORCE_TERRITORY": {
      if (!requireType("CONTRACTOR", "Enforce Territory")) return false;
      if (!order.targetHex) {
        reject(ctx, sub.id, "UNIT", `Enforce Territory needs a targetHex`, order);
        return false;
      }
      return true;
    }
    case "NEGOTIATE":
      return requireType("ADMINISTRATOR", "Negotiate");
    case "COUNTER_INTEL": {
      if (!requireType("ANALYST", "Counter-Intel")) return false;
      const b = order.targetBuildingId != null ? findBuilding(sub, order.targetBuildingId) : undefined;
      if (!b) {
        reject(ctx, sub.id, "UNIT", `Counter-Intel needs an own target building`, order);
        return false;
      }
      if (!affordable(start, { CREDITS: 20000 })) {
        reject(ctx, sub.id, "UNIT", `Counter-Intel unaffordable (2 Cr)`, order);
        return false;
      }
      return true;
    }
    case "LOBBY": {
      if (!requireType("ADMINISTRATOR", "Lobby")) return false;
      const motionId = order.params?.motionId;
      const votes = order.params?.lobbyVotes ?? 0;
      if (motionId == null || !ctx.game.activeMotions.some((m) => m.id === motionId)) {
        reject(ctx, sub.id, "UNIT", `Lobby needs a valid motionId`, order);
        return false;
      }
      if (votes <= 0) {
        reject(ctx, sub.id, "UNIT", `Lobby needs lobbyVotes > 0`, order);
        return false;
      }
      if (!affordable(start, { CREDITS: 30000 * votes })) {
        reject(ctx, sub.id, "UNIT", `Lobby unaffordable (3 Cr/vote)`, order);
        return false;
      }
      return true;
    }
    case "TRADE_ACTION": {
      if (!requireType("ADMINISTRATOR", "Trade Action")) return false;
      const issuerId = order.params?.equityIssuerSubdivisionId;
      const shares = order.params?.shares ?? 0;
      const kind = order.params?.tradeKind ?? "BUY";
      const issuer = ctx.game.subdivisions.find((s) => s.id === issuerId);
      if (!issuer || issuer.status !== "ACTIVE") {
        reject(ctx, sub.id, "UNIT", `Trade Action needs a valid issuer subdivision`, order);
        return false;
      }
      if (shares <= 0) {
        reject(ctx, sub.id, "UNIT", `Trade Action needs shares > 0`, order);
        return false;
      }
      const price = ctx.game.equity.sharePrice[issuerId!] ?? 0;
      if (kind === "BUY") {
        if (!affordable(start, { CREDITS: price * shares })) {
          reject(ctx, sub.id, "UNIT", `Trade Action unaffordable`, order);
          return false;
        }
      } else {
        // SELL: must currently hold at least `shares`.
        const held = ctx.game.equity.holdings.find(
          (h) => h.issuerSubdivisionId === issuerId && h.holderSubdivisionId === sub.id,
        );
        if (!held || held.shares < shares) {
          reject(ctx, sub.id, "UNIT", `Trade Action: not enough shares held to sell`, order);
          return false;
        }
      }
      return true;
    }
    default:
      return true;
  }
}

function validateVehicleAction(
  ctx: TurnContext,
  sub: Subdivision,
  order: UnitActionOrder,
): boolean {
  const v = sub.vehicles.find((x) => x.id === order.vehicleId);
  if (!v) {
    reject(ctx, sub.id, "UNIT", `vehicle ${order.vehicleId} not found`, order);
    return false;
  }
  if (v.status !== "ACTIVE") {
    reject(ctx, sub.id, "UNIT", `vehicle ${order.vehicleId} not active`, order);
    return false;
  }
  if (v.crew.length === 0) {
    reject(ctx, sub.id, "UNIT", `vehicle ${order.vehicleId} has no crew`, order);
    return false;
  }
  if (order.action === "VEHICLE_MOVE" && !order.targetHex) {
    reject(ctx, sub.id, "UNIT", `Vehicle Move needs a targetHex`, order);
    return false;
  }
  if (order.action === "VEHICLE_ATTACK") {
    if (order.targetSubdivisionId == null) {
      reject(ctx, sub.id, "UNIT", `Vehicle Attack needs a target subdivision`, order);
      return false;
    }
    if (order.targetVehicleId == null && order.targetBuildingId == null) {
      reject(ctx, sub.id, "UNIT", `Vehicle Attack needs a target vehicle or building`, order);
      return false;
    }
  }
  return true;
}

function validatePoliticalAction(
  ctx: TurnContext,
  sub: Subdivision,
  order: PoliticalActionOrder,
): boolean {
  // Exactly one political action; if two are supplied only the first field is used.
  if (order.action === "APPEAL_TO_EARTH") {
    if (!appealAvailable(sub)) {
      reject(ctx, sub.id, "POLITICAL", `Appeal to Earth unavailable at ER 0`, order);
      return false;
    }
  }
  if (
    (order.action === "PUBLIC_STATEMENT" || order.action === "PROPOSE_MOTION") &&
    !hasDiplomaticSuite(sub, ctx.turnNumber)
  ) {
    // Diplomatic Suite required for some political actions (§10.4). Broadcast/motion.
    // We enforce only for PROPOSE_MOTION to keep basic statements available.
    if (order.action === "PROPOSE_MOTION") {
      reject(ctx, sub.id, "POLITICAL", `Propose Motion requires a Diplomatic Suite`, order);
      return false;
    }
  }
  return true;
}

function hasDiplomaticSuite(sub: Subdivision, turn: number): boolean {
  return sub.buildings.some(
    (b) => isOperational(b, turn) && hasActiveModule(b, "DIPLOMATIC_SUITE"),
  );
}

function validateCorporateActions(
  ctx: TurnContext,
  sub: Subdivision,
  orders: CorporateActionOrder[],
): CorporateActionOrder[] {
  const maxAllowed = universalBonusActive(sub) ? 2 : 1;
  const out: CorporateActionOrder[] = [];
  for (const order of orders) {
    if (out.length >= maxAllowed) {
      reject(ctx, sub.id, "CORPORATE", `exceeds corporate action allowance (${maxAllowed})`, order);
      continue;
    }
    out.push(order);
  }
  return out;
}

export { affordable };
