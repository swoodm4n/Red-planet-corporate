"use client";

import { AdminProvider, useAdmin } from "@/lib/client/adminContext";
import { Shell, type NavSection } from "@/lib/client/Shell";

const SECTIONS: NavSection[] = [
  {
    label: "PLAYERS",
    items: [
      { href: "/admin/registrations", label: "Registrations" },
      { href: "/admin/subdivisions", label: "Subdivisions" },
      { href: "/admin/research", label: "Research Queue" },
    ],
  },
  {
    label: "GAME CONTROL",
    items: [
      { href: "/admin/turns", label: "Turn Control" },
      { href: "/admin/events", label: "Manual Events" },
      { href: "/admin/announcements", label: "Announcements" },
      { href: "/admin/state", label: "State Editor" },
      { href: "/admin/audit", label: "Audit Log" },
    ],
  },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const { me, games, gameId, setGameId } = useAdmin();
  const game = games.find((g) => g.id === gameId);

  return (
    <Shell
      brand="GM CONSOLE"
      brandSub="GAME MASTER TERMINAL"
      sections={SECTIONS}
      ticker={
        <div className="res-chip">
          <span className="res-label">GAME</span>
          <select className="console-input inline-input" style={{ width: 200 }} value={gameId} onChange={(e) => setGameId(Number(e.target.value))}>
            {games.map((g) => <option key={g.id} value={g.id}>#{g.id} {g.name} [{g.status}]</option>)}
          </select>
        </div>
      }
      topRight={
        <>
          {game && `TURN ${game.turnNumber} // ${game.status} `}
          <span className="blink">_</span>
          <span style={{ marginLeft: 12, color: "var(--text-tertiary)" }}>{me.user?.email}</span>
        </>
      }
      footer="RED PLANET CORPORATE // GAME MASTER CONSOLE // ADMIN-ONLY"
    >
      {children}
    </Shell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
