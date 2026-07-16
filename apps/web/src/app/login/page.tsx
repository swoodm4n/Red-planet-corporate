"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<{ role: string; status: string }>("/api/auth/login", { email, password });
      if (r.role === "ADMIN") router.replace("/admin/registrations");
      else if (r.status === "PENDING") router.replace("/pending");
      else router.replace("/play/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-title">RED PLANET CORPORATE</div>
          <div className="auth-sub">MARS COLONIAL INITIATIVE // SECURE TERMINAL ACCESS</div>
        </div>
        <form className="auth-body" onSubmit={submit}>
          {error && <div className="error-box">{error}</div>}
          <label className="field">
            <span className="field-label">Operator Email</span>
            <input
              className="console-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Access Code</span>
            <input
              className="console-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? "AUTHENTICATING…" : "LOG IN"}
          </button>
        </form>
        <div className="auth-foot">
          <Link href="/register">Request access</Link>
          <Link href="/forgot">Reset access code</Link>
        </div>
      </div>
    </div>
  );
}
