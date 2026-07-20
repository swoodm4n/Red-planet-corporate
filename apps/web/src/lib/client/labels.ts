// Display labels + light formatting helpers. Purely cosmetic — no game logic.

export const PARENT_LABELS: Record<string, string> = {
  TERRA_AGRICULTURAL: "Terra Agricultural Syndicate",
  UNIFIED_MINING: "Unified Mining Consortium",
  STELLAR_DYNAMICS: "Stellar Dynamics Corporation",
  HELIX_PHARMA: "Helix Pharmaceutical Group",
  OMEGA_SECURITY: "Omega Security Solutions",
  GENESIS_TECH: "Genesis Tech Industries",
};

/**
 * Parent-company perk help text for the registration picker. Display-only.
 *
 * Grounded in the engine's actual setup logic, NOT just GAME_SPEC prose:
 *   - PARENTS table + ParentSpec in packages/engine/src/constants.ts
 *   - buildGame() / subdivision setup in packages/engine/src/state.ts
 *
 * What the engine actually does at setup:
 *   1. Applies the company's `storedBonus` to starting resources — the SAME for
 *      both perk A and B (it is a company bonus, not a per-perk bonus).
 *   2. If the chosen perk has a `freeBuilding`, places that building at HQ.
 *      This free building is the ONLY mechanical difference between A and B.
 *
 * Not implemented in the engine (so deliberately NOT promised here):
 *   - Omega Security's perks carry only a `note` string ("HQ free Fortification",
 *     "free Contractor Personnel Module") that state.ts never consumes — no
 *     Fortification or Personnel Module is installed, so its two perks are
 *     currently mechanically identical (stored bonus only). Flagged below.
 *   - The §5 ER-25 bonus actions / company Corporate Actions (Bumper Harvest,
 *     Strategic Reserve, etc.) do not exist in the engine's action set.
 */
export interface PerkInfo { label: string; desc: string; }
export interface ParentPerkInfo { storedBonus: string; A: PerkInfo; B: PerkInfo; }

export const PARENT_PERK_INFO: Record<string, ParentPerkInfo> = {
  TERRA_AGRICULTURAL: {
    storedBonus: "+10 Food, +10 Water",
    A: {
      label: "Free Bio Facility",
      desc: "Farm dome. You start with a Bio Facility already built beside HQ (saves its 12 Min + 8 Cr + 3 W build cost). Once garrisoned with 2 Engineers it yields +2 Food/turn.",
    },
    B: {
      label: "Free Water Reclamation",
      desc: "Ice-melt plant. You start with a Water Reclamation building beside HQ (saves 12 Min + 8 Cr). Garrisoned with 2 Engineers it yields +2 Water/turn.",
    },
  },
  UNIFIED_MINING: {
    storedBonus: "+15 Minerals, +5 Energy",
    A: {
      label: "Free Extraction Site",
      desc: "Ore mine. You start with an Extraction Site already built (saves 12 Min + 8 Cr). Garrisoned with 3 Engineers it yields +2 Minerals/turn.",
    },
    B: {
      label: "Free Power Facility",
      desc: "Reactor. You start with a Power Facility already built (saves 12 Min + 8 Cr). Garrisoned with 2 Engineers it yields +2 Energy/turn.",
    },
  },
  STELLAR_DYNAMICS: {
    storedBonus: "+10 Credits, +10 Minerals",
    A: {
      label: "Free Transit Hub",
      desc: "Logistics depot. You start with a Transit Hub already built (saves 12 Min + 10 Cr + 4 R). Unlocks Market Sale (sell up to 10 units/turn) and serves as your trade-network node; garrison 2 Engineers + 1 Administrator.",
    },
    B: {
      label: "Free Warehouse",
      desc: "Storage bay. You start with a Warehouse already built (saves 8 Min + 6 Cr). Raises your storage cap by +20 on every resource and enables Resource Transfer; garrison 2 Engineers.",
    },
  },
  HELIX_PHARMA: {
    storedBonus: "+10 Food, +5 Research",
    A: {
      label: "Free Research Complex",
      desc: "Lab. You start with a Research Complex already built (saves 14 Min + 10 Cr). Garrisoned with 3 Innovators it yields +2 Research/turn.",
    },
    B: {
      label: "Free Bio Facility",
      desc: "Farm dome. You start with a Bio Facility already built (saves 12 Min + 8 Cr + 3 W). Garrisoned with 2 Engineers it yields +2 Food/turn.",
    },
  },
  OMEGA_SECURITY: {
    storedBonus: "+10 Credits, +5 Minerals",
    A: {
      label: "Hardened HQ (intended: free Fortification)",
      desc: "The security firm's own HQ is meant to ship pre-fitted with a Fortification. NOTE: the engine does not currently install this Fortification at setup, so this perk presently grants only the shared +10 Cr / +5 Min stockpile — mechanically identical to Perk B until it is wired up.",
    },
    B: {
      label: "Embedded Contractor (intended: free Personnel Module)",
      desc: "Meant to bolt a Contractor Personnel Module onto a building of your choice. NOTE: the engine does not currently install this module at setup, so this perk presently grants only the shared +10 Cr / +5 Min stockpile — mechanically identical to Perk A until it is wired up.",
    },
  },
  GENESIS_TECH: {
    storedBonus: "+8 Research, +10 Credits",
    A: {
      label: "Free Communications Array",
      desc: "Sensor mast. You start with a Communications Array already built (saves 10 Min + 14 Cr + 4 R). Gives intel range out to 2 hexes plus an Analyst intel action; garrison 2 Analysts + 1 Engineer.",
    },
    B: {
      label: "Free Research Complex",
      desc: "Lab. You start with a Research Complex already built (saves 14 Min + 10 Cr). Garrisoned with 3 Innovators it yields +2 Research/turn.",
    },
  },
};

