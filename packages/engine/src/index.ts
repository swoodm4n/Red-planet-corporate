/**
 * @rpc/engine — Red Planet Corporate deterministic rules engine.
 * Public API surface. Pure, framework-agnostic; import from a backend per turn.
 */

// Core entry point.
export { resolveTurn } from "./resolveTurn.js";
export type { ResolveResult, AdminActions } from "./resolveTurn.js";

// Submission-time validation (reuses engine Phase-2 validation). [D-043]
export { validateSubmission } from "./validateSubmission.js";

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
  ActiveEffect,
  EffectType,
  EffectScope,
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
  gridDistance,
  hexDistance,
  isAdjacent,
  makeDefaultMap,
  getHex,
  MAP_COLS,
  MAP_ROWS,
} from "./map.js";

// Intelligence-gated visibility (§21 / [D-050]–[D-055]).
export {
  computeEspionage,
  computeOpsec,
  computeIntelTier,
  intelTierFrom,
  getGatedTileView,
  getMapView,
  INTEL_ESPIONAGE_BASE,
  INTEL_OPSEC_BASE,
  INTEL_W_ANALYST,
  INTEL_W_SENSOR_ARRAY,
  INTEL_W_COMMS_ARRAY,
  INTEL_W_COMMAND_SUITE,
  INTEL_W_CONTRACTOR,
  INTEL_W_SECURITY_DETAIL,
  INTEL_W_FORTIFICATION,
  INTEL_TIER_LOW_MAX,
  INTEL_TIER_MEDIUM_MAX,
  INTEL_TIER_HIGH_MAX,
} from "./intel.js";
export type {
  IntelTier,
  TileViewTier,
  TileView,
  TileViewBuildingDetail,
  TileViewUnits,
  MapTileMarker,
} from "./intel.js";

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

// §22 Unit Attention & building available-action derivation. [D-056]–[D-064]
export {
  availableActions,
  buildingActionOffered,
  selectAttentionUnits,
  selectActorAttention,
  buildingActionGarrisonGroups,
  pickBuildingActionAttention,
  pickUnitActionAttention,
  spendAttention,
  base,
  garrisonUnlocked,
  moduleUnlocked,
} from "./attention.js";
export type { AttentionGroup } from "./attention.js";

// Cloning (deterministic deep copy incl. bigint/Set).
export { cloneGame, deepClone } from "./clone.js";

// Phase-1 garrison application (single-subdivision), reused for the composer's
// available-actions preview so draft re-garrisoning is reflected before per-building
// actions are evaluated (§22.9 / [D-065]).
export { applyGarrisonForSubdivision } from "./phases/garrison.js";
