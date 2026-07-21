/**
 * Static game data tables. GAME_SPEC §2, §4, §5, §6, §7, §8.
 * All Cr values are fixed-point (see money.ts). Physical resource costs are ints.
 */

import { cr, type Fp } from "./money.js";
import type {
  BuildingType,
  HullClass,
  ModuleType,
  ParentCompany,
  PersonnelType,
  PhysicalResource,
  ResourceBundle,
  Tier,
  VehicleModCat,
} from "./types.js";

// §2 Baseline market prices (Cr/unit) -> fixed-point.
export const BASELINE_PRICE: Record<PhysicalResource, Fp> = {
  ENERGY: cr(0.5),
  MINERALS: cr(0.5),
  WATER: cr(0.75),
  FOOD: cr(0.75),
  RESEARCH: cr(1.5),
};

// §2 / [D-003] base storage cap per resource.
export const BASE_STORAGE_CAP = 100;
export const WAREHOUSE_STORAGE_BONUS = 20; // per Warehouse & per Warehouse Expansion
export const COMMERCIAL_HUB_CREDIT_CAP_BONUS = 50; // per Commercial-Hub Expansion (Credits only)

// §11 / [D-001] throughput caps.
export const LZ_COLONY_CAP = 15;
export const LZ_SUBDIVISION_CAP = 6;
export const TRANSIT_HUB_BASE_SELL_CAP = 10;
export const TRANSIT_HUB_EXPANSION_SELL_BONUS = 5;
export const HQ_LZ_ACTION_CAP = 6;
export const BLACK_MARKET_CAP = 6;

// §11.2 sale routing multipliers.
export const EARTH_SELL_MULT = 0.8;
export const EARTH_BUY_MULT = 1.2;

// §4 starting stored resources (before parent bonus).
export const STARTING_RESOURCES: ResourceBundle = {
  CREDITS: cr(30),
  ENERGY: 15,
  MINERALS: 25,
  WATER: 15,
  FOOD: 15,
  RESEARCH: 0,
};

// §4 HQ starting subsidy (flat, permanent). [D-004]
export const HQ_SUBSIDY: { CREDITS: Fp } & Record<PhysicalResource, number> = {
  ENERGY: 5,
  CREDITS: cr(15),
  WATER: 12,
  FOOD: 12,
  MINERALS: 3,
  RESEARCH: 0,
};

// §6 personnel upkeep.
export interface PersonnelUpkeep {
  FOOD: number;
  WATER: number;
  CREDITS: Fp;
  ENERGY: number;
  RESEARCH: number;
}
export const PERSONNEL_UPKEEP: Record<PersonnelType, PersonnelUpkeep> = {
  ENGINEER: { FOOD: 1, WATER: 1, CREDITS: 0, ENERGY: 0, RESEARCH: 0 },
  CONTRACTOR: { FOOD: 1, WATER: 1, CREDITS: cr(1), ENERGY: 0, RESEARCH: 0 },
  ADMINISTRATOR: { FOOD: 1, WATER: 1, CREDITS: cr(2), ENERGY: 0, RESEARCH: 0 },
  INNOVATOR: { FOOD: 1, WATER: 1, CREDITS: cr(1), ENERGY: 1, RESEARCH: 0 },
  ANALYST: { FOOD: 1, WATER: 1, CREDITS: cr(1), ENERGY: 0, RESEARCH: 1 },
};

export const ADMIN_PASSIVE_CR: Fp = cr(2); // [D-008]

