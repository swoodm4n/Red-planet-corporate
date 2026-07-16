"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import { StateEditBuilder, type StateEdit } from "@/lib/client/StateEditBuilder";

interface Proposal {
  id: string;
  subdivisionId: number;
  proposalText: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  user?: { id: string; email: string } | null;
}

function ResolveForm({ proposal, onDone }: { proposal: Proposal; onDone: () => void }) {
  const [response, setResponse] = useState("");
  const [effects, setEffects] = useState<StateEdit[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resolve(status: "APPROVED" | "REJECTED") {
    setBusy(true); setErr(null);
    try {
      await api.post(`/api/admin/research-proposals/${proposal.id}/resolve`, {
        status,
        adminResponse: response || undefined,
        grantedEffects: status === "APPROVED" ? effects : undefined,
      });
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="panel-body" style={{ borderTop: "1px solid var(--border-dim)" }}>
      {err && <div className="error-box">{err}</div>}
      <label className="field">
        <span className="field-label">GM ruling / response</span>
        <textarea className="console-input" value={response} onChange={(e) => setResponse(e.target.value)} />
      </label>
      <span className="field-label">Granted structured effects (on approval)</span>
      <StateEditBuilder edits={effects} onChange={setEffects} />
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => resolve("APPROVED")}>APPROVE + GRANT</button>
        <button className="btn btn-danger" disabled={busy} onClick={() => resolve("REJECTED")}>REJECT</button>
      </div>
    </div>
  );
}

export default function AdminResearchPage() {
  const { gameId } = useAdmin();
  const [status, setStatus] = useState("PENDING");
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setProposals(null);
    const q = status === "ALL" ? "" : `?status=${status}`;
    api.get<{ proposals: Proposal[] }>(`/api/admin/games/${gameId}/research-proposals${q}`).then((r) => setProposals(r.proposals)).catch((e) => setError(e.message));
  }, [gameId, status]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorMsg error={error} />;
  if (!proposals) return <Loading label="LOADING RESEARCH QUEUE" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">RESEARCH ADJUDICATION</div>
          <div className="page-subtitle">Rule on freeform proposals; grant effects as structured edits only (D-047).</div>
        </div>
        <div className="page-meta">
          <select className="console-input inline-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {proposals.length === 0 && <div className="muted-note">No proposals.</div>}
      {proposals.map((p) => (
        <div className="panel" key={p.id}>
          <div className="panel-head">
            <span>&#9635; SUB #{p.subdivisionId} — {p.user?.email ?? "?"} — {new Date(p.createdAt).toLocaleString()}</span>
            <span className="panel-head-actions">
              <span className={`badge ${p.status === "APPROVED" ? "badge-green" : p.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>{p.status}</span>
              {p.status === "PENDING" && <button className="btn btn-sm" onClick={() => setOpenId(openId === p.id ? null : p.id)}>{openId === p.id ? "CLOSE" : "ADJUDICATE"}</button>}
            </span>
          </div>
          <div className="panel-body">
            <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{p.proposalText}</div>
            {p.adminResponse && <div className="muted-note" style={{ marginTop: 8 }}>Ruling: {p.adminResponse}</div>}
          </div>
          {openId === p.id && p.status === "PENDING" && <ResolveForm proposal={p} onDone={() => { setOpenId(null); load(); }} />}
        </div>
      ))}
    </div>
  );
}
