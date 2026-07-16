"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import { PARENT_LABELS } from "@/lib/client/labels";

interface Registration {
  id: string;
  email: string;
  status: string;
  displayName: string | null;
  prefParentCompany: string | null;
  prefParentPerk: string | null;
  prefChoicePersonnel: string[] | null;
  prefDesiredName: string | null;
  createdAt: string;
  assignment: { gameId: number; subdivisionId: number } | null;
}

interface Slot {
  subdivisionId: number;
  name: string;
  parentCompany: string;
  assignedTo: { id: string; email: string } | null;
}

export default function RegistrationsPage() {
  const { gameId, refresh } = useAdmin();
  const [status, setStatus] = useState("PENDING");
  const [regs, setRegs] = useState<Registration[] | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    api.get<{ registrations: Registration[] }>(`/api/admin/registrations?status=${status}`).then((r) => setRegs(r.registrations)).catch((e) => setError(e.message));
    api.get<{ subdivisions: Slot[] }>(`/api/admin/games/${gameId}/subdivisions`).then((r) => setSlots(r.subdivisions)).catch(() => {});
  }, [status, gameId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorMsg error={error} />;
  if (!regs) return <Loading label="LOADING REGISTRATIONS" />;

  async function approve(userId: string) {
    const subdivisionId = pick[userId];
    if (!subdivisionId) { setMsg("Select a subdivision slot first."); return; }
    setMsg(null);
    try {
      await api.post(`/api/admin/registrations/${userId}/approve`, { gameId, subdivisionId });
      setMsg(`Approved and assigned to subdivision ${subdivisionId}.`);
      load(); refresh();
    } catch (e) { setMsg((e as Error).message); }
  }
  async function reject(userId: string) {
    try {
      await api.post(`/api/admin/registrations/${userId}/reject`, { reason: "Rejected via GM console" });
      setMsg("Registration rejected.");
      load();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">REGISTRATION QUEUE</div>
          <div className="page-subtitle">Approve players and assign them a subdivision slot in game #{gameId} (D-048).</div>
        </div>
        <div className="page-meta">
          <select className="console-input inline-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {msg && <div className="ok-box">{msg}</div>}

      <div className="panel">
        <div className="panel-head"><span>&#9635; {status} REGISTRATIONS ({regs.length})</span></div>
        <div className="panel-body tight">
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>EMAIL</th><th>NAME</th><th>PREF PARENT / PERK</th><th>CHOICE</th><th>STATUS</th><th>ASSIGN &amp; ACT</th></tr>
              </thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.email}</td>
                    <td className="td-dim">{r.displayName ?? "—"}{r.prefDesiredName ? ` (${r.prefDesiredName})` : ""}</td>
                    <td className="td-dim">{r.prefParentCompany ? `${PARENT_LABELS[r.prefParentCompany] ?? r.prefParentCompany} / ${r.prefParentPerk ?? "?"}` : "—"}</td>
                    <td className="td-dim">{r.prefChoicePersonnel?.join(", ") ?? "—"}</td>
                    <td><span className={`badge ${r.status === "APPROVED" ? "badge-green" : r.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>{r.status}</span></td>
                    <td>
                      {r.status === "PENDING" ? (
                        <div className="btn-row" style={{ alignItems: "center" }}>
                          <select className="console-input inline-input" value={pick[r.id] ?? ""} onChange={(e) => setPick((p) => ({ ...p, [r.id]: Number(e.target.value) }))}>
                            <option value="">slot…</option>
                            {slots.map((s) => (
                              <option key={s.subdivisionId} value={s.subdivisionId}>
                                #{s.subdivisionId} {s.name}{s.assignedTo ? " (taken)" : ""}
                              </option>
                            ))}
                          </select>
                          <button className="btn btn-sm btn-primary" onClick={() => approve(r.id)}>APPROVE</button>
                          <button className="btn btn-sm btn-danger" onClick={() => reject(r.id)}>REJECT</button>
                        </div>
                      ) : (
                        <span className="td-dim">{r.assignment ? `sub ${r.assignment.subdivisionId}` : "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {regs.length === 0 && <tr><td colSpan={6} className="td-dim">No registrations.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