// §7.1 building master table.
export interface BuildingSpec {
  tier: Tier;
  slots: number;
  /** Primary passive output: the physical resource produced and its base amount. */
  primaryResource?: PhysicalResource;
  baseOutput: number;
  buildCost: Partial<ResourceBundle>;
  upkeep: Partial<ResourceBundle>;
  /** Minimum garrison (labor requirement) keyed by personnel type. */
  garrisonMin: Partial<Record<PersonnelType, number>>;
  /** Housing capacity contributed (Habitat 8, HQ 10). */
  housing?: number;
}

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  POWER_FACILITY: {
    tier: "T1",
    slots: 8,
    primaryResource: "ENERGY",
    baseOutput: 2,
    buildCost: { MINERALS: 12, CREDITS: cr(8) },
    upkeep: { ENERGY: 1, CREDITS: cr(1) },
    garrisonMin: { ENGINEER: 2 },
  },
  EXTRACTION_SITE: {
    tier: "T1",
    slots: 8,
    primaryResource: "MINERALS",
    baseOutput: 2,
    buildCost: { MINERALS: 12, CREDITS: cr(8) },
    upkeep: { ENERGY: 1, CREDITS: cr(1) },
    garrisonMin: { ENGINEER: 3 },
  },
  WATER_RECLAMATION: {
    tier: "T1",
    slots: 8,
    primaryResource: "WATER",
    baseOutput: 2,
    buildCost: { MINERALS: 12, CREDITS: cr(8) },
    upkeep: { ENERGY: 1, CREDITS: cr(1) },
    garrisonMin: { ENGINEER: 2 },
  },
  BIO_FACILITY: {
    tier: "T1",
    slots: 8,
    primaryResource: "FOOD",
    baseOutput: 2,
    buildCost: { MINERALS: 12, CREDITS: cr(8), WATER: 3 },
    upkeep: { ENERGY: 1, CREDITS: cr(1), WATER: 1 },
    garrisonMin: { ENGINEER: 2 },
  },
  RESEARCH_COMPLEX: {
    tier: "T1",
    slots: 8,
    primaryResource: "RESEARCH",
    baseOutput: 2,
    buildCost: { MINERALS: 14, CREDITS: cr(10) },
    upkeep: { ENERGY: 1, CREDITS: cr(1), RESEARCH: 1 },
    garrisonMin: { INNOVATOR: 3 },
  },
  COMMERCIAL_HUB: {
    tier: "T1",
    slots: 8,
    baseOutput: 0, // credit amplifier, §11.1
    buildCost: { MINERALS: 14, CREDITS: cr(10) },
    upkeep: { ENERGY: 1, CREDITS: cr(1) },
    garrisonMin: { ADMINISTRATOR: 2 },
  },
  HABITAT_MODULE: {
    tier: "T1",
    slots: 8,
    baseOutput: 0,
    housing: 8,
    buildCost: { MINERALS: 10, CREDITS: cr(12) },
    upkeep: { ENERGY: 1, CREDITS: cr(2), FOOD: 1 },
    garrisonMin: { ADMINISTRATOR: 1 },
  },
  OUTPOST: {
    tier: "T0",
    slots: 3,
    baseOutput: 0,
    buildCost: { MINERALS: 6, CREDITS: cr(4) },
    upkeep: { ENERGY: 1, CREDITS: cr(1) },
    garrisonMin: { ENGINEER: 2 },
  },
  HEADQUARTERS: {
    tier: "T1",
    slots: 8,
    baseOutput: 0,
    housing: 10,
    buildCost: { MINERALS: 18, CREDITS: cr(24) }, // via Tier Upgrade
    upkeep: { ENERGY: 2, CREDITS: cr(3), MINERALS: 1 },
    garrisonMin: { ADMINISTRATOR: 2, CONTRACTOR: 1 },
  },
  POWER_CONDUIT: {
    tier: "T1",
    slots: 4,
    baseOutput: 0,
    buildCost: { MINERALS: 6, CREDITS: cr(4) },
    upkeep: { CREDITS: cr(1) },
    garrisonMin: {},
  },
  WAREHOUSE: {
    tier: "T1",
    slots: 6,
    baseOutput: 0,
    buildCost: { MINERALS: 8, CREDITS: cr(6) },
    upkeep: { ENERGY: 1, CREDITS: cr(1), MINERALS: 1 },
    garrisonMin: { ENGINEER: 2 },
  },
  COMMUNICATIONS_ARRAY: {
    tier: "T1",
    slots: 8,
    baseOutput: 0,
    buildCost: { MINERALS: 10, CREDITS: cr(14), RESEARCH: 4 },
    upkeep: { ENERGY: 2, CREDITS: cr(2), RESEARCH: 1 },
    garrisonMin: { ANALYST: 2, ENGINEER: 1 },
  },
  TRANSIT_HUB: {
    tier: "T1",
    slots: 8,
    baseOutput: 0,
    buildCost: { MINERALS: 12, CREDITS: cr(10), RESEARCH: 4 },
    upkeep: { ENERGY: 2, CREDITS: cr(2) },
    garrisonMin: { ENGINEER: 2, ADMINISTRATOR: 1 },
  },
  VEHICLE_WORKSHOP: {
    tier: "T1",
    slots: 8,
    baseOutput: 0,
    buildCost: { MINERALS: 14, CREDITS: cr(10) },
    upkeep: { ENERGY: 2, CREDITS: cr(2), MINERALS: 1 },
    garrisonMin: { ENGINEER: 3 },
  },
};

