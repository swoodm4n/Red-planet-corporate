"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import type { GameSummary, MeResponse } from "@/lib/client/types";
import { Loading } from "@/lib/client/Shell";

interface AdminCtx {
  me: MeResponse;
  games: GameSummary[];
  gameId: number;
  setGameId: (id: number) => void;
  refresh: () => void;
}

const Ctx = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used within AdminProvider");
  return c;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.get<MeResponse>("/api/auth/me");
        if (!m.user) {
          router.replace("/login");
          return;
        }
        if (m.user.role !== "ADMIN") {
          router.replace("/play/dashboard");
          return;
        }
        setMe(m);
        const { games } = await api.get<{ games: GameSummary[] }>("/api/games");
        setGames(games);
        setGameId((prev) => prev ?? games[0]?.id ?? null);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError((e as Error).message);
      }
    })();
  }, [router, tick]);

  if (error) return <div className="auth-wrap"><div className="error-box">{error}</div></div>;
  if (!me || !games || gameId == null) return <div className="auth-wrap"><Loading label="LOADING GM CONSOLE" /></div>;

  return (
    <Ctx.Provider value={{ me, games, gameId, setGameId, refresh: () => setTick((t) => t + 1) }}>
      {children}
    </Ctx.Provider>
  );
}
