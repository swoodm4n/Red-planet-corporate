"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { api } from "@/lib/client/api";
import type { GameSummary } from "@/lib/client/types";
import { countdown } from "@/lib/client/labels";

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
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">TURN CONTROL</div>
          <div className="page-subtitle">Force / pause / resume resolution and adjust the timer for game #{gameId}.</div>
        </div>
        <div className="page-meta">{game && `Turn ${game.turnNumber} // ${game.status}`}</div>
      </div>

      {msg && <div className="ok-box">{msg}</div>}
      {err && <div className="error-box">{err}</div>}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><span>&#9635; STATE</span></div>
          <div className="panel-body">
            <div className="detail-row"><span className="detail-label">Current turn</span><span className="detail-value">{game?.turnNumber}</span></div>
            <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value">{game?.status}</span></div>
            <div className="detail-row"><span className="detail-label">Turn length</span><span className="detail-value">{game?.turnLengthHours} h</span></div>
            <div className="detail-row"><span className="detail-label">Deadline</span><span className="detail-value">{game?.turnDeadline ? new Date(game.turnDeadline).toLocaleString() : "—"}</span></div>
            <div className="detail-row"><span className="detail-label">Closes in</span><span className="detail-value">{countdown(game?.turnDeadline ?? null)}</span></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span>&#9635; RESOLUTION CONTROLS</span></div>
          <div className="panel-body">
            <div className="btn-row" style={{ marginBottom: 12 }}>
              <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.post(`/api/admin/games/${gameId}/process-turn`), "Turn resolved.")}>FORCE PROCESS TURN</button>
              <button className="btn" disabled={busy} onClick={() => act(() => api.post(`/api/admin/games/${gameId}/pause`), "Game paused.")}>PAUSE</button>
              <button className="btn" disabled={busy} onClick={() => act(() => api.post(`/api/admin/games/${gameId}/resume`, { resetDeadline: true }), "Game resumed, deadline reset.")}>RESUME + RESET</button>
            </div>

            <div className="section-label">TIMER</div>
            <div className="btn-row" style={{ alignItems: "flex-end" }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-label">Turn length (hours)</span>
                <input className="console-input inline-input" style={{ width: 100 }} type="number" min={1} max={720} value={turnLength} onChange={(e) => setTurnLength(Number(e.target.value))} />
              </label>
              <button className="btn" disabled={busy} onClick={() => act(() => api.patch(`/api/admin/games/${gameId}/config`, { turnLengthHours: turnLength }), "Turn length updated.")}>SET LENGTH</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.patch(`/api/admin/games/${gameId}/config`, { resetDeadline: true }), "Deadline reset from now.")}>RESET DEADLINE</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