export const RESOURCE_GENERATORS: BuildingType[] = [
  "POWER_FACILITY",
  "EXTRACTION_SITE",
  "WATER_RECLAMATION",
  "BIO_FACILITY",
  "RESEARCH_COMPLEX",
];

// §7.2 module master table.
export interface ModuleSpec {
  buildCost: Partial<ResourceBundle>;
  upkeep: Partial<ResourceBundle>;
  addGarrison: Partial<Record<PersonnelType, number>>;
  repeatable: boolean;
}
export const MODULES: Record<ModuleType, ModuleSpec> = {
  EFFICIENCY: { buildCost: { CREDITS: cr(6) }, upkeep: { CREDITS: cr(1) }, addGarrison: {}, repeatable: true },
  REDUNDANT_SYSTEMS: { buildCost: { CREDITS: cr(6) }, upkeep: { CREDITS: cr(1) }, addGarrison: {}, repeatable: true },
  EXPANSION: { buildCost: { MINERALS: 6, CREDITS: cr(6) }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: {}, repeatable: true },
  FORTIFICATION: { buildCost: { MINERALS: 10, CREDITS: cr(6) }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: { CONTRACTOR: 1 }, repeatable: true },
  SECURITY_DETAIL: { buildCost: { MINERALS: 6, CREDITS: cr(6) }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: { CONTRACTOR: 1 }, repeatable: false },
  OPERATIONS_DIRECTOR: { buildCost: { CREDITS: cr(6) }, upkeep: { CREDITS: cr(1) }, addGarrison: { ADMINISTRATOR: 1 }, repeatable: false },
  TERRAIN_EXPLOIT: { buildCost: { MINERALS: 10, CREDITS: cr(8) }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: { ENGINEER: 2 }, repeatable: false },
  SENSOR_ARRAY: { buildCost: { CREDITS: cr(6), RESEARCH: 3 }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: { ANALYST: 1 }, repeatable: false },
  COMMAND_SUITE: { buildCost: { CREDITS: cr(10), RESEARCH: 3 }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: {}, repeatable: false },
  DIPLOMATIC_SUITE: { buildCost: { CREDITS: cr(12) }, upkeep: { CREDITS: cr(1) }, addGarrison: {}, repeatable: false },
  AUTOMATION: { buildCost: { CREDITS: cr(10), RESEARCH: 3 }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: {}, repeatable: false },
  PERSONNEL_MODULE: { buildCost: { CREDITS: cr(6) }, upkeep: { CREDITS: cr(1) }, addGarrison: {}, repeatable: false },
  HAZARD_SHIELD: { buildCost: { MINERALS: 6, CREDITS: cr(6) }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: {}, repeatable: false },
  RESEARCH_LINK: { buildCost: { CREDITS: cr(4), RESEARCH: 6 }, upkeep: { ENERGY: 1, CREDITS: cr(1) }, addGarrison: {}, repeatable: false },
  TRADE_NETWORK: { buildCost: { MINERALS: 12, CREDITS: cr(18) }, upkeep: { ENERGY: 2, CREDITS: cr(2) }, addGarrison: { ADMINISTRATOR: 2 }, repeatable: false },
  GLOBAL_CONTRIBUTION: { buildCost: { CREDITS: cr(6), FOOD: 6 }, upkeep: { CREDITS: cr(1) }, addGarrison: {}, repeatable: false },
};

