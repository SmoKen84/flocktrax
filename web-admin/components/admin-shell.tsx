"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";

const consoleLinks = [
  { label: "Live Dashboard", href: "/admin/overview" },
  { label: "Placements", href: "/admin/placements/new" },
  { label: "Rollups" },
  { label: "Sync Engine", href: "/admin/sync/googleapis-sheets/outbox" },
  { label: "Reports" },
];

const configurationLinks = [
  { label: "Integrator", href: "/admin/integrator" },
  { label: "Groups, Farms & Barns", href: "/admin/farm-groups" },
  { label: "Feed Bins", href: "/admin/feed-bins" },
  { label: "Placement Wizard", href: "/admin/placements/new" },
  { label: "User Access Control", href: "/admin/user-access" },
  { label: "Breed Benchmarks", href: "/admin/breed-benchmarks" },
];

const archiveLinks = [
  { label: "Flocks", href: "/admin/flocks" },
  { label: "Activity Log", href: "/admin/activity-log" },
  { label: "Feed Tickets" },
];

type AdminShellProps = {
  children: ReactNode;
  displayName: string;
  roleLabel: string;
  scopeLabel: string | null;
};

export function AdminShell({ children, displayName, roleLabel, scopeLabel }: AdminShellProps) {
  const pathname = usePathname();
  const now = new Date();
  const sidebarDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(now);
  const sidebarTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(now);

  const renderNavItem = (item: { href?: string; label: string }) => {
    if (!item.href) {
      return (
        <p className="splash-sidebar-item" key={item.label}>
          {item.label}
        </p>
      );
    }

    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        className="splash-sidebar-item splash-sidebar-item-link"
        data-active={active}
        href={item.href}
        key={item.href}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <main className="splash-shell admin-shell">
      <aside className="splash-sidebar admin-sidebar">
        <div className="splash-sidebar-utility-row">
          <Link
            aria-label="Open options and settings"
            className="splash-sidebar-utility-button"
            href="/admin/settings"
            title="Options & Settings"
          >
            ...
          </Link>
        </div>

        <div className="splash-sidebar-brand">
          <img alt="FlockTrax Victor mark" className="splash-sidebar-logo" src="/victor.svg" />
          <div className="splash-sidebar-copy">
            <FlockTraxWordmark compact descriptor="Admin and reporting console" product="Admin" tone="light" />
            <p className="splash-sidebar-subcopy">Integrated Flock Management Platform</p>
          </div>
        </div>

        <div className="splash-sidebar-identity-card" aria-label="Signed in user">
          <p className="splash-sidebar-identity-name">{displayName}</p>
          <p className="splash-sidebar-identity-role">{roleLabel}</p>
          {scopeLabel ? <p className="splash-sidebar-identity-scope">{scopeLabel}</p> : null}
        </div>

        <div className="admin-sidebar-session-actions">
          <Link className="admin-sidebar-session-link" href="/login">
            Switch User
          </Link>
          <form action="/logout" method="post">
            <button className="admin-sidebar-session-link admin-sidebar-session-link-quiet" type="submit">
              Logout
            </button>
          </form>
        </div>

        <div className="splash-sidebar-datetime" suppressHydrationWarning>
          <p>{`${sidebarDate} - ${sidebarTime}`}</p>
        </div>

        <div className="splash-sidebar-groups">
          <div className="splash-sidebar-group">
            <p className="splash-sidebar-label">Console</p>
            {consoleLinks.map(renderNavItem)}
          </div>

          <div className="splash-sidebar-group">
            <p className="splash-sidebar-label">Configuration</p>
            {configurationLinks.map(renderNavItem)}
          </div>

          <div className="splash-sidebar-group">
            <p className="splash-sidebar-label">Archives</p>
            {archiveLinks.map(renderNavItem)}
          </div>
        </div>

        <div className="splash-sidebar-footer">
          <p>FlockTrax Admin Console</p>
        </div>
      </aside>

      <div className="content-shell">{children}</div>
    </main>
  );
}
