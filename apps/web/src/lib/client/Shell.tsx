"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";

export interface NavItem {
  href: string;
  label: string;
  badge?: string;
  badgeClass?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export function Shell({
  brand,
  brandSub,
  sections,
  topRight,
  ticker,
  footer,
  children,
}: {
  brand: string;
  brandSub: string;
  sections: NavSection[];
  topRight?: React.ReactNode;
  ticker?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api.post("/api/auth/logout");
    router.replace("/login");
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">&#9670;</div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">{brand}</div>
            <div className="sidebar-brand-sub">{brandSub}</div>
          </div>
        </div>
        <div className="sidebar-nav">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} className={`navitem ${active ? "active" : ""}`}>
                    <span className="navitem-label">{item.label}</span>
                    {item.badge && <span className={`navitem-badge ${item.badgeClass ?? ""}`}>{item.badge}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="sidebar-section-label">SESSION</div>
          <div className="navitem" onClick={logout} style={{ cursor: "pointer" }}>
            <span className="navitem-label">Log Out</span>
          </div>
        </div>
      </div>

      <div className="app-right">
        <div className="topbar">
          <div className="topbar-left">
            <span className="pill">
              <span className="pill-dot" />
              LINK STABLE
            </span>
          </div>
          {ticker && <div className="resource-ticker">{ticker}</div>}
          <div className="topbar-clock">{topRight}</div>
        </div>
        <div className="main">{children}</div>
        {footer && <div className="footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Loading({ label = "LOADING" }: { label?: string }) {
  return (
    <div className="loading">
      {label}… <span className="blink">_</span>
    </div>
  );
}

export function ErrorMsg({ error }: { error: string }) {
  return <div className="error-box">{error}</div>;
}
