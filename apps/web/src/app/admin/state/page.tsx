"use client";

import { useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { api } from "@/lib/client/api";
import { StateEditBuilder, type StateEdit } from "@/lib/client/StateEditBuilder";
import { ConfirmButton } from "@/lib/client/Confirm";

export default function StateEditorPage() {
  const { gameId, subdivisions } = useAdmin();
  const [edits, setEdits] = useState<StateEdit[]>([]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ applied: string[]; warnings: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    if (edits.length === 0) return;
    setErr(null); setResult(null);
    try {
      const r = await api.post<{ applied: string[]; warnings: string[] }>(`/api/admin/games/${gameId}/state-edit`, { edits, note: note || undefined });
      setResult(r);
      setEdits([]); setNote("");
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">STATE EDITOR</div>
          <div className="page-subtitle">Direct structured edits to the live game snapshot for game #{gameId} (D-046).</div>
        </div>
      </div>

      <div className="help-box">
        <span className="help-title">WHAT THIS IS</span>
        Every edit here writes directly to the authoritative game state and is recorded in the <strong>audit log</strong> with a full before/after snapshot. You only author <strong>data</strong> (resource numbers, Earth Relations, disable flags, hex ownership, effects) — the engine derives all downstream consequences on the next resolution. Pick an operation, fill its fields, add it to the queue, then apply. Hover any field for a hint.
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
          <StateEditBuilder edits={edits} onChange={setEdits} subdivisions={subdivisions} />
          <label className="field" style={{ marginTop: 14 }}>
            <span className="field-label">Audit note (recommended)</span>
            <input className="console-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for this edit…" />
          </label>
          <ConfirmButton
            className="btn btn-primary"
            disabled={edits.length === 0}
            title="Apply state edits?"
            confirmLabel={`APPLY ${edits.length} EDIT(S)`}
            confirmClass="btn-primary"
            danger={false}
            message={<>This writes <strong>{edits.length} edit(s)</strong> directly to the live game state for game #{gameId}. It is audited but cannot be automatically undone — you would have to author a compensating edit. Continue?</>}
            onConfirm={apply}
          >
            APPLY {edits.length} EDIT(S)
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
