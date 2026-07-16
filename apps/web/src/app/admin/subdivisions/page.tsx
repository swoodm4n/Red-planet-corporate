"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import type { ReportResponse } from "@/lib/client/types";
import { PARENT_LABELS, hexLabel, titleCase } from "@/lib/client/labels";

interface Slot {
  subdivisionId: number;
  name: string;
  parentCompany: string;
  parentPerk: string;
  status: string;
  earthRelations: number;
  composite: number;
  rank: number;
  assignedTo: { id: string; email: string; displayName: string | null } | null;
}

interface ApprovedUser { id: string; email: string; }

export default function SubdivisionsPage() {
  const { gameId, refresh } = useAdmin();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [users, setUsers] = useState<ApprovedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [assignPick, setAssignPick] = useState<Record<number, string>>({});
  const [report, setReport] = useState<ReportResponse["own"] | null>(null);
  const [reportSid, setReportSid] = useState<number | null>(null);

  const load = useCallback(() => {
    api.get<{ subdivisions: Slot[] }>(`/api/admin/games/${gameId}/subdivisions`).then((r) => setSlots(r.subdivisions)).catch((e) => setError(e.message));
    api.get<{ registrations: ApprovedUser[] }>(`/api/admin/registrations?status=APPROVED`).then((r) => setUsers(r.registrations)).catch(() => {});
  }, [gameId]);

  useEffect(() => { load(); setReport(null); setReportSid(null); }, [load]);

  if (error) return <ErrorMsg error={error} />;
  if (!slots) return <Loading label="LOADING SUBDIVISIONS" />;

  async function assign(sid: number) {
    const userId = assignPick[sid];
    if (!userId) { setMsg("Pick a user to assign."); return; }
    try {
      await api.post(`/api/admin/games/${gameId}/subdivisions/${sid}/assign`, { userId });
      setMsg(`Assigned user to subdivision ${sid}.`); load(); refresh();
    } catch (e) { setMsg((e as Error).message); }
  }
  async function retire(sid: number) {
    try {
      await api.post(`/api/admin/games/${gameId}/subdivisions/${sid}/retire`, {});
      setMsg(`Subdivision ${sid} queued for retirement (applies next resolution).`); load();
    } catch (e) { setMsg((e as Error).message); }
  }
  async function viewReport(sid: number) {
    setMsg(null);
    try {
      const r = await api.get<{ own?: ReportResponse["own"] } & ReportResponse["own"]>(`/api/admin/games/${gameId}/subdivisions/${sid}/report`);
      // route may return either the report shape with `own` or the own object directly
      const own = (r as { own?: ReportResponse["own"] }).own ?? (r as unknown as ReportResponse["own"]);
      setReport(own); setReportSid(sid);
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">SUBDIVISIONS</div>
          <div className="page-subtitle">Assign / reassign / retire slots and inspect any subdivision&apos;s private data (game #{gameId}).</div>
        </div>
      </div>

      {msg && <div className="ok-box">{msg}</div>}

      <div className="panel">
        <div className="panel-head"><span>&#9635; SLOTS ({slots.length})</span></div>
        <div className="panel-body tight">
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>ID</th><th>NAME</th><th>PARENT</th><th className="td-num">ER</th><th className="td-num">RANK</th><th className="td-num">COMP</th><th>STATUS</th><th>ASSIGNED</th><th>ACTIONS</th></tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.subdivisionId}>
                    <td>#{s.subdivisionId}</td>
                    <td><strong>{s.name}</strong></td>
                    <td className="td-dim">{PARENT_LABELS[s.parentCompany] ?? s.parentCompany}</td>
                    <td className="td-num">{s.earthRelations}</td>
                    <td className="td-num">{s.rank}</td>
                    <td className="td-num">{s.composite}</td>
                    <td><span className={`badge ${s.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>{s.status}</span></td>
                    <td className="td-dim">{s.assignedTo?.email ?? "—"}</td>
                    <td>
                      <div className="btn-row" style={{ alignItems: "center" }}>
                        <select className="console-input inline-input" value={assignPick[s.subdivisionId] ?? ""} onChange={(e) => setAssignPick((p) => ({ ...p, [s.subdivisionId]: e.target.value }))}>
                          <option value="">user…</option>
                          {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
                        </select>
                        <button className="btn btn-sm" onClick={() => assign(s.subdivisionId)}>ASSIGN</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => viewReport(s.subdivisionId)}>VIEW</button>
                        <button className="btn btn-sm btn-danger" onClick={() => retire(s.subdivisionId)}>RETIRE</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {report && (
        <div className="panel">
          <div className="panel-head">
            <span>&#9635; PRIVATE REPORT — SUBDIVISION #{reportSid} ({report.name})</span>
            <span className="panel-head-actions"><button className="btn btn-sm btn-ghost" onClick={() => setReport(null)}>CLOSE</button></span>
          </div>
          <div className="panel-body">
            <div className="grid-4" style={{ marginBottom: 12 }}>
              <div className="stat-block"><div className="stat-label">CREDITS</div><div className="stat-value">{report.resources.creditsDisplay}</div></div>
              <div className="stat-block"><div className="stat-label">EARTH RELATIONS</div><div className="stat-value amber">{report.earthRelations}</div></div>
              <div className="stat-block"><div className="stat-label">COMPOSITE</div><div className="stat-value">{report.scoring.composite}</div></div>
              <div className="stat-block"><div className="stat-label">PERSONNEL</div><div className="stat-value cyan">{report.personnel.length}</div></div>
            </div>
            <div className="detail-row"><span className="detail-label">Resources</span><span className="detail-value">E {report.resources.ENERGY} · Min {report.resources.MINERALS} · W {report.resources.WATER} · F {report.resources.FOOD} · R {report.resources.RESEARCH}</span></div>
            <div className="section-label">BUILDINGS</div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>TYPE</th><th>HEX</th><th>STATUS</th><th>MODULES</th></tr></thead>
                <tbody>
                  {report.buildings.map((b) => (
                    <tr key={b.id}><td>{titleCase(b.type)}</td><td className="td-dim">{hexLabel(b.hex.col, b.hex.row)}</td><td className="td-dim">{b.status}</td><td className="td-dim">{b.modules.map((m) => m.type).join(", ") || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