// §7.4 module availability (allowed-on sets).
export const MODULE_ALLOWED_ON: Record<ModuleType, BuildingType[]> = {
  EFFICIENCY: [...RESOURCE_GENERATORS, "WAREHOUSE", "TRANSIT_HUB", "VEHICLE_WORKSHOP", "COMMERCIAL_HUB"],
  REDUNDANT_SYSTEMS: [
    ...RESOURCE_GENERATORS, "HABITAT_MODULE", "POWER_CONDUIT", "WAREHOUSE", "TRANSIT_HUB",
    "HEADQUARTERS", "VEHICLE_WORKSHOP", "COMMERCIAL_HUB",
  ],
  EXPANSION: [
    "POWER_FACILITY", "WATER_RECLAMATION", "HABITAT_MODULE", "OUTPOST", "HEADQUARTERS",
    "POWER_CONDUIT", "COMMERCIAL_HUB", "COMMUNICATIONS_ARRAY", "TRANSIT_HUB",
    "VEHICLE_WORKSHOP", "WAREHOUSE", "RESEARCH_COMPLEX",
  ],
  FORTIFICATION: ["OUTPOST", "HEADQUARTERS", "WAREHOUSE", "COMMUNICATIONS_ARRAY"],
  SECURITY_DETAIL: (Object.keys(BUILDINGS) as BuildingType[]).filter((b) => b !== "POWER_CONDUIT"),
  OPERATIONS_DIRECTOR: (Object.keys(BUILDINGS) as BuildingType[]).filter(
    (b) => b !== "POWER_CONDUIT" && b !== "OUTPOST",
  ),
  TERRAIN_EXPLOIT: ["EXTRACTION_SITE", "WATER_RECLAMATION"],
  SENSOR_ARRAY: ["EXTRACTION_SITE", "COMMERCIAL_HUB", "OUTPOST", "HEADQUARTERS", "COMMUNICATIONS_ARRAY"],
  COMMAND_SUITE: ["HEADQUARTERS", "COMMUNICATIONS_ARRAY", "TRANSIT_HUB"],
  DIPLOMATIC_SUITE: ["RESEARCH_COMPLEX", "COMMERCIAL_HUB", "HEADQUARTERS", "COMMUNICATIONS_ARRAY"],
  AUTOMATION: [...RESOURCE_GENERATORS, "HABITAT_MODULE", "RESEARCH_COMPLEX", "COMMERCIAL_HUB"],
  PERSONNEL_MODULE: [
    ...RESOURCE_GENERATORS, "HABITAT_MODULE", "HEADQUARTERS", "COMMUNICATIONS_ARRAY",
    "TRANSIT_HUB", "VEHICLE_WORKSHOP",
  ],
  HAZARD_SHIELD: [
    "POWER_FACILITY", "EXTRACTION_SITE", "WATER_RECLAMATION", "HABITAT_MODULE",
    "POWER_CONDUIT", "COMMUNICATIONS_ARRAY", "TRANSIT_HUB", "VEHICLE_WORKSHOP",
  ],
  RESEARCH_LINK: ["POWER_FACILITY", "BIO_FACILITY", "RESEARCH_COMPLEX", "HABITAT_MODULE", "VEHICLE_WORKSHOP"],
  TRADE_NETWORK: ["TRANSIT_HUB"],
  GLOBAL_CONTRIBUTION: ["BIO_FACILITY"],
};

// §8.1 vehicle hulls.
export interface HullSpec {
  slots: number;
  buildCost: Partial<ResourceBundle>;
  crew: number;
  upkeep: Partial<ResourceBundle>;
  baseMove: number;
}
export const HULLS: Record<HullClass, HullSpec> = {
  LIGHT: { slots: 2, buildCost: { MINERALS: 8, CREDITS: cr(6) }, crew: 1, upkeep: { CREDITS: cr(1) }, baseMove: 1 },
  MEDIUM: { slots: 4, buildCost: { MINERALS: 16, CREDITS: cr(12) }, crew: 2, upkeep: { CREDITS: cr(2) }, baseMove: 1 },
  HEAVY: { slots: 6, buildCost: { MINERALS: 28, CREDITS: cr(22) }, crew: 3, upkeep: { CREDITS: cr(4) }, baseMove: 1 },
};

