// Pure client-side merge of the four already-existing feeds (subdivision messages,
// turn logs, colony events, market ticks) into one reverse-chronological stream for
// the tactical-HUD forum. No new backend endpoint — each source keeps its own
// auth/fetch; this only blends the shapes the API already returns. Display-only.

import type { DashboardResponse, Message } from "@/lib/client/types";

export type FeedChannel = "INTEL" | "WAR" | "COMMS" | "MARKET" | "SYSTEM";

export interface FeedItem {
  id: string;
  channel: FeedChannel;
  source: string;
  body: string;
  at: number; // epoch ms
  scope?: Message["scope"];
  hex?: { col: number; row: number };
}

// Loose shape of a /turns row (see turns route: turnNumber, eventJson, createdAt).
export interface TurnRow {
  turnNumber: number;
  eventJson?: unknown;
  scoreboardJson?: unknown;
  createdAt?: string;
}

// Classify a colony/turn event into a forum lane from its scope/name. The engine
// owns the real semantics; this is a cosmetic lane assignment only.
export function classifyEvent(name?: string, scope?: string): FeedChannel {
  const s = `${name ?? ""} ${scope ?? ""}`.toUpperCase();
  if (/\b(RAID|ATTACK|SABOTAGE|COMBAT|WAR|HOSTILE|SEIZ|BREACH|STRIKE)/.test(s)) return "WAR";
  if (/\b(INTEL|SCAN|SPOT|RECON|SURVEY|ESPIONAGE|SENSOR)/.test(s)) return "INTEL";
  return "SYSTEM";
}

function nameFor(id: number | null | undefined, names: Map<number, string>, self: number | null): string {
  if (id == null) return "High Command";
  if (self != null && id === self) return "You";
  return names.get(id) ?? `Subdivision #${id}`;
}

export function buildFeed(opts: {
  messages: Message[];
  dashboard: DashboardResponse | null;
  turns: TurnRow[];
  names: Map<number, string>;
  viewerSubdivisionId: number | null;
}): FeedItem[] {
  const { messages, dashboard, turns, names, viewerSubdivisionId } = opts;
  const items: FeedItem[] = [];

  // 1) Subdivision comms → COMMS (violet). Public vs DM carried by scope.
  for (const m of messages) {
    const src = nameFor(m.senderSubdivisionId, names, viewerSubdivisionId);
    const to =
      m.scope === "PUBLIC"
        ? "→ Public"
        : m.scope === "ADMIN"
          ? "→ High Command"
          : `→ ${nameFor(m.recipientSubdivisionId, names, viewerSubdivisionId)}`;
    items.push({
      id: `msg-${m.id}`,
      channel: "COMMS",
      source: `${src} ${to}`,
      body: m.body,
      at: new Date(m.createdAt).getTime(),
      scope: m.scope,
    });
  }

  // 2) Colony events (dashboard) → INTEL / WAR / SYSTEM by classification.
  if (dashboard?.colonyEvents) {
    for (const ce of dashboard.colonyEvents) {
      const ev = ce.event ?? { name: "", message: "", scope: "" };
      // Skip filler "no event this turn" rows — they add noise, not signal.
      if (/^\s*no[\s_]?event/i.test(ev.name ?? "") || /^\s*no event/i.test(ev.message ?? "")) continue;
      items.push({
        id: `evt-${ce.turnNumber}-${ev.name}`,
        channel: classifyEvent(ev.name, ev.scope),
        source: ev.name ? ev.name.replace(/_/g, " ") : `Cycle ${ce.turnNumber} event`,
        body: ev.message || "",
        at: new Date(ce.at).getTime(),
      });
    }
  }

  // 3) Announcements (dashboard) → SYSTEM (green), from High Command.
  if (dashboard?.announcements) {
    for (const a of dashboard.announcements) {
      items.push({
        id: `ann-${a.id}`,
        channel: "SYSTEM",
        source: "High Command",
        body: a.title ? `${a.title} — ${a.body}` : a.body,
        at: new Date(a.createdAt).getTime(),
      });
    }
  }

  // 4) Turn resolutions → SYSTEM markers ("CYCLE N RESOLVED").
  for (const t of turns) {
    if (!t.createdAt) continue;
    items.push({
      id: `turn-${t.turnNumber}`,
      channel: "SYSTEM",
      source: "Colony Ledger",
      body: `Cycle ${t.turnNumber} resolved.`,
      at: new Date(t.createdAt).getTime(),
    });
  }

  // 5) Market tick → MARKET (amber). One digest post at the newest known time.
  if (dashboard?.market && dashboard.market.length) {
    const newest = items.reduce((mx, i) => Math.max(mx, i.at), 0) || Date.now();
    const digest = dashboard.market
      .map((m) => `${m.resource} ${m.livePrice.toFixed?.(2) ?? m.livePrice}`)
      .join("  ");
    items.push({
      id: `market-tick`,
      channel: "MARKET",
      source: "Market Desk",
      body: `Live prices — ${digest}`,
      at: newest,
    });
  }

  items.sort((a, b) => b.at - a.at);
  return items;
}
