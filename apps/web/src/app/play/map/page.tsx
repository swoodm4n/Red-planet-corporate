"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import type { DashboardResponse } from "@/lib/client/types";
import { hexLabel, titleCase } from "@/lib/client/labels";
import { Icon, BuildingIcon } from "@/lib/client/Icon";
import { buildingIcon } from "@/lib/client/icons";

const COLS = 12;
const ROWS = 8;

interface Cell {
  col: number;
  row: number;
  terrain: string;
  owner: number | null;
  buildings: { id: number; type: string; tier: string; subId: number; subName: string }[];
}

export default function MapPage() {
  const { gameId, subdivisionId } = usePlayer();
  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    api.get<DashboardResponse>(`/api/games/${gameId}/dashboard`).then(setDash).catch((e) => setError(e.message));
  }, [gameId]);

  const cells = useMemo(() => {
    const map = new Map<string, Cell>();
    if (!dash) return map;
    for (const h of dash.map) {
      map.set(`${h.col},${h.row}`, { col: h.col, row: h.row, terrain: h.terrain, owner: h.ownerSubdivisionId, buildings: [] });
    }
    for (const s of dash.subdivisions) {
      for (const b of s.buildings) {
        const key = `${b.hex.col},${b.hex.row}`;
        const c = map.get(key);
        if (c) c.buildings.push({ id: b.id, type: b.type, tier: b.tier, subId: s.subdivisionId, subName: s.name });
      }
    }
    return map;
  }, [dash]);

  if (error) return <ErrorMsg error={error} />;
  if (!dash) return <Loading label="LOADING TERRITORY MAP" />;

  const nameById = new Map(dash.subdivisions.map((s) => [s.subdivisionId, s.name]));
  dash.standings.standings.forEach((s) => nameById.set(s.subdivisionId, s.name));

  // Closed-border sets: who each subdivision has closed against.
  const closedBy = new Map<number, Set<string | number>>();
  for (const s of dash.subdivisions) closedBy.set(s.subdivisionId, new Set(s.closedBordersAgainst));

  const myClaims = dash.map.filter((h) => h.ownerSubdivisionId === subdivisionId).length;
  const transitHubs = [...cells.values()].filter((c) => c.buildings.some((b) => b.type === "TRANSIT_HUB"));

  const selCell = sel ? cells.get(sel) : null;

  function cellClass(c: Cell): string {
    let cls = "hex";
    const hasHQ = c.buildings.some((b) => b.type === "HEADQUARTERS");
    if (c.terrain === "LANDING_ZONE") cls += " landing";
    else if (c.terrain === "IMPASSABLE") cls += " impassable";
    else if (c.owner === subdivisionId) cls += hasHQ ? " owned-hq" : " owned";
    else if (c.owner != null) cls += " rival";
    else if (c.terrain === "MOUNTAINS" || c.terrain === "RARE_MINERALS") cls += " terrain-mountain";
    // closed border against me?
    if (c.owner != null && c.owner !== subdivisionId) {
      const set = closedBy.get(c.owner);
      if (set && (set.has("ALL") || (subdivisionId != null && set.has(subdivisionId)))) cls += " closed";
    }
    if (sel === `${c.col},${c.row}`) cls += " selected";
    return cls;
  }

  function cellLabel(c: Cell): string {
    if (c.terrain === "LANDING_ZONE") return "LZ";
    if (c.terrain === "IMPASSABLE") return "~";
    if (c.buildings.some((b) => b.type === "HEADQUARTERS")) return "HQ";
    if (c.buildings.some((b) => b.type === "TRANSIT_HUB")) return "TH";
    if (c.owner != null) return hexLabel(c.col, c.row);
    if (c.terrain === "MOUNTAINS") return "M";
    if (c.terrain === "RARE_MINERALS") return "R";
    return "";
  }

  // Pick the most notable pixel-art icon to render in a hex (HQ > Transit Hub >
  // first building), or the Landing Zone terrain marker. Falls back to text.
  function cellIconName(c: Cell): string | null {
    if (c.terrain === "LANDING_ZONE") return "landing-zone";
    const priority = ["HEADQUARTERS", "TRANSIT_HUB"];
    for (const t of priority) {
      if (c.buildings.some((b) => b.type === t)) return buildingIcon(t);
    }
    if (c.buildings.length > 0) return buildingIcon(c.buildings[0].type);
    return null;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">TRANSIT HUB MAP</div>
          <div className="page-subtitle">
            12×8 grid. Territory control &amp; closed borders are public; unit-level intel comes from Survey / Sensor / Surveillance actions (see private report).
          </div>
        </div>
        <div className="page-meta">{myClaims} hexes claimed // {transitHubs.length} Transit Hubs colony-wide</div>
      </div>

      <div className="map-wrap">
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head"><span>&#9635; REGIONAL SCAN</span></div>
          <div className="hexgrid">
            {Array.from({ length: ROWS }, (_, ri) => {
              const row = ri + 1;
              return (
                <div className={`hexrow ${row % 2 === 0 ? "odd" : ""}`} key={row}>
                  {Array.from({ length: COLS }, (_, ci) => {
                    const col = ci + 1;
                    const c = cells.get(`${col},${row}`);
                    if (!c) return <div className="hex fog" key={col} />;
                    const iconName = cellIconName(c);
                    return (
                      <div className={cellClass(c)} key={col} title={`${hexLabel(col, row)} — ${titleCase(c.terrain)}`} onClick={() => setSel(`${col},${row}`)}>
                        {iconName ? <Icon name={iconName} alt="" size={30} /> : cellLabel(c)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="map-legend">
            <div className="legend-item"><div className="legend-swatch" style={{ background: "var(--green-dim)", border: "1px solid var(--green-bright)" }} />HQ</div>
            <div className="legend-item"><div className="legend-swatch" style={{ background: "var(--green-faint)", border: "1px solid var(--green-dim)" }} />Your claim</div>
            <div className="legend-item"><div className="legend-swatch" style={{ background: "#3A1414", border: "1px solid #6B2424" }} />Rival claim</div>
            <div className="legend-item"><Icon name="landing-zone" alt="" size={14} />Landing Zone</div>
            <div className="legend-item"><Icon name="status-closed-border" alt="" size={14} />Closed border vs you</div>
            <div className="legend-item"><div className="legend-swatch" style={{ background: "#1A1A1A" }} />Impassable</div>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><span>&#9635; HEX DETAIL {selCell ? `— ${hexLabel(selCell.col, selCell.row)}` : ""}</span></div>
            <div className="panel-body">
              {!selCell ? (
                <div className="muted-note" style={{ margin: 0 }}>Select a hex to inspect.</div>
              ) : (
                <>
                  <div className="detail-row"><span className="detail-label">Coord</span><span className="detail-value">{hexLabel(selCell.col, selCell.row)} ({selCell.col},{selCell.row})</span></div>
                  <div className="detail-row"><span className="detail-label">Terrain</span><span className="detail-value">{titleCase(selCell.terrain)}</span></div>
                  <div className="detail-row">
                    <span className="detail-label">Owner</span>
                    <span className="detail-value" style={{ color: selCell.owner === subdivisionId ? "var(--green-bright)" : undefined }}>
                      {selCell.owner == null ? "Unclaimed" : `${nameById.get(selCell.owner) ?? `#${selCell.owner}`}${selCell.owner === subdivisionId ? " (you)" : ""}`}
                    </span>
                  </div>
                  <div className="detail-row"><span className="detail-label">Buildings</span><span className="detail-value">{selCell.buildings.length || "None"}</span></div>
                  {selCell.buildings.map((b) => (
                    <div className="detail-row" key={b.id}>
                      <span className="detail-label icon-label"><BuildingIcon type={b.type} size={16} />{titleCase(b.type)} ({b.tier})</span>
                      <span className="detail-value td-dim">{b.subName}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; TRANSIT HUB NETWORK</span></div>
            <div className="panel-body">
              <div className="muted-note" style={{ margin: "0 0 10px 0" }}>All your Transit Hubs + the Landing Zone form one jump network (§9.4).</div>
              {transitHubs.filter((c) => c.buildings.some((b) => b.subId === subdivisionId && b.type === "TRANSIT_HUB")).map((c) => (
                <div className="detail-row" key={`${c.col},${c.row}`}>
                  <span className="detail-label icon-label"><Icon name="transit-hub" alt="" size={16} />Transit Hub {hexLabel(c.col, c.row)}</span>
                  <span className="detail-value" style={{ color: "var(--green-bright)" }}>ACTIVE</span>
                </div>
              ))}
              <div className="detail-row"><span className="detail-label icon-label"><Icon name="landing-zone" alt="" size={16} />Landing Zone</span><span className="detail-value" style={{ color: "var(--cyan)" }}>UNIVERSAL</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
