/**
 * Phase 6 — Political & Corporate Actions. §16, §10.4, §10.5 / [D-024].
 * Each subdivision: 1 Political + 1 Corporate (2 corporate if ER==30). Hostile
 * Acquisition counter-bids resolve deterministically (higher Cr wins) in the §15
 * step-3 canonical order. Appeal/Resupply schedule next-turn drops & adjust ER.
 */

import { BLACK_MARKET_CAP } from "../constants.js";
import type { TurnContext } from "../context.js";
import { adjustEr, emergencyResupplyAvailable, expeditedDeliveryFree } from "../earthRelations.js";
import { addResourceCapped } from "../helpers.js";
import { earthSaleProceeds } from "../market.js";
import { cr } from "../money.js";
import { rowMajorIndex } from "../map.js";
import type { CorporateActionOrder, PoliticalActionOrder } from "../orders.js";
import type { Personnel, PhysicalResource, Subdivision } from "../types.js";

export function runPhase6(ctx: TurnContext): void {
  const sorted = [...ctx.plan].sort((a, b) => a.subdivisionId - b.subdivisionId);

  // Political actions.
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub || !vs.politicalAction) continue;
    resolvePolitical(ctx, sub, vs.politicalAction);
  }

  // Corporate actions — collect Hostile Acquisitions for canonical resolution.
  interface HA { sub: Subdivision; order: CorporateActionOrder; targetSubId: number; targetHexIdx: number; declIndex: number }
  const acquisitions: HA[] = [];
  for (const vs of sorted) {
    const sub = getSub(ctx, vs.subdivisionId);
    if (!sub) continue;
    vs.corporateActions.forEach((order, i) => {
      if (order.action === "HOSTILE_ACQUISITION") {
        const targetSubId = order.params?.targetSubdivisionId ?? -1;
        acquisitions.push({ sub, order, targetSubId, targetHexIdx: 0, declIndex: i });
      } else {
        resolveCorporate(ctx, sub, order);
      }
    });
  }
  acquisitions.sort((a, b) => a.targetSubId - b.targetSubId || a.sub.id - b.sub.id || a.declIndex - b.declIndex);
  for (const a of acquisitions) resolveHostileAcquisition(ctx, a.sub, a.order);

  // Tally motions due this turn.
  tallyMotions(ctx);
}

function getSub(ctx: TurnContext, id: number): Subdivision | undefined {
  const s = ctx.game.subdivisions.find((x) => x.id === id);
  return s && s.status === "ACTIVE" ? s : undefined;
}

function pay(sub: Subdivision, fp: number): boolean {
  if (sub.resources.CREDITS < fp) return false;
  sub.resources.CREDITS -= fp;
  return true;
}

// ---- Political -------------------------------------------------------------

function resolvePolitical(ctx: TurnContext, sub: Subdivision, order: PoliticalActionOrder): void {
  switch (order.action) {
    case "APPEAL_TO_EARTH": {
      if (!pay(sub, cr(5))) return;
      adjustEr(sub, -3);
      const res = order.params?.resource ?? "FOOD";
      ctx.game.resupplyMissions.push({ subdivisionId: sub.id, resource: res, quantity: 10, arriveOnTurn: ctx.turnNumber + 1, kind: "APPEAL" });
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "APPEAL_TO_EARTH", message: `Appeal to Earth: -3 ER, +10 ${res} next turn` });
      return;
    }
    case "PROPOSE_MOTION": {
      if (!pay(sub, cr(3))) return;
      const motion = {
        id: ctx.game.nextIds.motion++,
        proposerSubdivisionId: sub.id,
        description: order.params?.description ?? "",
        votes: {} as Record<number, "FOR" | "AGAINST" | "ABSTAIN">,
        lobbyWeight: {} as Record<number, number>,
        resolveOnTurn: ctx.turnNumber + 1,
      };
      ctx.game.activeMotions.push(motion);
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "PROPOSE_MOTION", message: `Proposed motion ${motion.id}`, data: { motionId: motion.id } });
      return;
    }
    case "VOTE_ON_MOTION": {
      const motionId = order.params?.motionId;
      const motion = ctx.game.activeMotions.find((m) => m.id === motionId);
      if (!motion) return;
      motion.votes[sub.id] = order.params?.vote ?? "ABSTAIN";
      if (order.params?.lobbyVotes) motion.lobbyWeight[sub.id] = order.params.lobbyVotes;
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "VOTE", message: `Voted ${motion.votes[sub.id]} on motion ${motion.id}` });
      return;
    }
    case "DENOUNCE":
      pay(sub, cr(2));
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "DENOUNCE", message: `Denounced subdivision ${order.params?.targetSubdivisionId}` });
      return;
    case "PUBLIC_STATEMENT":
      pay(sub, cr(2));
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "PUBLIC_STATEMENT", message: order.params?.text ?? "" });
      return;
    case "FORM_AGREEMENT":
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "FORM_AGREEMENT", message: `Formed agreement (social)` });
      return;
  }
}

// ---- Corporate -------------------------------------------------------------

