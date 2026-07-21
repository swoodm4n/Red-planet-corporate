/**
 * Phase 5 — Unit Actions. §16, §10.3, §14 / [D-017], [D-018], [D-022], [D-028],
 * [D-030], [D-042].
 *
 * Sub-step 1: non-conflict actions resolve simultaneously (greedy, ascending id):
 *   construction/modules/survey/repair/field research, Trade Action (equity),
 *   Patrol, Negotiate, Lobby, Counter-Intel, Enforce Territory (deterministic
 *   §14.2), and vehicle moves that do not cross a rival closed border.
 * Sub-step 2: RNG conflicts + spotting (Sabotage, Intercept, Vehicle combat, and
 *   closed-border vehicle-move spotting) consume the seeded stream in the §15
 *   step-2 canonical order: (targetSubdivisionId, targetHex, attackerSubdivisionId,
 *   declaration index).
 */

import { spendAttention } from "../attention.js";
import { BUILDINGS, MODULES, TIER_UPGRADE_COST } from "../constants.js";
import type { TurnContext } from "../context.js";
import { resolveConflict } from "../conflict.js";
import { noIntelligenceActive } from "../effects.js";
import {
  addResourceCapped,
  countActiveModule,
  transitHubNetworkHexes,
  vehicleDefenseInvestment,
  vehicleMoveRange,
  vehicleWeaponInvestment,
} from "../helpers.js";
import { getHex, hexDistance, rowMajorIndex, sameCoord, terrainMoveCost } from "../map.js";
import { terrainBuildMineralSurcharge } from "../map.js";
import { cr } from "../money.js";
import { recomputeSharePrice, setShares, sharesHeld } from "../equity.js";
import type { UnitActionOrder } from "../orders.js";
import type { Building, Personnel, ResourceBundle, Subdivision, Vehicle } from "../types.js";

