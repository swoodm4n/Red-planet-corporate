"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/client/gameContext";
import { api } from "@/lib/client/api";
import {
  emptyDraft,
  fromSubmission,
  fetchAvailableActions,
  saveDraft,
  validateDraft,
  type DraftSubmission,
} from "@/lib/client/orders";
import { FIELD_HINTS, ParamInputs, buildParams } from "@/lib/client/actionParams";
import { buildFeed, type FeedItem, type FeedChannel, type TurnRow } from "@/lib/client/feed";
import type {
  AvailableActionsResponse,
  DashboardResponse,
  IntelTier,
  MapResponse,
  MapTileMarker,
  Message,
  MessagesResponse,
  OwnBuilding,
  ReportResponse,
  TileResponse,
  TileView,
} from "@/lib/client/types";
import {
  actionInfo,
  actionLabel,
  buildingLabel,
  countdown,
  hexLabel,
  PERSONNEL_LABELS,
  RESOURCE_SHORT,
  titleCase,
} from "@/lib/client/labels";
import { actionIcon } from "@/lib/client/icons";
import { Icon } from "@/lib/client/Icon";
import { ConfirmButton } from "@/lib/client/Confirm";
import { NavRail } from "./NavRail";

const COLS = 12;
const ROWS = 8;
const COL_LETTERS = "ABCDEFGHIJKL";

// Offensive/intel actions offered on a HOSTILE tile, additive by the server-computed
// intel tier against that opponent (decision #2). The tier itself is authoritative —
// this only chooses which offensive verbs the card surfaces at each coverage level.
function offensiveActionsForTier(tier: IntelTier): string[] {
  const base = ["SURVEY_HEX"];
  if (tier === "LOW") return base;
  if (tier === "MEDIUM") return [...base, "SABOTAGE"];
  return [...base, "SABOTAGE", "INTERCEPT"]; // HIGH / FULL
}

type FeedTab = "ALL" | "INTEL" | "WAR" | "COMMS";

