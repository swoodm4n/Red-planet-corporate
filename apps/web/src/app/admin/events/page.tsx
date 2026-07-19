"use client";

import { useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { api } from "@/lib/client/api";
import { StateEditBuilder, type StateEdit } from "@/lib/client/StateEditBuilder";
import { ConfirmButton } from "@/lib/client/Confirm";

// Canonical events (GAME_SPEC §17) expressed as the structured effects they
// produce. Selecting one pre-fills the builder; the GM can then tweak scope,
// magnitude, target subdivision, etc. before triggering. Display-only convenience.
const PRESETS: { key: string; name: string; note: string; edits: StateEdit[] }[] = [
  {
    key: "dust_storm", name: "Dust Storm Season", note: "-1 output to unshielded buildings, colony-wide, for 2 turns.",
    edits: [{ op: "REGISTER_EFFECT", effectType: "OUTPUT_DELTA", scope: "COLONY", source: "Dust Storm Season", turnsRemaining: 2, magnitude: -1, requiresUnshielded: true }],
  },
  {
    key: "solar_flare", name: "Solar Flare", note: "No Intelligence actions colony-wide this turn.",
    edits: [{ op: "REGISTER_EFFECT", effectType: "NO_INTELLIGENCE", scope: "COLONY", source: "Solar Flare", turnsRemaining: 1 }],
  },
  {
    key: "seismic", name: "Seismic Event", note: "-1 output to region buildings without Redundant Systems, 1 turn.",
    edits: [{ op: "REGISTER_EFFECT", effectType: "OUTPUT_DELTA", scope: "REGION", source: "Seismic Event", turnsRemaining: 1, magnitude: -1, requiresNoRedundant: true }],
  },
  {
    key: "equipment_recall", name: "Equipment Recall", note: "One module type runs at half effect this turn (pick the module below).",
    edits: [{ op: "REGISTER_EFFECT", effectType: "MODULE_HALF_EFFECT", scope: "COLONY", source: "Equipment Recall", turnsRemaining: 1, moduleType: "EFFICIENCY" }],
  },
  {
    key: "ice_shift", name: "Ice Deposit Shift", note: "Region Water Terrain Exploit suspended for 1 turn.",
    edits: [{ op: "REGISTER_EFFECT", effectType: "TERRAIN_EXPLOIT_SUSPEND", scope: "REGION", source: "Ice Deposit Shift", turnsRemaining: 1 }],
  },
  {
    key: "surplus", name: "Surplus Shipment", note: "+5 of one resource to a chosen subdivision (set the subdivision & resource).",
    edits: [{ op: "ADD_RESOURCE", subdivisionId: 0, resource: "MINERALS", amount: 5 }],
  },
];

export default function EventsPage() {
  const { gameId, subdivisions } = useAdmin();
  const [name, setName] = useState("");
  const [edits, setEdits] = useState<StateEdit[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function applyPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setName(p.name);
    setEdits(p.edits.map((e) => ({ ...e })));
    setNote(p.note);
    setMsg(null); setErr(null);
  }

  async function trigger() {
    if (!name || edits.length === 0) { setErr("Provide an event name and at least one structured effect."); return; }
    setErr(null); setMsg(null);
    const r = await api.post<{ applied?: string[] }>(`/api/admin/games/${gameId}/events`, { name, edits, note: note || undefined });
    setMsg(`Event "${name}" applied (${r.applied?.length ?? 0} effect(s)). It resolves on the next turn.`);
    setEdits([]); setName(""); setNote("");
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">MANUAL EVENTS</div>
          <div className="page-subtitle">Trigger any event as one or more structured effects for game #{gameId}. There is no free-text execution (D-046).</div>
        </div>
      </div>

      <div className="help-box">
        <span className="help-title">HOW THIS WORKS</span>
        A manual event is just the structured edit(s) that event would produce, applied to the engine snapshot and resolved by the engine <strong>on the next turn</strong>. Start from a preset below, adjust the scope / magnitude / target subdivision, then trigger. Example: a Dust Storm is <code>Register active effect · OUTPUT_DELTA · COLONY · −1 · only unshielded · 2 turns</code>.
      </div>

      {err && <div className="error-box">{err}</div>}
      {msg && <div className="ok-box">{msg}</div>}

      <div className="panel">
        <div className="panel-head"><span>&#9635; START FROM A CANONICAL EVENT (OPTIONAL)</span></div>
        <div className="panel-body">
          <div className="btn-row" style={{ flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button key={p.key} className="btn btn-sm btn-ghost" title={p.note} onClick={() => applyPreset(p.key)}>{p.name}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><span>&#9635; EVENT DEFINITION</span></div>
        <div className="panel-body">
          <label className="field">
            <span className="field-label">Event name (shown to players)</span>
            <input className="console-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dust Storm Season" />
          </label>
          <span className="field-label">Structured effects</span>
          <StateEditBuilder edits={edits} onChange={setEdits} subdivisions={subdivisions} />
          <label className="field" style={{ marginTop: 14 }}>
            <span className="field-label">Audit note (optional)</span>
            <input className="console-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you are firing this event…" />
          </label>
          <ConfirmButton
            className="btn btn-primary"
            disabled={!name || edits.length === 0}
            title="Trigger manual event?"
            danger={false}
            confirmLabel="TRIGGER EVENT"
            confirmClass="btn-primary"
            message={<>This applies <strong>{edits.length} effect(s)</strong> under the event name <strong>&quot;{name}&quot;</strong> to the live snapshot. Players will see the event, and its effects resolve on the next turn. This is recorded in the audit log.</>}
            onConfirm={trigger}
          >
            TRIGGER EVENT
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
