"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import type { DashboardResponse } from "@/lib/client/types";
import { PARENT_LABELS, RESOURCE_LABELS, titleCase } from "@/lib/client/labels";
import { Icon, ResourceIcon } from "@/lib/client/Icon";

const CATS = ["economic", "industrial", "research", "territorial", "security", "intelligence"];

export default function DashboardPage() {
  const { gameId, subdivisionId } = usePlayer();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DashboardResponse>(`/api/games/${gameId}/dashboard`).then(setData).catch((e) => setError(e.message));
  }, [gameId]);

  if (error) return <ErrorMsg error={error} />;
  if (!data) return <Loading label="LOADING COLONY DASHBOARD" />;

  const nameById = new Map(data.subdivisions.map((s) => [s.subdivisionId, s.name]));
  data.standings.standings.forEach((s) => nameById.set(s.subdivisionId, s.name));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">
            COLONY DASHBOARD <span className="dim">// TURN {data.turnNumber}</span>
          </div>
          <div className="page-subtitle">Public colony-wide standings, market data, events and announcements.</div>
        </div>
        <div className="page-meta">{data.subdivisions.length} active subdivisions</div>
      </div>

      <div className="section-label">CATEGORY LEADERS</div>
      <div className="category-leader-strip" style={{ marginBottom: 18 }}>
        {CATS.map((c) => {
          const leaderId = data.standings.leaders[c];
          return (
            <div className="leader-chip" key={c}>
              <div className="leader-chip-cat">{c.toUpperCase()}</div>
              <div className="leader-chip-name">{leaderId != null ? nameById.get(leaderId) ?? `#${leaderId}` : "—"}</div>
            </div>
          );
        })}
      </div>

      <div className="grid-sidebar-r">
        <div>
          <div className="panel">
            <div className="panel-head"><span>&#9635; STANDINGS</span></div>
            <div className="panel-body tight">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>RANK</th>
                      <th>SUBDIVISION</th>
                      <th>PARENT CO</th>
                      <th>LEADING</th>
                      <th className="td-num">COMPOSITE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.standings.standings.map((s) => {
                      const you = s.subdivisionId === subdivisionId;
                      const rc = s.rank === 1 ? "gold" : s.rank === 2 ? "silver" : s.rank === 3 ? "bronze" : "";
                      return (
                        <tr key={s.subdivisionId} className={you ? "you-row" : ""}>
                          <td><span className={`rank-badge ${rc}`}>{s.rank}</span></td>
                          <td>
                            <strong>{s.name}</strong>
                            {you && <span className="badge badge-cyan" style={{ marginLeft: 6 }}>YOU</span>}
                          </td>
                          <td className="td-dim">{PARENT_LABELS[s.parentCompany] ?? s.parentCompany}</td>
                          <td className="td-dim">{titleCase(s.leadingCategory)}</td>
                          <td className="td-num" style={{ color: "var(--green-bright)", fontWeight: 700 }}>{s.composite}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; RESOURCE MARKET — LIVE PRICES</span></div>
            <div className="panel-body tight">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>RESOURCE</th>
                      <th className="td-num">LIVE PRICE</th>
                      <th className="td-num">CUM. BOUGHT</th>
                      <th className="td-num">CUM. SOLD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.market.map((m) => {
                      const net = m.cumulativeBought - m.cumulativeSold;
                      return (
                        <tr key={m.resource}>
                          <td><span className="icon-label"><ResourceIcon resource={m.resource} size={18} />{RESOURCE_LABELS[m.resource] ?? m.resource}</span></td>
                          <td className="td-num">
                            <span className="icon-label" style={{ justifyContent: "flex-end" }}>
                              {net !== 0 && <Icon name={net > 0 ? "status-price-up" : "status-price-down"} alt={net > 0 ? "trending up" : "trending down"} size={14} />}
                              {m.livePrice.toFixed(2)} Cr
                            </span>
                          </td>
                          <td className="td-num td-dim">{m.cumulativeBought}</td>
                          <td className="td-num td-dim">{m.cumulativeSold}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><span>&#9635; ANNOUNCEMENTS</span></div>
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.announcements.length === 0 && <div className="muted-note" style={{ margin: 0 }}>No announcements posted.</div>}
              {data.announcements.map((a) => (
                <div key={a.id}>
                  <div style={{ color: "var(--green-bright)", fontSize: 12, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>{a.body}</div>
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 3 }}>{new Date(a.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; COLONY EVENTS</span></div>
            <div className="feed">
              {data.colonyEvents.length === 0 && <div className="muted-note" style={{ margin: 0 }}>No colony events yet.</div>}
              {data.colonyEvents.map((e, i) => (
                <div className="feed-line" key={i}>
                  <span className="feed-time">T{e.turnNumber}</span>
                  <span className="feed-text">
                    {e.event.scope !== "NONE" && <Icon name="status-alert" alt="event" size={14} style={{ marginRight: 6 }} />}
                    <span className={e.event.scope === "NONE" ? "" : "hl"}>{e.event.name}</span>
                    {e.event.message && e.event.name !== e.event.message ? ` — ${e.event.message}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