export function runPhase5(ctx: TurnContext): void {
  const sorted = [...ctx.plan].sort((a, b) => a.subdivisionId - b.subdivisionId);

  // §22.4: spend the attention reserved in Phase 2 for every accepted unit action
  // (actor for personnel actions; whole crew for vehicle actions, [D-060]). [D-056]
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    for (const order of vs.unitActions) {
      spendAttention(sub, ctx.attentionPicks.get(order) ?? []);
    }
  }

  // --- Sub-step 1: non-conflict actions (simultaneous, greedy) ---
  const outpostPlacements: { sub: Subdivision; order: UnitActionOrder }[] = [];
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    for (const order of vs.unitActions) {
      switch (order.action) {
        case "PLACE_OUTPOST":
          outpostPlacements.push({ sub, order });
          break;
        case "CONSTRUCT_BUILDING":
          constructBuilding(ctx, sub, order);
          break;
        case "INSTALL_MODULE":
          installModule(ctx, sub, order);
          break;
        case "TIER_UPGRADE":
          tierUpgrade(ctx, sub, order);
          break;
        case "SURVEY_HEX":
          surveyHex(ctx, sub, order);
          break;
        case "DEMOLISH":
          demolish(ctx, sub, order);
          break;
        case "REPAIR_BUILDING":
          repairBuilding(ctx, sub, order);
          break;
        case "FIELD_RESEARCH":
          fieldResearch(ctx, sub, order);
          break;
        case "TRADE_ACTION":
          tradeAction(ctx, sub, order);
          break;
        case "NEGOTIATE":
          negotiate(ctx, sub, order);
          break;
        case "LOBBY":
          lobby(ctx, sub, order);
          break;
        case "PATROL":
          patrol(ctx, sub, order);
          break;
        case "COUNTER_INTEL":
          counterIntel(ctx, sub, order);
          break;
        case "ENFORCE_TERRITORY":
          enforceTerritory(ctx, sub, order);
          break;
        case "VEHICLE_MOVE":
          // Non-crossing / hub-jump moves resolve here; crossing moves defer to conflicts.
          if (!vehicleMoveIsSpotted(ctx, sub, order)) vehicleMove(ctx, sub, order, false);
          break;
        default:
          break; // SABOTAGE / INTERCEPT / VEHICLE_ATTACK handled below
      }
    }
  }
  resolveOutpostPlacements(ctx, outpostPlacements);

  // --- Sub-step 2: conflict actions + spotting (seeded, canonical order) ---
  type ConflictKind = "SABOTAGE" | "INTERCEPT" | "VEHICLE_ATTACK" | "MOVE_SPOT";
  interface Conflict {
    kind: ConflictKind;
    sub: Subdivision;
    order: UnitActionOrder;
    unit?: Personnel;
    vehicle?: Vehicle;
    targetSubId: number;
    targetHexIdx: number;
    declIndex: number;
  }
  const conflicts: Conflict[] = [];
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    vs.unitActions.forEach((order, i) => {
      if (order.action === "SABOTAGE" || order.action === "INTERCEPT") {
        const unit = sub.personnel.find((p) => p.id === order.unitId);
        if (!unit || unit.status !== "AVAILABLE") return;
        const { targetSubId, targetHexIdx } = targetKeys(ctx, order);
        conflicts.push({ kind: order.action, sub, order, unit, targetSubId, targetHexIdx, declIndex: i });
      } else if (order.action === "VEHICLE_ATTACK") {
        const vehicle = sub.vehicles.find((v) => v.id === order.vehicleId);
        if (!vehicle || vehicle.status !== "ACTIVE") return;
        const { targetSubId, targetHexIdx } = targetKeys(ctx, order);
        conflicts.push({ kind: "VEHICLE_ATTACK", sub, order, vehicle, targetSubId, targetHexIdx, declIndex: i });
      } else if (order.action === "VEHICLE_MOVE") {
        // Only crossing moves (spotting) reach the conflict pass.
        if (!vehicleMoveIsSpotted(ctx, sub, order)) return;
        const vehicle = sub.vehicles.find((v) => v.id === order.vehicleId);
        if (!vehicle) return;
        const hex = order.targetHex;
        const owner = hex ? getHex(ctx.game.map, hex)?.ownerSubdivisionId ?? -1 : -1;
        conflicts.push({
          kind: "MOVE_SPOT", sub, order, vehicle,
          targetSubId: owner, targetHexIdx: hex ? rowMajorIndex(hex) : 0, declIndex: i,
        });
      }
    });
  }
  conflicts.sort(
    (a, b) =>
      a.targetSubId - b.targetSubId ||
      a.targetHexIdx - b.targetHexIdx ||
      a.sub.id - b.sub.id ||
      a.declIndex - b.declIndex,
  );
  for (const c of conflicts) {
    if (c.kind === "SABOTAGE") {
      if (spotAndMaybeCapture(ctx, c.sub, c.unit!, c.order)) continue;
      resolveSabotage(ctx, c.sub, c.unit!, c.order);
    } else if (c.kind === "INTERCEPT") {
      if (spotAndMaybeCapture(ctx, c.sub, c.unit!, c.order)) continue;
      resolveIntercept(ctx, c.sub, c.unit!, c.order);
    } else if (c.kind === "VEHICLE_ATTACK") {
      resolveVehicleAttack(ctx, c.sub, c.vehicle!, c.order);
    } else {
      // MOVE_SPOT: roll spotting; on failure the move proceeds.
      resolveVehicleMoveSpot(ctx, c.sub, c.vehicle!, c.order);
    }
  }
}

function getSub(ctx: TurnContext, id: number): Subdivision | undefined {
  const s = ctx.game.subdivisions.find((x) => x.id === id);
  return s && s.status === "ACTIVE" ? s : undefined;
}

function targetKeys(ctx: TurnContext, order: UnitActionOrder): { targetSubId: number; targetHexIdx: number } {
  const targetSubId = order.targetSubdivisionId ?? -1;
  const targetSub = ctx.game.subdivisions.find((s) => s.id === targetSubId);
  let targetHexIdx = 0;
  if (order.targetBuildingId != null && targetSub) {
    const tb = targetSub.buildings.find((b) => b.id === order.targetBuildingId);
    if (tb) targetHexIdx = rowMajorIndex(tb.hex);
  } else if (order.targetVehicleId != null && targetSub) {
    const tv = targetSub.vehicles.find((v) => v.id === order.targetVehicleId);
    if (tv) targetHexIdx = rowMajorIndex(tv.hex);
  }
  return { targetSubId, targetHexIdx };
}

