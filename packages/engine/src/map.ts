/**
 * Map geometry. GAME_SPEC §9 / §21.1-2, [D-026] (superseded), [D-027], [D-050].
 * Square grid, 12 columns (1..12) x 8 rows (1..8) = 96 tiles. 8-directional
 * (Moore) adjacency; Chebyshev distance. The `Hex`/`HexCoord` names are retained
 * per [D-050] (read as "tile") to avoid churn; terrain is a straight reskin.
 */

import type { Hex, HexCoord, Terrain } from "./types.js";

export const MAP_COLS = 12;
export const MAP_ROWS = 8;

export function inBounds(c: HexCoord): boolean {
  return c.col >= 1 && c.col <= MAP_COLS && c.row >= 1 && c.row <= MAP_ROWS;
}

export function coordKey(c: HexCoord): string {
  return `${c.col},${c.row}`;
}

/** Row-major index used for canonical RNG iteration ordering (§15). */
export function rowMajorIndex(c: HexCoord): number {
  return (c.row - 1) * MAP_COLS + (c.col - 1);
}

export function sameCoord(a: HexCoord, b: HexCoord): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * 8-neighbour (Moore) set of (col,row) per §21.2 / [D-050]. Excludes out-of-bounds.
 * All up-to-8 cells with Δcol,Δrow ∈ {-1,0,1} minus self.
 * Reach delta vs old hex: distance-1 = 8 tiles (was 6); distance-2 = 24 (was 18).
 */
export function neighbors(c: HexCoord): HexCoord[] {
  const { col, row } = c;
  const candidates: HexCoord[] = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      candidates.push({ col: col + dc, row: row + dr });
    }
  }
  return candidates.filter(inBounds);
}

/**
 * Chebyshev distance between two tiles. §21.2 / [D-050]. Replaces the old cube
 * `hexDistance`. Vehicle ranges (2/4), Patrol/Enforce/Vehicle-Attack range ≤1,
 * survey/intel radii all read the same numbers against this metric.
 */
export function gridDistance(a: HexCoord, b: HexCoord): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

/**
 * @deprecated Kept as an alias of {@link gridDistance} to avoid churn in callers
 * that still say `hexDistance`. Under §21 the metric is Chebyshev, not cube. [D-050]
 */
export const hexDistance = gridDistance;

export function isAdjacent(a: HexCoord, b: HexCoord): boolean {
  return gridDistance(a, b) === 1;
}

/** Move cost onto a terrain. §9.1. Mountains/Rare Minerals consume the whole move. */
export function terrainMoveCost(t: Terrain): number {
  switch (t) {
    case "MOUNTAINS":
    case "RARE_MINERALS":
      return 2;
    case "IMPASSABLE":
      return Infinity;
    default:
      return 1;
  }
}

export function terrainBuildMineralSurcharge(t: Terrain): number {
  // §7.1 / [D-026 terrain]: +50% Mineral cost on Mountains & Rare Minerals.
  return t === "MOUNTAINS" || t === "RARE_MINERALS" ? 0.5 : 0;
}

/** Build a default 12x8 map of PLAINS with one Landing Zone hex. */
export function makeDefaultMap(landingZone: HexCoord): Hex[] {
  const hexes: Hex[] = [];
  for (let row = 1; row <= MAP_ROWS; row++) {
    for (let col = 1; col <= MAP_COLS; col++) {
      const coord = { col, row };
      const terrain: Terrain = sameCoord(coord, landingZone) ? "LANDING_ZONE" : "PLAINS";
      hexes.push({ coord, terrain });
    }
  }
  return hexes;
}

export function getHex(map: Hex[], c: HexCoord): Hex | undefined {
  return map.find((h) => sameCoord(h.coord, c));
}
