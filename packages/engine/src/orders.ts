/**
 * Turn submission schema (§10.6) and turn-log types.
 * Orders carry a discriminated `action` plus loosely-typed params validated in
 * Phase 2. The engine treats each Submission as immutable input.
 */

import type {
  HexCoord,
  HullClass,
  ModuleType,
  OpsDirectorMode,
  PersonnelType,
  PhysicalResource,
} from "./types.js";

export type GarrisonTarget =
  | { kind: "BUILDING"; buildingId: number }
  | { kind: "VEHICLE"; vehicleId: number }
  | { kind: "AVAILABLE" };

export interface GarrisonAssignment {
  unitId: number;
  target: GarrisonTarget;
}

export type BuildingActionType =
  | "BOOST_OUTPUT"
  | "EMERGENCY_EXTRACTION"
  | "MARKET_SALE"
  | "COLONIST_REQUISITION"
  | "TERRITORIAL_CLAIM"
  | "RESOURCE_TRANSFER"
  | "PRODUCE_VEHICLE"
  | "AMPLIFY_CREDIT_YIELD"
  | "RESEARCH_SPRINT"
  | "PASSIVE_INTEL_SCAN";

export interface BuildingActionOrder {
  buildingId: number;
  action: BuildingActionType;
  params?: {
    resource?: PhysicalResource;
    quantity?: number;
    peerBuyerSubdivisionId?: number;
    colonistCount?: number;
    colonistType?: PersonnelType;
    targetHex?: HexCoord;
    fromBuildingId?: number;
    toBuildingId?: number;
    toLandingZone?: boolean;
    hull?: HullClass;
    vehicleModules?: string[];
    opsDirectorMode?: OpsDirectorMode;
  };
}

export type UnitActionType =
  | "CONSTRUCT_BUILDING"
  | "INSTALL_MODULE"
  | "TIER_UPGRADE"
  | "PLACE_OUTPOST"
  | "SURVEY_HEX"
  | "DEMOLISH"
  | "REPAIR_BUILDING"
  | "SABOTAGE"
  | "INTERCEPT"
  | "FIELD_RESEARCH";

export interface UnitActionOrder {
  unitId: number;
  action: UnitActionType;
  targetHex?: HexCoord;
  targetBuildingId?: number;
  targetSubdivisionId?: number;
  targetUnitId?: number;
  params?: {
    buildingType?: import("./types.js").BuildingType;
    moduleType?: ModuleType;
    namedUnits?: PersonnelType[];
  };
}

export type PoliticalActionType =
  | "PUBLIC_STATEMENT"
  | "PROPOSE_MOTION"
  | "FORM_AGREEMENT"
  | "DENOUNCE"
  | "APPEAL_TO_EARTH"
  | "VOTE_ON_MOTION";

export interface PoliticalActionOrder {
  action: PoliticalActionType;
  params?: {
    resource?: PhysicalResource;
    description?: string;
    motionId?: number;
    vote?: "FOR" | "AGAINST" | "ABSTAIN";
    lobbyVotes?: number;
    targetSubdivisionId?: number;
    text?: string;
  };
}

export type CorporateActionType =
  | "EXPEDITED_DELIVERY"
  | "EMERGENCY_RESUPPLY"
  | "CORPORATE_AUDIT"
  | "HOSTILE_ACQUISITION"
  | "BLACK_MARKET_SALE"
  | "DISINFORMATION_CAMPAIGN";

export interface CorporateActionOrder {
  action: CorporateActionType;
  params?: {
    resource?: PhysicalResource;
    quantity?: number;
    targetSubdivisionId?: number;
    targetUnitId?: number;
    counterBid?: number; // fixed-point Cr for defender counter-bid
  };
}

export interface Submission {
  subdivisionId: number;
  turnNumber: number;
  garrison: GarrisonAssignment[];
  buildingActions: BuildingActionOrder[];
  unitActions: UnitActionOrder[];
  politicalAction?: PoliticalActionOrder;
  corporateActions?: CorporateActionOrder[]; // 1, or 2 if ER==30
  notes?: string[];
}

// ---- Turn log --------------------------------------------------------------

export interface LogEntry {
  phase: number;
  subdivisionId?: number;
  code: string; // machine-readable event code
  message: string;
  data?: Record<string, unknown>;
}

export interface InvalidOrder {
  subdivisionId: number;
  kind: "GARRISON" | "BUILDING" | "UNIT" | "POLITICAL" | "CORPORATE";
  reason: string;
  order: unknown;
}

export interface TurnLog {
  turnNumber: number;
  entries: LogEntry[];
  invalidOrders: InvalidOrder[];
  /** Event that fired this turn (if any). */
  event?: {
    scope: "COLONY" | "REGIONAL" | "SUBDIVISION" | "NONE";
    name: string;
    message: string;
    affectedSubdivisionIds: number[];
  };
  /** Final scoreboard snapshot for the turn. */
  scoreboard: {
    subdivisionId: number;
    categories: Record<string, number>;
    composite: number;
    rank: number;
  }[];
  categoryLeaders: Record<string, number | null>;
}
