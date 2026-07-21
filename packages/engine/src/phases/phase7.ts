/**
 * Phase 7 — Event Roll. §16, §17 / [D-016], [D-034].
 * RNG order (§15 step 4): trigger -> scope -> tone -> target selection ->
 * per-event sub-rolls. Point-in-time effects are applied; durational output
 * modifiers are emitted as notifications (see engine README / report).
 */

import type { TurnContext } from "../context.js";
import { adjustEr } from "../earthRelations.js";
import { addEffect } from "../effects.js";
import { addResourceCapped, countActiveModule, hasActiveModule } from "../helpers.js";
import { neighbors, rowMajorIndex } from "../map.js";
import type { Building, HexCoord, ModuleType, Subdivision } from "../types.js";
import type { TurnLog } from "../orders.js";

/** Output-affecting module types eligible for Equipment Recall half-effect. [D-042] */
const RECALLABLE_MODULES: ModuleType[] = [
  "EFFICIENCY",
  "OPERATIONS_DIRECTOR",
  "PERSONNEL_MODULE",
  "TERRAIN_EXPLOIT",
];

export const EVENT_TRIGGER_PCT = 15;

export function runPhase7(ctx: TurnContext): TurnLog["event"] {
  const triggered = ctx.rng.percentSuccess(EVENT_TRIGGER_PCT);
  if (!triggered) {
    return { scope: "NONE", name: "No Event", message: "No event this turn", affectedSubdivisionIds: [] };
  }

  const scopeRoll = ctx.rng.nextInt(100);
  const scope = scopeRoll < 20 ? "COLONY" : scopeRoll < 55 ? "REGIONAL" : "SUBDIVISION";
  const toneRoll = ctx.rng.nextInt(100);
  const tone = toneRoll < 40 ? "HAZARD" : toneRoll < 70 ? "OPPORTUNITY" : "NEUTRAL";

  if (scope === "COLONY") return colonyEvent(ctx, tone);
  if (scope === "REGIONAL") return regionalEvent(ctx, tone);
  return subdivisionEvent(ctx, tone);
}

const activeSubs = (ctx: TurnContext): Subdivision[] =>
  ctx.game.subdivisions.filter((s) => s.status === "ACTIVE");

function isShielded(b: Building): boolean {
  return hasActiveModule(b, "HAZARD_SHIELD");
}

// ---- Colony-wide (roll 1-8) -----------------------------------------------

function colonyEvent(ctx: TurnContext, tone: string): TurnLog["event"] {
  const n = ctx.rng.nextInt(8) + 1;
  const affected: number[] = [];
  let name = "";
  let message = "";
  switch (n) {
    case 1:
      name = "Dust Storm Season";
      addEffect(ctx.game, {
        type: "OUTPUT_DELTA",
        scope: "COLONY",
        source: name,
        magnitude: -1,
        requiresUnshielded: true,
        turnsRemaining: 2,
        registeredTurn: ctx.turnNumber,
      });
      message = "-1 output to unshielded buildings for 2 turns";
      break;
    case 2:
      name = "Solar Flare";
      addEffect(ctx.game, {
        type: "NO_INTELLIGENCE",
        scope: "COLONY",
        source: name,
        turnsRemaining: 1,
        registeredTurn: ctx.turnNumber,
      });
      message = "No Intelligence actions colony-wide next turn";
      break;
    case 3:
      name = "Earth Supply Convoy";
      message = "Each subdivision may buy <=10 of one resource at 1:1 (opportunity)";
      break;
    case 4:
      name = "Atmospheric Breakthrough";
      for (const sub of activeSubs(ctx)) {
        const bios = sub.buildings.filter((b) => b.type === "BIO_FACILITY" && b.status === "ACTIVE");
        if (bios.length > 0) {
          addResourceCapped(sub, "FOOD", bios.length);
          affected.push(sub.id);
        }
      }
      message = "All Bio Facilities +1 F";
      break;
    case 5: {
      name = "Micrometeorite Shower";
      for (const sub of activeSubs(ctx)) {
        // per subdivision (ascending id): 30% a random unshielded building disabled 1 turn.
        const hit = ctx.rng.percentSuccess(30);
        if (!hit) continue;
        const candidates = sub.buildings.filter((b) => b.status === "ACTIVE" && !isShielded(b));
        if (candidates.length === 0) continue;
        const idx = ctx.rng.nextInt(candidates.length);
        const b = candidates[idx]!;
        b.disabledUntilTurn = ctx.turnNumber + 1;
        affected.push(sub.id);
        ctx.log.push({ phase: 7, subdivisionId: sub.id, code: "MICROMETEORITE", message: `Building ${b.id} disabled`, data: { buildingId: b.id } });
      }
      message = "Micrometeorite Shower (30% per subdivision)";
      break;
    }
    case 6:
      name = "Quiet Skies";
      message = "No effect";
      break;
    case 7:
      name = "Comms Festival";
      message = "Political actions -1 Cr (notification)";
      break;
    case 8: {
      name = "Equipment Recall";
      const mt = RECALLABLE_MODULES[ctx.rng.nextInt(RECALLABLE_MODULES.length)]!;
      addEffect(ctx.game, {
        type: "MODULE_HALF_EFFECT",
        scope: "COLONY",
        source: name,
        moduleType: mt,
        turnsRemaining: 1,
        registeredTurn: ctx.turnNumber,
      });
      message = `${mt} modules at half effect next turn`;
      break;
    }
  }
  return { scope: "COLONY", name, message, affectedSubdivisionIds: affected };
}

