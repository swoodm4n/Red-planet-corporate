"use client";

import { useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { api } from "@/lib/client/api";
import { StateEditBuilder, type StateEdit } from "@/lib/client/StateEditBuilder";

export default function EventsPage() {
  const { gameId } = useAdmin();
  const [name, setName] = useState("");
  const [edits, setEdits] = useState<StateEdit[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function trigger() {
    if (!name || edits.length === 0) { setErr("Provide an event name and at least one structured edit."); return; }
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await api.post<{ applied?: string[] }>(`/api/admin/games/${gameId}/events`, { name, edits, note: note || undefined });
      setMsg(`Event "${name}" applied (${r.applied?.length ?? 0} edits). It resolves on the next turn.`);
      setEdits([]); setName("");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">MANUAL EVENTS</div>
          <div className="page-subtitle">Trigger any event as one or more structured effects (D-046). No free-text execution.</div>
        </div>
      </div>

      {err && <div className="error-box">{err}</div>}
      {msg && <div className="ok-box">{msg}</div>}

      <div className="panel">
        <div className="panel-head"><span>&#9635; EVENT DEFINITION</span></div>
        <div className="panel-body">
          <label className="field">
            <span className="field-label">Event name</span>
            <input className="console-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dust Storm Season" />
          </label>
          <span className="field-label">Structured effects</span>
          <StateEditBuilder edits={edits} onChange={setEdits} />
          <label className="field" style={{ marginTop: 14 }}>
            <span className="field-label">Note</span>
            <input className="console-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={busy || !name || edits.length === 0} onClick={trigger}>TRIGGER EVENT</button>
        </div>
      </div>
    </div>
  );
}
