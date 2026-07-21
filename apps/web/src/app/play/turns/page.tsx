"use client";

import { useEffect, useState } from "react";
import { usePlayer } from "@/lib/client/gameContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import type { EngineEvent } from "@/lib/client/types";
import { titleCase } from "@/lib/client/labels";
import { Icon } from "@/lib/client/Icon";

interface TurnIndexRow {
  turnNumber: number;
  eventJson: EngineEvent | null;
  scoreboardJson: { subdivisionId: number; composite: number; rank: number }[] | null;
  createdAt: string;
}

interface TurnDetail {
  turnNumber: number;
  event: EngineEvent | null;
  scoreboard: { subdivisionId: number; categories: Record<string, number>; composite: number; rank: number }[] | null;
}

export default function TurnsPage() {
  const { gameId, subdivisionId } = usePlayer();
  const [turns, setTurns] = useState<TurnIndexRow[] | null>(null);
  const [sel, setSel] = useState<TurnDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ turns: TurnIndexRow[] }>(`/api/games/${gameId}/turns`).then((r) => setTurns(r.turns)).catch((e) => setError(e.message));
  }, [gameId]);

  async function openTurn(n: number) {
    const d = await api.get<TurnDetail>(`/api/games/${gameId}/turns/${n}`);
    setSel(d);
  }

  if (error) return <ErrorMsg error={error} />;
  if (!turns) return <Loading label="LOADING TURN LOG" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">TURN LOG</div>
          <div className="page-subtitle">Resolved turns: event of record + public scoreboard. Full per-order logs are admin-only (§18).</div>
        </div>
        <div className="page-meta">{turns.length} resolved turns</div>
      </div>

      <div className="grid-sidebar">
        <div className="panel">
          <div className="panel-head"><span>&#9635; TURNS</span></div>
          <div className="panel-body tight">
            <div className="table-scroll">
              <table>
                <thead><tr><th>TURN</th><th>EVENT</th></tr></thead>
                <tbody>
                  {turns.slice().reverse().map((t) => (
                    <tr key={t.turnNumber} onClick={() => openTurn(t.turnNumber)} style={{ cursor: "pointer" }}>
                      <td>T{t.turnNumber}</td>
                      <td className="td-dim">
                        {t.eventJson && t.eventJson.scope !== "NONE"
                          ? <span className="icon-label"><Icon name="status-alert" alt="" size={14} />{t.eventJson.name}</span>
                          : (t.eventJson?.name ?? "—")}
                      </td>
                    </tr>
                  ))}
                  {turns.length === 0 && <tr><td colSpan={2} className="td-dim">No turns resolved yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span>&#9635; TURN DETAIL {sel ? `— T${sel.turnNumber}` : ""}</span></div>
          <div className="panel-body">
            {!sel ? (
              <div className="muted-note" style={{ margin: 0 }}>Select a turn.</div>
            ) : (
              <>
                <div className="section-label">EVENT</div>
                <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{sel.event?.name ?? "No event"}</span></div>
                <div className="detail-row"><span className="detail-label">Scope</span><span className="detail-value">{sel.event?.scope ?? "NONE"}</span></div>
                {sel.event?.message && <div className="muted-note">{sel.event.message}</div>}

                <div className="section-label">SCOREBOARD</div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>RANK</th><th>SUBDIV</th><th className="td-num">COMPOSITE</th></tr></thead>
                    <tbody>
                      {(sel.scoreboard ?? []).slice().sort((a, b) => a.rank - b.rank).map((s) => (
                        <tr key={s.subdivisionId} className={s.subdivisionId === subdivisionId ? "you-row" : ""}>
                          <td>{s.rank}</td>
                          <td>#{s.subdivisionId}{s.subdivisionId === subdivisionId ? " (you)" : ""}</td>
                          <td className="td-num">{s.composite}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sel.scoreboard && subdivisionId != null && (() => {
                  const mine = sel.scoreboard.find((s) => s.subdivisionId === subdivisionId);
                  if (!mine?.categories) return null;
                  return (
                    <>
                      <div className="section-label">YOUR CATEGORIES</div>
                      {Object.entries(mine.categories).map(([k, v]) => (
                        <div className="detail-row" key={k}><span className="detail-label">{titleCase(k)}</span><span className="detail-value">{v}</span></div>
                      ))}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