function affordAndPay(sub: Subdivision, cost: Partial<ResourceBundle>): boolean {
  for (const key of Object.keys(cost) as (keyof ResourceBundle)[]) {
    if (sub.resources[key] < (cost[key] ?? 0)) return false;
  }
  for (const key of Object.keys(cost) as (keyof ResourceBundle)[]) {
    sub.resources[key] -= cost[key] ?? 0;
  }
  return true;
}

// ---- Non-conflict actions --------------------------------------------------

function constructBuilding(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const bt = order.params?.buildingType;
  const target = order.targetHex;
  if (!bt || !target) return;
  const hex = getHex(ctx.game.map, target);
  if (!hex) return;
  const cost = { ...BUILDINGS[bt].buildCost };
  const surcharge = terrainBuildMineralSurcharge(hex.terrain);
  if (surcharge > 0 && cost.MINERALS) {
    cost.MINERALS = Math.ceil(cost.MINERALS * (1 + surcharge));
  }
  if (!affordAndPay(sub, cost)) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "CONSTRUCT_UNAFFORDABLE", message: `Construct ${bt} unaffordable` });
    return;
  }
  const b: Building = {
    id: ctx.game.nextIds.building++,
    type: bt,
    tier: BUILDINGS[bt].tier,
    hex: target,
    status: "PENDING",
    builtOnTurn: ctx.turnNumber,
    modules: [],
    garrison: {},
    disabledUntilTurn: 0,
    dormantTurns: 0,
  };
  sub.buildings.push(b);
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "CONSTRUCT_BUILDING", message: `Constructed ${bt} (pending) id ${b.id}`, data: { buildingId: b.id } });
}

function installModule(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const mt = order.params?.moduleType;
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!mt || !b) return;
  if (b.modules.length >= BUILDINGS[b.type].slots) return;
  if (!affordAndPay(sub, MODULES[mt].buildCost)) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "MODULE_UNAFFORDABLE", message: `Install ${mt} unaffordable` });
    return;
  }
  b.modules.push({
    id: ctx.game.nextIds.module++,
    type: mt,
    status: "PENDING",
    ...(mt === "OPERATIONS_DIRECTOR" ? { operationsDirectorMode: order.params?.namedUnits ? "OUTPUT" : "OUTPUT" } : {}),
    ...(order.params?.namedUnits ? { namedUnits: order.params.namedUnits } : {}),
  });
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "INSTALL_MODULE", message: `Installed ${mt} (pending) on building ${b.id}`, data: { buildingId: b.id, moduleType: mt } });
}

function tierUpgrade(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!b || b.type !== "OUTPOST") return;
  if (!affordAndPay(sub, TIER_UPGRADE_COST)) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TIER_UPGRADE_UNAFFORDABLE", message: `Tier Upgrade unaffordable` });
    return;
  }
  b.type = "HEADQUARTERS";
  b.tier = "T1";
  b.status = "PENDING";
  b.builtOnTurn = ctx.turnNumber;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TIER_UPGRADE", message: `Outpost ${b.id} upgrading to HQ (pending)`, data: { buildingId: b.id } });
}

function surveyHex(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const target = order.targetHex;
  if (!target) return;
  const hex = getHex(ctx.game.map, target);
  if (!hex) return;
  hex.surveyed = true;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SURVEY", message: `Surveyed hex ${target.col},${target.row}`, data: { deposits: hex.deposits ?? {} } });
}

function demolish(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!b) return;
  const minCost = BUILDINGS[b.type].buildCost.MINERALS ?? 0;
  addResourceCapped(sub, "MINERALS", Math.floor(minCost / 2));
  // Free its garrison.
  for (const p of sub.personnel) {
    if (p.assignedBuildingId === b.id) {
      p.status = "AVAILABLE";
      p.assignedBuildingId = undefined;
    }
  }
  sub.buildings = sub.buildings.filter((x) => x.id !== b.id);
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "DEMOLISH", message: `Demolished building ${b.id}, recovered ${Math.floor(minCost / 2)} Min` });
}

function repairBuilding(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!b) return;
  if (!affordAndPay(sub, { CREDITS: 20000, MINERALS: 2 })) return;
  b.disabledUntilTurn = 0;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "REPAIR", message: `Repaired building ${b.id}` });
}

