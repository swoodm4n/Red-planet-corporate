"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import type { ReportResponse } from "@/lib/client/types";
import { PARENT_LABELS, PERSONNEL_LABELS, RESOURCE_LABELS, hexLabel, titleCase, unitDotClass } from "@/lib/client/labels";

const CATS = ["economic", "industrial", "research", "territorial", "security", "intelligence"];

function garrisonStr(g: Record<string, number>): string {
  const parts = Object.entries(g).filter(([, n]) => n > 0).map(([t, n]) => `${n} ${t.slice(0, 3)}`);
  return parts.length ? parts.join(" + ") : "—";
}

export default function ReportPage() {
  const { gameId, subdivisionId } = usePlayer();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subdivisionId == null) return;
    api.get<ReportResponse>(`/api/games/${gameId}/report`).then(setReport).catch((e) => setError(e.message));
  }, [gameId, subdivisionId]);

  if (subdivisionId == null) {
    return (
      <div className="page">
        <div className="page-header"><div><div className="page-title">PRIVATE REPORT</div></div></div>
        <div className="muted-note amber">
          You have no assigned subdivision yet, so there is no private report to show. You can still view the
          public <Link href="/play/dashboard">colony dashboard</Link>. A game master must assign you a subdivision.
        </div>
      </div>
    );
  }

  if (error) return <ErrorMsg error={error} />;
  if (!report) return <Loading label="DECRYPTING SUBDIVISION REPORT" />;

  const own = report.own;
  const personnelByType = new Map<string, { total: number; garrisoned: number; available: number }>();
  for (const p of own.personnel) {
    const e = personnelByType.get(p.type) ?? { total: 0, garrisoned: 0, available: 0 };
    e.total++;
    if (p.status === "GARRISONED" || p.status === "CREWING") e.garrisoned++;
    if (p.status === "AVAILABLE") e.available++;
    personnelByType.set(p.type, e);
  }
  const maxCat = Math.max(1, ...Object.values(own.scoring.categories));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{own.name} <span className="dim">// PRIVATE REPORT</span></div>
          <div className="page-subtitle">{PARENT_LABELS[own.parentCompany] ?? own.parentCompany} — Perk {own.parentPerk} — Turn {report.turnNumber}</div>
        </div>
        <div className="page-meta">Rank {own.scoring.rank} of {report.standings.standings.length}<br />Composite {own.scoring.composite}</div>
      </div>

      <div className="grid-4">
        <div className="stat-block">
          <div className="stat-label">COMPOSITE SCORE</div>
          <div className="stat-value">{own.scoring.composite}</div>
          <div className="stat-foot">Rank {own.scoring.rank} colony-wide</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">EARTH RELATIONS</div>
          <div className="stat-value amber">{own.earthRelations} <span className="unit">/ 30</span></div>
          <div className="stat-foot">{own.earthRelationsBonusActive ? "ER=30 bonus active" : "Private — never auto-revealed"}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">PERSONNEL</div>
          <div className="stat-value cyan">{own.personnel.length}</div>
          <div className="stat-foot">{own.personnel.filter((p) => p.status === "AVAILABLE").length} available</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">CREDITS</div>
          <div className="stat-value">{own.resources.creditsDisplay} <span className="unit">Cr</span></div>
          <div className="stat-foot">Sales earned: {own.creditsEarnedFromSalesDisplay} Cr</div>
        </div>
      </div>

      <div className="section-label">RESOURCE STOCKPILES</div>
      <div className="grid-4">
        {(["ENERGY", "MINERALS", "WATER", "FOOD", "RESEARCH"] as const).map((r) => (
          <div className="stat-block" key={r}>
            <div className="stat-label">{RESOURCE_LABELS[r].toUpperCase()}</div>
            <div className="stat-value">{own.resources[r]}</div>
          </div>
        ))}
        <div className="stat-block">
          <div className="stat-label">CONSISTENT OUTPUT STREAK</div>
          <div className="stat-value">{own.consistentOutputStreak}</div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="panel">
            <div className="panel-head"><span>&#9635; BUILDINGS ({own.buildings.length})</span></div>
            <div className="panel-body tight">
              <div className="table-scroll">
                <table>
                  <thead><tr><th>BUILDING</th><th>HEX</th><th>GARRISON</th><th>MODULES</th><th>STATUS</th></tr></thead>
                  <tbody>
                    {own.buildings.map((b) => (
                      <tr key={b.id}>
                        <td>{titleCase(b.type)} <span className="td-dim">({b.tier})</span></td>
                        <td className="td-dim">{hexLabel(b.hex.col, b.hex.row)}</td>
                        <td className="td-dim">{garrisonStr(b.garrison)}</td>
                        <td className="td-dim">{b.modules.length ? b.modules.map((m) => m.type.slice(0, 2)).join(",") : "—"}</td>
                        <td>
                          {b.disabledUntilTurn > report.turnNumber ? (
                            <span className="badge badge-red">DISABLED</span>
                          ) : b.status === "ACTIVE" ? (
                            <span className="badge badge-green">{b.status}</span>
                          ) : (
                            <span className="badge badge-amber">{b.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; PERSONNEL ROSTER</span></div>
            <div className="panel-body tight">
              <div className="table-scroll">
                <table>
                  <thead><tr><th>TYPE</th><th className="td-num">TOTAL</th><th className="td-num">GARRISONED</th><th className="td-num">AVAILABLE</th></tr></thead>
                  <tbody>
                    {[...personnelByType.entries()].map(([type, e]) => (
                      <tr key={type}>
                        <td><span className={unitDotClass(type)} style={{ marginRight: 7 }} />{PERSONNEL_LABELS[type] ?? type}</td>
                        <td className="td-num">{e.total}</td>
                        <td className="td-num">{e.garrisoned}</td>
                        <td className="td-num" style={{ color: e.available ? "var(--green-bright)" : undefined }}>{e.available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {own.vehicles.length > 0 && (
            <div className="panel">
              <div className="panel-head"><span>&#9635; VEHICLES ({own.vehicles.length})</span></div>
              <div className="panel-body tight">
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>ID</th><th>HULL</th><th>STATUS</th><th>MODULES</th></tr></thead>
                    <tbody>
                      {own.vehicles.map((v) => (
                        <tr key={v.id}>
                          <td>#{v.id}</td>
                          <td>{titleCase(v.hull)}</td>
                          <td className="td-dim">{v.status}</td>
                          <td className="td-dim">{v.modules?.map((m) => m.type).join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><span>&#9635; SCORING BREAKDOWN</span></div>
            <div className="panel-body">
              {CATS.map((c) => {
                const v = own.scoring.categories[c] ?? 0;
                return (
                  <div key={c}>
                    <div className="detail-row"><span className="detail-label">{titleCase(c)}</span><span className="detail-value">{v}</span></div>
                    <div className="bar-track" style={{ margin: "4px 0 10px 0" }}>
                      <div className="bar-fill" style={{ width: `${Math.round((v / maxCat) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; INTEL &amp; CAPTIVES</span></div>
            <div className="panel-body">
              <div className="detail-row"><span className="detail-label">Captured units held</span><span className="detail-value">{own.capturedUnits.length}</span></div>
              {own.capturedUnits.map((u) => (
                <div className="detail-row" key={u.id}><span className="detail-label">&nbsp;&nbsp;#{u.id}</span><span className="detail-value td-dim">{PERSONNEL_LABELS[u.type] ?? u.type}</span></div>
              ))}
              <div className="detail-row"><span className="detail-label">Closed borders against</span><span className="detail-value">{own.closedBordersAgainst.length ? own.closedBordersAgainst.join(", ") : "None"}</span></div>
              <div className="detail-row"><span className="detail-label">Insolvent streak</span><span className="detail-value">{own.insolventStreak}</span></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span>&#9635; CUMULATIVE COUNTERS</span></div>
            <div className="panel-body tight">
              <div className="table-scroll">
                <table>
                  <tbody>
                    {Object.entries(own.cumulativeCounters).filter(([, v]) => typeof v === "number").map(([k, v]) => (
                      <tr key={k}><td className="td-dim">{titleCase(k)}</td><td className="td-num">{String(v)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
