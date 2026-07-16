"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";

interface Proposal {
  id: string;
  proposalText: string;
  status: string;
  adminResponse: string | null;
  grantedEffectsJson: unknown;
  createdAt: string;
  resolvedAt: string | null;
}

export default function ResearchPage() {
  const { gameId, subdivisionId } = usePlayer();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api.get<{ proposals: Proposal[] }>(`/api/games/${gameId}/research-proposals`).then((r) => setProposals(r.proposals)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (subdivisionId == null) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, subdivisionId]);

  if (subdivisionId == null) {
    return (
      <div className="page">
        <div className="page-header"><div><div className="page-title">RESEARCH ADJUDICATION</div></div></div>
        <div className="muted-note amber">No assigned subdivision — you cannot file research proposals.</div>
      </div>
    );
  }

  if (error) return <ErrorMsg error={error} />;
  if (!proposals) return <Loading label="LOADING RESEARCH" />;

  async function submit() {
    if (text.trim().length < 3) return;
    setBusy(true); setMsg(null);
    try {
      await api.post(`/api/games/${gameId}/research-proposals`, { proposalText: text });
      setText("");
      setMsg("Proposal filed. A game master will adjudicate it and grant structured effects on approval.");
      load();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">RESEARCH ADJUDICATION</div>
          <div className="page-subtitle">Propose a freeform research effect in plain text. The game master rules on it and grants structured effects (§10.3, D-047).</div>
        </div>
      </div>

      {msg && <div className="ok-box">{msg}</div>}

      <div className="panel">
        <div className="panel-head"><span>&#9635; NEW PROPOSAL</span></div>
        <div className="panel-body">
          <textarea className="console-input" placeholder="Describe the research effect you want to pursue (e.g. 'Extraction Site Boost Output yields +3 instead of +2')…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || text.trim().length < 3} onClick={submit}>SUBMIT PROPOSAL</button>
        </div>
      </div>

      <div className="section-label">YOUR PROPOSALS</div>
      {proposals.length === 0 && <div className="muted-note">No proposals filed yet.</div>}
      {proposals.map((p) => (
        <div className="panel" key={p.id}>
          <div className="panel-head">
            <span>&#9635; {new Date(p.createdAt).toLocaleString()}</span>
            <span className="panel-head-actions">
              <span className={`badge ${p.status === "APPROVED" ? "badge-green" : p.status === "REJECTED" ? "badge-red" : "badge-amber"}`}>{p.status}</span>
            </span>
          </div>
          <div className="panel-body">
            <div style={{ fontSize: 12, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{p.proposalText}</div>
            {p.adminResponse && (
              <div className="muted-note" style={{ marginTop: 10 }}>GM ruling: {p.adminResponse}</div>
            )}
            {p.status === "APPROVED" && p.grantedEffectsJson != null && (
              <pre style={{ marginTop: 10, fontSize: 10, color: "var(--cyan)", overflowX: "auto" }}>{JSON.stringify(p.grantedEffectsJson, null, 2)}</pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