function fieldResearch(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const unit = sub.personnel.find((p) => p.id === order.unitId);
  if (!unit || unit.type !== "INNOVATOR") return;
  const { stored } = addResourceCapped(sub, "RESEARCH", 1);
  sub.cum.researchGenerated += stored;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "FIELD_RESEARCH", message: `Field Research +1 R` });
}

// ---- Equity Trade Action (§11.3 / [D-007], [D-042]) ------------------------

function tradeAction(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const issuerId = order.params?.equityIssuerSubdivisionId;
  const shares = order.params?.shares ?? 0;
  const kind = order.params?.tradeKind ?? "BUY";
  if (issuerId == null || shares <= 0) return;
  const issuer = ctx.game.subdivisions.find((s) => s.id === issuerId);
  if (!issuer || issuer.status !== "ACTIVE") return;
  const eq = ctx.game.equity;
  const price = eq.sharePrice[issuerId] ?? recomputeSharePrice(0, 0); // pre-turn (frozen) price
  const cost = price * shares;

  if (kind === "BUY") {
    // Shares are bought from the issuer's treasury (its own retained holdings). [D-042]
    const treasury = sharesHeld(eq, issuerId, issuerId);
    if (treasury < shares) {
      ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TRADE_ACTION_FAILED", message: `Not enough issuer ${issuerId} shares available` });
      return;
    }
    if (sub.resources.CREDITS < cost) {
      ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TRADE_ACTION_FAILED", message: `Insufficient Credits to buy ${shares} shares` });
      return;
    }
    sub.resources.CREDITS -= cost;
    setShares(eq, issuerId, issuerId, treasury - shares);
    setShares(eq, issuerId, sub.id, sharesHeld(eq, issuerId, sub.id) + shares);
    addResourceCapped(issuer, "CREDITS", cost); // proceeds to the issuer treasury
    eq.netSharesTradedThisTurn[issuerId] = (eq.netSharesTradedThisTurn[issuerId] ?? 0) + shares;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TRADE_ACTION", message: `Bought ${shares} shares of subdivision ${issuerId} for ${cost / 10000} Cr`, data: { issuerId, shares, kind, cost } });
  } else {
    // SELL: seller returns shares to the issuer treasury and is paid at the frozen price.
    const held = sharesHeld(eq, issuerId, sub.id);
    if (held < shares) {
      ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TRADE_ACTION_FAILED", message: `Do not hold ${shares} shares of subdivision ${issuerId}` });
      return;
    }
    const pay = Math.min(cost, issuer.resources.CREDITS); // issuer buys back from treasury Credits [D-020]
    setShares(eq, issuerId, sub.id, held - shares);
    setShares(eq, issuerId, issuerId, sharesHeld(eq, issuerId, issuerId) + shares);
    issuer.resources.CREDITS -= pay;
    addResourceCapped(sub, "CREDITS", pay);
    eq.netSharesTradedThisTurn[issuerId] = (eq.netSharesTradedThisTurn[issuerId] ?? 0) - shares;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "TRADE_ACTION", message: `Sold ${shares} shares of subdivision ${issuerId} for ${pay / 10000} Cr`, data: { issuerId, shares, kind, proceeds: pay } });
  }
}

// ---- Political-flavoured unit actions (§10.3) ------------------------------

function negotiate(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "NEGOTIATE", message: `Negotiated with subdivision ${order.targetSubdivisionId ?? "?"} (social)`, data: { target: order.targetSubdivisionId } });
}

function lobby(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const motionId = order.params?.motionId;
  const votes = order.params?.lobbyVotes ?? 0;
  const motion = ctx.game.activeMotions.find((m) => m.id === motionId);
  if (!motion || votes <= 0) return;
  if (!affordAndPay(sub, { CREDITS: cr(3) * votes })) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "LOBBY_UNAFFORDABLE", message: `Lobby unaffordable` });
    return;
  }
  motion.lobbyWeight[sub.id] = (motion.lobbyWeight[sub.id] ?? 0) + votes;
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "LOBBY", message: `Lobbied motion ${motion.id} +${votes} weight`, data: { motionId: motion.id, votes } });
}

