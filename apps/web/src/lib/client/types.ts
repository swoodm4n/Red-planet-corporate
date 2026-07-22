// Response shapes for the RPC API, kept loose where the engine payloads are deep.
// These mirror the server route handlers in src/app/api/**.

export type Role = "PLAYER" | "ADMIN";
export type UserStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MeResponse {
  user: {
    id: string;
    email: string;
    role: Role;
    status: UserStatus;
    displayName: string | null;
    preferences: {
      parentCompany: string | null;
      parentPerk: string | null;
      choicePersonnel: string[] | null;
      desiredName: string | null;
    };
  } | null;
  assignment: { gameId: number; subdivisionId: number } | null;
}

export interface GameSummary {
  id: number;
  name: string;
  turnNumber: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  turnDeadline: string | null;
  turnLengthHours: number;
  yourSubdivisionId: number | null;
}

export interface SubdivisionSlot {
  subdivisionId: number;
  name: string;
  parentCompany: string;
  parentPerk?: string;
  status: string;
  earthRelations?: number;
  composite?: number;
  rank?: number;
  assignedTo: { id: string; email: string; displayName?: string | null } | null;
}

export interface MarketRow {
  resource: string;
  livePriceFp: number;
  livePrice: number;
  cumulativeBought: number;
  cumulativeSold: number;
}

export interface StandingRow {
  rank: number;
  subdivisionId: number;
  name: string;
  parentCompany: string;
  composite: number;
  leadingCategory: string;
}

export interface HexView {
  col: number;
  row: number;
  terrain: string;
  ownerSubdivisionId: number | null;
}

// ---- Intel-gated square map (§21 / [D-050]–[D-055]) ----
export type IntelTier = "OWN" | "LOW" | "MEDIUM" | "HIGH" | "FULL";

/** GET /api/games/:id/map — one marker per tile (row-major, 96). Public map data
 *  + the server-computed intel tier only; never building lists/counts/outputs. */
export interface MapTileMarker {
  coord: { col: number; row: number };
  terrain: string;
  owner: number | null;
  isLandingZone: boolean;
  hasHQ: boolean;
  hasOutpost: boolean;
  intelTier: IntelTier;
}

export interface MapResponse {
  gameId: number;
  turnNumber: number;
  cols: number;
  rows: number;
  viewerSubdivisionId: number | null;
  tiles: MapTileMarker[];
}

/** GET /api/games/:id/map/tiles/:col/:row — additive by tier; gated fields are
 *  present only at/above their tier (render on field presence, never assume shape). */
export interface TileView {
  coord: { col: number; row: number };
  terrain: string;
  owner: number | null;
  isLandingZone: boolean;
  hasHQ: boolean;
  hasOutpost: boolean;
  intelTier: IntelTier;
  // MEDIUM+
  buildingCount?: number;
  // HIGH+
  buildings?: string[];
  unitCount?: number;
  // FULL+
  resourceOutput?: Record<string, number>;
  units?: { personnel: Record<string, number>; vehicles: Record<string, number> };
  // OWN only
  ownBuildings?: {
    id: number;
    type: string;
    tier: string;
    status: string;
    modules: { id: number; type: string; status: string }[];
    garrison: Record<string, number>;
  }[];
}

export interface TileResponse {
  gameId: number;
  turnNumber: number;
  viewerSubdivisionId: number | null;
  tile: TileView;
}

export interface PublicSubdivision {
  subdivisionId: number;
  name: string;
  parentCompany: string;
  status: string;
  composite: number;
  leadingCategory: string;
  buildings: { id: number; type: string; tier: string; hex: { col: number; row: number }; status: string }[];
  closedBordersAgainst: (number | string)[];
}

export interface DashboardResponse {
  gameId: number;
  turnNumber: number;
  standings: { leaders: Record<string, number | null>; standings: StandingRow[] };
  market: MarketRow[];
  equity: {
    sharePrices: { issuerSubdivisionId: number; sharePriceFp: number; sharePrice: number }[];
    holdings: { issuerSubdivisionId: number; holderSubdivisionId: number; shares: number }[];
  };
  map: HexView[];
  subdivisions: PublicSubdivision[];
  announcements: { id: string; title: string; body: string; createdAt: string }[];
  colonyEvents: { turnNumber: number; event: EngineEvent; at: string }[];
}

export interface EngineEvent {
  scope: string;
  name: string;
  message: string;
  affectedSubdivisionIds: number[];
}

export interface ResourceBlock {
  CREDITS: number;
  creditsDisplay: number;
  ENERGY: number;
  MINERALS: number;
  WATER: number;
  FOOD: number;
  RESEARCH: number;
}

