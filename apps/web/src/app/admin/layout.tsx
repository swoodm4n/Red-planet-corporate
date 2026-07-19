"use client";

import { AdminProvider, useAdmin } from "@/lib/client/adminContext";
import { Shell, type NavSection } from "@/lib/client/Shell";
import { countdown } from "@/lib/client/labels";

function AdminShell({ children }: { children: React.ReactNode }) {
  const { me, games, gameId, setGameId, pendingRegistrations, pendingResearch } = useAdmin();
  const game = games.find((g) => g.id === gameId);

  const regBadge = pendingRegistrations && pendingRegistrations > 0 ? String(pendingRegistrations) : undefined;
  const resBadge = pendingResearch && pendingResearch > 0 ? String(pendingResearch) : undefined;

  const sections: NavSection[] = [
    {
      label: "OVERVIEW",
      items: [{ href: "/admin/overview", label: "Overview" }],
    },
    {
      label: "PLAYERS",
      items: [
        { href: "/admin/registrations", label: "Registrations", badge: regBadge, badgeClass: "amber" },
        { href: "/admin/subdivisions", label: "Subdivisions" },
        { href: "/admin/research", label: "Research Queue", badge: resBadge, badgeClass: "amber" },
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

  const statusClass = game?.status === "PAUSED" ? "paused" : game?.status === "COMPLETED" ? "completed" : "active";
  const closes = countdown(game?.turnDeadline ?? null);

  return (
    <Shell
      brand="GM CONSOLE"
      brandSub="GAME MASTER TERMINAL"
      sections={sections}
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
          {game && (
            <>
              <span className={`status-dot ${statusClass}`} />
              {`TURN ${game.turnNumber} // ${game.status}`}
              {game.status === "ACTIVE" && (
                <span style={{ marginLeft: 10, color: closes === "OVERDUE" ? "var(--amber)" : "var(--text-tertiary)" }}>
                  {closes === "OVERDUE" ? "DEADLINE PASSED" : `CLOSES ${closes}`}
                </span>
              )}{" "}
            </>
          )}
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
