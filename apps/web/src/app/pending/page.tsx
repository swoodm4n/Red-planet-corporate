"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import type { MeResponse } from "@/lib/client/types";

export default function PendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("PENDING");
  const [checkedAt, setCheckedAt] = useState<string>("");

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const me = await api.get<MeResponse>("/api/auth/me");
        if (stop) return;
        if (!me.user) {
          router.replace("/login");
          return;
        }
        if (me.user.role === "ADMIN") {
          router.replace("/admin/registrations");
          return;
        }
        setStatus(me.user.status);
        setCheckedAt(new Date().toLocaleTimeString());
        if (me.user.status === "APPROVED") {
          router.replace("/play/dashboard");
          return;
        }
      } catch {
        /* keep waiting */
      }
    }
    poll();
    const t = setInterval(poll, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [router]);

  async function logout() {
    await api.post("/api/auth/logout");
    router.replace("/login");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-title">AWAITING APPROVAL</div>
          <div className="auth-sub">REGISTRATION STATUS: {status}</div>
        </div>
        <div className="auth-body">
          {status === "REJECTED" ? (
            <div className="error-box">Your registration was rejected. Contact the game master for details.</div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                Your account is registered but not yet approved. A game master must review your request
                and assign you a subdivision slot before you can access the command terminal.
              </p>
              <div className="muted-note" style={{ marginTop: 16 }}>
                This screen re-checks your status automatically every 15 seconds.
                {checkedAt && ` Last check: ${checkedAt}`} <span className="blink">_</span>
              </div>
            </>
          )}
        </div>
        <div className="auth-foot">
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            LOG OUT
          </button>
          <Link href="/play/dashboard">Try dashboard</Link>
        </div>
      </div>
    </div>
  );
}