function patrol(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const target = order.targetHex;
  // Report rival buildings on/adjacent to the patrolled hex (partial reveal, §18).
  const seen: { subdivisionId: number; buildingId: number; type: string; hex: { col: number; row: number } }[] = [];
  if (target) {
    for (const other of ctx.game.subdivisions) {
      if (other.id === sub.id || other.status !== "ACTIVE") continue;
      for (const b of other.buildings) {
        if (b.status === "DERELICT") continue;
        if (hexDistance(b.hex, target) <= 1) {
          seen.push({ subdivisionId: other.id, buildingId: b.id, type: b.type, hex: { ...b.hex } });
        }
      }
    }
  }
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "PATROL", message: `Patrol report: ${seen.length} rival building(s) sighted`, data: { sighted: seen } });
}

function counterIntel(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const b = order.targetBuildingId != null ? sub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  if (!b) return;
  if (!affordAndPay(sub, { CREDITS: cr(2) })) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "COUNTER_INTEL_UNAFFORDABLE", message: `Counter-Intel unaffordable` });
    return;
  }
  ctx.scratch.autoDefendBuildings.add(b.id);
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "COUNTER_INTEL", message: `Counter-Intel active on building ${b.id} (auto-defend)`, data: { buildingId: b.id } });
}

function enforceTerritory(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): void {
  const target = order.targetHex;
  if (!target) return;
  const hex = getHex(ctx.game.map, target);
  if (!hex || hex.ownerSubdivisionId == null || hex.ownerSubdivisionId === sub.id) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "ENFORCE_NO_TARGET", message: `Enforce Territory: hex not held by a rival` });
    return;
  }
  const incumbent = ctx.game.subdivisions.find((s) => s.id === hex.ownerSubdivisionId);
  if (!incumbent) return;

  // §14.2 territorial dispute: Σ(Contractors + Fortification tiers) each side.
  const defense = incumbent.buildings
    .filter((b) => sameCoord(b.hex, target))
    .reduce((n, b) => n + (b.garrison.CONTRACTOR ?? 0) + countActiveModule(b, "FORTIFICATION") + countActiveModule(b, "SECURITY_DETAIL"), 0);
  const attack = 1 + sub.buildings
    .filter((b) => sameCoord(b.hex, target) || hexDistance(b.hex, target) <= 1)
    .reduce((n, b) => n + countActiveModule(b, "FORTIFICATION"), 0);

  // Higher holds; tie -> incumbent holds (deterministic, no RNG). §14.2
  if (attack > defense) {
    hex.ownerSubdivisionId = sub.id;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "ENFORCE_SUCCESS", message: `Enforced claim on ${target.col},${target.row} (A ${attack} > D ${defense})`, data: { hex: target, attack, defense } });
  } else {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "ENFORCE_FAILED", message: `Enforce failed on ${target.col},${target.row} (A ${attack} <= D ${defense})`, data: { hex: target, attack, defense } });
  }
}

// ---- Vehicle movement (§9) -------------------------------------------------

/** True if the vehicle move would cross a rival closed border via adjacency. */
function vehicleMoveIsSpotted(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder): boolean {
  const v = sub.vehicles.find((x) => x.id === order.vehicleId);
  const target = order.targetHex;
  if (!v || !target) return false;
  // Hub jumps never trigger spotting (§9.3).
  if (isHubJump(ctx, sub, v, target)) return false;
  const dest = getHex(ctx.game.map, target);
  const owner = dest?.ownerSubdivisionId;
  if (owner == null || owner === sub.id) return false;
  const ownerSub = ctx.game.subdivisions.find((s) => s.id === owner);
  if (!ownerSub) return false;
  return ownerSub.closedBordersAgainst.has("ALL") || ownerSub.closedBordersAgainst.has(sub.id);
}

function isHubJump(ctx: TurnContext, sub: Subdivision, v: Vehicle, target: import("../types.js").HexCoord): boolean {
  const network = transitHubNetworkHexes(ctx.game, sub);
  const atNode = network.some((h) => sameCoord(h, v.hex));
  const toNode = network.some((h) => sameCoord(h, target));
  return atNode && toNode;
}

