"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { useAdmin } from "@/lib/client/adminContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { titleCase } from "@/lib/client/labels";
import {
  CATEGORY_ORDER,
  codeLabel,
  codeTone,
  eventScopeTone,
  groupByPhase,
  PHASE_META,
  type LogEntry,
  type ScoreboardRow,
  type TurnDetailResponse,
} from "../turnLog";

/** Compact one-line rendering of an entry's structured `data` payload. */
function DataInline({ data }: { data?: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  if (!data || Object.keys(data).length === 0) return <span className="td-dim">—</span>;
  const entries = Object.entries(data);
  const simple = entries.filter(([, v]) => v === null || typeof v !== "object");
  const complex = entries.filter(([, v]) => v !== null && typeof v === "object");
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {simple.map(([k, v]) => (
        <span key={k} className="pill">
          <span className="td-dim">{titleCase(k)}</span>&nbsp;
          <strong>{String(v)}</strong>
        </span>
      ))}
      {complex.length > 0 && (
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
            {open ? "▾ hide" : `▸ ${complex.length} more`}
          </button>
          {open && (
            <pre style={{ flexBasis: "100%", fontSize: 10, color: "var(--text-secondary)", margin: "4px 0 0", overflowX: "auto" }}>
              {JSON.stringify(Object.fromEntries(complex), null, 2)}
            </pre>
          )}
        </>
      )}
    </span>
  );
}

