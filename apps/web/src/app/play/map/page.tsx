"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import type {
  DashboardResponse,
  MapResponse,
  MapTileMarker,
  TileResponse,
  TileView,
  IntelTier,
} from "@/lib/client/types";
import { hexLabel, titleCase, RESOURCE_SHORT } from "@/lib/client/labels";
import { Icon, BuildingIcon, ResourceIcon, PersonnelIcon, HullIcon } from "@/lib/client/Icon";

const COLS = 12;
const ROWS = 8;

// Terrain that should read as "difficult ground" via a hatched background even on
// unclaimed tiles (§9.1 terrain is display-only here; the engine owns the effects).
const MOUNTAIN_TERRAIN = new Set(["MOUNTAINS"]);
const MINERAL_TERRAIN = new Set(["RARE_MINERALS", "VOLCANIC_VENT"]);

export default function MapPage() {
  const { gameId, subdivisionId } = usePlayer();
  const [map, setMap] = useState<MapResponse | null>(null);
  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sel, setSel] = useState<{ col: number; row: number } | null>(null);
  const [tile, setTile] = useState<TileView | null>(null);
  const [tileLoading, setTileLoading] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  useEffect(() => {
    api.get<MapResponse>(`/api/games/${gameId}/map`).then(setMap).catch((e) => setError(e.message));
    // Public dashboard is used only for owner display names + closed-border status.
    api.get<DashboardResponse>(`/api/games/${gameId}/dashboard`).then(setDash).catch(() => {});
  }, [gameId]);

  // Tiles are recomputed live per request and can change turn-to-turn — always
  // refetch on open, never reuse a previously-fetched shape (§21.5).
  const fetchTile = useCallback(
    (col: number, row: number) => {
      setSel({ col, row });
      setTile(null);
      setTileError(null);
      setTileLoading(true);
      api
        .get<TileResponse>(`/api/games/${gameId}/map/tiles/${col}/${row}`)
        .then((r) => setTile(r.tile))
        .catch((e) => setTileError(e.message))
        .finally(() => setTileLoading(false));
    },
    [gameId],
  );

  const markerAt = useMemo(() => {
    const m = new Map<string, MapTileMarker>();
    if (map) for (const t of map.tiles) m.set(`${t.coord.col},${t.coord.row}`, t);
    return m;
  }, [map]);

  const nameById = useMemo(() => {
    const m = new Map<number, string>();
    if (dash) {
      dash.subdivisions.forEach((s) => m.set(s.subdivisionId, s.name));
      dash.standings.standings.forEach((s) => m.set(s.subdivisionId, s.name));
    }
    return m;
  }, [dash]);

  // Who has closed borders against the viewer (public status, §18) — overlay only.
  const closedBy = useMemo(() => {
    const m = new Map<number, Set<string | number>>();
    if (dash) for (const s of dash.subdivisions) m.set(s.subdivisionId, new Set(s.closedBordersAgainst));
    return m;
  }, [dash]);

  if (error) return <ErrorMsg error={error} />;
  if (!map) return <Loading label="LOADING TERRITORY MAP" />;

  const ownerName = (id: number | null): string =>
    id == null ? "Unclaimed" : `${nameById.get(id) ?? `Subdivision #${id}`}${id === subdivisionId ? " (you)" : ""}`;

  const isClosedVsMe = (owner: number | null): boolean => {
    if (owner == null || owner === subdivisionId) return false;
    const set = closedBy.get(owner);
    return !!set && (set.has("ALL") || (subdivisionId != null && set.has(subdivisionId)));
  };

  const myClaims = map.tiles.filter((t) => t.owner === subdivisionId).length;
  const rivalClaims = map.tiles.filter((t) => t.owner != null && t.owner !== subdivisionId).length;

  function tileClass(t: MapTileMarker): string {
    let cls = "sq";
    if (t.isLandingZone) cls += " landing";
    else if (t.terrain === "IMPASSABLE") cls += " impassable";
    else if (t.owner === subdivisionId) cls += t.hasHQ ? " owned-hq" : " owned";
    else if (t.owner != null) cls += t.hasHQ ? " rival-hq" : " rival";
    else if (MOUNTAIN_TERRAIN.has(t.terrain)) cls += " terrain-mountain";
    else if (MINERAL_TERRAIN.has(t.terrain)) cls += " terrain-mineral";
    // Low-intel rival territory is rendered dimmer to signal poor coverage (§21 map-level treatment).
    if (t.owner != null && t.owner !== subdivisionId && t.intelTier === "LOW") cls += " dim";
    if (isClosedVsMe(t.owner)) cls += " closed";
    if (sel && sel.col === t.coord.col && sel.row === t.coord.row) cls += " selected";
    return cls;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">TRANSIT HUB MAP</div>
          <div className="page-subtitle">
            12×8 square grid, 8-directional adjacency. HQ &amp; Outpost placement and territory control are public; all other
            tile detail is gated by your live intel tier vs each rival (§21). Click any tile to inspect.
          </div>
        </div>
        <div className="page-meta">
          {myClaims} tiles claimed // {rivalClaims} rival // turn {map.turnNumber}
        </div>
      </div>

      <div className="map-wrap">
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head"><span>&#9635; REGIONAL SCAN</span></div>
          <div className="sqgrid-wrap">
            <div className="sqgrid">
              <div className="sq-corner" />
              {Array.from({ length: COLS }, (_, ci) => (
                <div className="sq-collabel" key={`c${ci}`}>{"ABCDEFGHIJKL"[ci]}</div>
              ))}
              {Array.from({ length: ROWS }, (_, ri) => {
                const row = ri + 1;
                return (
                  <MapRow key={row} row={row}>
                    {Array.from({ length: COLS }, (_, ci) => {
                      const col = ci + 1;
                      const t = markerAt.get(`${col},${row}`);
                      if (!t) return <div className="sq impassable" key={col} />;
                      return (
                        <div
                          className={tileClass(t)}
                          key={col}
                          title={`${hexLabel(col, row)} — ${titleCase(t.terrain)}`}
                          onClick={() => fetchTile(col, row)}
                        >
                          {t.isLandingZone ? (
                            <Icon name="landing-zone" alt="" size={26} />
                          ) : t.hasHQ ? (
                            <Icon name="headquarters" alt="" size={26} />
                          ) : t.hasOutpost ? (
                            <Icon name="outpost" alt="" size={24} />
                          ) : null}
                          {t.owner != null && t.owner !== subdivisionId && (
                            <span className="sq-tier">{t.intelTier === "OWN" ? "" : t.intelTier[0]}</span>
                          )}
                          {t.owner === subdivisionId && <span className="sq-tier">◆</span>}
                        </div>
                      );
                    })}
                  </MapRow>
                );
              })}
            </div>
          </div>
          <div className="map-legend">
            <div className="legend-item"><Icon name="headquarters" alt="" size={14} />HQ</div>
            <div className="legend-item"><Icon name="outpost" alt="" size={14} />Outpost</div>
            <div className="legend-item"><Icon name="landing-zone" alt="" size={14} />Landing Zone</div>
            <div className="legend-item"><div className="legend-swatch" style={{ background: "var(--green-dim)", border: "1px solid var(--green-bright)" }} />Your claim</div>
            <div className="legend-item"><div className="legend-swatch" style={{ background: "#3A1414", border: "1px solid #A03434" }} />Rival claim</div>
            <div className="legend-item"><Icon name="status-closed-border" alt="" size={14} />Closed border vs you</div>
            <div className="legend-item"><span style={{ opacity: 0.5 }}>▨</span> Dim = LOW intel</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span>&#9635; TILE INSPECTION {sel ? `— ${hexLabel(sel.col, sel.row)}` : ""}</span>
          </div>
          <div className="panel-body">
            {!sel ? (
              <div className="muted-note" style={{ margin: 0 }}>Select a tile to inspect it at your current intel level.</div>
            ) : tileLoading ? (
              <div className="muted-note" style={{ margin: 0 }}>Scanning…</div>
            ) : tileError ? (
              <ErrorMsg error={tileError} />
            ) : tile ? (
              <TileDetail tile={tile} ownerName={ownerName} isYou={tile.owner === subdivisionId} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MapRow({ row, children }: { row: number; children: React.ReactNode }) {
  return (
    <>
      <div className="sq-rowlabel">{row}</div>
      {children}
    </>
  );
}

function IntelBadge({ tier }: { tier: IntelTier }) {
  return <span className={`intel-badge t-${tier}`}>INTEL: {tier}</span>;
}

function TileDetail({
  tile,
  ownerName,
  isYou,
}: {
  tile: TileView;
  ownerName: (id: number | null) => string;
  isYou: boolean;
}) {
  const { intelTier } = tile;
  const isOwn = intelTier === "OWN";
  // A LOW opponent tile reveals nothing beyond the public map fields — communicate
  // that as a real game state ("insufficient intelligence"), not an empty panel.
  const lowOpponent = !isOwn && intelTier === "LOW" && tile.owner != null;
  const unclaimed = tile.owner == null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <IntelBadge tier={intelTier} />
        {tile.isLandingZone && <Icon name="landing-zone" alt="Landing Zone" size={20} />}
      </div>

      <div className="detail-row"><span className="detail-label">Coord</span><span className="detail-value">{hexLabel(tile.coord.col, tile.coord.row)} ({tile.coord.col},{tile.coord.row})</span></div>
      <div className="detail-row"><span className="detail-label">Terrain</span><span className="detail-value">{titleCase(tile.terrain)}</span></div>
      <div className="detail-row">
        <span className="detail-label">Owner</span>
        <span className="detail-value" style={{ color: isYou ? "var(--green-bright)" : undefined }}>{ownerName(tile.owner)}</span>
      </div>
      {(tile.hasHQ || tile.hasOutpost || tile.isLandingZone) && (
        <div className="detail-row">
          <span className="detail-label">Structures (public)</span>
          <span className="detail-value icon-label" style={{ justifyContent: "flex-end" }}>
            {tile.isLandingZone && <><Icon name="landing-zone" alt="" size={16} />LZ</>}
            {tile.hasHQ && <><Icon name="headquarters" alt="" size={16} />HQ</>}
            {tile.hasOutpost && <><Icon name="outpost" alt="" size={16} />Outpost</>}
          </span>
        </div>
      )}

      {lowOpponent && (
        <div className="intel-empty" style={{ marginTop: 12 }}>
          INSUFFICIENT INTELLIGENCE
          <div style={{ marginTop: 6, fontSize: 11 }}>
            Your intel tier against {ownerName(tile.owner)} is LOW. You can see this tile exists, its terrain, its owner,
            and any public HQ/Outpost — but nothing about what is built or stationed here.
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-tertiary)" }}>
            Raise your espionage (Analysts, Sensor / Comms Arrays) or lower their opsec to reach MEDIUM+ (§21.3).
          </div>
        </div>
      )}

      {unclaimed && !tile.isLandingZone && (
        <div className="muted-note" style={{ marginTop: 12 }}>Unclaimed territory — no subdivision holds this tile, so there is nothing to reveal.</div>
      )}

      {/* MEDIUM+ : building count */}
      {tile.buildingCount != null && (
        <div className="detail-row">
          <span className="detail-label">Buildings on tile</span>
          <span className="detail-value">{tile.buildingCount}</span>
        </div>
      )}

      {/* HIGH+ : building type list + aggregate unit count (opponent view) */}
      {!isOwn && tile.buildings && (
        <div style={{ marginTop: 8 }}>
          <div className="detail-label" style={{ marginBottom: 4 }}>Structures detected</div>
          {tile.buildings.length === 0 ? (
            <div className="muted-note" style={{ margin: 0 }}>None</div>
          ) : (
            tile.buildings.map((b, i) => (
              <div className="detail-row" key={`${b}-${i}`}>
                <span className="detail-label icon-label"><BuildingIcon type={b} size={16} />{titleCase(b)}</span>
                <span className="detail-value td-dim" />
              </div>
            ))
          )}
        </div>
      )}
      {!isOwn && tile.unitCount != null && (
        <div className="detail-row">
          <span className="detail-label">Units on tile (aggregate)</span>
          <span className="detail-value">{tile.unitCount}</span>
        </div>
      )}

      {/* FULL+ : per-turn output + unit type/hull breakdown (still no identities/loadouts) */}
      {tile.resourceOutput && Object.keys(tile.resourceOutput).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="detail-label" style={{ marginBottom: 4 }}>Per-turn output (capacity)</div>
          {Object.entries(tile.resourceOutput).map(([res, amt]) => (
            <div className="detail-row" key={res}>
              <span className="detail-label icon-label"><ResourceIcon resource={res} size={16} />{RESOURCE_SHORT[res] ?? titleCase(res)}</span>
              <span className="detail-value">+{amt}/turn</span>
            </div>
          ))}
        </div>
      )}
      {tile.units && (
        <div style={{ marginTop: 8 }}>
          <div className="detail-label" style={{ marginBottom: 4 }}>Force composition (counts only)</div>
          {Object.keys(tile.units.personnel).length === 0 && Object.keys(tile.units.vehicles).length === 0 ? (
            <div className="muted-note" style={{ margin: 0 }}>No units stationed here.</div>
          ) : (
            <>
              {Object.entries(tile.units.personnel).map(([type, n]) => (
                <div className="detail-row" key={`p-${type}`}>
                  <span className="detail-label icon-label"><PersonnelIcon type={type} size={16} />{titleCase(type)}</span>
                  <span className="detail-value">×{n}</span>
                </div>
              ))}
              {Object.entries(tile.units.vehicles).map(([hull, n]) => (
                <div className="detail-row" key={`v-${hull}`}>
                  <span className="detail-label icon-label"><HullIcon hull={hull} size={16} />{titleCase(hull)} vehicle</span>
                  <span className="detail-value">×{n}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* OWN : full per-building detail with modules + garrison */}
      {isOwn && tile.ownBuildings && (
        <div style={{ marginTop: 10 }}>
          <div className="detail-label" style={{ marginBottom: 6, color: "var(--green-bright)" }}>Your buildings (full detail)</div>
          {tile.ownBuildings.length === 0 ? (
            <div className="muted-note" style={{ margin: 0 }}>No standing buildings on this tile.</div>
          ) : (
            tile.ownBuildings.map((b) => (
              <div key={b.id} style={{ borderTop: "1px solid var(--border-dim)", padding: "8px 0" }}>
                <div className="detail-row" style={{ border: "none", padding: "0 0 4px 0" }}>
                  <span className="detail-label icon-label"><BuildingIcon type={b.type} size={18} />{titleCase(b.type)} ({b.tier})</span>
                  <span className="detail-value td-dim">{titleCase(b.status)}</span>
                </div>
                {b.modules.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", paddingLeft: 24 }}>
                    Modules: {b.modules.map((m) => `${titleCase(m.type)}${m.status !== "ACTIVE" ? ` (${titleCase(m.status)})` : ""}`).join(", ")}
                  </div>
                )}
                {Object.keys(b.garrison).length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", paddingLeft: 24, marginTop: 2 }}>
                    Garrison: {Object.entries(b.garrison).map(([t, n]) => `${titleCase(t)} ×${n}`).join(", ")}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