function vehicleReachable(ctx: TurnContext, sub: Subdivision, v: Vehicle, target: import("../types.js").HexCoord): boolean {
  const dest = getHex(ctx.game.map, target);
  if (!dest) return false;
  if (dest.terrain === "IMPASSABLE") return false;
  if (isHubJump(ctx, sub, v, target)) return true;
  const range = vehicleMoveRange(v);
  const dist = hexDistance(v.hex, target);
  if (dist === 0) return true;
  // Entering difficult terrain consumes the whole move (cost 2). §9.3
  if (terrainMoveCost(dest.terrain) > range) return false;
  return dist <= range;
}

function vehicleMove(ctx: TurnContext, sub: Subdivision, order: UnitActionOrder, viaSpotPass: boolean): void {
  const v = sub.vehicles.find((x) => x.id === order.vehicleId);
  const target = order.targetHex;
  if (!v || !target || v.status !== "ACTIVE") return;
  if (v.crew.length === 0) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_MOVE_FAILED", message: `Vehicle ${v.id} has no crew` });
    return;
  }
  if (!vehicleReachable(ctx, sub, v, target)) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_MOVE_FAILED", message: `Vehicle ${v.id} cannot reach ${target.col},${target.row}` });
    return;
  }
  v.hex = { ...target };
  const via = isHubJump(ctx, sub, v, target) ? "hub jump" : viaSpotPass ? "unspotted crossing" : "move";
  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_MOVE", message: `Vehicle ${v.id} moved to ${target.col},${target.row} (${via})`, data: { vehicleId: v.id, hex: target } });
}

function resolveVehicleMoveSpot(ctx: TurnContext, sub: Subdivision, v: Vehicle, order: UnitActionOrder): void {
  const target = order.targetHex;
  if (!target) return;
  const dest = getHex(ctx.game.map, target);
  const owner = dest?.ownerSubdivisionId;
  const ownerSub = owner != null ? ctx.game.subdivisions.find((s) => s.id === owner) : undefined;
  const analystCrewed = v.crew.some((id) => sub.personnel.find((p) => p.id === id)?.type === "ANALYST");
  const chance = ownerSub ? spotChance(ownerSub, target, analystCrewed) : 0;
  if (ctx.rng.percentSuccess(chance)) {
    // Spotted vehicle: move cancelled, held at origin, owner notified. [D-042]
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_SPOTTED", message: `Vehicle ${v.id} spotted crossing closed border of subdivision ${owner}; move cancelled`, data: { vehicleId: v.id, spotter: owner } });
    return;
  }
  vehicleMove(ctx, sub, order, true);
}

// ---- Outpost placement -----------------------------------------------------

function resolveOutpostPlacements(
  ctx: TurnContext,
  placements: { sub: Subdivision; order: UnitActionOrder }[],
): void {
  const byHex = new Map<string, { sub: Subdivision; order: UnitActionOrder }[]>();
  for (const p of placements) {
    const t = p.order.targetHex;
    if (!t) continue;
    const key = `${t.col},${t.row}`;
    const arr = byHex.get(key) ?? [];
    arr.push(p);
    byHex.set(key, arr);
  }
  for (const [key, group] of byHex) {
    const hex = ctx.game.map.find((h) => `${h.coord.col},${h.coord.row}` === key);
    if (!hex) continue;
    if (group.length > 1) {
      ctx.log.push({ phase: 5, code: "OUTPOST_COLLISION", message: `Simultaneous outpost claims on ${key} cancelled (refunded)` });
      continue;
    }
    const p = group[0]!;
    if (hex.ownerSubdivisionId != null && hex.ownerSubdivisionId !== p.sub.id) {
      ctx.log.push({ phase: 5, subdivisionId: p.sub.id, code: "OUTPOST_CONTESTED", message: `Hex ${key} already claimed` });
      continue;
    }
    if (!affordAndPay(p.sub, BUILDINGS.OUTPOST.buildCost)) {
      ctx.log.push({ phase: 5, subdivisionId: p.sub.id, code: "OUTPOST_UNAFFORDABLE", message: `Place Outpost unaffordable` });
      continue;
    }
    const b: Building = {
      id: ctx.game.nextIds.building++,
      type: "OUTPOST",
      tier: "T0",
      hex: hex.coord,
      status: "PENDING",
      builtOnTurn: ctx.turnNumber,
      modules: [],
      garrison: {},
      disabledUntilTurn: 0,
      dormantTurns: 0,
    };
    p.sub.buildings.push(b);
    hex.ownerSubdivisionId = p.sub.id;
    ctx.log.push({ phase: 5, subdivisionId: p.sub.id, code: "PLACE_OUTPOST", message: `Placed Outpost (pending) on ${key}`, data: { buildingId: b.id } });
  }
}

