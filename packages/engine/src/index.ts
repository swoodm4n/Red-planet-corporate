/**
 * @rpc/engine — Red Planet Corporate deterministic rules engine.
 * Public API surface. Pure, framework-agnostic; import from a backend per turn.
 */

// Core entry point.
export { resolveTurn } from "./resolveTurn.js";
export type { ResolveResult, AdminActions } from "./resolveTurn.js";

// State construction.
export { makeGame } from "./state.js";
export type { GameSetup, SubdivisionSetup } from "./state.js";

// Orders & turn log.
export type {
  Submission,
  GarrisonAssignment,
  GarrisonTarget,
  BuildingActionOrder,
  BuildingActionType,
  UnitActionOrder,
  UnitActionType,
  PoliticalActionOrder,
  PoliticalActionType,
  CorporateActionOrder,
  CorporateActionType,
  TurnLog,
  LogEntry,
  InvalidOrder,
} from "./orders.js";

// Data models & enums.
export type {
  Game,
  Subdivision,
  Building,
  Module,
  Personnel,
  Vehicle,
  VehicleModule,
  Hex,
  HexCoord,
  MarketState,
  EquityState,
  Motion,
  ResupplyMission,
  GameConfig,
  ResourceBundle,
  CumulativeCounters,
  ResourceType,
  PhysicalResource,
  PersonnelType,
  BuildingType,
  ModuleType,
  HullClass,
  VehicleModCat,
  Terrain,
  Tier,
  BuildStatus,
  UnitStatus,
  VehicleStatus,
  SubdivisionStatus,
  ParentCompany,
} from "./types.js";
export { PHYSICAL_RESOURCES, MARKET_RESOURCE_ORDER } from "./types.js";

// Deterministic RNG (exported so backend/qa can reproduce streams).
export { Rng, makeTurnRng } from "./rng.js";

// Money helpers.
export { cr, toCr, displayCr, roundHalfUp, FP_SCALE } from "./money.js";
export type { Fp } from "./money.js";

// Subsystem functions (useful for the backend/dashboards & focused testing).
export {
  computeScoreboard,
  computeCategoryScores,
  composite,
  rankByComposite,
  categoryLeaders,
  CATEGORY_WEIGHTS,
  CATEGORY_KEYS,
} from "./scoring.js";
export type { CategoryScores, Scoreboard, CategoryKey } from "./scoring.js";

export { recomputePrice, updateMarketPrices, makeInitialMarket } from "./market.js";
export {
  recomputeSharePrice,
  computeDividends,
  makeInitialEquity,
  sharesHeld,
  setShares,
  TOTAL_SHARES,
} from "./equity.js";
export {
  adjustEr,
  colonistEta,
  emergencyResupplyAvailable,
  appealAvailable,
  requisitionCostMultiplier,
  expeditedDeliveryFree,
  parentBonusActionUnlocked,
  universalBonusActive,
  accrueResourceExport,
} from "./earthRelations.js";
export { resolveConflict } from "./conflict.js";
export type { ConflictInput, ConflictResult } from "./conflict.js";

// Map utilities.
export {
  neighbors,
  hexDistance,
  isAdjacent,
  makeDefaultMap,
  getHex,
  MAP_COLS,
  MAP_ROWS,
} from "./map.js";

// Constants (read-only data tables the backend seeds UIs from).
export {
  BUILDINGS,
  MODULES,
  MODULE_ALLOWED_ON,
  HULLS,
  VEHICLE_MODULES,
  PARENTS,
  BASELINE_PRICE,
  PERSONNEL_UPKEEP,
  RESOURCE_GENERATORS,
} from "./constants.js";

// Helper predicates.
export {
  isOperational,
  garrisonSetCount,
  housingCapacity,
  storageCap,
} from "./helpers.js";

// Cloning (deterministic deep copy incl. bigint/Set).
export { cloneGame, deepClone } from "./clone.js";