export const RESOURCE_LABELS: Record<string, string> = {
  CREDITS: "Credits",
  ENERGY: "Energy",
  MINERALS: "Minerals",
  WATER: "Water",
  FOOD: "Food/Bio",
  RESEARCH: "Research",
};

export const RESOURCE_SHORT: Record<string, string> = {
  CREDITS: "CR",
  ENERGY: "ENG",
  MINERALS: "MIN",
  WATER: "H2O",
  FOOD: "FOOD",
  RESEARCH: "RES",
};

export const PERSONNEL_LABELS: Record<string, string> = {
  ENGINEER: "Engineer",
  CONTRACTOR: "Contractor",
  ADMINISTRATOR: "Administrator",
  INNOVATOR: "Innovator",
  ANALYST: "Analyst",
};

export const PERSONNEL_TYPES = [
  "ENGINEER",
  "CONTRACTOR",
  "ADMINISTRATOR",
  "INNOVATOR",
  "ANALYST",
] as const;

export function unitDotClass(type: string): string {
  return `unit-dot ${type.toLowerCase()}`;
}

export function titleCase(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // split camelCase keys (e.g. researchGenerated)
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function hexLabel(col: number, row: number): string {
  const letters = "ABCDEFGHIJKL";
  return `${letters[col - 1] ?? col}${row}`;
}

export function fmtCr(fp: number): string {
  return (fp / 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function countdown(deadline: string | null): string {
  if (!deadline) return "—";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "OVERDUE";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const BUILDING_ACTIONS = [
  "BOOST_OUTPUT",
  "EMERGENCY_EXTRACTION",
  "MARKET_SALE",
  "COLONIST_REQUISITION",
  "TERRITORIAL_CLAIM",
  "RESOURCE_TRANSFER",
  "PRODUCE_VEHICLE",
  "AMPLIFY_CREDIT_YIELD",
  "RESEARCH_SPRINT",
  "PASSIVE_INTEL_SCAN",
  "LOCKDOWN",
];

export const UNIT_ACTIONS = [
  "CONSTRUCT_BUILDING",
  "INSTALL_MODULE",
  "TIER_UPGRADE",
  "PLACE_OUTPOST",
  "SURVEY_HEX",
  "DEMOLISH",
  "REPAIR_BUILDING",
  "SABOTAGE",
  "INTERCEPT",
  "FIELD_RESEARCH",
  "TRADE_ACTION",
  "NEGOTIATE",
  "LOBBY",
  "PATROL",
  "ENFORCE_TERRITORY",
  "COUNTER_INTEL",
  "VEHICLE_MOVE",
  "VEHICLE_ATTACK",
];

export const POLITICAL_ACTIONS = [
  "PUBLIC_STATEMENT",
  "PROPOSE_MOTION",
  "FORM_AGREEMENT",
  "DENOUNCE",
  "APPEAL_TO_EARTH",
  "VOTE_ON_MOTION",
];

export const CORPORATE_ACTIONS = [
  "EXPEDITED_DELIVERY",
  "EMERGENCY_RESUPPLY",
  "CORPORATE_AUDIT",
  "HOSTILE_ACQUISITION",
  "BLACK_MARKET_SALE",
  "DISINFORMATION_CAMPAIGN",
];

export const PHYSICAL_RESOURCES = ["ENERGY", "MINERALS", "WATER", "FOOD", "RESEARCH"];

// ---------------------------------------------------------------------------
// Display-only metadata. The engine (@rpc/engine) is the source of truth and
// re-validates everything at submit + resolution; the maps below exist ONLY to
// give the player readable labels and immediate on-screen hints. None of it
// changes what the server accepts.
// ---------------------------------------------------------------------------

export const BUILDING_TYPES = [
  "POWER_FACILITY", "EXTRACTION_SITE", "WATER_RECLAMATION", "BIO_FACILITY",
  "RESEARCH_COMPLEX", "COMMERCIAL_HUB", "HABITAT_MODULE", "OUTPOST",
  "HEADQUARTERS", "POWER_CONDUIT", "WAREHOUSE", "COMMUNICATIONS_ARRAY",
  "TRANSIT_HUB", "VEHICLE_WORKSHOP",
];

export const MODULE_TYPES = [
  "EFFICIENCY", "REDUNDANT_SYSTEMS", "EXPANSION", "FORTIFICATION",
  "SECURITY_DETAIL", "OPERATIONS_DIRECTOR", "TERRAIN_EXPLOIT", "SENSOR_ARRAY",
  "COMMAND_SUITE", "DIPLOMATIC_SUITE", "AUTOMATION", "PERSONNEL_MODULE",
  "HAZARD_SHIELD", "RESEARCH_LINK", "TRADE_NETWORK", "GLOBAL_CONTRIBUTION",
];

export function buildingLabel(type: string): string {
  return titleCase(type);
}

/** Minimum garrison per building type — display mirror of engine BUILDINGS[…].garrisonMin (§7.1). */
export const GARRISON_MIN: Record<string, Partial<Record<string, number>>> = {
  POWER_FACILITY: { ENGINEER: 2 },
  EXTRACTION_SITE: { ENGINEER: 3 },
  WATER_RECLAMATION: { ENGINEER: 2 },
  BIO_FACILITY: { ENGINEER: 2 },
  RESEARCH_COMPLEX: { INNOVATOR: 3 },
  COMMERCIAL_HUB: { ADMINISTRATOR: 2 },
  HABITAT_MODULE: { ADMINISTRATOR: 1 },
  OUTPOST: { ENGINEER: 2 },
  HEADQUARTERS: { ADMINISTRATOR: 2, CONTRACTOR: 1 },
  POWER_CONDUIT: {},
  WAREHOUSE: { ENGINEER: 2 },
  COMMUNICATIONS_ARRAY: { ANALYST: 2, ENGINEER: 1 },
  TRANSIT_HUB: { ENGINEER: 2, ADMINISTRATOR: 1 },
  VEHICLE_WORKSHOP: { ENGINEER: 3 },
};

/** One-line "what does this do" copy per action (§10). Advisory help text only. */
export interface ActionInfo { label: string; desc: string; personnel?: string; }

export const BUILDING_ACTION_INFO: Record<string, ActionInfo> = {
  BOOST_OUTPUT: { label: "Boost Output", desc: "Spend a surplus full garrison set to add +2 to this generator's output this turn." },
  EMERGENCY_EXTRACTION: { label: "Emergency Extraction", desc: "Double this generator's output this turn, with a 25% chance of building damage. Uses your Corporate action slot." },
  MARKET_SALE: { label: "Market Sale", desc: "Sell up to 10 units of a resource on the colony market at the live price (Transit Hub)." },
  COLONIST_REQUISITION: { label: "Colonist Requisition", desc: "Order up to 5 colonists (arrive in 3 turns). Costs 5 Cr each + a 2 Cr fee. Headquarters only." },
  TERRITORIAL_CLAIM: { label: "Territorial Claim", desc: "Register a claim on a hex to earn territory income. Headquarters only." },
  RESOURCE_TRANSFER: { label: "Resource Transfer", desc: "Move up to 20 units of a resource to one of your own buildings (Warehouse)." },
  PRODUCE_VEHICLE: { label: "Produce Vehicle", desc: "Build one vehicle of the chosen hull class. Vehicle Workshop only." },
  AMPLIFY_CREDIT_YIELD: { label: "Amplify Credit Yield", desc: "Give every Administrator +1 bonus credit this turn. Commercial Hub only." },
  RESEARCH_SPRINT: { label: "Research Sprint", desc: "Spend a surplus Innovator garrison set to add +2 Research. Research Complex only." },
  PASSIVE_INTEL_SCAN: { label: "Passive Intel Scan", desc: "Report enemy unit presence within intel range. Communications Array only." },
  LOCKDOWN: { label: "Lockdown", desc: "Put the building into a defensive lockdown (requires a Security Detail module)." },
};

export const UNIT_ACTION_INFO: Record<string, ActionInfo> = {
  CONSTRUCT_BUILDING: { label: "Construct Building", desc: "Build a new building on a target hex. Costs the building's build cost.", personnel: "ENGINEER" },
  INSTALL_MODULE: { label: "Install Module", desc: "Install a module on one of your buildings.", personnel: "ENGINEER" },
  TIER_UPGRADE: { label: "Tier Upgrade", desc: "Upgrade an Outpost into a Headquarters (18 Min + 24 Cr).", personnel: "ENGINEER" },
  PLACE_OUTPOST: { label: "Place Outpost", desc: "Place an outpost on a hex to claim territory.", personnel: "ENGINEER" },
  SURVEY_HEX: { label: "Survey Hex", desc: "Survey a hex to reveal its terrain and resources.", personnel: "ENGINEER" },
  DEMOLISH: { label: "Demolish", desc: "Demolish one of your buildings, recovering 50% of its mineral cost.", personnel: "ENGINEER" },
  REPAIR_BUILDING: { label: "Repair Building", desc: "Repair a damaged building (2 Cr + 2 Min).", personnel: "ENGINEER" },
  SABOTAGE: { label: "Sabotage", desc: "Attempt to sabotage a rival's building.", personnel: "ANALYST" },
  INTERCEPT: { label: "Intercept", desc: "Move to intercept a rival subdivision's units.", personnel: "CONTRACTOR" },
  FIELD_RESEARCH: { label: "Field Research", desc: "Generate +1 Research plus an intel insight.", personnel: "INNOVATOR" },
  TRADE_ACTION: { label: "Trade Action", desc: "Execute a market or equity trade (§11).", personnel: "ADMINISTRATOR" },
  NEGOTIATE: { label: "Negotiate", desc: "Open negotiations with another subdivision.", personnel: "ADMINISTRATOR" },
  LOBBY: { label: "Lobby", desc: "Lobby for votes on a motion (3 Cr per vote).", personnel: "ADMINISTRATOR" },
  PATROL: { label: "Patrol", desc: "Patrol a hex to deter and spot rival units.", personnel: "CONTRACTOR" },
  ENFORCE_TERRITORY: { label: "Enforce Territory", desc: "Enforce your claim on a contested hex.", personnel: "CONTRACTOR" },
  COUNTER_INTEL: { label: "Counter-Intel", desc: "Protect your subdivision against enemy intel operations (2 Cr).", personnel: "ANALYST" },
  VEHICLE_MOVE: { label: "Vehicle Move", desc: "Move a crewed vehicle to a target hex." },
  VEHICLE_ATTACK: { label: "Vehicle Attack", desc: "Attack a target with a crewed vehicle." },
};

export const POLITICAL_ACTION_INFO: Record<string, ActionInfo> = {
  PUBLIC_STATEMENT: { label: "Public Statement", desc: "Broadcast a colony-wide statement (2 Cr)." },
  PROPOSE_MOTION: { label: "Propose Motion", desc: "Propose a colony motion to be voted on (3 Cr)." },
  FORM_AGREEMENT: { label: "Form Agreement", desc: "Form a social agreement with another subdivision (free)." },
  DENOUNCE: { label: "Denounce", desc: "Publicly denounce a rival subdivision (2 Cr)." },
  APPEAL_TO_EARTH: { label: "Appeal to Earth", desc: "Request a resource shipment: +10 of one resource next turn, costs 5 Cr and −3 Earth Relations." },
  VOTE_ON_MOTION: { label: "Vote on Motion", desc: "Cast your vote on an active colony motion (free)." },
};

export const CORPORATE_ACTION_INFO: Record<string, ActionInfo> = {
  EXPEDITED_DELIVERY: { label: "Expedited Delivery", desc: "Buy a resource shipment for delivery (5 Cr)." },
  EMERGENCY_RESUPPLY: { label: "Emergency Resupply", desc: "+8 of one resource next turn. Costs 8 Cr and −1 Earth Relations." },
  CORPORATE_AUDIT: { label: "Corporate Audit", desc: "Run a corporate audit for intel (4 Cr)." },
  HOSTILE_ACQUISITION: { label: "Hostile Acquisition", desc: "Attempt to poach one of a rival's units (10 Cr, resolved via counter-bid)." },
  BLACK_MARKET_SALE: { label: "Black Market Sale", desc: "Sell up to 6 units of a resource at live price, bypassing the market cap (2 Cr fee)." },
  DISINFORMATION_CAMPAIGN: { label: "Disinformation Campaign", desc: "Spread disinformation against rivals (5 Cr)." },
};

export function actionInfo(action: string): ActionInfo {
  return (
    BUILDING_ACTION_INFO[action] ??
    UNIT_ACTION_INFO[action] ??
    POLITICAL_ACTION_INFO[action] ??
    CORPORATE_ACTION_INFO[action] ??
    { label: titleCase(action), desc: "" }
  );
}

export function actionLabel(action: string): string {
  return actionInfo(action).label;
}

/** Friendly labels for the free-form parameter fields shown in the add-order forms. */
export const PARAM_LABELS: Record<string, string> = {
  resource: "Resource",
  quantity: "Quantity",
  colonistCount: "Number of colonists",
  colonistType: "Colonist type",
  targetHexCol: "Target hex column",
  targetHexRow: "Target hex row",
  toBuildingId: "Destination building",
  hull: "Hull class",
  buildingType: "Building to construct",
  moduleType: "Module",
  targetBuildingId: "Target building",
  targetSubdivisionId: "Target subdivision",
  targetUnitId: "Target unit ID",
  text: "Message",
};

export function paramLabel(field: string): string {
  return PARAM_LABELS[field] ?? titleCase(field);
}

// ----- Admin StateEdit op metadata (plain-language names + what each op does) -----
// Mirrors the server op set in src/server/stateEdit.ts. Display-only.
export const STATE_EDIT_OPS: Record<string, { label: string; desc: string }> = {
  SET_RESOURCE: { label: "Set resource", desc: "Overwrite one resource stockpile for a subdivision to an exact value." },
  ADD_RESOURCE: { label: "Add / remove resource", desc: "Add (or subtract, with a negative amount) from a subdivision's stockpile." },
  SET_EARTH_RELATIONS: { label: "Set Earth Relations", desc: "Set a subdivision's Earth Relations to an exact value (clamped 0-30)." },
  ADJUST_EARTH_RELATIONS: { label: "Adjust Earth Relations", desc: "Nudge Earth Relations up/down by a delta (clamped 0-30)." },
  DISABLE_BUILDING: { label: "Disable building", desc: "Flag a building as disabled (produces nothing) until the given turn." },
  SET_HEX_OWNER: { label: "Set hex owner", desc: "Assign a map hex to a subdivision, or unclaim it (leave owner blank)." },
  SET_OXYGEN: { label: "Set oxygen counter", desc: "Set the colony-wide oxygen habitability counter (inert display value)." },
  ADD_MILESTONE: { label: "Mark milestone claimed", desc: "Record a milestone id as already claimed (prevents its first-time bonus)." },
  REGISTER_EFFECT: { label: "Register active effect", desc: "Attach a timed effect (e.g. an event's mechanical result) resolved by the engine next turn." },
  RELEASE_CAPTIVE: { label: "Release captive", desc: "Free a captured unit — return it to a subdivision, or remove it entirely." },
};

export const EFFECT_TYPE_META: Record<string, string> = {
  OUTPUT_DELTA: "Change building output by a magnitude (e.g. -1 for a Dust Storm).",
  MODULE_HALF_EFFECT: "Halve the effect of one module type this turn (e.g. Equipment Recall).",
  NO_INTELLIGENCE: "Suppress all Intelligence actions in scope (e.g. Solar Flare).",
  TERRAIN_EXPLOIT_SUSPEND: "Suspend Terrain Exploit output in scope (e.g. Ice Deposit Shift).",
};

// Humanize audit-log action codes (APPROVE_REGISTRATION -> Approve Registration).
// Some codes carry a suffix after a colon (e.g. MANUAL_EVENT:Dust Storm).
export function humanizeAudit(action: string): { label: string; suffix?: string } {
  const [code, ...rest] = action.split(":");
  const suffix = rest.length ? rest.join(":") : undefined;
  return { label: titleCase(code), suffix };
}