export interface OwnBuilding {
  id: number;
  type: string;
  tier: string;
  hex: { col: number; row: number };
  status: string;
  builtOnTurn: number;
  garrison: Record<string, number>;
  modules: { id: number; type: string; status: string; operationsDirectorMode?: string }[];
  disabledUntilTurn: number;
  dormantTurns: number;
}

export interface OwnPersonnel {
  id: number;
  type: string;
  status: string;
  assignedBuildingId: number | null;
  assignedVehicleId: number | null;
  unavailableUntilTurn: number;
  arrivalTurn: number | null;
  requisitionType: string | null;
}

export interface OwnVehicle {
  id: number;
  hull: string;
  status: string;
  hex?: { col: number; row: number };
  crew?: number[];
  modules?: { id: number; type: string }[];
  cargo?: Record<string, number>;
}

export interface ReportResponse {
  gameId: number;
  turnNumber: number;
  own: {
    subdivisionId: number;
    name: string;
    parentCompany: string;
    parentPerk: string;
    status: string;
    earthRelations: number;
    earthRelationsBonusActive: boolean;
    resources: ResourceBlock;
    buildings: OwnBuilding[];
    personnel: OwnPersonnel[];
    vehicles: OwnVehicle[];
    capturedUnits: OwnPersonnel[];
    closedBordersAgainst: (number | string)[];
    cumulativeCounters: Record<string, unknown>;
    consistentOutputStreak: number;
    insolventStreak: number;
    scoring: { categories: Record<string, number>; composite: number; rank: number };
    equityHoldings: { issuerSubdivisionId: number; holderSubdivisionId: number; shares: number }[];
    creditsEarnedFromSalesDisplay: number;
  };
  others: PublicSubdivision[];
  market: MarketRow[];
  standings: { leaders: Record<string, number | null>; standings: StandingRow[] };
}

export interface AvailableActionsResponse {
  gameId: number;
  turnNumber: number;
  subdivisionId: number;
  /** buildingId (string key) -> currently-valid BuildingActionType[]. */
  buildings: Record<string, string[]>;
  /** personnelId (string key) -> attention spent by the draft so far. */
  unitAttention: Record<string, boolean>;
}

export interface OrdersResponse {
  gameId: number;
  turnNumber: number;
  subdivisionId: number;
  submission: EngineSubmission | null;
  status: string | null;
  updatedAt: string | null;
}

export interface EngineSubmission {
  subdivisionId: number;
  turnNumber: number;
  garrison: GarrisonAssignment[];
  buildingActions: BuildingActionOrder[];
  unitActions: UnitActionOrder[];
  politicalAction?: PoliticalActionOrder | null;
  corporateActions: CorporateActionOrder[];
  notes: string[];
}

export type GarrisonTarget =
  | { kind: "BUILDING"; buildingId: number }
  | { kind: "VEHICLE"; vehicleId: number }
  | { kind: "AVAILABLE" };

export interface GarrisonAssignment {
  unitId: number;
  target: GarrisonTarget;
}

export interface BuildingActionOrder {
  buildingId: number;
  action: string;
  params?: Record<string, unknown>;
}

export interface UnitActionOrder {
  unitId: number;
  action: string;
  vehicleId?: number;
  targetHex?: { col: number; row: number };
  targetBuildingId?: number;
  targetSubdivisionId?: number;
  targetUnitId?: number;
  targetVehicleId?: number;
  params?: Record<string, unknown>;
}

export interface PoliticalActionOrder {
  action: string;
  params?: Record<string, unknown>;
}

export interface CorporateActionOrder {
  action: string;
  params?: Record<string, unknown>;
}

// ---- Subdivision comms ([D-066]–[D-068]) ----
export type MessageScope = "PUBLIC" | "SUBDIVISION" | "ADMIN";

export interface Message {
  id: string;
  gameId: number;
  scope: MessageScope;
  channel: string; // always "COMMS" for player messages
  senderSubdivisionId: number | null;
  recipientSubdivisionId: number | null;
  recipientIsAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface MessagesResponse {
  gameId: number;
  viewerSubdivisionId: number | null;
  isAdmin: boolean;
  messages: Message[];
}

export type MessageRecipient =
  | { type: "PUBLIC" }
  | { type: "SUBDIVISION"; subdivisionId: number }
  | { type: "ADMIN" };

export interface InvalidOrder {
  subdivisionId: number;
  kind: string;
  reason: string;
  order: unknown;
}

export interface OrdersPutResult {
  saved: boolean;
  gameId: number;
  turnNumber: number;
  subdivisionId: number;
  invalidOrders: InvalidOrder[];
  accepted: boolean;
}
