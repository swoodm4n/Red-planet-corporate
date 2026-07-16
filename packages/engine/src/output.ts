/**
 * Per-building passive output computation. §7.3 / [D-010], [D-011], [D-040].
 * Returns the primary-resource output plus any Research-Link pool bonus.
 */

import { BUILDINGS } from "./constants.js";
import { countActiveModule, hasActiveModule, isOperational } from "./helpers.js";
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

export function computePassiveOutput(b: Building, game: Game): PassiveOutput {
  const spec = BUILDINGS[b.type];
  const researchLinkBonus = isOperational(b, game.turnNumber)
    ? countActiveModule(b, "RESEARCH_LINK")
    : 0;

  if (!spec.primaryResource || !isOperational(b, game.turnNumber)) {
    return { amount: 0, researchLinkBonus };
  }

  let amount = spec.baseOutput;
  amount += countActiveModule(b, "EFFICIENCY");
  // Operations Director in OUTPUT mode: +1.
  const opsDir = b.modules.find((m) => m.status === "ACTIVE" && m.type === "OPERATIONS_DIRECTOR");
  if (opsDir && (opsDir.operationsDirectorMode ?? "OUTPUT") === "OUTPUT") {
    amount += 1;
  }
  amount += personnelModuleBonus(b);
  amount += terrainExploitBonus(b, game);

  return { resource: spec.primaryResource, amount, researchLinkBonus };
}
