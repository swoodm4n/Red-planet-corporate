"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Nav rail (§5). The HUD is the default/active item; the remaining rail items link
// to the best-fitting EXISTING secondary pages (no new pages built) — mapping:
//   Tactical HUD  -> /play/hud        (this screen)
//   Subdivisions  -> /play/standings  (colony standings / rivals)
//   Market/Equity -> /play/market
//   Intel/Report  -> /play/report     (private subdivision report)
//   Research      -> /play/research
//   Turn Log      -> /play/turns
// Session/logout sits at the bottom via the flex spacer.
interface RailItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | null;
  alert?: boolean;
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONS = {
  hud: <Svg><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></Svg>,
  subs: <Svg><circle cx="9" cy="7" r="3" /><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /><path d="M17 7a3 3 0 0 1 0 6" /></Svg>,
  market: <Svg><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></Svg>,
  intel: <Svg><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>,
  research: <Svg><path d="M9 3h6" /><path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></Svg>,
  log: <Svg><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></Svg>,
  logout: <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Svg>,
};

export function NavRail({ onLogout, alertBadge }: { onLogout: () => void; alertBadge?: string | null }) {
  const pathname = usePathname();
  const items: RailItem[] = [
    { href: "/play/hud", label: "Tactical HUD", icon: ICONS.hud },
    { href: "/play/standings", label: "Subdivisions & Standings", icon: ICONS.subs },
    { href: "/play/market", label: "Market & Equity", icon: ICONS.market },
    { href: "/play/report", label: "Private Report / Intel", icon: ICONS.intel },
    { href: "/play/research", label: "Research", icon: ICONS.research },
    { href: "/play/turns", label: "Turn Log", icon: ICONS.log, badge: alertBadge, alert: !!alertBadge },
  ];

  return (
    <div className="hud-rail">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link key={it.href} href={it.href} className={`hud-rail-item${active ? " active" : ""}`} aria-label={it.label}>
            {it.icon}
            {it.badge && <span className={`hud-rail-badge${it.alert ? " alert" : ""}`}>{it.badge}</span>}
            <span className="hud-rail-tip">{it.label}</span>
          </Link>
        );
      })}
      <div className="hud-rail-spacer" />
      <button className="hud-rail-item" onClick={onLogout} aria-label="Log out">
        {ICONS.logout}
        <span className="hud-rail-tip">Log out</span>
      </button>
    </div>
  );
}
