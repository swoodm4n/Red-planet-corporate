/**
 * Structured, audited game-state authoring. [D-046][D-047]
 *
 * These operations let an admin (a) directly edit persisted state, (b) manually
 * trigger the mechanical consequence of any event, and (c) grant freeform-research
 * effects — ALL through a fixed set of STRUCTURED ops, never free-text-executed
 * code. Each op only authors DATA that the engine already interprets (resource
 * numbers, ER, building disable flags, ActiveEffect records, hex ownership,
 * oxygen, milestones). No game logic is computed here; the engine derives every
 * consequence on the next resolution.
 *
 * `REGISTER_EFFECT` defaults `registeredTurn` to (turnNumber - 1) so the effect
 * bites the very next resolved turn for `turnsRemaining` turns (see effects.ts /
 * [D-042]); an explicit `registeredTurn` may override this.
 */

import type {
  ActiveEffect,
  EffectScope,
  EffectType,
  Game,
  ModuleType,
  PhysicalResource,
} from "@rpc/engine";
import { cr } from "@rpc/engine";

export type ResourceKey = "CREDITS" | PhysicalResource;

export type StateEdit =
  | { op: "SET_RESOURCE"; subdivisionId: number; resource: ResourceKey; value: number; asCredits?: boolean }
  | { op: "ADD_RESOURCE"; subdivisionId: number; resource: ResourceKey; amount: number; asCredits?: boolean }
  | { op: "SET_EARTH_RELATIONS"; subdivisionId: number; value: number }
  | { op: "ADJUST_EARTH_RELATIONS"; subdivisionId: number; delta: number }
  | { op: "DISABLE_BUILDING"; subdivisionId: number; buildingId: number; untilTurn: number }
  | { op: "SET_HEX_OWNER"; col: number; row: number; ownerSubdivisionId: number | null }
  | { op: "SET_OXYGEN"; value: number }
  | { op: "ADD_MILESTONE"; milestoneId: string }
  | {
      op: "REGISTER_EFFECT";
      effectType: EffectType;
      scope: EffectScope;
      source: string;
      turnsRemaining: number;
      magnitude?: number;
      subdivisionId?: number;
      buildingId?: number;
      hexes?: { col: number; row: number }[];
      moduleType?: ModuleType;
      requiresUnshielded?: boolean;
      requiresNoRedundant?: boolean;
      registeredTurn?: number;
    }
  | { op: "RELEASE_CAPTIVE"; captorSubdivisionId: number; personnelId: number; toSubdivisionId?: number };

export interface EditResult {
  applied: string[];
  warnings: string[];
}

function findSub(game: Game, id: number) {
  return game.subdivisions.find((s) => s.id === id);
}

function clampEr(v: number): number {
  return Math.max(0, Math.min(30, Math.round(v)));
}

