"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client/api";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<{ ok: boolean; devToken?: string }>("/api/auth/password-reset/request", { email });
      setSent(true);
      if (r.devToken) setDevToken(r.devToken);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-title">RESET ACCESS CODE</div>
          <div className="auth-sub">PASSWORD RECOVERY</div>
        </div>
        <form className="auth-body" onSubmit={submit}>
          {error && <div className="error-box">{error}</div>}
          {sent ? (
            <div className="ok-box">
              If an account exists for that email, a reset token has been issued.
              {devToken && (
                <div style={{ marginTop: 10 }}>
                  <span className="field-label">Dev reset token (non-prod only)</span>
                  <code style={{ wordBreak: "break-all", color: "var(--cyan)" }}>{devToken}</code>
                  <div style={{ marginTop: 8 }}>
                    <Link href={`/reset?token=${encodeURIComponent(devToken)}`}>Continue to reset →</Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <label className="field">
                <span className="field-label">Email</span>
                <input className="console-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                {busy ? "SENDING…" : "REQUEST RESET"}
              </button>
            </>
          )}
        </form>
        <div className="auth-foot">
          <Link href="/login">Back to login</Link>
          <Link href="/reset">I have a token</Link>
        </div>
      </div>
    </div>
  );
}
