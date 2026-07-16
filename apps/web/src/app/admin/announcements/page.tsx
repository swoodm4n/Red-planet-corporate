"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/lib/client/adminContext";
import { api } from "@/lib/client/api";

interface Announcement { id: string; title: string; body: string; createdAt: string; }

export default function AnnouncementsPage() {
  const { gameId } = useAdmin();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [list, setList] = useState<Announcement[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<{ announcements: Announcement[] }>(`/api/games/${gameId}/announcements`).then((r) => setList(r.announcements)).catch(() => {});
  }, [gameId]);

  useEffect(() => { load(); }, [load]);

  async function post() {
    if (!title || !body) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api.post(`/api/admin/games/${gameId}/announcements`, { title, body });
      setMsg("Announcement posted."); setTitle(""); setBody(""); load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">ANNOUNCEMENTS</div>
          <div className="page-subtitle">Colony-wide broadcasts, visible on every player&apos;s dashboard.</div>
        </div>
      </div>

      {err && <div className="error-box">{err}</div>}
      {msg && <div className="ok-box">{msg}</div>}

      <div className="panel">
        <div className="panel-head"><span>&#9635; COMPOSE</span></div>
        <div className="panel-body">
          <label className="field">
            <span className="field-label">Title</span>
            <input className="console-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Body</span>
            <textarea className="console-input" value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={busy || !title || !body} onClick={post}>POST ANNOUNCEMENT</button>
        </div>
      </div>

      <div className="section-label">POSTED</div>
      {list.map((a) => (
        <div className="panel" key={a.id}>
          <div className="panel-head"><span>&#9635; {a.title}</span><span className="panel-head-actions td-dim">{new Date(a.createdAt).toLocaleString()}</span></div>
          <div className="panel-body"><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.body}</div></div>
        </div>
      ))}
      {list.length === 0 && <div className="muted-note">No announcements yet.</div>}
    </div>
  );
}
