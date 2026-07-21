"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import type { GameSummary, MeResponse, SubdivisionSlot } from "@/lib/client/types";
import { Loading } from "@/lib/client/Shell";

interface AdminCtx {
  me: MeResponse;
  games: GameSummary[];
  gameId: number;
  setGameId: (id: number) => void;
  refresh: () => void;
  /** Slots for the selected game (null while loading). */
  subdivisions: SubdivisionSlot[] | null;
  /** Count of PENDING registrations (colony-wide), for nav badges / overview. */
  pendingRegistrations: number | null;
  /** Count of PENDING research proposals for the selected game. */
  pendingResearch: number | null;
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
  const [subdivisions, setSubdivisions] = useState<SubdivisionSlot[] | null>(null);
  const [pendingRegistrations, setPendingRegistrations] = useState<number | null>(null);
  const [pendingResearch, setPendingResearch] = useState<number | null>(null);

  // Ambient game-state summary for nav badges + the overview page. Non-blocking:
  // failures leave counts null so pages still render.
  useEffect(() => {
    if (gameId == null) return;
    let alive = true;
    api.get<{ subdivisions: SubdivisionSlot[] }>(`/api/admin/games/${gameId}/subdivisions`)
      .then((r) => { if (alive) setSubdivisions(r.subdivisions); }).catch(() => {});
    api.get<{ registrations: unknown[] }>(`/api/admin/registrations?status=PENDING`)
      .then((r) => { if (alive) setPendingRegistrations(r.registrations.length); }).catch(() => {});
    api.get<{ proposals: unknown[] }>(`/api/admin/games/${gameId}/research-proposals?status=PENDING`)
      .then((r) => { if (alive) setPendingResearch(r.proposals.length); }).catch(() => {});
    return () => { alive = false; };
  }, [gameId, tick]);

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
    <Ctx.Provider value={{ me, games, gameId, setGameId, refresh: () => setTick((t) => t + 1), subdivisions, pendingRegistrations, pendingResearch }}>
      {children}
    </Ctx.Provider>
  );
}
