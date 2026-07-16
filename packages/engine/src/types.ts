/**
 * Core data models & enumerations. GAME_SPEC §1, §3.
 * All money fields are fixed-point (see money.ts, [D-002]). Physical resources
 * are non-negative integers.
 */

import type { Fp } from "./money.js";

// ---------------------------------------------------------------------------
// §1 Enumerations
// ---------------------------------------------------------------------------

export type ResourceType = "CREDITS" | "ENERGY" | "MINERALS" | "WATER" | "FOOD" | "RESEARCH";
export type PhysicalResource = "ENERGY" | "MINERALS" | "WATER" | "FOOD" | "RESEARCH";

export const PHYSICAL_RESOURCES: PhysicalResource[] = [
  "ENERGY",
  "MINERALS",
  "WATER",
  "FOOD",
  "RESEARCH",
];

/** Canonical market resource order [E, Min, W, F, R]. §11.2 / [D-006]. */
export const MARKET_RESOURCE_ORDER: PhysicalResource[] = [
  "ENERGY",
  "MINERALS",
  "WATER",
  "FOOD",
  "RESEARCH",
];

export type PersonnelType = "ENGINEER" | "CONTRACTOR" | "ADMINISTRATOR" | "INNOVATOR" | "ANALYST";

export type BuildingType =
  | "POWER_FACILITY"
  | "EXTRACTION_SITE"
  | "WATER_RECLAMATION"
  | "BIO_FACILITY"
  | "RESEARCH_COMPLEX"
  | "COMMERCIAL_HUB"
  | "HABITAT_MODULE"
  | "OUTPOST"
  | "HEADQUARTERS"
  | "POWER_CONDUIT"
  | "WAREHOUSE"
  | "COMMUNICATIONS_ARRAY"
  | "TRANSIT_HUB"
  | "VEHICLE_WORKSHOP";

export type ModuleType =
  | "EFFICIENCY"
  | "REDUNDANT_SYSTEMS"
  | "EXPANSION"
  | "FORTIFICATION"
  | "SECURITY_DETAIL"
  | "OPERATIONS_DIRECTOR"
  | "TERRAIN_EXPLOIT"
  | "SENSOR_ARRAY"
  | "COMMAND_SUITE"
  | "DIPLOMATIC_SUITE"
  | "AUTOMATION"
  | "PERSONNEL_MODULE"
  | "HAZARD_SHIELD"
  | "RESEARCH_LINK"
  | "TRADE_NETWORK"
  | "GLOBAL_CONTRIBUTION";

export type HullClass = "LIGHT" | "MEDIUM" | "HEAVY";
export type VehicleModCat = "CARGO" | "WEAPON" | "SENSOR" | "MOBILITY" | "UTILITY" | "DEFENSE";

export type Terrain =
  | "PLAINS"
  | "COLONY_EXPANSION"
  | "MOUNTAINS"
  | "ICE_DEPOSIT"
  | "RARE_MINERALS"
  | "VOLCANIC_VENT"
  | "WATER_RESERVE"
  | "LANDING_ZONE"
  | "IMPASSABLE";

export type Tier = "T0" | "T1";
export type BuildStatus = "PENDING" | "ACTIVE" | "DISABLED" | "DERELICT";
export type UnitStatus =
  | "AVAILABLE"
  | "GARRISONED"
  | "CREWING"
  | "CAPTURED"
  | "UNHOUSED"
  | "LOST";
export type VehicleStatus = "PENDING" | "ACTIVE" | "DESTROYED";
export type SubdivisionStatus = "ACTIVE" | "RETIRED";
export type OpsDirectorMode = "OUTPUT" | "UPKEEP";

export type ParentCompany =
  | "TERRA_AGRICULTURAL"
  | "UNIFIED_MINING"
  | "STELLAR_DYNAMICS"
  | "HELIX_PHARMA"
  | "OMEGA_SECURITY"
  | "GENESIS_TECH";

// ---------------------------------------------------------------------------
// §3 Data models
// ---------------------------------------------------------------------------

export interface HexCoord {
  col: number; // 1..12
  row: number; // 1..8
}

export interface ResourceBundle {
  CREDITS: number; // fixed-point (Fp)
  ENERGY: number;
  MINERALS: number;
  WATER: number;
  FOOD: number;
  RESEARCH: number;
}

export interface Module {
  id: number;
  type: ModuleType;
  status: BuildStatus;
  /** Only meaningful for OPERATIONS_DIRECTOR. [D-011] */
  operationsDirectorMode?: OpsDirectorMode;
  /** For PERSONNEL_MODULE / COMMAND_SUITE: named unit types the module wants. */
  namedUnits?: PersonnelType[];
}

