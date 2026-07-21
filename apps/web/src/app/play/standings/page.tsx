"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import type { DashboardResponse } from "@/lib/client/types";
import { PARENT_LABELS, titleCase } from "@/lib/client/labels";
import { Icon } from "@/lib/client/Icon";

const CATS = ["economic", "industrial", "research", "territorial", "security", "intelligence"];

export default function StandingsPage() {
  const { gameId, subdivisionId } = usePlayer();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DashboardResponse>(`/api/games/${gameId}/dashboard`).then(setData).catch((e) => setError(e.message));
  }, [gameId]);

  if (error) return <ErrorMsg error={error} />;
  if (!data) return <Loading label="LOADING STANDINGS" />;

  const nameById = new Map(data.standings.standings.map((s) => [s.subdivisionId, s.name]));
  const priceById = new Map(data.equity.sharePrices.map((p) => [p.issuerSubdivisionId, p.sharePrice]));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title icon-label"><Icon name="status-standings" alt="" size={20} />COLONY STANDINGS <span className="dim">// TURN {data.turnNumber}</span></div>
          <div className="page-subtitle">Composite score is the sum of six weighted category scores (§12). Ties break by subdivision id.</div>
        </div>
        <div className="page-meta">{data.standings.standings.length} active subdivisions</div>
      </div>

      <div className="section-label">CATEGORY LEADERS</div>
      <div className="category-leader-strip" style={{ marginBottom: 18 }}>
        {CATS.map((c) => {
          const id = data.standings.leaders[c];
          return (
            <div className="leader-chip" key={c}>
              <div className="leader-chip-cat">{c.toUpperCase()}</div>
              <div className="leader-chip-name">{id != null ? nameById.get(id) ?? `#${id}` : "—"}</div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div className="panel-head"><span>&#9635; FULL STANDINGS</span></div>
        <div className="panel-body tight">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>SUBDIVISION</th>
                  <th>PARENT CO</th>
                  <th>LEADING CATEGORY</th>
                  <th className="td-num">SHARE PRICE</th>
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
                      <td className="td-num">{priceById.get(s.subdivisionId)?.toFixed(2) ?? "—"} Cr</td>
                      <td className="td-num" style={{ color: "var(--green-bright)", fontWeight: 700 }}>{s.composite}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