export default function TurnDetailPage() {
  const params = useParams<{ turnNumber: string }>();
  const turnNumber = Number(params.turnNumber);
  const { gameId, subdivisions } = useAdmin();
  const [data, setData] = useState<TurnDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subName = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of subdivisions ?? []) map.set(s.subdivisionId, s.name);
    return (id?: number) => (id == null ? "Colony" : map.get(id) ?? `Sub #${id}`);
  }, [subdivisions]);

  useEffect(() => {
    if (!Number.isInteger(turnNumber)) {
      setError("Invalid turn number");
      return;
    }
    setData(null);
    setError(null);
    api
      .get<TurnDetailResponse>(`/api/games/${gameId}/turns/${turnNumber}`)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [gameId, turnNumber]);

  if (error) return <ErrorMsg error={error} />;
  if (!data) return <Loading label={`LOADING TURN ${turnNumber} LOG`} />;

  const log = data.log;
  const phases = groupByPhase(log.entries ?? []);
  const invalid = log.invalidOrders ?? [];
  const event = data.event ?? log.event ?? null;
  const scoreboard: ScoreboardRow[] = data.scoreboard?.scoreboard ?? log.scoreboard ?? [];
  const leaders = data.scoreboard?.categoryLeaders ?? log.categoryLeaders ?? {};
  const rankedBoard = [...scoreboard].sort((a, b) => a.rank - b.rank);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">TURN {turnNumber} — RESOLUTION LOG</div>
          <div className="page-subtitle">
            Immutable per-phase record for game #{gameId}. {log.entries?.length ?? 0} log lines · {invalid.length} invalid order(s).
          </div>
        </div>
        <div className="page-meta">
          <Link className="btn btn-ghost btn-sm" href="/admin/turns">◂ TURN CONTROL</Link>
        </div>
      </div>

      {/* Prev / next turn navigation */}
      <div className="btn-row" style={{ marginBottom: 14 }}>
        {turnNumber > 1 ? (
          <Link className="btn btn-ghost btn-sm" href={`/admin/turns/${turnNumber - 1}`}>◂ TURN {turnNumber - 1}</Link>
        ) : (
          <button className="btn btn-ghost btn-sm" disabled>◂ TURN {turnNumber - 1}</button>
        )}
        <Link className="btn btn-ghost btn-sm" href={`/admin/turns/${turnNumber + 1}`}>TURN {turnNumber + 1} ▸</Link>
      </div>

      {/* ---- Event ---- */}
      <div className="panel">
        <div className="panel-head"><span>&#9635; EVENT</span></div>
        <div className="panel-body">
          {event && event.scope !== "NONE" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span className={`badge ${eventScopeTone(event.scope)}`}>{event.scope}</span>
                <strong style={{ fontSize: 15 }}>{event.name}</strong>
              </div>
              <div className="muted-note">{event.message}</div>
              {event.affectedSubdivisionIds?.length > 0 && (
                <div className="detail-row" style={{ marginTop: 8 }}>
                  <span className="detail-label">Affected</span>
                  <span className="detail-value">{event.affectedSubdivisionIds.map(subName).join(", ")}</span>
                </div>
              )}
            </>
          ) : (
            <div className="muted-note">No event fired this turn.</div>
          )}
        </div>
      </div>

      {/* ---- Invalid orders ---- */}
      {invalid.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span>
              <img src="/icons/status-alert.png" alt="" width={14} height={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              REJECTED ORDERS ({invalid.length})
            </span>
          </div>
          <div className="panel-body tight">
            <div className="table-scroll">
              <table>
                <thead><tr><th>SUBDIVISION</th><th>KIND</th><th>REASON</th><th>ORDER</th></tr></thead>
                <tbody>
                  {invalid.map((io, i) => (
                    <InvalidRow key={i} subName={subName(io.subdivisionId)} kind={io.kind} reason={io.reason} order={io.order} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- Per-phase log ---- */}
      {phases.length === 0 && (
        <div className="panel"><div className="panel-body"><div className="muted-note">No log entries were recorded for this turn.</div></div></div>
      )}
      {phases.map(({ phase, entries }) => {
        const meta = PHASE_META[phase];
        return (
          <div className="panel" key={phase}>
            <div className="panel-head">
              <span>&#9635; PHASE {phase} — {meta?.title.toUpperCase() ?? "OTHER"}</span>
              <span className="td-dim" style={{ fontSize: 11 }}>{entries.length} line(s)</span>
            </div>
            <div className="panel-body tight">
              {meta?.blurb && <div className="section-label" style={{ marginBottom: 6 }}>{meta.blurb}</div>}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 150 }}>SUBDIVISION</th>
                      <th style={{ width: 200 }}>EVENT</th>
                      <th>DETAIL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e: LogEntry, i) => (
                      <tr key={i}>
                        <td className="td-dim">{e.subdivisionId == null ? <em>Colony</em> : subName(e.subdivisionId)}</td>
                        <td><span className={`badge ${codeTone(e.code)}`}>{codeLabel(e.code)}</span></td>
                        <td>
                          <div>{e.message}</div>
                          {e.data && Object.keys(e.data).length > 0 && (
                            <div style={{ marginTop: 4 }}><DataInline data={e.data} /></div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}

      {/* ---- Scoreboard ---- */}
      <div className="panel">
        <div className="panel-head"><span>&#9635; END-OF-TURN SCOREBOARD</span></div>
        <div className="panel-body tight">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>RANK</th>
                  <th>SUBDIVISION</th>
                  {CATEGORY_ORDER.map((c) => <th key={c} className="td-num">{c.slice(0, 4).toUpperCase()}</th>)}
                  <th className="td-num">COMPOSITE</th>
                </tr>
              </thead>
              <tbody>
                {rankedBoard.map((row) => (
                  <tr key={row.subdivisionId}>
                    <td className="td-num"><strong>{row.rank}</strong></td>
                    <td>{subName(row.subdivisionId)}</td>
                    {CATEGORY_ORDER.map((c) => {
                      const isLeader = leaders[c] === row.subdivisionId;
                      return (
                        <td key={c} className="td-num" style={isLeader ? { color: "var(--cyan)", fontWeight: 700 } : undefined}>
                          {fmtScore(row.categories?.[c])}
                          {isLeader && <span title="category leader"> ★</span>}
                        </td>
                      );
                    })}
                    <td className="td-num"><strong>{fmtScore(row.composite)}</strong></td>
                  </tr>
                ))}
                {rankedBoard.length === 0 && (
                  <tr><td colSpan={CATEGORY_ORDER.length + 3} className="td-dim">No scoreboard recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="section-label" style={{ marginTop: 8 }}>★ = category leader (max raw score). Composite weights: security & intelligence ×0.75.</div>
        </div>
      </div>
    </div>
  );
}

function InvalidRow({ subName, kind, reason, order }: { subName: string; kind: string; reason: string; order: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr>
        <td className="td-dim">{subName}</td>
        <td><span className="badge badge-red">{titleCase(kind)}</span></td>
        <td>{reason}</td>
        <td><button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? "▾ hide" : "▸ order"}</button></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4}>
            <pre style={{ fontSize: 10, color: "var(--text-secondary)", overflowX: "auto", margin: 0 }}>{JSON.stringify(order ?? null, null, 2)}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

function fmtScore(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