export interface Building {
  id: number;
  type: BuildingType;
  tier: Tier;
  hex: HexCoord;
  status: BuildStatus;
  builtOnTurn: number;
  modules: Module[];
  /** Units currently assigned here, keyed by personnel type. */
  garrison: Partial<Record<PersonnelType, number>>;
  disabledUntilTurn: number; // [D-030]
  dormantTurns: number; // consecutive turns garrison-min unmet
  /** Runtime flag: set when this building's own Cr upkeep went unpaid. [D-020] */
  nonOperationalNextTurn?: boolean;
}

export interface Personnel {
  id: number;
  type: PersonnelType;
  status: UnitStatus;
  assignedBuildingId?: number;
  assignedVehicleId?: number;
  unavailableUntilTurn: number; // Personnel Dispute event
  arrivalTurn?: number; // if in transit from requisition
  requisitionType?: PersonnelType;
}

export interface VehicleModule {
  id: number;
  category: VehicleModCat;
  name: string;
  status: BuildStatus;
}

export interface Vehicle {
  id: number;
  hull: HullClass;
  modules: VehicleModule[];
  crew: number[]; // personnel ids
  hex: HexCoord;
  status: VehicleStatus;
  cargo: Partial<Record<PhysicalResource, number>>;
}

export interface Hex {
  coord: HexCoord;
  terrain: Terrain;
  ownerSubdivisionId?: number;
  deposits?: Partial<Record<PhysicalResource, number>>;
  /** True once revealed via Survey. */
  surveyed?: boolean;
}

export interface CumulativeCounters {
  resourcesSoldUnits: number;
  creditsEarnedFromSales: Fp;
  researchGenerated: number;
  researchSubmissions: number;
  successfulSabotageDefenses: number;
  successfulIntercepts: number;
  successfulSabotageActions: number;
  successfulSurveillance: number;
  undetectedPlantIntel: number;
  consistentOutputStreak: number;
  /** ER Resource Export: last multiple-of-20 already credited. [D-024] */
  resourceExportCredited: number;
}

export interface Subdivision {
  id: number;
  name: string;
  parentCompany: ParentCompany;
  parentPerk: "A" | "B";
  status: SubdivisionStatus;
  resources: ResourceBundle;
  earthRelations: number; // [0,30], start 10
  buildings: Building[];
  personnel: Personnel[];
  vehicles: Vehicle[];
  capturedUnits: Personnel[];
  closedBordersAgainst: Set<number | "ALL">;
  cum: CumulativeCounters;
  earthRelationsBonusActive: boolean; // ER==30 second corporate action
  /** consecutive turns of physical net >= 0 (feeds Consistent Output ER). [D-025] */
  consistentOutputStreak: number;
  /** Turns spent at 0 Credits with net-negative flow (insolvency watch). [D-020] */
  insolventStreak: number;
}

export interface MarketState {
  livePrice: Record<PhysicalResource, Fp>;
  cumulativeBought: Record<PhysicalResource, number>;
  cumulativeSold: Record<PhysicalResource, number>;
  /** Flow accrued this turn (reset each turn start). */
  boughtThisTurn: Record<PhysicalResource, number>;
  soldThisTurn: Record<PhysicalResource, number>;
  /** LZ colony-wide throughput used this turn (§11.1 / [D-001]). */
  lzColonyUsedThisTurn: number;
}

export interface EquityHolding {
  issuerSubdivisionId: number;
  holderSubdivisionId: number;
  shares: number;
}

export interface EquityState {
  /** Live share price per issuer subdivision (fixed-point). */
  sharePrice: Record<number, Fp>;
  /** Ownership ledger. 100 shares per issuer; issuer holds the remainder. */
  holdings: EquityHolding[];
  /** Net shares traded this turn per issuer (for pressure calc). */
  netSharesTradedThisTurn: Record<number, number>;
}

export interface Motion {
  id: number;
  proposerSubdivisionId: number;
  description: string;
  votes: Record<number, "FOR" | "AGAINST" | "ABSTAIN">;
  lobbyWeight: Record<number, number>;
  resolveOnTurn: number;
}

export interface ResupplyMission {
  subdivisionId: number;
  resource: PhysicalResource;
  quantity: number;
  arriveOnTurn: number;
  /** "APPEAL" | "EMERGENCY" | "EARTH_MARKET" — informational. */
  kind: string;
}

export interface GameConfig {
  normalizationEnabled: boolean; // [D-035]
  /** Landing-zone hub hex (unclaimable, permanent Transit Hub). §9.1 */
  landingZoneHex: HexCoord;
}

export interface Game {
  id: number;
  gameSeed: bigint;
  turnNumber: number; // 1-based, current turn being processed
  subdivisions: Subdivision[];
  map: Hex[];
  market: MarketState;
  equity: EquityState;
  oxygen: number; // inert habitability counter [D-034]
  milestonesClaimed: Set<string>;
  activeMotions: Motion[];
  resupplyMissions: ResupplyMission[];
  config: GameConfig;
  /** Monotonic id allocators. Never reuse ids. §3. */
  nextIds: {
    building: number;
    module: number;
    personnel: number;
    vehicle: number;
    vehicleModule: number;
    motion: number;
  };
}
