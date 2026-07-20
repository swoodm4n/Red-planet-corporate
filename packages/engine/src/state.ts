/**
 * State construction: build a Game with subdivisions at their starting
 * conditions. GAME_SPEC §4, §5 / [D-014], [D-015].
 */

import {
  BUILDINGS,
  HQ_SUBSIDY,
  PARENTS,
  STARTING_RESOURCES,
} from "./constants.js";
import { makeInitialEquity } from "./equity.js";
import { emptyResourceBundle } from "./helpers.js";
import { makeDefaultMap } from "./map.js";
import { makeInitialMarket } from "./market.js";
import type {
  Building,
  Game,
  HexCoord,
  ParentCompany,
  Personnel,
  PersonnelType,
  ResourceBundle,
  Subdivision,
} from "./types.js";

export interface SubdivisionSetup {
  id: number;
  name: string;
  parentCompany: ParentCompany;
  parentPerk: "A" | "B";
  /** The 2 player-choice starting personnel types. [D-015] */
  choicePersonnel: [PersonnelType, PersonnelType];
  hqHex: HexCoord;
  /** Hex adjacent to HQ where the free parent building is placed. */
  freeBuildingHex?: HexCoord;
}

export interface GameSetup {
  id: number;
  gameSeed: bigint;
  landingZoneHex: HexCoord;
  subdivisions: SubdivisionSetup[];
  map?: Game["map"];
  normalizationEnabled?: boolean;
}

function addBundle(target: ResourceBundle, add: Partial<ResourceBundle>): void {
  for (const key of Object.keys(add) as (keyof ResourceBundle)[]) {
    target[key] += add[key] ?? 0;
  }
}

let _idAllocator = {
  building: 1,
  module: 1,
  personnel: 1,
  vehicle: 1,
  vehicleModule: 1,
  motion: 1,
};

export function makeGame(setup: GameSetup): Game {
  const ids = {
    building: 1,
    module: 1,
    personnel: 1,
    vehicle: 1,
    vehicleModule: 1,
    motion: 1,
    effect: 1,
  };

  const map = setup.map ?? makeDefaultMap(setup.landingZoneHex);

  const subdivisions: Subdivision[] = setup.subdivisions.map((s) => {
    const resources: ResourceBundle = { ...STARTING_RESOURCES };

    // Parent stored bonus.
    const parent = PARENTS[s.parentCompany];
    addBundle(resources, parent.storedBonus);

    // Starting personnel: Engineer×5, Administrator×2, Contractor×1 + 2 choice.
    const personnel: Personnel[] = [];
    const roster: PersonnelType[] = [
      "ENGINEER",
      "ENGINEER",
      "ENGINEER",
      "ENGINEER",
      "ENGINEER",
      "ADMINISTRATOR",
      "ADMINISTRATOR",
      "CONTRACTOR",
      s.choicePersonnel[0],
      s.choicePersonnel[1],
    ];
    for (const type of roster) {
      personnel.push({
        id: ids.personnel++,
        type,
        status: "AVAILABLE",
        unavailableUntilTurn: 0,
        attentionSpentThisTurn: false,
      });
    }

    // Pre-built buildings: HQ (T1), Habitat (T1), Bio Facility (T1). §4
    const buildings: Building[] = [];
    const mkBuilding = (type: Building["type"], hex: HexCoord): Building => ({
      id: ids.building++,
      type,
      tier: BUILDINGS[type].tier,
      hex,
      status: "ACTIVE",
      builtOnTurn: 0, // operational from turn 1
      modules: [],
      garrison: {},
      disabledUntilTurn: 0,
      dormantTurns: 0,
    });

    const hqHex = s.hqHex;
    buildings.push(mkBuilding("HEADQUARTERS", hqHex));
    // Place Habitat and Bio adjacent-ish (use rows offset; not critical for engine).
    buildings.push(mkBuilding("HABITAT_MODULE", { col: hqHex.col, row: hqHex.row }));
    buildings.push(mkBuilding("BIO_FACILITY", { col: hqHex.col, row: hqHex.row }));

    // Free parent building perk (if it grants a building).
    const perkSpec = s.parentPerk === "A" ? parent.perkA : parent.perkB;
    if (perkSpec.freeBuilding) {
      buildings.push(
        mkBuilding(perkSpec.freeBuilding, s.freeBuildingHex ?? hqHex),
      );
    }

    // Claim the HQ hex.
    const hqTile = map.find((h) => h.coord.col === hqHex.col && h.coord.row === hqHex.row);
    if (hqTile) hqTile.ownerSubdivisionId = s.id;

    const sub: Subdivision = {
      id: s.id,
      name: s.name,
      parentCompany: s.parentCompany,
      parentPerk: s.parentPerk,
      status: "ACTIVE",
      resources,
      earthRelations: 10,
      buildings,
      personnel,
      vehicles: [],
      capturedUnits: [],
      closedBordersAgainst: new Set(),
      cum: {
        resourcesSoldUnits: 0,
        creditsEarnedFromSales: 0,
        researchGenerated: 0,
        researchSubmissions: 0,
        successfulSabotageDefenses: 0,
        successfulIntercepts: 0,
        successfulSabotageActions: 0,
        successfulSurveillance: 0,
        undetectedPlantIntel: 0,
        consistentOutputStreak: 0,
        resourceExportCredited: 0,
      },
      earthRelationsBonusActive: false,
      consistentOutputStreak: 0,
      insolventStreak: 0,
    };
    return sub;
  });

  const game: Game = {
    id: setup.id,
    gameSeed: setup.gameSeed,
    turnNumber: 1,
    subdivisions,
    map,
    market: makeInitialMarket(),
    equity: makeInitialEquity(subdivisions),
    oxygen: 0,
    milestonesClaimed: new Set(),
    activeMotions: [],
    resupplyMissions: [],
    activeEffects: [],
    config: {
      normalizationEnabled: setup.normalizationEnabled ?? false,
      landingZoneHex: setup.landingZoneHex,
    },
    nextIds: ids,
  };
  return game;
}

export { HQ_SUBSIDY, _idAllocator };