// ---- Regional (roll 1-6) --------------------------------------------------

function regionalEvent(ctx: TurnContext, tone: string): TurnLog["event"] {
  const n = ctx.rng.nextInt(6) + 1;
  // Deterministic default target region: densest contested cluster by ascending
  // hex index. Simplified: pick the lowest-index claimed hex and its owner.
  const claimed = ctx.game.map
    .filter((h) => h.ownerSubdivisionId != null)
    .sort((a, b) => rowMajorIndex(a.coord) - rowMajorIndex(b.coord));
  const focus = claimed[0];
  const affected: number[] = focus?.ownerSubdivisionId != null ? [focus.ownerSubdivisionId] : [];
  const regionHexes: HexCoord[] = focus ? [focus.coord, ...neighbors(focus.coord)] : [];
  let name = "";
  let message = "";
  switch (n) {
    case 1: {
      name = "Dust Devil";
      // Buildings in region+adjacent without Hazard Shield disabled 1 turn (point-in-time).
      for (const sub of ctx.game.subdivisions) {
        if (sub.status !== "ACTIVE") continue;
        for (const b of sub.buildings) {
          if (b.status !== "ACTIVE" || isShielded(b)) continue;
          if (!regionHexes.some((h) => h.col === b.hex.col && h.row === b.hex.row)) continue;
          b.disabledUntilTurn = ctx.turnNumber + 1;
        }
      }
      message = "Buildings in region without Hazard Shield disabled 1 turn";
      break;
    }
    case 2: name = "Mineral Vein Discovery"; message = "First to Survey gains free Terrain Exploit (notification)"; break;
    case 3: {
      name = "Seismic Event";
      addEffect(ctx.game, {
        type: "OUTPUT_DELTA",
        scope: "REGION",
        source: name,
        hexes: regionHexes,
        magnitude: -1,
        requiresNoRedundant: true,
        turnsRemaining: 1,
        registeredTurn: ctx.turnNumber,
      });
      message = "Region buildings without Redundant Systems -1 output next turn";
      break;
    }
    case 4: {
      name = "Equipment Cache";
      const sub = ctx.game.subdivisions.find((s) => s.id === focus?.ownerSubdivisionId);
      if (sub) {
        addResourceCapped(sub, "MINERALS", 5);
        addResourceCapped(sub, "CREDITS", 50000);
      }
      message = "A unit present claims 5 Min + 5 Cr";
      break;
    }
    case 5: name = "Territorial Tension"; message = "Prompt, no auto effect"; break;
    case 6: {
      name = "Ice Deposit Shift";
      addEffect(ctx.game, {
        type: "TERRAIN_EXPLOIT_SUSPEND",
        scope: "REGION",
        source: name,
        hexes: regionHexes,
        turnsRemaining: 1,
        registeredTurn: ctx.turnNumber,
      });
      message = "Region Water Terrain Exploit suspended next turn";
      break;
    }
  }
  return { scope: "REGIONAL", name, message, affectedSubdivisionIds: affected };
}

