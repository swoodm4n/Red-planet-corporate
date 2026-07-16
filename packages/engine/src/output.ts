/**
 * Per-building passive output computation. §7.3 / [D-010], [D-011], [D-040], [D-042].
 * Returns the primary-resource output plus any Research-Link pool bonus.
 *
 * Redundant Systems (§7.3): when a building is disabled by an event/sabotage this
 * turn but would otherwise be operational (built, garrison-min met), a building
 * carrying an active Redundant Systems module runs at 50% output (rounded down)
 * instead of 0. Any other reason for non-operation (derelict, garrison unmet,
 * built this turn) yields 0 as before.
 */

import { BUILDINGS } from "./constants.js";
import {
  countActiveModule,
  garrisonMeetsMin,
  hasActiveModule,
  laborGarrisonMin,
} from "./helpers.js";
import { moduleHalved, outputDeltaFor, terrainExploitSuspended } from "./effects.js";
import { getHex } from "./map.js";
import type { Building, Game, PhysicalResource } from "./types.js";

export interface PassiveOutput {
  resource?: PhysicalResource;
  amount: number;
  researchLinkBonus: number;
}

/** Terrain-exploit bonus for a matching generator on its terrain. §9.1 / [D-011]. */
function terrainExploitBonus(b: Building, game: Game): number {
  if (!hasActiveModule(b, "TERRAIN_EXPLOIT")) return 0;
  const hex = getHex(game.map, b.hex);
  if (!hex) return 0;
  if (b.type === "EXTRACTION_SITE") {
    if (hex.terrain === "RARE_MINERALS") return 3;
    if (hex.terrain === "MOUNTAINS") return 2;
  }
  if (b.type === "WATER_RECLAMATION") {
    if (hex.terrain === "WATER_RESERVE") return 4;
    if (hex.terrain === "ICE_DEPOSIT") return 2;
  }
  return 0;
}

/** Personnel Module bonus: +2 while its named units are garrisoned. [D-011] */
function personnelModuleBonus(b: Building): number {
  let bonus = 0;
  for (const m of b.modules) {
    if (m.status !== "ACTIVE" || m.type !== "PERSONNEL_MODULE") continue;
    const named = m.namedUnits ?? [];
    const satisfied = named.every((t) => {
      // Count needed vs garrisoned of that type (2 named units).
      const needed = named.filter((x) => x === t).length;
      return (b.garrison[t] ?? 0) >= needed;
    });
    if (named.length === 2 && satisfied) bonus += 2;
  }
  return bonus;
}

export function computePassiveOutput(b: Building, game: Game, subId?: number): PassiveOutput {
  const spec = BUILDINGS[b.type];
  const turn = game.turnNumber;

  // Status classification (see [D-012] for "operational").
  const active = b.status === "ACTIVE";
  const builtPrior = b.builtOnTurn < turn;
  const garrisonOk = garrisonMeetsMin(b, laborGarrisonMin(b));
  const disabled = b.disabledUntilTurn >= turn;
  const operational = active && builtPrior && !disabled && garrisonOk;
  // Would be operational but for an event/sabotage disable this turn (§7.3).
  const disabledButRunnable = active && builtPrior && disabled && garrisonOk;
  const redundant = hasActiveModule(b, "REDUNDANT_SYSTEMS");
  const runsAtHalf = disabledButRunnable && redundant;

  const producing = operational || runsAtHalf;

  if (!spec.primaryResource || !producing) {
    // Research Link still contributes when producing (halved under RS floor).
    let rl = producing ? countActiveModule(b, "RESEARCH_LINK") : 0;
    if (runsAtHalf) rl = Math.floor(rl * 0.5);
    return { amount: 0, researchLinkBonus: rl };
  }

  let amount = spec.baseOutput;

  // Efficiency modules (+1 each; halved by Equipment Recall).
  let efficiency = countActiveModule(b, "EFFICIENCY");
  if (subId != null && moduleHalved(game, b, subId, "EFFICIENCY")) {
    efficiency = Math.floor(efficiency * 0.5);
  }
  amount += efficiency;

  // Operations Director in OUTPUT mode: +1 (halved -> 0 by Equipment Recall).
  const opsDir = b.modules.find((m) => m.status === "ACTIVE" && m.type === "OPERATIONS_DIRECTOR");
  if (opsDir && (opsDir.operationsDirectorMode ?? "OUTPUT") === "OUTPUT") {
    let v = 1;
    if (subId != null && moduleHalved(game, b, subId, "OPERATIONS_DIRECTOR")) v = Math.floor(v * 0.5);
    amount += v;
  }

  // Personnel modules (+2 each when named units garrisoned).
  let pm = personnelModuleBonus(b);
  if (subId != null && moduleHalved(game, b, subId, "PERSONNEL_MODULE")) pm = Math.floor(pm * 0.5);
  amount += pm;

  // Terrain Exploit (+2/+3/+4 on matching terrain).
  let te = terrainExploitBonus(b, game);
  if (subId != null && b.type === "WATER_RECLAMATION" && terrainExploitSuspended(game, b, subId)) {
    te = 0; // Ice Deposit Shift suspends Water Terrain Exploit.
  }
  if (subId != null && moduleHalved(game, b, subId, "TERRAIN_EXPLOIT")) te = Math.floor(te * 0.5);
  amount += te;

  // Durational output deltas (Dust Storm -1, Seismic -1, ...).
  if (subId != null) amount += outputDeltaFor(game, b, subId);
  if (amount < 0) amount = 0;

  let researchLinkBonus = countActiveModule(b, "RESEARCH_LINK");

  // Redundant Systems 50% floor when disabled this turn. §7.3
  if (runsAtHalf) {
    amount = Math.floor(amount * 0.5);
    researchLinkBonus = Math.floor(researchLinkBonus * 0.5);
  }

  return { resource: spec.primaryResource, amount, researchLinkBonus };
}
