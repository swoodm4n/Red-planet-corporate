import { describe, it, expect } from "vitest";
import {
  neighbors,
  gridDistance,
  hexDistance,
  isAdjacent,
  inBounds,
  makeDefaultMap,
  MAP_COLS,
  MAP_ROWS,
} from "../src/map.js";

describe("map geometry (square grid, 8-dir Chebyshev, §21.2 / [D-050])", () => {
  it("bounds", () => {
    expect(inBounds({ col: 1, row: 1 })).toBe(true);
    expect(inBounds({ col: 12, row: 8 })).toBe(true);
    expect(inBounds({ col: 0, row: 1 })).toBe(false);
    expect(inBounds({ col: 13, row: 1 })).toBe(false);
  });

  it("interior tile has 8 (Moore) neighbours — no column parity", () => {
    const ns = neighbors({ col: 3, row: 4 });
    expect(ns).toEqual(
      expect.arrayContaining([
        { col: 2, row: 3 },
        { col: 3, row: 3 },
        { col: 4, row: 3 },
        { col: 2, row: 4 },
        { col: 4, row: 4 },
        { col: 2, row: 5 },
        { col: 3, row: 5 },
        { col: 4, row: 5 },
      ]),
    );
    expect(ns).toHaveLength(8);
  });

  it("even and odd columns produce identical-shaped neighbourhoods", () => {
    // No odd-q parity offset anymore: both are the 8 surrounding cells.
    expect(neighbors({ col: 4, row: 4 })).toHaveLength(8);
    expect(neighbors({ col: 5, row: 4 })).toHaveLength(8);
  });

  it("corner has 3 neighbours", () => {
    expect(neighbors({ col: 1, row: 1 })).toHaveLength(3);
  });

  it("edge (non-corner) has 5 neighbours", () => {
    expect(neighbors({ col: 1, row: 4 })).toHaveLength(5);
  });

  it("reach delta vs old hex: distance-1 = 8 tiles (was 6)", () => {
    const center = { col: 6, row: 4 };
    let within1 = 0;
    for (let col = 1; col <= MAP_COLS; col++) {
      for (let row = 1; row <= MAP_ROWS; row++) {
        const d = gridDistance(center, { col, row });
        if (d >= 1 && d <= 1) within1 += 1;
      }
    }
    expect(within1).toBe(8);
  });

  it("reach delta vs old hex: distance-2 = 24 tiles (was 18)", () => {
    const center = { col: 6, row: 4 };
    let within2 = 0;
    for (let col = 1; col <= MAP_COLS; col++) {
      for (let row = 1; row <= MAP_ROWS; row++) {
        const d = gridDistance(center, { col, row });
        if (d >= 1 && d <= 2) within2 += 1;
      }
    }
    expect(within2).toBe(24);
  });

  it("Chebyshev distance: diagonal is distance 1, knight-ish is max of deltas", () => {
    expect(gridDistance({ col: 5, row: 5 }, { col: 6, row: 6 })).toBe(1); // diagonal
    expect(gridDistance({ col: 5, row: 5 }, { col: 7, row: 6 })).toBe(2);
    expect(gridDistance({ col: 5, row: 5 }, { col: 9, row: 7 })).toBe(4);
    expect(gridDistance({ col: 5, row: 5 }, { col: 5, row: 5 })).toBe(0);
  });

  it("hexDistance is retained as an alias of gridDistance", () => {
    expect(hexDistance).toBe(gridDistance);
    expect(hexDistance({ col: 1, row: 1 }, { col: 3, row: 2 })).toBe(2);
  });

  it("adjacency and distance are consistent (adjacent ⇔ distance 1)", () => {
    const a = { col: 3, row: 4 };
    for (const n of neighbors(a)) {
      expect(isAdjacent(a, n)).toBe(true);
      expect(gridDistance(a, n)).toBe(1);
    }
    expect(isAdjacent(a, { col: 3, row: 6 })).toBe(false); // distance 2
    expect(gridDistance(a, a)).toBe(0);
  });

  it("default map has 96 tiles and one landing zone", () => {
    const map = makeDefaultMap({ col: 6, row: 4 });
    expect(map).toHaveLength(MAP_COLS * MAP_ROWS);
    expect(map.filter((h) => h.terrain === "LANDING_ZONE")).toHaveLength(1);
  });
});