// ---- Subdivision (roll 1-8) -----------------------------------------------

function subdivisionEvent(ctx: TurnContext, tone: string): TurnLog["event"] {
  // Risk-weighted target selection. §17: +10% weight per building lacking
  // Redundant/Hazard; +15% dormant 3+.
  const subs = activeSubs(ctx);
  if (subs.length === 0) return { scope: "SUBDIVISION", name: "None", message: "", affectedSubdivisionIds: [] };
  const weights = subs.map((s) => {
    let w = 100; // base
    for (const b of s.buildings) {
      if (b.status !== "ACTIVE") continue;
      if (!hasActiveModule(b, "REDUNDANT_SYSTEMS") && !hasActiveModule(b, "HAZARD_SHIELD")) w += 10;
      if (b.dormantTurns >= 3) w += 15;
    }
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const pick = ctx.rng.nextInt(total);
  let acc = 0;
  let target = subs[0]!;
  for (let i = 0; i < subs.length; i++) {
    acc += weights[i]!;
    if (pick < acc) { target = subs[i]!; break; }
  }

  const n = ctx.rng.nextInt(8) + 1;
  let name = "";
  let message = "";
  switch (n) {
    case 1: {
      name = "Equipment Malfunction";
      const candidates = target.buildings.filter((b) => b.status === "ACTIVE" && !hasActiveModule(b, "REDUNDANT_SYSTEMS"));
      if (candidates.length > 0) {
        const idx = ctx.rng.nextInt(candidates.length);
        const b = candidates[idx]!;
        b.disabledUntilTurn = ctx.turnNumber + 1;
        message = `Building ${b.id} disabled 1 turn`;
      } else message = "No vulnerable building";
      break;
    }
    case 2: {
      name = "Personnel Dispute";
      const garrisoned = target.personnel.filter((p) => p.status === "GARRISONED").sort((a, b) => a.id - b.id);
      if (garrisoned.length > 0) {
        const idx = ctx.rng.nextInt(garrisoned.length);
        const u = garrisoned[idx]!;
        u.unavailableUntilTurn = ctx.turnNumber + 1;
        message = `Unit ${u.id} unavailable next turn`;
      } else message = "No garrisoned unit";
      break;
    }
    case 3: {
      name = "Surplus Shipment";
      addResourceCapped(target, "MINERALS", 5);
      message = "+5 Minerals";
      break;
    }
    case 4: {
      name = "Innovator Insight";
      const hasInnovator = target.personnel.some((p) => p.type === "INNOVATOR" && p.status !== "LOST" && p.status !== "CAPTURED");
      if (hasInnovator) {
        const { stored } = addResourceCapped(target, "RESEARCH", 3);
        target.cum.researchGenerated += stored;
        message = "+3 Research";
      } else message = "No Innovator (no effect)";
      break;
    }
    case 5: name = "Routine Inspection"; message = "No effect"; break;
    case 6: name = "Personnel Request"; message = "Flavor"; break;
    case 7: name = "Minor NPC Sabotage"; message = "Weak NPC Analyst attack (notification)"; break;
    case 8: {
      name = "Earth's Favor";
      adjustEr(target, +1);
      message = "+1 Earth Relations";
      break;
    }
  }
  ctx.log.push({ phase: 7, subdivisionId: target.id, code: "SUBDIVISION_EVENT", message: `${name}: ${message}` });
  return { scope: "SUBDIVISION", name, message, affectedSubdivisionIds: [target.id] };
}