export default function HudPage() {
  const { gameId, subdivisionId, game, me } = usePlayer();
  const router = useRouter();

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [map, setMap] = useState<MapResponse | null>(null);
  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<DraftSubmission | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [avail, setAvail] = useState<AvailableActionsResponse | null>(null);
  const [baseline, setBaseline] = useState<AvailableActionsResponse | null>(null);

  const [sel, setSel] = useState<{ col: number; row: number } | null>(null);
  const [tile, setTile] = useState<TileView | null>(null);
  const [tileLoading, setTileLoading] = useState(false);
  const [selBuildingId, setSelBuildingId] = useState<number | null>(null);

  const [feedTab, setFeedTab] = useState<FeedTab>("ALL");
  const [localFeed, setLocalFeed] = useState<FeedItem[]>([]);
  const [now, setNow] = useState(Date.now());

  // Live tick for the cycle clock (re-renders so countdown() re-evaluates each second).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  void now;

  // ---- initial + refetchable loads ----
  const loadCore = useCallback(() => {
    if (subdivisionId == null) return;
    Promise.all([
      api.get<ReportResponse>(`/api/games/${gameId}/report`),
      api.get<MapResponse>(`/api/games/${gameId}/map`),
      api.get<DashboardResponse>(`/api/games/${gameId}/dashboard`),
      api.get<{ turnNumber: number; status: string | null; submission: unknown }>(`/api/games/${gameId}/orders`),
    ])
      .then(([rep, mp, db, ord]) => {
        setReport(rep);
        setMap(mp);
        setDash(db);
        setStatus(ord.status);
        setDraft((prev) => prev ?? (ord.submission ? fromSubmission(ord.submission as never) : seedGarrison(rep)));
      })
      .catch((e) => setError((e as Error).message));
  }, [gameId, subdivisionId]);

  const loadMessages = useCallback(() => {
    api.get<MessagesResponse>(`/api/games/${gameId}/messages`).then((r) => setMessages(r.messages)).catch(() => {});
  }, [gameId]);

  useEffect(() => {
    loadCore();
    loadMessages();
    api.get<{ turns: TurnRow[] }>(`/api/games/${gameId}/turns`).then((r) => setTurns(r.turns)).catch(() => {});
  }, [gameId, loadCore, loadMessages]);

  // ---- baseline available-actions (empty draft): the full per-building action set
  // at turn start, used to render attention-exhausted actions dimmed (decision #3). ----
  useEffect(() => {
    if (subdivisionId == null) return;
    fetchAvailableActions(gameId, emptyDraft()).then(setBaseline).catch(() => {});
  }, [gameId, subdivisionId, game?.turnNumber]);

  // ---- live available-actions, debounced on every draft edit. Sole source of truth
  // for which actions remain valid + which units' attention is spent. ----
  const baKey = draft ? JSON.stringify(draft.buildingActions) : "";
  const uaKey = draft ? JSON.stringify(draft.unitActions) : "";
  useEffect(() => {
    if (subdivisionId == null || !draft) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetchAvailableActions(gameId, draft)
        .then((r) => !cancelled && setAvail(r))
        .catch(() => {});
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, subdivisionId, baKey, uaKey]);

  // ---- tile inspection ----
  const fetchTile = useCallback(
    (col: number, row: number) => {
      setSel({ col, row });
      setTile(null);
      setSelBuildingId(null);
      setTileLoading(true);
      api
        .get<TileResponse>(`/api/games/${gameId}/map/tiles/${col}/${row}`)
        .then((r) => setTile(r.tile))
        .catch(() => setTile(null))
        .finally(() => setTileLoading(false));
    },
    [gameId],
  );

  // Default the command card to the first of MY buildings on the selected hex that
  // has baseline actions. Sourced from the private report (authoritative for my own
  // structures) rather than the intel-gated tile payload — a building can sit on a
  // hex the map reports as unclaimed, so tile.ownBuildings alone would miss it.
  useEffect(() => {
    if (!sel || !report) {
      setSelBuildingId(null);
      return;
    }
    const here = report.own.buildings.filter((b) => b.hex.col === sel.col && b.hex.row === sel.row);
    if (!here.length) {
      setSelBuildingId(null);
      return;
    }
    const withActions = here.find((b) => (baseline?.buildings?.[String(b.id)]?.length ?? 0) > 0);
    setSelBuildingId((withActions ?? here[0]).id);
  }, [sel, report, baseline]);

  const names = useMemo(() => {
    const m = new Map<number, string>();
    if (dash) {
      dash.subdivisions.forEach((s) => m.set(s.subdivisionId, s.name));
      dash.standings.standings.forEach((s) => m.set(s.subdivisionId, s.name));
    }
    if (report) m.set(report.own.subdivisionId, report.own.name);
    return m;
  }, [dash, report]);

  const markerAt = useMemo(() => {
    const m = new Map<string, MapTileMarker>();
    if (map) for (const t of map.tiles) m.set(`${t.coord.col},${t.coord.row}`, t);
    return m;
  }, [map]);

  // Owned garrison headcount per tile + the set of hexes where I have buildings
  // (from the private report) — the cyan grid number and the owned-tile highlight.
  const ownGarrisonByTile = useMemo(() => {
    const m = new Map<string, number>();
    if (report) {
      for (const b of report.own.buildings) {
        const n = Object.values(b.garrison).reduce((a, c) => a + (c ?? 0), 0);
        const k = `${b.hex.col},${b.hex.row}`;
        m.set(k, (m.get(k) ?? 0) + n);
      }
    }
    return m;
  }, [report]);
  const myHexes = useMemo(() => {
    const s = new Set<string>();
    if (report) for (const b of report.own.buildings) s.add(`${b.hex.col},${b.hex.row}`);
    return s;
  }, [report]);

  const feed = useMemo(
    () => [
      ...localFeed,
      ...buildFeed({ messages, dashboard: dash, turns, names, viewerSubdivisionId: subdivisionId }),
    ].sort((a, b) => b.at - a.at),
    [localFeed, messages, dash, turns, names, subdivisionId],
  );

  const pushLocal = useCallback((item: Omit<FeedItem, "id" | "at"> & { id?: string }) => {
    setLocalFeed((f) => [{ ...item, id: item.id ?? `local-${Date.now()}-${Math.random()}`, at: Date.now() }, ...f]);
  }, []);

  // ---- draft mutators ----
  const queueBuildingAction = useCallback((buildingId: number, action: string, params: Record<string, unknown>) => {
    setDraft((d) => d && { ...d, buildingActions: [...d.buildingActions, { buildingId, action, params }] });
  }, []);

  const queueUnitAction = useCallback(
    (unitId: number, action: string, extra: Record<string, unknown>) => {
      setDraft((d) => d && { ...d, unitActions: [...d.unitActions, { unitId, action, ...extra } as never] });
    },
    [],
  );

  if (subdivisionId == null) {
    return (
      <div className="hud">
        <div className="hud-loading" style={{ gridColumn: "1 / -1" }}>
          NO SUBDIVISION ASSIGNED — the tactical HUD requires an assigned slot. A game master must assign you first.
        </div>
      </div>
    );
  }
  if (error) return <div className="hud"><div className="hud-loading" style={{ gridColumn: "1 / -1", color: "var(--red)" }}>{error}</div></div>;
  if (!report || !map || !draft) return <div className="hud"><div className="hud-loading" style={{ gridColumn: "1 / -1" }}>ESTABLISHING TACTICAL UPLINK<span className="blink"> _</span></div></div>;

  const own = report.own;
  const res = own.resources;
  const rivals = report.others ?? [];

  const attentionSpent = (unitId: number): boolean => avail?.unitAttention?.[String(unitId)] === true;
  const totalUnits = Object.keys(avail?.unitAttention ?? baseline?.unitAttention ?? {}).length || own.personnel.length;
  const spentUnits = Object.values(avail?.unitAttention ?? {}).filter(Boolean).length;
  const remaining = totalUnits - spentUnits;

  // My buildings on the selected hex (authoritative private data — see effect above).
  const myBuildingsHere = sel ? own.buildings.filter((b) => b.hex.col === sel.col && b.hex.row === sel.row) : [];
  const hasMineHere = myBuildingsHere.length > 0;

  // Selected tile classification for panels.
  const isOwnTile = tile?.intelTier === "OWN" || hasMineHere;
  const isHostileTile = tile != null && tile.owner != null && tile.owner !== subdivisionId && !hasMineHere;
  const isEmptyTile = tile != null && tile.owner == null && !hasMineHere;

  const submitDisabled = game?.status !== "ACTIVE";

  async function onEndCycle() {
    if (!draft) return;
    await validateDraft(gameId, draft).catch(() => {});
    const r = await saveDraft(gameId, draft);
    setStatus("SUBMITTED");
    pushLocal({
      channel: "SYSTEM",
      source: "Command",
      body: r.accepted
        ? "Cycle orders submitted and accepted."
        : `Orders saved with ${r.invalidOrders.length} flagged order(s) — they will be skipped unless revised.`,
    });
  }

  async function sendMessage(recipient: unknown, body: string) {
    await api.post(`/api/games/${gameId}/messages`, { recipient, body });
    loadMessages();
  }

  return (
    <div className="hud">
      {/* ===== TOP BAR ===== */}
      <div className="hud-top">
        <div className="hud-crest">
          <div className="hud-crest-mark">{own.name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="hud-crest-name">{own.name}</div>
            <div className="hud-crest-sub">{titleCase(own.parentCompany)} · SUBDIV {own.subdivisionId}</div>
          </div>
        </div>
        <div className="hud-ticker">
          <ResCell label={RESOURCE_SHORT.CREDITS} value={res.creditsDisplay} />
          <ResCell label={RESOURCE_SHORT.ENERGY} value={res.ENERGY} />
          <ResCell label={RESOURCE_SHORT.MINERALS} value={res.MINERALS} />
          <ResCell label={RESOURCE_SHORT.WATER} value={res.WATER} />
          <ResCell label={RESOURCE_SHORT.FOOD} value={res.FOOD} />
          <ResCell label={RESOURCE_SHORT.RESEARCH} value={res.RESEARCH} />
        </div>
        <div className="hud-turn">
          <span className="hud-turn-txt">
            CYCLE <b>{game?.turnNumber ?? report.turnNumber}</b> · {game?.status === "ACTIVE" ? <>CLOSES {countdown(game?.turnDeadline ?? null)}</> : game?.status}
          </span>
          <ConfirmButton
            className="hud-endcycle"
            title="END CYCLE"
            confirmLabel="CONFIRM · SUBMIT"
            confirmClass="btn-primary"
            danger={false}
            disabled={submitDisabled}
            onConfirm={onEndCycle}
            message={
              <div>
                Submit this cycle&apos;s orders for <strong>{own.name}</strong>?
                <ul style={{ margin: "10px 0 0", paddingLeft: 16 }}>
                  <li>{draft.buildingActions.length} building action(s), {draft.unitActions.length} unit action(s)</li>
                  <li>{draft.garrison.filter((g) => g.target.kind !== "AVAILABLE").length} personnel garrisoned</li>
                </ul>
                <div style={{ marginTop: 8, color: "var(--text-tertiary)" }}>You can keep revising and re-submit until the deadline.</div>
              </div>
            }
          >
            {status === "SUBMITTED" ? "RE-SUBMIT" : "END CYCLE"}
          </ConfirmButton>
        </div>
      </div>

      {/* ===== NAV RAIL ===== */}
      <NavRail
        onLogout={async () => {
          await api.post("/api/auth/logout");
          router.replace("/login");
        }}
        alertBadge={status === "SUBMITTED" ? null : "!"}
      />

      {/* ===== STAGE ===== */}
      <div className="hud-stage">
        <MapViewport
          map={map}
          markerAt={markerAt}
          subdivisionId={subdivisionId}
          ownGarrisonByTile={ownGarrisonByTile}
          myHexes={myHexes}
          sel={sel}
          onSelect={fetchTile}
        />

        <div className="hud-lower">
          <SelectionPanel
            tile={tile}
            tileLoading={tileLoading}
            sel={sel}
            report={report}
            myBuildingsHere={myBuildingsHere}
            avail={avail}
            names={names}
            subdivisionId={subdivisionId}
            selBuildingId={selBuildingId}
            onSelectBuilding={setSelBuildingId}
            attentionSpent={attentionSpent}
          />
          <CommandCard
            tile={tile}
            isOwnTile={!!isOwnTile}
            isHostileTile={isHostileTile}
            isEmptyTile={isEmptyTile}
            selBuildingId={selBuildingId}
            baseline={baseline}
            avail={avail}
            remaining={remaining}
            totalUnits={totalUnits}
            own={own}
            rivals={rivals}
            onQueueBuilding={(bid, action, params) => {
              queueBuildingAction(bid, action, params);
              pushLocal({ channel: "SYSTEM", source: "Command", body: `Queued ${actionLabel(action)} at ${buildingShortName(own.buildings, bid)}.` });
            }}
            onQueueUnit={(unitId, action, extra) => {
              queueUnitAction(unitId, action, extra);
              pushLocal({ channel: "WAR", source: "Field Order", body: `Ordered ${actionLabel(action)} vs ${sel ? hexLabel(sel.col, sel.row) : "target"}.` });
            }}
          />
        </div>
      </div>

      {/* ===== FORUM ===== */}
      <Forum
        feed={feed}
        tab={feedTab}
        onTab={setFeedTab}
        rivals={rivals}
        onSend={sendMessage}
        onViewTile={(hex) => fetchTile(hex.col, hex.row)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-bar resource cell
// ---------------------------------------------------------------------------
function ResCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="hud-res">
      <span className="hud-res-label">{label}</span>
      <span className="hud-res-val">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map viewport (§6)
// ---------------------------------------------------------------------------
function MapViewport({
  map,
  markerAt,
  subdivisionId,
  ownGarrisonByTile,
  myHexes,
  sel,
  onSelect,
}: {
  map: MapResponse;
  markerAt: Map<string, MapTileMarker>;
  subdivisionId: number;
  ownGarrisonByTile: Map<string, number>;
  myHexes: Set<string>;
  sel: { col: number; row: number } | null;
  onSelect: (col: number, row: number) => void;
}) {
  const mine = new Set([
    ...map.tiles.filter((t) => t.owner === subdivisionId).map((t) => `${t.coord.col},${t.coord.row}`),
    ...myHexes,
  ]).size;
  const rival = map.tiles.filter((t) => t.owner != null && t.owner !== subdivisionId).length;

  function glyphFor(t: MapTileMarker): string | null {
    if (t.isLandingZone) return "landing-zone";
    if (t.hasHQ) return "headquarters";
    if (t.hasOutpost) return "outpost";
    return null;
  }

  return (
    <div className="hud-viewport">
      <div className="hud-viewport-status">
        SECTOR ROSSBY · GRID 12×8 · <b>{mine}</b> HELD / <b>{rival}</b> RIVAL · CYCLE {map.turnNumber}
      </div>
      <div className="hud-intel-key">
        <span><i className="hud-key-swatch owned" /> Owned</span>
        <span><i className="hud-key-swatch med" /> Intel Med+</span>
        <span><i className="hud-key-swatch low" /> Intel Low</span>
      </div>

      <div className="hud-grid">
        <div className="hud-grid-corner" />
        {Array.from({ length: COLS }, (_, ci) => (
          <div className="hud-grid-collabel" key={`c${ci}`}>{COL_LETTERS[ci]}</div>
        ))}
        {Array.from({ length: ROWS }, (_, ri) => {
          const row = ri + 1;
          return (
            <Fragment key={`row-${row}`}>
              <div className="hud-grid-rowlabel">{row}</div>
              {Array.from({ length: COLS }, (_, ci) => {
                const col = ci + 1;
                const t = markerAt.get(`${col},${row}`);
                if (!t) return <div className="hud-tile impassable" key={col} />;
                const owned = t.owner === subdivisionId || myHexes.has(`${col},${row}`);
                const hostile = t.owner != null && t.owner !== subdivisionId && !myHexes.has(`${col},${row}`);
                const cls = ["hud-tile"];
                if (owned) cls.push("owned");
                else if (hostile) cls.push("hostile");
                if (t.terrain === "IMPASSABLE") cls.push("impassable");
                if (hostile && t.intelTier === "LOW") cls.push("fog-low");
                else if (hostile && t.intelTier === "MEDIUM") cls.push("fog-med");
                if (sel && sel.col === col && sel.row === row) cls.push("selected");
                const glyph = glyphFor(t);
                const garr = owned ? ownGarrisonByTile.get(`${col},${row}`) : undefined;
                return (
                  <button
                    type="button"
                    className={cls.join(" ")}
                    key={col}
                    title={`${hexLabel(col, row)} — ${titleCase(t.terrain)}`}
                    onClick={() => onSelect(col, row)}
                  >
                    {owned && <span className="hud-tile-own-dot" />}
                    {glyph && <Icon name={glyph} alt="" size={20} className="hud-tile-glyph" />}
                    {hostile && t.intelTier === "LOW" && <span className="hud-tile-q">?</span>}
                    {garr ? <span className="hud-tile-garr">{garr}</span> : null}
                  </button>
                );
              })}
            </Fragment>
          );
        })}
      </div>

      <div className="hud-minimap" aria-hidden>
        {Array.from({ length: ROWS }, (_, ri) =>
          Array.from({ length: COLS }, (_, ci) => {
            const t = markerAt.get(`${ci + 1},${ri + 1}`);
            const cls = ["hud-mini"];
            if (t?.owner === subdivisionId || myHexes.has(`${ci + 1},${ri + 1}`)) cls.push("owned");
            else if (t?.owner != null) cls.push("rival");
            return <div className={cls.join(" ")} key={`${ci}-${ri}`} />;
          }),
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selection panel (§7)
// ---------------------------------------------------------------------------
function SelectionPanel({
  tile,
  tileLoading,
  sel,
  report,
  myBuildingsHere,
  avail,
  names,
  subdivisionId,
  selBuildingId,
  onSelectBuilding,
  attentionSpent,
}: {
  tile: TileView | null;
  tileLoading: boolean;
  sel: { col: number; row: number } | null;
  report: ReportResponse;
  myBuildingsHere: OwnBuilding[];
  avail: AvailableActionsResponse | null;
  names: Map<number, string>;
  subdivisionId: number;
  selBuildingId: number | null;
  onSelectBuilding: (id: number) => void;
  attentionSpent: (id: number) => boolean;
}) {
  if (!sel) {
    return (
      <div className="hud-sel">
        <div className="hud-panel-head"><span className="hud-label">Selection</span><span className="hud-tag empty">No target</span></div>
        <div className="hud-empty-note">Select a tile on the tactical grid to inspect it at your current intel level and issue commands.</div>
      </div>
    );
  }
  if (tileLoading || !tile) {
    return (
      <div className="hud-sel">
        <div className="hud-panel-head"><span className="hud-label">Selection</span><span className="hud-tag">{hexLabel(sel.col, sel.row)}</span></div>
        <div className="hud-empty-note">Scanning {hexLabel(sel.col, sel.row)}…</div>
      </div>
    );
  }

  const own = report.own;
  // "Mine here" is driven by the private report (authoritative), so a building on an
  // unclaimed hex is still commandable even when the intel-gated tile omits it.
  const hasMine = myBuildingsHere.length > 0;
  const isOwn = hasMine || tile.intelTier === "OWN";
  const owner = tile.owner;
  const tag = isOwn ? "OWNED" : owner == null ? "EMPTY" : owner === subdivisionId ? "OWNED" : "HOSTILE";
  const tagClass = tag.toLowerCase();
  const ownerName = isOwn ? own.name : owner == null ? "Unclaimed" : names.get(owner) ?? `Subdivision #${owner}`;

  const hasHQhere = myBuildingsHere.some((b) => b.type === "HEADQUARTERS") || tile.hasHQ;
  const hasOutpostHere = myBuildingsHere.some((b) => b.type === "OUTPOST") || tile.hasOutpost;

  // Icon well glyph.
  const wellGlyph = tile.isLandingZone ? "landing-zone" : hasHQhere ? "headquarters" : hasOutpostHere ? "outpost" : null;
  const primaryName = hasHQhere
    ? "Headquarters Node"
    : hasOutpostHere
      ? "Outpost Node"
      : tile.isLandingZone
        ? "Landing Zone"
        : hasMine
          ? `${buildingLabel(myBuildingsHere[0].type)} Node`
          : owner == null
            ? "Open Ground"
            : "Territory Node";

  // Units garrisoned in MY buildings on this hex (report), for the pip list.
  const tileBuildingIds = new Set(myBuildingsHere.map((b) => b.id));
  const tileUnits = hasMine ? own.personnel.filter((p) => p.assignedBuildingId != null && tileBuildingIds.has(p.assignedBuildingId)) : [];

  const integrity = hasMine
    ? myBuildingsHere.every((b) => b.status === "ACTIVE") ? "NOMINAL" : "DAMAGED"
    : "—";
  const garrisonCount = hasMine ? tileUnits.length : isOwn ? tile.unitCount ?? "—" : tile.unitCount ?? "—";
  const structuresCount = hasMine ? myBuildingsHere.length : tile.intelTier === "OWN" ? tile.ownBuildings?.length ?? 0 : tile.buildingCount ?? "—";

  return (
    <div className="hud-sel">
      <div className="hud-panel-head">
        <span className="hud-label">Selection</span>
        <span className={`hud-tag ${tagClass}`}>{tag}</span>
      </div>

      <div className="hud-sel-head">
        <div className="hud-sel-well">{wellGlyph ? <Icon name={wellGlyph} alt="" size={26} /> : <span style={{ color: "var(--text-tertiary)" }}>·</span>}</div>
        <div style={{ flex: 1 }}>
          <div className="hud-sel-name">{primaryName}</div>
          <div className="hud-sel-sub">{ownerName} · Intel {tile.intelTier}</div>
          <div className="hud-sel-coord">GRID {hexLabel(tile.coord.col, tile.coord.row)} · {titleCase(tile.terrain)}</div>
        </div>
      </div>

      <div className="hud-stats">
        <div className="hud-stat"><div className="hud-stat-label">Integrity</div><div className="hud-stat-val">{integrity}</div></div>
        <div className="hud-stat"><div className="hud-stat-label">Garrison</div><div className="hud-stat-val">{garrisonCount}</div></div>
        <div className="hud-stat"><div className="hud-stat-label">Structures</div><div className="hud-stat-val">{structuresCount}</div></div>
      </div>

      {/* Owned tile: building picker + garrison pips */}
      {hasMine && (
        <div className="hud-sel-section">
          <div className="hud-sel-section-label">Structures on tile</div>
          {myBuildingsHere.map((b) => (
            <div
              key={b.id}
              className={`hud-unit selectable${selBuildingId === b.id ? " active" : ""}`}
              onClick={() => onSelectBuilding(b.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectBuilding(b.id)}
            >
              <Icon name="action-build" alt="" size={14} />
              <div>
                <div className="hud-unit-name">{buildingLabel(b.type)}</div>
                <div className="hud-unit-type">{b.tier} · {titleCase(b.status)}{(avail?.buildings?.[String(b.id)]?.length ?? 0) > 0 ? ` · ${avail!.buildings[String(b.id)].length} ready` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMine && tileUnits.length > 0 && (
        <div className="hud-sel-section">
          <div className="hud-sel-section-label"><span>Garrison</span><span>Attention</span></div>
          {tileUnits.map((u) => {
            const spent = attentionSpent(u.id);
            return (
              <div key={u.id} className="hud-unit">
                <Icon name={`personnel-${u.type.toLowerCase()}`} alt="" size={14} />
                <div>
                  <div className="hud-unit-name">{PERSONNEL_LABELS[u.type] ?? titleCase(u.type)} <span style={{ color: "var(--text-tertiary)" }}>#{u.id}</span></div>
                  <div className="hud-unit-type">{titleCase(u.status)}</div>
                </div>
                <div className="hud-unit-pips" title={spent ? "Attention spent this cycle" : "Attention available"}>
                  <span className={`hud-pip ${spent ? "spent" : "full"}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hostile tile: intel-gated reveal */}
      {!isOwn && owner != null && owner !== subdivisionId && (
        <div className="hud-sel-section">
          <div className="hud-sel-section-label">Intelligence</div>
          {tile.intelTier === "LOW" ? (
            <div className="hud-empty-note" style={{ margin: 0 }}>
              INSUFFICIENT INTELLIGENCE — coverage against {ownerName} is LOW. You see the node exists and who holds it, but not what is built or stationed here. Raise espionage to reach MEDIUM+.
            </div>
          ) : (
            <>
              {tile.buildings && tile.buildings.map((b, i) => (
                <div key={i} className="hud-unit"><Icon name="action-build" alt="" size={14} /><div className="hud-unit-name">{titleCase(b)}</div></div>
              ))}
              {tile.units && (
                <>
                  {Object.entries(tile.units.personnel).map(([type, n]) => (
                    <div key={type} className="hud-unit">
                      <Icon name={`personnel-${type.toLowerCase()}`} alt="" size={14} />
                      <div className="hud-unit-name">{titleCase(type)} ×{n}</div>
                      <div className="hud-unit-pips"><span className="hud-masked">masked</span></div>
                    </div>
                  ))}
                </>
              )}
              {!tile.buildings && !tile.units && <div className="hud-masked" style={{ padding: "4px 12px" }}>Force composition masked at this tier.</div>}
            </>
          )}
        </div>
      )}

      {!hasMine && isEmpty(tile) && (
        <div className="hud-empty-note">Open ground — no subdivision holds {hexLabel(tile.coord.col, tile.coord.row)}. Deploy an outpost or claim it to project control here.</div>
      )}
    </div>
  );
}

function isEmpty(tile: TileView): boolean {
  return tile.owner == null && !tile.isLandingZone;
}

// ---------------------------------------------------------------------------
// Command card (§8)
// ---------------------------------------------------------------------------
function CommandCard({
  tile,
  isOwnTile,
  isHostileTile,
  isEmptyTile,
  selBuildingId,
  baseline,
  avail,
  remaining,
  totalUnits,
  own,
  rivals,
  onQueueBuilding,
  onQueueUnit,
}: {
  tile: TileView | null;
  isOwnTile: boolean;
  isHostileTile: boolean;
  isEmptyTile: boolean;
  selBuildingId: number | null;
  baseline: AvailableActionsResponse | null;
  avail: AvailableActionsResponse | null;
  remaining: number;
  totalUnits: number;
  own: ReportResponse["own"];
  rivals: ReportResponse["others"];
  onQueueBuilding: (bid: number, action: string, params: Record<string, unknown>) => void;
  onQueueUnit: (unitId: number, action: string, extra: Record<string, unknown>) => void;
}) {
  const [pending, setPending] = useState<{ mode: "building" | "unit"; action: string; buildingId?: number } | null>(null);

  const bldg = selBuildingId != null ? own.buildings.find((b) => b.id === selBuildingId) : undefined;
  const shortName = bldg ? buildingLabel(bldg.type) : isHostileTile ? "Offensive" : "—";

  // Owned building: baseline set = full action set at turn start; live set = still-valid.
  // Actions in baseline-not-live are attention-exhausted → dimmed (decision #3).
  const baseActs = selBuildingId != null ? baseline?.buildings?.[String(selBuildingId)] ?? [] : [];
  const liveActs = new Set(selBuildingId != null ? avail?.buildings?.[String(selBuildingId)] ?? [] : []);

  // Hostile tile: offensive verbs gated by the server-computed intel tier.
  const offensive = isHostileTile && tile ? offensiveActionsForTier(tile.intelTier) : [];

  const availableUnits = own.personnel.filter((p) => !["LOST", "CAPTURED", "UNHOUSED"].includes(p.status));

  let body: React.ReactNode;
  if (isHostileTile && tile) {
    body = (
      <div className="hud-cmd-grid">
        {offensive.map((a) => (
          <CmdButton key={a} action={a} offensive exhausted={false} onClick={() => setPending({ mode: "unit", action: a })} />
        ))}
      </div>
    );
  } else if (isOwnTile && selBuildingId != null) {
    body =
      baseActs.length === 0 ? (
        <div className="hud-empty-note">{bldg && bldg.status !== "ACTIVE" ? "Structure not operational — no actions available." : "No actions available for this structure this cycle."}</div>
      ) : (
        <div className="hud-cmd-grid">
          {baseActs.map((a) => {
            const exhausted = !liveActs.has(a);
            return (
              <CmdButton
                key={a}
                action={a}
                exhausted={exhausted}
                onClick={() => {
                  if (exhausted) return;
                  const fields = FIELD_HINTS[a] ?? [];
                  if (fields.length > 0) setPending({ mode: "building", action: a, buildingId: selBuildingId });
                  else onQueueBuilding(selBuildingId, a, {});
                }}
              />
            );
          })}
        </div>
      );
  } else if (isEmptyTile) {
    body = <div className="hud-empty-note">Open ground — select one of your structures to construct, deploy or claim here via its command card.</div>;
  } else {
    body = <div className="hud-empty-note">Select an owned structure or a hostile node to issue commands.</div>;
  }

  return (
    <div className="hud-cmd">
      <div className="hud-panel-head">
        <span className="hud-label">Command</span>
        <span className="hud-tag">{shortName}</span>
      </div>
      {body}
      <div className="hud-cmd-foot">
        <span className="hud-cmd-foot-label">Attention this cycle</span>
        <span className="hud-cmd-foot-val"><b>{remaining}</b> / {totalUnits}</span>
      </div>

      {pending && (
        <ParamPopover
          action={pending.action}
          own={own}
          rivals={rivals}
          tile={tile}
          onCancel={() => setPending(null)}
          onConfirm={(values, unitId) => {
            const params = buildParams(pending.action, values);
            if (pending.mode === "building" && pending.buildingId != null) {
              onQueueBuilding(pending.buildingId, pending.action, params);
            } else if (pending.mode === "unit" && unitId != null) {
              const extra: Record<string, unknown> = {};
              if (params.targetHex) extra.targetHex = params.targetHex;
              if (params.targetSubdivisionId) extra.targetSubdivisionId = params.targetSubdivisionId;
              if (params.targetBuildingId) extra.targetBuildingId = params.targetBuildingId;
              const rest = { ...params };
              delete rest.targetHex; delete rest.targetSubdivisionId; delete rest.targetBuildingId;
              if (Object.keys(rest).length) extra.params = rest;
              onQueueUnit(unitId, pending.action, extra);
            }
            setPending(null);
          }}
          units={pending.mode === "unit" ? availableUnits : undefined}
        />
      )}
    </div>
  );
}

function CmdButton({ action, exhausted, offensive, onClick }: { action: string; exhausted: boolean; offensive?: boolean; onClick: () => void }) {
  const cls = ["hud-cmd-btn"];
  if (offensive) cls.push("offensive");
  if (exhausted) cls.push("exhausted");
  return (
    <button
      type="button"
      className={cls.join(" ")}
      onClick={onClick}
      disabled={exhausted}
      title={exhausted ? `${actionLabel(action)} — required unit's attention already spent this cycle` : actionInfo(action).desc}
    >
      <span className="hud-cmd-pips"><span className="hud-cmd-cost" /></span>
      <Icon name={actionIcon(action)} alt="" size={19} className="hud-cmd-glyph" />
      <span className="hud-cmd-lbl">{actionLabel(action)}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Param popover (targets / quantities for actions that need them)
// ---------------------------------------------------------------------------
function ParamPopover({
  action,
  own,
  rivals,
  tile,
  units,
  onCancel,
  onConfirm,
}: {
  action: string;
  own: ReportResponse["own"];
  rivals: ReportResponse["others"];
  tile: TileView | null;
  units?: ReportResponse["own"]["personnel"];
  onCancel: () => void;
  onConfirm: (values: Record<string, string>, unitId?: number) => void;
}) {
  const fields = FIELD_HINTS[action] ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (tile) {
      if (fields.includes("targetHexCol")) init.targetHexCol = String(tile.coord.col);
      if (fields.includes("targetHexRow")) init.targetHexRow = String(tile.coord.row);
      if (fields.includes("targetSubdivisionId") && tile.owner != null) init.targetSubdivisionId = String(tile.owner);
    }
    return init;
  });
  const [unitId, setUnitId] = useState<number | "">(units && units.length ? units[0].id : "");

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const needsUnit = units != null;
  const canConfirm = !needsUnit || unitId !== "";

  return (
    <div className="hud-param-pop" onClick={onCancel}>
      <div className="hud-param-card" onClick={(e) => e.stopPropagation()}>
        <div className="hud-panel-head"><span className="hud-label">{actionLabel(action)}</span></div>
        <div className="hud-param-body">
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10 }}>{actionInfo(action).desc}</div>
          {needsUnit && (
            <label style={{ display: "block", marginBottom: 10 }}>
              <span className="field-label">Acting unit</span>
              <select className="console-input" value={unitId} onChange={(e) => setUnitId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">select…</option>
                {units!.map((u) => (
                  <option key={u.id} value={u.id}>{PERSONNEL_LABELS[u.type] ?? titleCase(u.type)} #{u.id}</option>
                ))}
              </select>
            </label>
          )}
          <ParamInputs fields={fields} values={values} onChange={set} ctx={{ buildings: own.buildings, rivals }} />
        </div>
        <div className="hud-param-foot">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>CANCEL</button>
          <button className="btn btn-primary btn-sm" disabled={!canConfirm} onClick={() => onConfirm(values, needsUnit ? Number(unitId) : undefined)}>QUEUE</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forum (§9)
// ---------------------------------------------------------------------------
function Forum({
  feed,
  tab,
  onTab,
  rivals,
  onSend,
  onViewTile,
}: {
  feed: FeedItem[];
  tab: FeedTab;
  onTab: (t: FeedTab) => void;
  rivals: ReportResponse["others"];
  onSend: (recipient: unknown, body: string) => Promise<void>;
  onViewTile: (hex: { col: number; row: number }) => void;
}) {
  const [to, setTo] = useState<string>("PUBLIC");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const filtered = feed.filter((f) => {
    if (tab === "ALL") return true;
    return f.channel === tab;
  });

  // Unread dots (cosmetic): channel has any item.
  const has = (c: FeedChannel) => feed.some((f) => f.channel === c);

  async function submit() {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const recipient =
        to === "PUBLIC" ? { type: "PUBLIC" } : to === "ADMIN" ? { type: "ADMIN" } : { type: "SUBDIVISION", subdivisionId: Number(to) };
      await onSend(recipient, body.trim());
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="hud-forum">
      <div className="hud-tabs">
        {(["ALL", "INTEL", "WAR", "COMMS"] as FeedTab[]).map((t) => (
          <button key={t} className={`hud-tab${tab === t ? " active" : ""}`} onClick={() => onTab(t)}>
            {t}
            {t !== "ALL" && has(t as FeedChannel) && (
              <span
                className="hud-tab-dot"
                style={{ background: t === "INTEL" ? "var(--cyan)" : t === "WAR" ? "var(--red)" : "var(--violet)" }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="hud-feed" ref={feedRef}>
        {filtered.length === 0 && <div className="hud-empty-note">No transmissions on this channel yet.</div>}
        {filtered.map((f) => (
          <div key={f.id} className={`hud-post ${f.channel.toLowerCase()}`}>
            <div className="hud-post-head">
              <span className="hud-post-chan">{f.channel}</span>
              <span className="hud-post-src">{f.source}</span>
              <span className="hud-post-time">{fmtTime(f.at)}</span>
            </div>
            <div className="hud-post-body">{f.body}</div>
            {f.hex && (
              <div className="hud-post-actions">
                <button className="hud-post-act" onClick={() => onViewTile(f.hex!)}>View tile</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hud-composer">
        <div className="hud-composer-to">
          <label htmlFor="hud-dispatch">Dispatch to:</label>
          <select id="hud-dispatch" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="PUBLIC">Public (colony-wide)</option>
            {rivals.map((r) => (
              <option key={r.subdivisionId} value={r.subdivisionId}>{r.name}</option>
            ))}
            <option value="ADMIN">High Command</option>
          </select>
        </div>
        <div className="hud-composer-row">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Compose dispatch, treaty terms, or field order…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <button className="hud-send" disabled={!body.trim() || sending} onClick={submit}>SEND</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function seedGarrison(rep: ReportResponse): DraftSubmission {
  const d = emptyDraft();
  for (const p of rep.own.personnel) {
    if (p.status === "GARRISONED" && p.assignedBuildingId != null) {
      d.garrison.push({ unitId: p.id, target: { kind: "BUILDING", buildingId: p.assignedBuildingId } });
    } else if (p.status === "CREWING" && p.assignedVehicleId != null) {
      d.garrison.push({ unitId: p.id, target: { kind: "VEHICLE", vehicleId: p.assignedVehicleId } });
    }
  }
  return d;
}

function buildingShortName(buildings: OwnBuilding[], id: number): string {
  const b = buildings.find((x) => x.id === id);
  return b ? `${buildingLabel(b.type)} ${hexLabel(b.hex.col, b.hex.row)}` : `building #${id}`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