// ---- Conflicts (§14) -------------------------------------------------------

function defenseInvestment(ctx: TurnContext, _targetSub: Subdivision, b: Building): { investment: number; autoDefend: boolean } {
  const contractors = b.garrison.CONTRACTOR ?? 0;
  const security = countActiveModule(b, "SECURITY_DETAIL");
  const fort = countActiveModule(b, "FORTIFICATION");
  const autoDefend = ctx.scratch.autoDefendBuildings.has(b.id);
  return { investment: contractors + security + fort, autoDefend };
}

function resolveSabotage(ctx: TurnContext, sub: Subdivision, _unit: Personnel, order: UnitActionOrder): void {
  // Solar Flare blocks colony-wide Intelligence actions. [D-042]
  if (noIntelligenceActive(ctx.game, sub.id)) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SABOTAGE_BLOCKED", message: `Sabotage blocked (no Intelligence actions this turn)` });
    return;
  }
  const targetSub = ctx.game.subdivisions.find((s) => s.id === order.targetSubdivisionId);
  const targetB = targetSub?.buildings.find((b) => b.id === order.targetBuildingId);
  if (!targetSub || !targetB) return;

  const commsAid = sub.buildings.some((b) => b.type === "COMMUNICATIONS_ARRAY" && b.status === "ACTIVE") ? 1 : 0;
  const attacker = 1 + commsAid;
  const def = defenseInvestment(ctx, targetSub, targetB);

  const result = resolveConflict(ctx.rng, {
    attackerInvestment: attacker,
    defenderInvestment: def.investment,
    defenderAutoDefend: def.autoDefend,
  });

  if (result.success) {
    targetB.disabledUntilTurn = ctx.turnNumber + 1;
    sub.cum.successfulSabotageActions += 1;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SABOTAGE_SUCCESS", message: `Sabotaged building ${targetB.id} of subdivision ${targetSub.id}`, data: { target: targetSub.id, buildingId: targetB.id } });
  } else {
    targetSub.cum.successfulSabotageDefenses += 1;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SABOTAGE_FAILED", message: `Sabotage on building ${targetB.id} failed (attacker exposed)`, data: { target: targetSub.id, buildingId: targetB.id } });
  }
}

function resolveIntercept(ctx: TurnContext, sub: Subdivision, _unit: Personnel, _order: UnitActionOrder): void {
  const result = resolveConflict(ctx.rng, { attackerInvestment: 1, defenderInvestment: 1 });
  if (result.success) {
    sub.cum.successfulIntercepts += 1;
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "INTERCEPT_SUCCESS", message: `Intercept succeeded` });
  } else {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "INTERCEPT_FAILED", message: `Intercept failed` });
  }
}

// ---- Vehicle combat (§14 / [D-030]) ----------------------------------------

