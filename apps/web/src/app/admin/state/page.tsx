"use client";

import { useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { api } from "@/lib/client/api";
import { StateEditBuilder, type StateEdit } from "@/lib/client/StateEditBuilder";

export default function StateEditorPage() {
  const { gameId } = useAdmin();
  const [edits, setEdits] = useState<StateEdit[]>([]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ applied: string[]; warnings: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (edits.length === 0) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await api.post<{ applied: string[]; warnings: string[] }>(`/api/admin/games/${gameId}/state-edit`, { edits, note: note || undefined });
      setResult(r);
      setEdits([]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">STATE EDITOR</div>
          <div className="page-subtitle">Direct structured edits (audited, before/after). The engine derives all consequences (D-046).</div>
        </div>
      </div>

      {err && <div className="error-box">{err}</div>}
      {result && (
        <div className="ok-box">
          Applied {result.applied.length} edit(s).
          {result.applied.map((a, i) => <div key={i} style={{ fontSize: 11 }}>{a}</div>)}
          {result.warnings.length > 0 && <div style={{ color: "var(--amber)", marginTop: 6 }}>Warnings: {result.warnings.join("; ")}</div>}
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><span>&#9635; COMPOSE EDITS</span></div>
        <div className="panel-body">
          <StateEditBuilder edits={edits} onChange={setEdits} />
          <label className="field" style={{ marginTop: 14 }}>
            <span className="field-label">Audit note</span>
            <input className="console-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for this edit…" />
          </label>
          <button className="btn btn-primary" disabled={busy || edits.length === 0} onClick={apply}>APPLY {edits.length} EDIT(S)</button>
        </div>
      </div>
    </div>
  );
}
