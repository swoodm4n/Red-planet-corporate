"use client";

import { Fragment, useEffect, useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { Loading, ErrorMsg } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";

interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  note: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  admin: { id: string; email: string } | null;
}

export default function AuditPage() {
  const { gameId } = useAdmin();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setEntries(null);
    api.get<{ entries: AuditEntry[] }>(`/api/admin/games/${gameId}/audit`).then((r) => setEntries(r.entries)).catch((e) => setError(e.message));
  }, [gameId]);

  if (error) return <ErrorMsg error={error} />;
  if (!entries) return <Loading label="LOADING AUDIT LOG" />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">AUDIT LOG</div>
          <div className="page-subtitle">Immutable trail of every admin action on game #{gameId}, with before/after snapshots.</div>
        </div>
        <div className="page-meta">{entries.length} entries</div>
      </div>

      <div className="panel">
        <div className="panel-head"><span>&#9635; TRAIL</span></div>
        <div className="panel-body tight">
          <div className="table-scroll">
            <table>
              <thead><tr><th>TIME</th><th>ADMIN</th><th>ACTION</th><th>TARGET</th><th>NOTE</th><th></th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <Fragment key={e.id}>
                    <tr onClick={() => setOpen(open === e.id ? null : e.id)} style={{ cursor: "pointer" }}>
                      <td className="td-dim">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="td-dim">{e.admin?.email ?? "—"}</td>
                      <td><span className="badge badge-cyan">{e.action}</span></td>
                      <td className="td-dim">{e.targetType ? `${e.targetType} ${e.targetId ?? ""}` : "—"}</td>
                      <td className="td-dim">{e.note ?? "—"}</td>
                      <td className="td-dim">{open === e.id ? "▾" : "▸"}</td>
                    </tr>
                    {open === e.id && (
                      <tr>
                        <td colSpan={6}>
                          <div className="grid-2">
                            <div><div className="field-label">BEFORE</div><pre style={{ fontSize: 10, color: "var(--text-secondary)", overflowX: "auto" }}>{JSON.stringify(e.before ?? null, null, 2)}</pre></div>
                            <div><div className="field-label">AFTER</div><pre style={{ fontSize: 10, color: "var(--cyan)", overflowX: "auto" }}>{JSON.stringify(e.after ?? null, null, 2)}</pre></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {entries.length === 0 && <tr><td colSpan={6} className="td-dim">No audit entries.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
