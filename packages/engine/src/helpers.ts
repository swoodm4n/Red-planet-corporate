/**
 * Shared derived-state helpers: storage caps, operational checks, garrison math,
 * module queries. Pure functions over state.
 */

import {
  BASE_STORAGE_CAP,
  BUILDINGS,
  COMMERCIAL_HUB_CREDIT_CAP_BONUS,
  MODULES,
  WAREHOUSE_STORAGE_BONUS,
} from "./constants.js";
import type {
  Building,
  ModuleType,
  PersonnelType,
  PhysicalResource,
  ResourceBundle,
  ResourceType,
  Subdivision,
} from "./types.js";

export function activeModules(b: Building): ModuleType[] {
  return b.modules.filter((m) => m.status === "ACTIVE").map((m) => m.type);
}

export function countActiveModule(b: Building, type: ModuleType): number {
  return b.modules.filter((m) => m.status === "ACTIVE" && m.type === type).length;
}

export function hasActiveModule(b: Building, type: ModuleType): boolean {
  return b.modules.some((m) => m.status === "ACTIVE" && m.type === type);
}

/** Effective labor garrison minimum after Automation reductions (floor 1). [D-011] */
export function effectiveGarrisonMin(b: Building): Partial<Record<PersonnelType, number>> {
  const spec = BUILDINGS[b.type];
  const base = { ...spec.garrisonMin };
  const automations = countActiveModule(b, "AUTOMATION");
  if (automations > 0) {
    for (const key of Object.keys(base) as PersonnelType[]) {
      const v = base[key] ?? 0;
      base[key] = Math.max(1, v - automations);
    }
  }
  // Add module-required garrison (Fortification/Security/OpsDirector/etc.).
  for (const m of b.modules) {
    if (m.status !== "ACTIVE") continue;
    const add = MODULES[m.type].addGarrison;
    for (const key of Object.keys(add) as PersonnelType[]) {
      base[key] = (base[key] ?? 0) + (add[key] ?? 0);
    }
  }
  return base;
}

/** Just the primary labor requirement (excludes module-added garrison). */
export function laborGarrisonMin(b: Building): Partial<Record<PersonnelType, number>> {
  const spec = BUILDINGS[b.type];
  const base = { ...spec.garrisonMin };
  const automations = countActiveModule(b, "AUTOMATION");
  if (automations > 0) {
    for (const key of Object.keys(base) as PersonnelType[]) {
      const v = base[key] ?? 0;
      base[key] = Math.max(1, v - automations);
    }
  }
  return base;
}

export function garrisonMeetsMin(
  b: Building,
  requirement: Partial<Record<PersonnelType, number>>,
): boolean {
  for (const key of Object.keys(requirement) as PersonnelType[]) {
    const need = requirement[key] ?? 0;
    const have = b.garrison[key] ?? 0;
    if (have < need) return false;
  }
  return true;
}

/**
 * Operational: finished on a prior turn, garrison meets labor min (after
 * Automation), and not disabled this turn. [D-012]
 */
export function isOperational(b: Building, turnNumber: number): boolean {
  if (b.status !== "ACTIVE") return false;
  if (b.builtOnTurn >= turnNumber) return false; // built this turn -> not yet operational
  if (b.disabledUntilTurn >= turnNumber) return false;
  return garrisonMeetsMin(b, laborGarrisonMin(b));
}

/** How many complete labor garrison sets are staffed (for repeatable actions). */
export function garrisonSetCount(b: Building): number {
  const req = laborGarrisonMin(b);
  const keys = Object.keys(req) as PersonnelType[];
  if (keys.length === 0) return 0;
  let sets = Infinity;
  for (const key of keys) {
    const need = req[key] ?? 0;
    if (need <= 0) continue;
    const have = b.garrison[key] ?? 0;
    sets = Math.min(sets, Math.floor(have / need));
  }
  return sets === Infinity ? 0 : sets;
}

// ---- Storage caps [D-003] --------------------------------------------------

export function storageCap(sub: Subdivision, resource: ResourceType): number {
  const warehouses = sub.buildings.filter(
    (b) => b.type === "WAREHOUSE" && b.status === "ACTIVE",
  ).length;
  const warehouseExpansions = sub.buildings
    .filter((b) => b.type === "WAREHOUSE" && b.status === "ACTIVE")
    .reduce((n, b) => n + countActiveModule(b, "EXPANSION"), 0);
  let cap = BASE_STORAGE_CAP + WAREHOUSE_STORAGE_BONUS * (warehouses + warehouseExpansions);
  if (resource === "CREDITS") {
    const hubExpansions = sub.buildings
      .filter((b) => b.type === "COMMERCIAL_HUB" && b.status === "ACTIVE")
      .reduce((n, b) => n + countActiveModule(b, "EXPANSION"), 0);
    cap += COMMERCIAL_HUB_CREDIT_CAP_BONUS * hubExpansions;
  }
  return cap;
}

/**
 * Add `amount` of a resource, clamping to the storage cap.
 * For Credits, cap is applied in fixed-point (cap * FP handled by caller — here
 * we treat `cap` for credits as the fp cap). Returns { stored, discarded }.
 */
export function addResourceCapped(
  sub: Subdivision,
  resource: ResourceType,
  amount: number,
): { stored: number; discarded: number } {
  const current = sub.resources[resource];
  const capUnits = storageCap(sub, resource);
  // For CREDITS the resource is stored in fp; cap is in whole Cr -> scale.
  const cap = resource === "CREDITS" ? capUnits * 10000 : capUnits;
  const next = current + amount;
  if (next > cap) {
    sub.resources[resource] = cap;
    return { stored: cap - current, discarded: next - cap };
  }
  sub.resources[resource] = next;
  return { stored: amount, discarded: 0 };
}

/** Housing capacity = sum of ACTIVE building capacities (+Expansion on Habitat). [D-023] */
export function housingCapacity(sub: Subdivision): number {
  let cap = 0;
  for (const b of sub.buildings) {
    if (b.status !== "ACTIVE") continue;
    const spec = BUILDINGS[b.type];
    if (spec.housing) {
      cap += spec.housing;
      if (b.type === "HABITAT_MODULE") {
        cap += 4 * countActiveModule(b, "EXPANSION");
      }
    }
  }
  return cap;
}

export function operationalBuildings(sub: Subdivision, turnNumber: number): Building[] {
  return sub.buildings.filter((b) => isOperational(b, turnNumber));
}

export function hasOperational(
  sub: Subdivision,
  type: Building["type"],
  turnNumber: number,
): boolean {
  return sub.buildings.some((b) => b.type === type && isOperational(b, turnNumber));
}

export function emptyResourceBundle(): ResourceBundle {
  return { CREDITS: 0, ENERGY: 0, MINERALS: 0, WATER: 0, FOOD: 0, RESEARCH: 0 };
}

/** Count personnel of a type that are not captured/lost. */
export function personnelCount(sub: Subdivision): number {
  return sub.personnel.filter((p) => p.status !== "CAPTURED" && p.status !== "LOST").length;
}

const PHYSICAL: PhysicalResource[] = ["ENERGY", "MINERALS", "WATER", "FOOD", "RESEARCH"];
export function isPhysical(r: ResourceType): r is PhysicalResource {
  return (PHYSICAL as ResourceType[]).includes(r);
}