/** Apply structured edits to an engine Game in place. Returns per-op outcomes. */
export function applyStateEdits(game: Game, edits: StateEdit[]): EditResult {
  const applied: string[] = [];
  const warnings: string[] = [];

  for (const edit of edits) {
    switch (edit.op) {
      case "SET_RESOURCE": {
        const sub = findSub(game, edit.subdivisionId);
        if (!sub) { warnings.push(`SET_RESOURCE: subdivision ${edit.subdivisionId} not found`); break; }
        const val = edit.resource === "CREDITS" && edit.asCredits ? cr(edit.value) : edit.value;
        sub.resources[edit.resource] = Math.max(0, Math.round(val));
        applied.push(`SET_RESOURCE ${edit.resource}=${sub.resources[edit.resource]} for sub ${sub.id}`);
        break;
      }
      case "ADD_RESOURCE": {
        const sub = findSub(game, edit.subdivisionId);
        if (!sub) { warnings.push(`ADD_RESOURCE: subdivision ${edit.subdivisionId} not found`); break; }
        const amt = edit.resource === "CREDITS" && edit.asCredits ? cr(edit.amount) : edit.amount;
        sub.resources[edit.resource] = Math.max(0, Math.round(sub.resources[edit.resource] + amt));
        applied.push(`ADD_RESOURCE ${edit.resource}+=${amt} for sub ${sub.id}`);
        break;
      }
      case "SET_EARTH_RELATIONS": {
        const sub = findSub(game, edit.subdivisionId);
        if (!sub) { warnings.push(`SET_EARTH_RELATIONS: subdivision ${edit.subdivisionId} not found`); break; }
        sub.earthRelations = clampEr(edit.value);
        applied.push(`SET_EARTH_RELATIONS=${sub.earthRelations} for sub ${sub.id}`);
        break;
      }
      case "ADJUST_EARTH_RELATIONS": {
        const sub = findSub(game, edit.subdivisionId);
        if (!sub) { warnings.push(`ADJUST_EARTH_RELATIONS: subdivision ${edit.subdivisionId} not found`); break; }
        sub.earthRelations = clampEr(sub.earthRelations + edit.delta);
        applied.push(`ADJUST_EARTH_RELATIONS delta ${edit.delta} -> ${sub.earthRelations} for sub ${sub.id}`);
        break;
      }
      case "DISABLE_BUILDING": {
        const sub = findSub(game, edit.subdivisionId);
        const b = sub?.buildings.find((x) => x.id === edit.buildingId);
        if (!b) { warnings.push(`DISABLE_BUILDING: building ${edit.buildingId} not found`); break; }
        b.disabledUntilTurn = edit.untilTurn;
        applied.push(`DISABLE_BUILDING ${b.id} until turn ${edit.untilTurn}`);
        break;
      }
      case "SET_HEX_OWNER": {
        const h = game.map.find((x) => x.coord.col === edit.col && x.coord.row === edit.row);
        if (!h) { warnings.push(`SET_HEX_OWNER: hex ${edit.col},${edit.row} not found`); break; }
        h.ownerSubdivisionId = edit.ownerSubdivisionId ?? undefined;
        applied.push(`SET_HEX_OWNER (${edit.col},${edit.row}) -> ${edit.ownerSubdivisionId ?? "unclaimed"}`);
        break;
      }
      case "SET_OXYGEN": {
        game.oxygen = Math.max(0, Math.round(edit.value));
        applied.push(`SET_OXYGEN=${game.oxygen}`);
        break;
      }
      case "ADD_MILESTONE": {
        game.milestonesClaimed.add(edit.milestoneId);
        applied.push(`ADD_MILESTONE ${edit.milestoneId}`);
        break;
      }
      case "REGISTER_EFFECT": {
        const effect: Omit<ActiveEffect, "id"> = {
          type: edit.effectType,
          scope: edit.scope,
          source: edit.source,
          turnsRemaining: edit.turnsRemaining,
          registeredTurn: edit.registeredTurn ?? game.turnNumber - 1,
          magnitude: edit.magnitude,
          subdivisionId: edit.subdivisionId,
          buildingId: edit.buildingId,
          hexes: edit.hexes,
          moduleType: edit.moduleType,
          requiresUnshielded: edit.requiresUnshielded,
          requiresNoRedundant: edit.requiresNoRedundant,
        };
        const e: ActiveEffect = { id: game.nextIds.effect++, ...effect };
        game.activeEffects.push(e);
        applied.push(`REGISTER_EFFECT ${edit.effectType}/${edit.scope} id ${e.id} (${edit.turnsRemaining} turns)`);
        break;
      }
      case "RELEASE_CAPTIVE": {
        const captor = findSub(game, edit.captorSubdivisionId);
        if (!captor) { warnings.push(`RELEASE_CAPTIVE: captor ${edit.captorSubdivisionId} not found`); break; }
        const idx = captor.capturedUnits.findIndex((p) => p.id === edit.personnelId);
        if (idx < 0) { warnings.push(`RELEASE_CAPTIVE: captive ${edit.personnelId} not held`); break; }
        const [unit] = captor.capturedUnits.splice(idx, 1);
        const target = edit.toSubdivisionId != null ? findSub(game, edit.toSubdivisionId) : undefined;
        if (target) {
          unit.status = "AVAILABLE";
          unit.assignedBuildingId = undefined;
          unit.assignedVehicleId = undefined;
          target.personnel.push(unit);
          applied.push(`RELEASE_CAPTIVE ${unit.id} -> sub ${target.id}`);
        } else {
          applied.push(`RELEASE_CAPTIVE ${unit.id} removed from captor ${captor.id}`);
        }
        break;
      }
      default: {
        warnings.push(`Unknown op: ${(edit as { op: string }).op}`);
      }
    }
  }

  return { applied, warnings };
}
