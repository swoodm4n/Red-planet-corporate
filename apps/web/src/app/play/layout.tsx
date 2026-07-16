"use client";

import { useEffect, useState } from "react";
import { PlayerProvider, usePlayer } from "@/lib/client/gameContext";
import { Shell, type NavSection } from "@/lib/client/Shell";
import { api } from "@/lib/client/api";
import type { ReportResponse } from "@/lib/client/types";
import { PARENT_LABELS, RESOURCE_SHORT, countdown } from "@/lib/client/labels";

const SECTIONS: NavSection[] = [
  {
    label: "COLONY",
    items: [
      { href: "/play/dashboard", label: "Public Dashboard" },
      { href: "/play/standings", label: "Standings" },
      { href: "/play/market", label: "Market & Equity" },
      { href: "/play/map", label: "Transit Hub Map" },
    ],
  },
  {
    label: "SUBDIVISION",
    items: [
      { href: "/play/report", label: "Private Report" },
      { href: "/play/orders", label: "Orders", badge: "!", badgeClass: "amber" },
      { href: "/play/research", label: "Research" },
      { href: "/play/turns", label: "Turn Log" },
    ],
  },
];

function PlayShell({ children }: { children: React.ReactNode }) {
  const { me, gameId, subdivisionId, game } = usePlayer();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (subdivisionId == null) return;
    api
      .get<ReportResponse>(`/api/games/${gameId}/report`)
      .then(setReport)
      .catch(() => setReport(null));
  }, [gameId, subdivisionId, game?.turnNumber]);

  const res = report?.own.resources;
  const ticker = res ? (
    <>
      <div className="res-chip"><span className="res-label">{RESOURCE_SHORT.CREDITS}</span><span className="res-value">{res.creditsDisplay}</span></div>
      <div className="res-chip"><span className="res-label">{RESOURCE_SHORT.MINERALS}</span><span className="res-value">{res.MINERALS}</span></div>
      <div className="res-chip"><span className="res-label">{RESOURCE_SHORT.ENERGY}</span><span className="res-value">{res.ENERGY}</span></div>
      <div className="res-chip"><span className="res-label">{RESOURCE_SHORT.WATER}</span><span className="res-value">{res.WATER}</span></div>
      <div className="res-chip"><span className="res-label">{RESOURCE_SHORT.FOOD}</span><span className="res-value">{res.FOOD}</span></div>
      <div className="res-chip"><span className="res-label">{RESOURCE_SHORT.RESEARCH}</span><span className="res-value">{res.RESEARCH}</span></div>
    </>
  ) : (
    <span className="res-chip"><span className="res-label">NO SUBDIVISION ASSIGNED — PUBLIC VIEW</span></span>
  );

  const parent = report?.own.parentCompany;
  const footer = `RED PLANET CORPORATE // ${report?.own.name ?? "OBSERVER"}${
    parent ? " // PARENT CO: " + (PARENT_LABELS[parent] ?? parent).toUpperCase() : ""
  } // GAME ${gameId}`;

  const clock =
    game &&
    (game.status === "ACTIVE"
      ? `TURN ${game.turnNumber} // CLOSES ${countdown(game.turnDeadline)} `
      : `TURN ${game.turnNumber} // ${game.status} `);

  void now;

  return (
    <Shell
      brand={report?.own.name ?? "RPC TERMINAL"}
      brandSub="SUBDIVISION TERMINAL"
      sections={SECTIONS}
      ticker={ticker}
      topRight={
        <>
          {clock}
          <span className="blink">_</span>
          <span style={{ marginLeft: 12, color: "var(--text-tertiary)" }}>{me.user?.email}</span>
        </>
      }
      footer={footer}
    >
      {children}
    </Shell>
  );
}

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <PlayShell>{children}</PlayShell>
    </PlayerProvider>
  );
}
