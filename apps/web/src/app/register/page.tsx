"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client/api";
import { PARENT_LABELS, PERSONNEL_LABELS, PERSONNEL_TYPES } from "@/lib/client/labels";

const PARENTS = Object.keys(PARENT_LABELS);

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [desiredName, setDesiredName] = useState("");
  const [parentCompany, setParentCompany] = useState<string>("");
  const [parentPerk, setParentPerk] = useState<"A" | "B">("A");
  const [choice, setChoice] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggleChoice(t: string) {
    setChoice((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 2) return [prev[1], t];
      return [...prev, t];
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (choice.length !== 0 && choice.length !== 2) {
      setError("Pick exactly two choice-personnel, or leave both unselected.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { email, password };
      if (displayName) body.displayName = displayName;
      if (desiredName) body.desiredName = desiredName;
      if (parentCompany) body.parentCompany = parentCompany;
      if (parentCompany) body.parentPerk = parentPerk;
      if (choice.length === 2) body.choicePersonnel = choice;
      await api.post("/api/auth/register", body);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-head">
            <div className="auth-title">REGISTRATION RECEIVED</div>
            <div className="auth-sub">AWAITING GAME MASTER APPROVAL</div>
          </div>
          <div className="auth-body">
            <div className="ok-box">
              Your access request has been logged. A game master must approve your account and assign
              you a subdivision before you can play. You can log in now to check your status.
            </div>
          </div>
          <div className="auth-foot">
            <Link href="/login">Return to login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-head">
          <div className="auth-title">REQUEST TERMINAL ACCESS</div>
          <div className="auth-sub">NEW SUBDIVISION DIRECTOR REGISTRATION</div>
        </div>
        <form className="auth-body" onSubmit={submit}>
          {error && <div className="error-box">{error}</div>}
          <label className="field">
            <span className="field-label">Email</span>
            <input className="console-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">Access Code (min 8 chars)</span>
            <input className="console-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          <div className="grid-2">
            <label className="field">
              <span className="field-label">Display Name</span>
              <input className="console-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Desired Subdivision Name</span>
              <input className="console-input" value={desiredName} onChange={(e) => setDesiredName(e.target.value)} />
            </label>
          </div>

          <span className="field-label">Preferred Parent Company (advisory)</span>
          <div className="choice-grid" style={{ marginBottom: 12 }}>
            {PARENTS.map((p) => (
              <div key={p} className={`choice ${parentCompany === p ? "selected" : ""}`} onClick={() => setParentCompany(parentCompany === p ? "" : p)}>
                {PARENT_LABELS[p]}
              </div>
            ))}
          </div>

          {parentCompany && (
            <label className="field">
              <span className="field-label">Parent Perk</span>
              <select className="console-input" value={parentPerk} onChange={(e) => setParentPerk(e.target.value as "A" | "B")}>
                <option value="A">Perk A</option>
                <option value="B">Perk B</option>
              </select>
            </label>
          )}

          <span className="field-label">Choice Personnel (pick exactly 2)</span>
          <div className="choice-grid" style={{ marginBottom: 16 }}>
            {PERSONNEL_TYPES.map((t) => (
              <div key={t} className={`choice ${choice.includes(t) ? "selected" : ""}`} onClick={() => toggleChoice(t)}>
                {PERSONNEL_LABELS[t]}
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? "SUBMITTING…" : "SUBMIT REGISTRATION"}
          </button>
        </form>
        <div className="auth-foot">
          <Link href="/login">Already registered? Log in</Link>
        </div>
      </div>
    </div>
  );
}
