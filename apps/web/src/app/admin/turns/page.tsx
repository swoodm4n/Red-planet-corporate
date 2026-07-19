"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { api } from "@/lib/client/api";
import type { GameSummary } from "@/lib/client/types";
import { countdown } from "@/lib/client/labels";
import { ConfirmButton } from "@/lib/client/Confirm";

export default function TurnControlPage() {
  const { gameId, games, refresh } = useAdmin();
  const [game, setGame] = useState<GameSummary | undefined>(games.find((g) => g.id === gameId));
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [turnLength, setTurnLength] = useState<number>(game?.turnLengthHours ?? 96);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setGame(games.find((g) => g.id === gameId)); }, [games, gameId]);

  async function reloadGame() {
    const { games } = await api.get<{ games: GameSummary[] }>("/api/games");
    setGame(games.find((g) => g.id === gameId));
    refresh();
  }

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true); setMsg(null); setErr(null);
    try { await fn(); setMsg(okMsg); await reloadGame(); }
    catch (e) { setErr((e as Error).message); throw e; }
    finally { setBusy(false); }
  }

  const paused = game?.status === "PAUSED";
  const completed = game?.status === "COMPLETED";
  const closes = countdown(game?.turnDeadline ?? null);
  const statusClass = paused ? "paused" : completed ? "completed" : closes === "OVERDUE" ? "overdue" : "active";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">TURN CONTROL</div>
          <div className="page-subtitle">Resolve, pause, resume, and re-time turns for game #{gameId}.</div>
        </div>
        <div className="page-meta"><span className={`status-dot ${statusClass}`} />Turn {game?.turnNumber} // {game?.status}</div>
      </div>

      {msg && <div className="ok-box">{msg}</div>}
      {err && <div className="error-box">{err}</div>}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><span>&#9635; CURRENT STATE</span></div>
          <div className="panel-body">
            <div className="detail-row"><span className="detail-label">Current turn</span><span className="detail-value">{game?.turnNumber}</span></div>
            <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className={`status-dot ${statusClass}`} />{game?.status}</span></div>
            <div className="detail-row"><span className="detail-label">Turn length</span><span className="detail-value">{game?.turnLengthHours} h</span></div>
            <div className="detail-row"><span className="detail-label">Deadline</span><span className="detail-value">{game?.turnDeadline ? new Date(game.turnDeadline).toLocaleString() : "—"}</span></div>
            <div className="detail-row"><span className="detail-label">Closes in</span><span className="detail-value" style={{ color: closes === "OVERDUE" ? "var(--amber)" : undefined }}>{paused ? "PAUSED" : closes}</span></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span>&#9635; RESOLUTION CONTROLS</span></div>
          <div className="panel-body">
            {paused && <div className="muted-note amber">This game is PAUSED — automatic resolution is suspended until you resume.</div>}

            <div className="section-label">RESOLVE NOW</div>
            <ConfirmButton
              className="btn btn-danger"
              disabled={busy || completed}
              title="Force-resolve this turn now?"
              confirmLabel="RESOLVE TURN NOW"
              message={<>This immediately runs the engine&apos;s eight-phase resolution for <strong>turn {game?.turnNumber}</strong> of game #{gameId}, <strong>regardless of the deadline</strong> and even if some players have not submitted (unsubmitted slots hold their last garrison, no new actions).</>}
              warn={<>This is <strong>irreversible</strong>: it writes an immutable turn log and advances to the next turn. It cannot be undone.</>}
              onConfirm={() => act(() => api.post(`/api/admin/games/${gameId}/process-turn`), "Turn resolved. Advanced to the next turn.")}
            >
              FORCE-RESOLVE TURN NOW
            </ConfirmButton>
            <div className="field-hint">Normally the scheduler resolves turns automatically at the deadline. Use this only to resolve early.</div>

            <div className="section-label">PAUSE / RESUME</div>
            <div className="btn-row">
              <button className="btn" disabled={busy || paused || completed} onClick={() => act(() => api.post(`/api/admin/games/${gameId}/pause`), "Game paused. Automatic resolution suspended.")}>
                {paused ? "ALREADY PAUSED" : "PAUSE GAME"}
              </button>
              <button className="btn btn-primary" disabled={busy || !paused} onClick={() => act(() => api.post(`/api/admin/games/${gameId}/resume`, { resetDeadline: true }), "Game resumed and deadline reset from now.")}>
                RESUME (RESET DEADLINE)
              </button>
            </div>
            <div className="field-hint">Pausing stops the auto-resolver. Resuming restarts it and resets the deadline to a fresh turn length from now.</div>

            <div className="section-label">TIMER</div>
            <div className="btn-row" style={{ alignItems: "flex-end" }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label">Turn length (hours)</span>
                <input className="console-input inline-input" style={{ width: 100 }} type="number" min={1} max={720} value={turnLength} onChange={(e) => setTurnLength(Number(e.target.value))} />
              </label>
              <button className="btn" disabled={busy} onClick={() => act(() => api.patch(`/api/admin/games/${gameId}/config`, { turnLengthHours: turnLength }), "Turn length updated (applies to future deadlines).")}>SET LENGTH</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.patch(`/api/admin/games/${gameId}/config`, { resetDeadline: true }), "Deadline reset from now.")}>RESET DEADLINE FROM NOW</button>
            </div>
            <div className="field-hint">&quot;Set length&quot; changes the window for upcoming turns. &quot;Reset deadline&quot; restarts the current turn&apos;s clock from now.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
