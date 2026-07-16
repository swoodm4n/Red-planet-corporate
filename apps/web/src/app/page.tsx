"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import type { MeResponse } from "@/lib/client/types";

export default function Home() {
  const router = useRouter();
  const [msg, setMsg] = useState("ESTABLISHING UPLINK…");

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<MeResponse>("/api/auth/me");
        if (!me.user) {
          router.replace("/login");
          return;
        }
        if (me.user.role === "ADMIN") {
          router.replace("/admin/registrations");
          return;
        }
        if (me.user.status === "PENDING") {
          router.replace("/pending");
          return;
        }
        if (me.user.status === "REJECTED") {
          setMsg("This account has been rejected. Contact the game master.");
          return;
        }
        router.replace("/play/dashboard");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setMsg("Uplink error: " + (e as Error).message);
      }
    })();
  }, [router]);

  return (
    <div className="auth-wrap">
      <div className="loading">
        {msg} <span className="blink">_</span>
      </div>
    </div>
  );
}
