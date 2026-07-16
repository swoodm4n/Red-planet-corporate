// Display labels + light formatting helpers. Purely cosmetic — no game logic.

export const PARENT_LABELS: Record<string, string> = {
  TERRA_AGRICULTURAL: "Terra Agricultural Syndicate",
  UNIFIED_MINING: "Unified Mining Consortium",
  STELLAR_DYNAMICS: "Stellar Dynamics Corporation",
  HELIX_PHARMA: "Helix Pharmaceutical Group",
  OMEGA_SECURITY: "Omega Security Solutions",
  GENESIS_TECH: "Genesis Tech Industries",
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