// §8.3 predefined vehicle modules.
export interface VehicleModuleSpec {
  category: VehicleModCat;
  slots: number;
  buildCost: Partial<ResourceBundle>;
  bestCrew: PersonnelType | "ANY";
  cargoBonus?: number;
  weaponInvestment?: number;
  defenseInvestment?: number;
  sensorRange?: number;
  moveRange?: number;
}
export const VEHICLE_MODULES: Record<string, VehicleModuleSpec> = {
  HAULING_RIG: { category: "CARGO", slots: 1, buildCost: { MINERALS: 4, CREDITS: cr(3) }, bestCrew: "ENGINEER", cargoBonus: 10 },
  REINFORCED_HOLD: { category: "CARGO", slots: 2, buildCost: { MINERALS: 8, CREDITS: cr(6) }, bestCrew: "ENGINEER", cargoBonus: 25 },
  LIGHT_ARMAMENT: { category: "WEAPON", slots: 1, buildCost: { CREDITS: cr(6), RESEARCH: 2 }, bestCrew: "CONTRACTOR", weaponInvestment: 1 },
  HEAVY_ARMAMENT: { category: "WEAPON", slots: 3, buildCost: { MINERALS: 14, CREDITS: cr(12), RESEARCH: 4 }, bestCrew: "CONTRACTOR", weaponInvestment: 3 },
  FIELD_SCANNER: { category: "SENSOR", slots: 1, buildCost: { CREDITS: cr(4), RESEARCH: 3 }, bestCrew: "ANALYST", sensorRange: 1 },
  DEEP_ARRAY: { category: "SENSOR", slots: 2, buildCost: { CREDITS: cr(8), RESEARCH: 6 }, bestCrew: "ANALYST", sensorRange: 2 },
  UPGRADED_DRIVETRAIN: { category: "MOBILITY", slots: 1, buildCost: { MINERALS: 4, CREDITS: cr(4) }, bestCrew: "ENGINEER", moveRange: 2 },
  LONG_RANGE_PROPULSION: { category: "MOBILITY", slots: 2, buildCost: { MINERALS: 8, CREDITS: cr(8) }, bestCrew: "ANY", moveRange: 4 },
  MOBILE_WORKSHOP: { category: "UTILITY", slots: 2, buildCost: { MINERALS: 6, CREDITS: cr(6), RESEARCH: 2 }, bestCrew: "ENGINEER" },
  MOBILE_RELAY: { category: "UTILITY", slots: 2, buildCost: { CREDITS: cr(6), RESEARCH: 4 }, bestCrew: "ANALYST" },
  COMMAND_MODULE: { category: "UTILITY", slots: 2, buildCost: { CREDITS: cr(6), RESEARCH: 4 }, bestCrew: "ADMINISTRATOR" },
  PLATING: { category: "DEFENSE", slots: 1, buildCost: { MINERALS: 5, CREDITS: cr(3) }, bestCrew: "ANY", defenseInvestment: 1 },
  ACTIVE_COUNTERMEASURES: { category: "DEFENSE", slots: 2, buildCost: { MINERALS: 8, CREDITS: cr(6), RESEARCH: 3 }, bestCrew: "CONTRACTOR", defenseInvestment: 2 },
};

// §10.3 tier upgrade cost.
export const TIER_UPGRADE_COST: Partial<ResourceBundle> = { MINERALS: 18, CREDITS: cr(24) };

// §5 parent companies.
export interface ParentSpec {
  name: string;
  perkA: { freeBuilding?: BuildingType; note?: string };
  perkB: { freeBuilding?: BuildingType; note?: string };
  storedBonus: Partial<ResourceBundle>;
}
export const PARENTS: Record<ParentCompany, ParentSpec> = {
  TERRA_AGRICULTURAL: {
    name: "Terra Agricultural Syndicate",
    perkA: { freeBuilding: "BIO_FACILITY" },
    perkB: { freeBuilding: "WATER_RECLAMATION" },
    storedBonus: { FOOD: 10, WATER: 10 },
  },
  UNIFIED_MINING: {
    name: "Unified Mining Consortium",
    perkA: { freeBuilding: "EXTRACTION_SITE" },
    perkB: { freeBuilding: "POWER_FACILITY" },
    storedBonus: { MINERALS: 15, ENERGY: 5 },
  },
  STELLAR_DYNAMICS: {
    name: "Stellar Dynamics Corporation",
    perkA: { freeBuilding: "TRANSIT_HUB" },
    perkB: { freeBuilding: "WAREHOUSE" },
    storedBonus: { CREDITS: cr(10), MINERALS: 10 },
  },
  HELIX_PHARMA: {
    name: "Helix Pharmaceutical Group",
    perkA: { freeBuilding: "RESEARCH_COMPLEX" },
    perkB: { freeBuilding: "BIO_FACILITY" },
    storedBonus: { FOOD: 10, RESEARCH: 5 },
  },
  OMEGA_SECURITY: {
    name: "Omega Security Solutions",
    perkA: { note: "HQ free Fortification installed" },
    perkB: { note: "free Contractor Personnel Module on any building" },
    storedBonus: { CREDITS: cr(10), MINERALS: 5 },
  },
  GENESIS_TECH: {
    name: "Genesis Tech Industries",
    perkA: { freeBuilding: "COMMUNICATIONS_ARRAY" },
    perkB: { freeBuilding: "RESEARCH_COMPLEX" },
    storedBonus: { RESEARCH: 8, CREDITS: cr(10) },
  },
};

// §13.2 Earth Relations thresholds.
export const ER_START = 10;
export const ER_MIN = 0;
export const ER_MAX = 30;
