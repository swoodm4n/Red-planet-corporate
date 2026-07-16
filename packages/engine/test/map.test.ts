import { describe, it, expect } from "vitest";
import {
  neighbors,
  hexDistance,
  isAdjacent,
  inBounds,
  makeDefaultMap,
  MAP_COLS,
  MAP_ROWS,
} from "../src/map.js";

describe("map geometry (odd-q flat-top, [D-026])", () => {
  it("bounds", () => {
    expect(inBounds({ col: 1, row: 1 })).toBe(true);
    expect(inBounds({ col: 12, row: 8 })).toBe(true);
    expect(inBounds({ col: 0, row: 1 })).toBe(false);
    expect(inBounds({ col: 13, row: 1 })).toBe(false);
  });

  it("odd column neighbors (c=3,r=4)", () => {
    const ns = neighbors({ col: 3, row: 4 });
    // odd q: (c,r-1),(c,r+1),(c-1,r),(c-1,r+1),(c+1,r),(c+1,r+1)
    expect(ns).toEqual(
      expect.arrayContaining([
        { col: 3, row: 3 },
        { col: 3, row: 5 },
        { col: 2, row: 4 },
        { col: 2, row: 5 },
        { col: 4, row: 4 },
        { col: 4, row: 5 },
      ]),
    );
    expect(ns).toHaveLength(6);
  });

  it("even column neighbors (c=4,r=4)", () => {
    const ns = neighbors({ col: 4, row: 4 });
    // even q: (c,r-1),(c,r+1),(c-1,r-1),(c-1,r),(c+1,r-1),(c+1,r)
    expect(ns).toEqual(
      expect.arrayContaining([
        { col: 4, row: 3 },
        { col: 4, row: 5 },
        { col: 3, row: 3 },
        { col: 3, row: 4 },
        { col: 5, row: 3 },
        { col: 5, row: 4 },
      ]),
    );
  });

  it("corner has fewer neighbors", () => {
    expect(neighbors({ col: 1, row: 1 }).length).toBeLessThan(6);
  });

  it("adjacency and distance are consistent", () => {
    const a = { col: 3, row: 4 };
    for (const n of neighbors(a)) {
      expect(isAdjacent(a, n)).toBe(true);
      expect(hexDistance(a, n)).toBe(1);
    }
    expect(hexDistance(a, a)).toBe(0);
  });

  it("default map has 96 hexes and one landing zone", () => {
    const map = makeDefaultMap({ col: 6, row: 4 });
    expect(map).toHaveLength(MAP_COLS * MAP_ROWS);
    expect(map.filter((h) => h.terrain === "LANDING_ZONE")).toHaveLength(1);
  });
});
