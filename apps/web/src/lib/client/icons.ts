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
