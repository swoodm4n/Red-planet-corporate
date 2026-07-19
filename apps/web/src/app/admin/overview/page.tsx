"use client";

import Link from "next/link";
import { useAdmin } from "@/lib/client/adminContext";
import { countdown, PARENT_LABELS } from "@/lib/client/labels";
import { Icon } from "@/lib/client/Icon";

export default function OverviewPage() {
  const { games, gameId, subdivisions, pendingRegistrations, pendingResearch } = useAdmin();
  const game = games.find((g) => g.id === gameId);

  const paused = game?.status === "PAUSED";
  const completed = game?.status === "COMPLETED";
  const closes = countdown(game?.turnDeadline ?? null);
  const statusClass = paused ? "paused" : completed ? "completed" : closes === "OVERDUE" ? "overdue" : "active";

  const active = subdivisions?.filter((s) => s.status === "ACTIVE") ?? [];
  const seated = subdivisions?.filter((s) => s.assignedTo).length ?? 0;
  const retired = subdivisions?.filter((s) => s.status !== "ACTIVE").length ?? 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">GAME OVERVIEW</div>
          <div className="page-subtitle">At-a-glance status and outstanding work for {game?.name ?? `game #${gameId}`}.</div>
        </div>
        <div className="page-meta"><span className={`status-dot ${statusClass}`} />{game?.status}</div>
      </div>

      {paused && <div className="muted-note amber">This game is PAUSED — automatic turn resolution is suspended. Resume it from Turn Control when ready.</div>}
      {closes === "OVERDUE" && !paused && <div className="muted-note amber">The turn deadline has passed. The scheduler resolves due turns automatically; you can also resolve now from Turn Control.</div>}

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="stat-block">
          <div className="stat-label">CURRENT TURN</div>
          <div className="stat-value">{game?.turnNumber ?? "—"}</div>
          <div className="stat-foot">{game?.turnLengthHours}h turns</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">{paused ? "DEADLINE" : "CLOSES IN"}</div>
          <div className={`stat-value ${statusClass === "overdue" ? "amber" : ""}`} style={{ fontSize: 20 }}>{paused ? "PAUSED" : closes}</div>
          <div className="stat-foot">{game?.turnDeadline ? new Date(game.turnDeadline).toLocaleString() : "no deadline set"}</div>
        </div>
        <Link href="/admin/registrations" className="tile-link">
          <div className="stat-block">
            <div className="stat-label">PENDING REGISTRATIONS</div>
            <div className={`stat-value ${pendingRegistrations ? "big-attn" : ""}`}>{pendingRegistrations ?? "—"}</div>
            <div className="stat-foot">{pendingRegistrations ? "awaiting approval →" : "none waiting"}</div>
          </div>
        </Link>
        <Link href="/admin/research" className="tile-link">
          <div className="stat-block">
            <div className="stat-label icon-label"><Icon name="action-research" alt="" size={13} />PENDING RESEARCH</div>
            <div className={`stat-value ${pendingResearch ? "big-attn" : ""}`}>{pendingResearch ?? "—"}</div>
            <div className="stat-foot">{pendingResearch ? "awaiting a ruling →" : "none waiting"}</div>
          </div>
        </Link>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><span>&#9635; SUBDIVISIONS ({subdivisions?.length ?? 0})</span><span className="panel-head-actions"><Link href="/admin/subdivisions" className="td-dim" style={{ fontSize: 10 }}>MANAGE →</Link></span></div>
          <div className="panel-body">
            <div className="detail-row"><span className="detail-label">Seated players</span><span className="detail-value">{seated} / {subdivisions?.length ?? 0}</span></div>
            <div className="detail-row"><span className="detail-label">Active slots</span><span className="detail-value">{active.length}</span></div>
            <div className="detail-row"><span className="detail-label">Retired slots</span><span className="detail-value">{retired}</span></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span>&#9635; STANDINGS (TOP)</span></div>
          <div className="panel-body tight">
            <div className="table-scroll">
              <table>
                <thead><tr><th>RANK</th><th>SUBDIVISION</th><th>PARENT</th><th className="td-num">COMPOSITE</th></tr></thead>
                <tbody>
                  {[...active].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).slice(0, 6).map((s) => (
                    <tr key={s.subdivisionId}>
                      <td>{s.rank ?? "—"}</td>
                      <td><strong>{s.name}</strong></td>
                      <td className="td-dim" style={{ fontSize: 10 }}>{PARENT_LABELS[s.parentCompany] ?? s.parentCompany}</td>
                      <td className="td-num">{s.composite ?? "—"}</td>
                    </tr>
                  ))}
                  {(!subdivisions || subdivisions.length === 0) && <tr><td colSpan={4} className="td-dim" style={{ textAlign: "center", padding: 20 }}>Loading…</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><span>&#9635; QUICK ACTIONS</span></div>
        <div className="panel-body">
          <div className="btn-row" style={{ flexWrap: "wrap" }}>
            <Link href="/admin/turns" className="btn btn-sm icon-label"><Icon name="status-turn-timer" alt="" size={14} />TURN CONTROL</Link>
            <Link href="/admin/events" className="btn btn-sm icon-label"><Icon name="status-alert" alt="" size={14} />TRIGGER EVENT</Link>
            <Link href="/admin/announcements" className="btn btn-sm icon-label"><Icon name="status-earth-relations" alt="" size={14} />POST ANNOUNCEMENT</Link>
            <Link href="/admin/state" className="btn btn-sm icon-label"><Icon name="action-settings" alt="" size={14} />STATE EDITOR</Link>
            <Link href="/admin/audit" className="btn btn-sm btn-ghost">AUDIT LOG</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