function resolveCorporate(ctx: TurnContext, sub: Subdivision, order: CorporateActionOrder): void {
  switch (order.action) {
    case "EMERGENCY_RESUPPLY": {
      if (!emergencyResupplyAvailable(sub)) {
        ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "RESUPPLY_UNAVAILABLE", message: `Emergency Resupply unavailable (ER<5)` });
        return;
      }
      if (!pay(sub, cr(8))) return;
      adjustEr(sub, -1);
      const res = order.params?.resource ?? "FOOD";
      ctx.game.resupplyMissions.push({ subdivisionId: sub.id, resource: res, quantity: 8, arriveOnTurn: ctx.turnNumber + 1, kind: "EMERGENCY" });
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "EMERGENCY_RESUPPLY", message: `Emergency Resupply: -1 ER, +8 ${res} next turn` });
      return;
    }
    case "EXPEDITED_DELIVERY": {
      const free = expeditedDeliveryFree(sub);
      if (!free && !pay(sub, cr(5))) return;
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "EXPEDITED_DELIVERY", message: `Expedited Delivery${free ? " (free)" : ""}` });
      return;
    }
    case "CORPORATE_AUDIT":
      if (!pay(sub, cr(4))) return;
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "CORPORATE_AUDIT", message: `Corporate Audit (intel revealed)`, data: { target: order.params?.targetSubdivisionId } });
      return;
    case "BLACK_MARKET_SALE": {
      if (!pay(sub, cr(2))) return;
      const res = order.params?.resource as PhysicalResource | undefined;
      let qty = Math.min(order.params?.quantity ?? 0, BLACK_MARKET_CAP);
      if (!res || qty <= 0) return;
      qty = Math.min(qty, sub.resources[res]);
      sub.resources[res] -= qty;
      ctx.game.market.soldThisTurn[res] += qty;
      const proceeds = earthSaleProceeds(ctx.game.market, res, qty);
      addResourceCapped(sub, "CREDITS", proceeds);
      sub.cum.creditsEarnedFromSales += proceeds;
      sub.cum.resourcesSoldUnits += qty;
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "BLACK_MARKET_SALE", message: `Black Market sold ${qty} ${res}`, data: { qty, res, proceeds } });
      return;
    }
    case "DISINFORMATION_CAMPAIGN":
      if (!pay(sub, cr(5))) return;
      ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "DISINFORMATION", message: `Disinformation Campaign` });
      return;
  }
}

function resolveHostileAcquisition(ctx: TurnContext, sub: Subdivision, order: CorporateActionOrder): void {
  if (!pay(sub, cr(10))) return;
  const targetSub = ctx.game.subdivisions.find((s) => s.id === order.params?.targetSubdivisionId);
  const targetUnit = targetSub?.personnel.find((p) => p.id === order.params?.targetUnitId);
  if (!targetSub || !targetUnit || targetUnit.status === "CAPTURED" || targetUnit.status === "LOST") {
    ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "ACQUISITION_INVALID", message: `Hostile Acquisition target invalid` });
    return;
  }
  const counterBid = order.params?.counterBid ?? 0; // supplied via target's notes/admin
  // Higher Cr wins; tie -> target keeps. §14.2.
  if (cr(10) > counterBid) {
    // Poach: transfer unit.
    targetSub.personnel = targetSub.personnel.filter((p) => p.id !== targetUnit.id);
    const moved: Personnel = { ...targetUnit, status: "AVAILABLE", assignedBuildingId: undefined, assignedVehicleId: undefined };
    sub.personnel.push(moved);
    ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "HOSTILE_ACQUISITION_SUCCESS", message: `Poached unit ${targetUnit.id} from subdivision ${targetSub.id}`, data: { unitId: targetUnit.id } });
  } else {
    // Counter-bid held; target pays its counter-bid.
    if (targetSub.resources.CREDITS >= counterBid) targetSub.resources.CREDITS -= counterBid;
    ctx.log.push({ phase: 6, subdivisionId: sub.id, code: "HOSTILE_ACQUISITION_FAILED", message: `Acquisition of unit ${targetUnit.id} repelled by counter-bid` });
  }
}

function tallyMotions(ctx: TurnContext): void {
  const remaining = [];
  for (const motion of ctx.game.activeMotions) {
    if (motion.resolveOnTurn > ctx.turnNumber) {
      remaining.push(motion);
      continue;
    }
    let forWeight = 0;
    let againstWeight = 0;
    for (const [subIdStr, vote] of Object.entries(motion.votes)) {
      const subId = Number(subIdStr);
      const weight = 1 + (motion.lobbyWeight[subId] ?? 0);
      if (vote === "FOR") forWeight += weight;
      else if (vote === "AGAINST") againstWeight += weight;
    }
    const passed = forWeight > againstWeight;
    ctx.log.push({ phase: 6, code: "MOTION_RESOLVED", message: `Motion ${motion.id} ${passed ? "passed" : "failed"}`, data: { motionId: motion.id, forWeight, againstWeight, passed } });
  }
  ctx.game.activeMotions = remaining;
}