function resolveVehicleAttack(ctx: TurnContext, sub: Subdivision, v: Vehicle, order: UnitActionOrder): void {
  const targetSub = ctx.game.subdivisions.find((s) => s.id === order.targetSubdivisionId);
  if (!targetSub || targetSub.status !== "ACTIVE") return;
  const attacker = vehicleWeaponInvestment(sub, v);

  // Range gate: attacker must be at or adjacent to the target's hex.
  const targetVehicle = order.targetVehicleId != null ? targetSub.vehicles.find((x) => x.id === order.targetVehicleId) : undefined;
  const targetBuilding = order.targetBuildingId != null ? targetSub.buildings.find((x) => x.id === order.targetBuildingId) : undefined;
  const targetHex = targetVehicle?.hex ?? targetBuilding?.hex;
  if (!targetHex || hexDistance(v.hex, targetHex) > 1) {
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_ATTACK_OUT_OF_RANGE", message: `Vehicle ${v.id} target out of range` });
    return;
  }

  if (targetVehicle && targetVehicle.status === "ACTIVE") {
    const defense = vehicleDefenseInvestment(targetSub, targetVehicle);
    const result = resolveConflict(ctx.rng, { attackerInvestment: attacker, defenderInvestment: defense });
    if (result.success) {
      targetVehicle.status = "DESTROYED";
      freeCrew(targetSub, targetVehicle);
      ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_ATTACK_SUCCESS", message: `Vehicle ${v.id} destroyed rival vehicle ${targetVehicle.id}`, data: { vehicleId: targetVehicle.id, target: targetSub.id } });
    } else {
      ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_ATTACK_FAILED", message: `Vehicle ${v.id} attack on vehicle ${targetVehicle.id} failed`, data: { vehicleId: targetVehicle.id, target: targetSub.id } });
    }
    return;
  }

  if (targetBuilding) {
    const def = defenseInvestment(ctx, targetSub, targetBuilding);
    const result = resolveConflict(ctx.rng, { attackerInvestment: attacker, defenderInvestment: def.investment, defenderAutoDefend: def.autoDefend });
    if (result.success) {
      targetBuilding.disabledUntilTurn = ctx.turnNumber + 1;
      ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_ATTACK_SUCCESS", message: `Vehicle ${v.id} disabled building ${targetBuilding.id}`, data: { buildingId: targetBuilding.id, target: targetSub.id } });
    } else {
      targetSub.cum.successfulSabotageDefenses += 1;
      ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_ATTACK_FAILED", message: `Vehicle ${v.id} attack on building ${targetBuilding.id} repelled`, data: { buildingId: targetBuilding.id, target: targetSub.id } });
    }
    return;
  }

  ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "VEHICLE_ATTACK_INVALID", message: `Vehicle ${v.id} has no valid target` });
}

/** Free a destroyed vehicle's crew back to the available pool (next turn). [D-030/D-033] */
function freeCrew(sub: Subdivision, v: Vehicle): void {
  for (const id of v.crew) {
    const p = sub.personnel.find((x) => x.id === id);
    if (p) {
      p.status = "AVAILABLE";
      p.assignedVehicleId = undefined;
    }
  }
  v.crew = [];
}

// ---- Spotting (§14.4 / [D-028]) --------------------------------------------

/** Spotting chance (percent) for a unit/vehicle crossing `targetSub`'s closed hex. */
function spotChance(
  targetSub: Subdivision,
  targetHex: import("../types.js").HexCoord,
  isAnalyst: boolean,
): number {
  let chance = 20;
  const fortOnHex = targetSub.buildings
    .filter((b) => sameCoord(b.hex, targetHex))
    .reduce((n, b) => n + countActiveModule(b, "FORTIFICATION"), 0);
  chance += 10 * fortOnHex;
  if (isAnalyst) chance -= 10;
  return Math.max(0, Math.min(100, chance));
}

function spotAndMaybeCapture(ctx: TurnContext, sub: Subdivision, unit: Personnel, order: UnitActionOrder): boolean {
  const targetSub = ctx.game.subdivisions.find((s) => s.id === order.targetSubdivisionId);
  if (!targetSub || targetSub.id === sub.id) return false;
  const targetB = targetSub.buildings.find((b) => b.id === order.targetBuildingId);
  if (!targetB) return false;
  const closed =
    targetSub.closedBordersAgainst.has("ALL") || targetSub.closedBordersAgainst.has(sub.id);
  if (!closed) return false;

  const chance = spotChance(targetSub, targetB.hex, unit.type === "ANALYST");
  const spotted = ctx.rng.percentSuccess(chance);
  if (spotted) {
    unit.status = "CAPTURED";
    unit.assignedBuildingId = undefined;
    unit.assignedVehicleId = undefined;
    sub.personnel = sub.personnel.filter((p) => p.id !== unit.id);
    targetSub.capturedUnits.push(unit);
    ctx.log.push({ phase: 5, subdivisionId: sub.id, code: "SPOTTED_CAPTURED", message: `Unit ${unit.id} captured crossing closed border of subdivision ${targetSub.id}`, data: { unitId: unit.id, captor: targetSub.id } });
    return true;
  }
  return false;
}

export { hexDistance };
