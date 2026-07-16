/**
 * Map geometry. GAME_SPEC §9 / [D-026], [D-027].
 * Offset "odd-q" flat-top hexes, 12 columns (1..12) x 8 rows (1..8) = 96 hexes.
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

/** Neighbors of (c,r) per [D-026] odd-q flat-top. Excludes out-of-bounds. */
export function neighbors(c: HexCoord): HexCoord[] {
  const { col, row } = c;
  const candidates: HexCoord[] =
    col % 2 === 0
      ? [
          { col, row: row - 1 },
          { col, row: row + 1 },
          { col: col - 1, row: row - 1 },
          { col: col - 1, row },
          { col: col + 1, row: row - 1 },
          { col: col + 1, row },
        ]
      : [
          { col, row: row - 1 },
          { col, row: row + 1 },
          { col: col - 1, row },
          { col: col - 1, row: row + 1 },
          { col: col + 1, row },
          { col: col + 1, row: row + 1 },
        ];
  return candidates.filter(inBounds);
}

interface Cube {
  x: number;
  y: number;
  z: number;
}

/** Convert odd-q offset to cube coordinates. §9.2 */
function offsetToCube(c: HexCoord): Cube {
  const q = c.col - 1;
  const r = c.row - 1;
  const x = q;
  const z = r - (q - (q & 1)) / 2;
  const y = -x - z;
  return { x, y, z };
}

/** Hex/cube distance between two coords. §9.2 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ca = offsetToCube(a);
  const cb = offsetToCube(b);
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y), Math.abs(ca.z - cb.z));
}

export function isAdjacent(a: HexCoord, b: HexCoord): boolean {
  return neighbors(a).some((n) => sameCoord(n, b));
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
