import { makeGame, type GameSetup } from "../src/state.js";
import type { Game } from "../src/types.js";

/** A minimal two-subdivision game for integration tests. */
export function makeTestGame(overrides?: Partial<GameSetup>): Game {
  const setup: GameSetup = {
    id: 1,
    gameSeed: 0xabcdef1234567890n,
    landingZoneHex: { col: 6, row: 4 },
    subdivisions: [
      {
        id: 1,
        name: "Alpha",
        parentCompany: "UNIFIED_MINING",
        parentPerk: "A", // free Extraction Site
        choicePersonnel: ["ENGINEER", "ENGINEER"],
        hqHex: { col: 2, row: 2 },
        freeBuildingHex: { col: 3, row: 2 },
      },
      {
        id: 2,
        name: "Beta",
        parentCompany: "TERRA_AGRICULTURAL",
        parentPerk: "A", // free Bio Facility
        choicePersonnel: ["ANALYST", "CONTRACTOR"],
        hqHex: { col: 10, row: 6 },
        freeBuildingHex: { col: 9, row: 6 },
      },
    ],
    ...overrides,
  };
  return makeGame(setup);
}
