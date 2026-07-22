// Pixel-art icon registry. Purely cosmetic — maps game-entity enum values to the
// 192x192 green-phosphor PNGs in /public/icons. The engine (@rpc/engine) remains
// the source of truth for every rule; nothing here changes what the server accepts.

/** BuildingType (packages/engine/src/types.ts) -> icon filename (no extension). */
export const BUILDING_ICONS: Record<string, string> = {
  POWER_FACILITY: "power-facility",
  EXTRACTION_SITE: "extraction-site",
  WATER_RECLAMATION: "water-reclamation",
  BIO_FACILITY: "bio-facility",
  RESEARCH_COMPLEX: "research-complex",
  COMMERCIAL_HUB: "commercial-hub",
  HABITAT_MODULE: "habitat-module",
  OUTPOST: "outpost",
  HEADQUARTERS: "headquarters",
  POWER_CONDUIT: "power-conduit",
  WAREHOUSE: "warehouse",
  COMMUNICATIONS_ARRAY: "communications-array",
  TRANSIT_HUB: "transit-hub",
  VEHICLE_WORKSHOP: "vehicle-workshop",
};

/** Resource key (+ Credits) -> icon filename. */
export const RESOURCE_ICONS: Record<string, string> = {
  CREDITS: "resource-credits",
  MINERALS: "resource-minerals",
  ENERGY: "resource-energy",
  WATER: "resource-water",
  FOOD: "resource-food",
  RESEARCH: "resource-research",
};

/** PersonnelType -> icon filename. */
export const PERSONNEL_ICONS: Record<string, string> = {
  ADMINISTRATOR: "personnel-administrator",
  INNOVATOR: "personnel-innovator",
  ENGINEER: "personnel-engineer",
  CONTRACTOR: "personnel-contractor",
  ANALYST: "personnel-analyst",
};

/** HullClass -> icon filename. */
export const HULL_ICONS: Record<string, string> = {
  LIGHT: "vehicle-light",
  MEDIUM: "vehicle-medium",
  HEAVY: "vehicle-heavy",
};

/** ActionType -> icon filename (command-card glyphs). Falls back to settings gear. */
export const ACTION_ICONS: Record<string, string> = {
  BOOST_OUTPUT: "action-settings",
  EMERGENCY_EXTRACTION: "action-settings",
  MARKET_SALE: "action-trade",
  COLONIST_REQUISITION: "action-garrison",
  TERRITORIAL_CLAIM: "action-move",
  RESOURCE_TRANSFER: "action-trade",
  PRODUCE_VEHICLE: "action-build",
  AMPLIFY_CREDIT_YIELD: "action-dividend",
  RESEARCH_SPRINT: "action-research",
  PASSIVE_INTEL_SCAN: "status-spotting",
  LOCKDOWN: "action-settings",
  CONSTRUCT_BUILDING: "action-build",
  INSTALL_MODULE: "action-settings",
  TIER_UPGRADE: "action-upgrade",
  PLACE_OUTPOST: "outpost",
  SURVEY_HEX: "status-spotting",
  DEMOLISH: "action-settings",
  REPAIR_BUILDING: "action-settings",
  SABOTAGE: "status-alert",
  INTERCEPT: "status-alert",
  FIELD_RESEARCH: "action-research",
  TRADE_ACTION: "action-trade",
  NEGOTIATE: "action-dividend",
  LOBBY: "action-dividend",
  PATROL: "status-spotting",
  ENFORCE_TERRITORY: "status-alert",
  COUNTER_INTEL: "status-spotting",
  VEHICLE_MOVE: "action-move",
  VEHICLE_ATTACK: "status-alert",
};

export function actionIcon(action: string): string {
  return ACTION_ICONS[action] ?? "action-settings";
}

export function buildingIcon(type: string): string | null {
  return BUILDING_ICONS[type] ?? null;
}
export function resourceIcon(resource: string): string | null {
  return RESOURCE_ICONS[resource] ?? null;
}
export function personnelIcon(type: string): string | null {
  return PERSONNEL_ICONS[type] ?? null;
}
export function hullIcon(hull: string): string | null {
  return HULL_ICONS[hull] ?? null;
}
