"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import { StateEditBuilder, type StateEdit } from "@/lib/client/StateEditBuilder";
import { ConfirmButton } from "@/lib/client/Confirm";
import type { SubdivisionSlot } from "@/lib/client/types";

interface Proposal {
  id: string;
  subdivisionId: number;
  proposalText: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  user?: { id: string; email: string } | null;
}

function ResolveForm({ proposal, subdivisions, onDone }: { proposal: Proposal; subdivisions: SubdivisionSlot[] | null; onDone: () => void }) {
  const [response, setResponse] = useState("");
  const [effects, setEffects] = useState<StateEdit[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function resolve(status: "APPROVED" | "REJECTED") {
    setErr(null);
    try {
      await api.post(`/api/admin/research-proposals/${proposal.id}/resolve`, {
        status,
        adminResponse: response || undefined,
        grantedEffects: status === "APPROVED" ? effects : undefined,
      });
      onDone();
    } catch (e) { setErr((e as Error).message); throw e; }
  }

  return (
    <div className="panel-body" style={{ borderTop: "1px solid var(--border-dim)" }}>
      {err && <div className="error-box">{err}</div>}
      <div className="help-box">
        The player&apos;s proposal text is <strong>never executed</strong>. If you approve, only the structured effects you attach below take effect — applied through the audited edit pipeline (D-047). Approve with an empty effect list to acknowledge a proposal that grants nothing mechanical.
      </div>
      <label className="field">
        <span className="field-label">GM ruling / response (shown to the player)</span>
        <textarea className="console-input" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Explain your decision…" />
      </label>
      <span className="field-label">Granted structured effects (applied only on approval)</span>
      <StateEditBuilder edits={effects} onChange={setEffects} subdivisions={subdivisions} />
      <div className="btn-row" style={{ marginTop: 12 }}>
        <ConfirmButton
          className="btn btn-primary" danger={false} confirmClass="btn-primary"
          title="Approve research proposal?"
          confirmLabel="APPROVE + GRANT"
          message={<>Approve this proposal and apply <strong>{effects.length} granted effect(s)</strong>. This is recorded in the audit log.</>}
          onConfirm={() => resolve("APPROVED")}
        >APPROVE + GRANT</ConfirmButton>
        <ConfirmButton
          className="btn btn-danger"
          title="Reject research proposal?"
          confirmLabel="REJECT PROPOSAL"
          message={<>Reject this proposal. No effects are applied. The player sees your ruling if you wrote one.</>}
          onConfirm={() => resolve("REJECTED")}
        >REJECT</ConfirmButton>
      </div>
    </div>
  );
}

export default function AdminResearchPage() {
  const { gameId, subdivisions } = useAdmin();
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

      {proposals.length === 0 && (
        <div className="panel"><div className="panel-body" style={{ textAlign: "center", color: "var(--text-tertiary)", padding: 32 }}>
          No {status === "ALL" ? "" : status.toLowerCase() + " "}research proposals. Players submit freeform research ideas from their own report; they will appear here for you to rule on.
        </div></div>
      )}
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
          {openId === p.id && p.status === "PENDING" && <ResolveForm proposal={p} subdivisions={subdivisions} onDone={() => { setOpenId(null); load(); }} />}
        </div>
      ))}
    </div>
  );
}
