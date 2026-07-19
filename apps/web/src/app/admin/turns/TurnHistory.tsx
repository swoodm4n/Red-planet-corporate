"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useAdmin } from "@/lib/client/adminContext";
import { eventScopeTone, type TurnIndexResponse, type TurnIndexRow } from "./turnLog";

/**
 * Resolved-turn history table. Embedded on the Turn Control page and links to the
 * per-turn detail view at /admin/turns/[turnNumber]. Uses only the fields the
 * index endpoint (GET /api/games/:id/turns) actually returns — the full per-phase
 * log lives on the detail endpoint, so no invalid-order count is available here.
 */
export function TurnHistory() {
  const { gameId } = useAdmin();
  const [rows, setRows] = useState<TurnIndexRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setErr(null);
    api
      .get<TurnIndexResponse>(`/api/games/${gameId}/turns`)
      .then((r) => setRows([...r.turns].sort((a, b) => b.turnNumber - a.turnNumber)))
      .catch((e) => setErr((e as Error).message));
  }, [gameId]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span>
          <img src="/icons/status-turn-timer.png" alt="" width={14} height={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          RESOLVED TURNS
        </span>
        <span className="td-dim" style={{ fontSize: 11 }}>{rows ? `${rows.length} logged` : ""}</span>
      </div>
      <div className="panel-body tight">
        {err && <div className="error-box">{err}</div>}
        {!rows && !err && <div className="muted-note">Loading turn history…</div>}
        {rows && rows.length === 0 && (
          <div className="muted-note">No turns have resolved yet. Force-resolve the current turn above to write the first log.</div>
        )}
        {rows && rows.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>TURN</th>
                  <th>RESOLVED AT</th>
                  <th>EVENT</th>
                  <th>LEADER</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const leader = t.scoreboardJson?.scoreboard?.find((s) => s.rank === 1);
                  return (
                    <tr key={t.turnNumber}>
                      <td className="td-num">#{t.turnNumber}</td>
                      <td className="td-dim">{new Date(t.createdAt).toLocaleString()}</td>
                      <td>
                        {t.eventJson && t.eventJson.scope !== "NONE" ? (
                          <>
                            <span className={`badge ${eventScopeTone(t.eventJson.scope)}`}>{t.eventJson.scope}</span>{" "}
                            <span>{t.eventJson.name}</span>
                          </>
                        ) : (
                          <span className="td-dim">— quiet turn —</span>
                        )}
                      </td>
                      <td className="td-dim">{leader ? `Sub #${leader.subdivisionId}` : "—"}</td>
                      <td>
                        <Link className="btn btn-ghost btn-sm" href={`/admin/turns/${t.turnNumber}`}>
                          VIEW LOG ▸
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
