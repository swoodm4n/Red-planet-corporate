"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";

function ResetForm() {
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/auth/password-reset/confirm", { token, newPassword });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <div className="auth-title">SET NEW ACCESS CODE</div>
        <div className="auth-sub">PASSWORD RESET CONFIRMATION</div>
      </div>
      <form className="auth-body" onSubmit={submit}>
        {error && <div className="error-box">{error}</div>}
        {done ? (
          <div className="ok-box">Access code updated. You can now log in with your new code.</div>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Reset Token</span>
              <input className="console-input" value={token} onChange={(e) => setToken(e.target.value)} required />
            </label>
            <label className="field">
              <span className="field-label">New Access Code (min 8 chars)</span>
              <input className="console-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </label>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? "UPDATING…" : "SET NEW CODE"}
            </button>
          </>
        )}
      </form>
      <div className="auth-foot">
        <Link href="/login">Back to login</Link>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <div className="auth-wrap">
      <Suspense fallback={<div className="loading">LOADING…</div>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
