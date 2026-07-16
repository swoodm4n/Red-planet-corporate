/**
 * Phase 8 — Reporting (recompute & persist). §16 / [D-024], [D-035].
 * 1. Recompute market & equity prices.
 * 2. Recompute scores.
 * 3. Phase-8 ER accrual (Resource Export, Consistent Output, milestones).
 * 4. Toggle ER==30 universal bonus.
 * 5. Emit scoreboard.
 * 6. Increment turn.
 */

import type { TurnContext } from "../context.js";
import { tickEffects } from "../effects.js";
import { recomputeSharePrice } from "../equity.js";
import { accrueResourceExport, adjustEr, universalBonusActive } from "../earthRelations.js";
import { updateMarketPrices } from "../market.js";
import {
  categoryLeaders,
  CATEGORY_KEYS,
  computeCategoryScores,
  composite,
  rankByComposite,
  type Scoreboard,
} from "../scoring.js";
import type { Subdivision } from "../types.js";
import type { TurnLog } from "../orders.js";

const MILESTONES: { id: string; test: (game: TurnContext["game"], sub: Subdivision) => boolean }[] = [
  { id: "FIRST_TRANSIT_HUB", test: (_g, s) => s.buildings.some((b) => b.type === "TRANSIT_HUB" && b.status === "ACTIVE") },
  { id: "FIRST_RESEARCH_COMPLEX", test: (_g, s) => s.buildings.some((b) => b.type === "RESEARCH_COMPLEX" && b.status === "ACTIVE") },
  { id: "FIRST_VEHICLE", test: (_g, s) => s.vehicles.some((v) => v.status !== "DESTROYED") },
  { id: "FIRST_5TH_HEX", test: (g, s) => g.map.filter((h) => h.ownerSubdivisionId === s.id).length >= 5 },
  { id: "FIRST_PERSONNEL_15", test: (_g, s) => s.personnel.filter((p) => p.status !== "LOST" && p.status !== "CAPTURED").length >= 15 },
];

export function runPhase8(ctx: TurnContext): {
  scoreboard: TurnLog["scoreboard"];
  categoryLeaders: TurnLog["categoryLeaders"];
} {
  // 1. Recompute market & equity.
  updateMarketPrices(ctx.game.market);

  // 2. Scores (pre-ER; ER isn't scored).
  const boards: Scoreboard[] = ctx.game.subdivisions
    .filter((s) => s.status === "ACTIVE")
    .map((s) => {
      const categories = computeCategoryScores(ctx.game, s);
      return { subdivisionId: s.id, categories, composite: composite(categories) };
    });

  // Equity: recompute using this turn's composite + net-shares pressure.
  for (const board of boards) {
    const net = ctx.game.equity.netSharesTradedThisTurn[board.subdivisionId] ?? 0;
    ctx.game.equity.sharePrice[board.subdivisionId] = recomputeSharePrice(board.composite, net);
    ctx.game.equity.netSharesTradedThisTurn[board.subdivisionId] = 0;
  }

  // 3. Phase-8 ER accrual.
  for (const sub of ctx.game.subdivisions) {
    if (sub.status !== "ACTIVE") continue;
    accrueResourceExport(sub);
    // Consistent Output +1/turn while streak >= 3. [D-024]/[D-025]
    if (sub.consistentOutputStreak >= 3) {
      const d = adjustEr(sub, +1);
      if (d !== 0) ctx.log.push({ phase: 8, subdivisionId: sub.id, code: "ER_CONSISTENT_OUTPUT", message: `+${d} ER (consistent output)` });
    }
    // Milestones (first-to-achieve, +3 ER once). §13.3
    for (const m of MILESTONES) {
      if (ctx.game.milestonesClaimed.has(m.id)) continue;
      if (m.test(ctx.game, sub)) {
        ctx.game.milestonesClaimed.add(m.id);
        adjustEr(sub, +3);
        ctx.log.push({ phase: 8, subdivisionId: sub.id, code: "MILESTONE", message: `Milestone ${m.id}: +3 ER`, data: { milestone: m.id } });
      }
    }
  }

  // 4. Toggle ER==30 universal bonus.
  for (const sub of ctx.game.subdivisions) {
    sub.earthRelationsBonusActive = universalBonusActive(sub);
  }

  // 5. Scoreboard emit.
  const ranked = rankByComposite(boards);
  const scoreboard: TurnLog["scoreboard"] = ranked.map((b, i) => ({
    subdivisionId: b.subdivisionId,
    categories: { ...b.categories },
    composite: b.composite,
    rank: i + 1,
  }));
  const leaders = categoryLeaders(boards);
  const leadersOut: TurnLog["categoryLeaders"] = {};
  for (const k of CATEGORY_KEYS) leadersOut[k] = leaders[k];

  // 5b. Tick durational effects (before the turn increments). [D-042]
  tickEffects(ctx.game);

  // 6. Increment turn.
  ctx.game.turnNumber += 1;

  return { scoreboard, categoryLeaders: leadersOut };
}
