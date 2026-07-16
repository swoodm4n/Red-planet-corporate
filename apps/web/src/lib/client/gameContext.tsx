"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import type { GameSummary, MeResponse } from "@/lib/client/types";
import { Loading } from "@/lib/client/Shell";

interface PlayerCtx {
  me: MeResponse;
  gameId: number;
  subdivisionId: number | null;
  game: GameSummary | null;
  refresh: () => void;
}

const Ctx = createContext<PlayerCtx | null>(null);

export function usePlayer(): PlayerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer must be used within PlayerProvider");
  return c;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<PlayerCtx | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<MeResponse>("/api/auth/me");
        if (!me.user) {
          router.replace("/login");
          return;
        }
        if (me.user.role !== "ADMIN" && me.user.status === "PENDING") {
          router.replace("/pending");
          return;
        }
        const { games } = await api.get<{ games: GameSummary[] }>("/api/games");
        const gameId = me.assignment?.gameId ?? games[0]?.id ?? null;
        if (gameId == null) {
          setError("No games are available yet.");
          return;
        }
        const game = games.find((g) => g.id === gameId) ?? null;
        setState({
          me,
          gameId,
          subdivisionId: me.assignment?.subdivisionId ?? null,
          game,
          refresh: () => setTick((t) => t + 1),
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError((e as Error).message);
      }
    })();
  }, [router, tick]);

  if (error) return <div className="auth-wrap"><div className="error-box">{error}</div></div>;
  if (!state) return <div className="auth-wrap"><Loading label="ESTABLISHING UPLINK" /></div>;
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
