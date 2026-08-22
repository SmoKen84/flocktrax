"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AdminWorkspaceContent, useAdminSplitWorkspace } from "@/components/admin-split-workspace";
import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { LiveSidebarClock } from "@/components/live-sidebar-clock";
import { SessionRecoveryLayer } from "@/components/session-recovery-layer";

const consoleLinks = [
  { label: "Live Dashboard", href: "/admin/overview" },
  { label: "Action Items", href: "/admin/issues" },
  { label: "Feed Tickets", href: "/admin/feed-tickets" },
  { label: "Sync Engine", href: "/admin/sync/googleapis-sheets/outbox" },
  { label: "Reports", href: "/admin/reports" },
];

const placementLinks = [
  { label: "Schedule", href: "/admin/placements/new?mode=placements&farm=all" },
  { label: "Livehaul", href: "/admin/placements/livehaul" },
  { label: "Closeout", href: "/admin/flock-closeout" },
];

const configurationLinks = [
  { label: "Integrator", href: "/admin/integrator" },
  { label: "Groups, Farms & Barns", href: "/admin/farm-groups" },
  { label: "Feed Bins", href: "/admin/feed-bins" },
  { label: "User Access Control", href: "/admin/user-access" },
  { label: "Breed Benchmarks", href: "/admin/breed-benchmarks" },
];

const utilityLinks = [
  { label: "About", href: "/admin/about" },
  { label: "Flocks", href: "/admin/flocks" },
  { label: "Activity Log", href: "/admin/activity-log" },
  { label: "BinSentry Refs", href: "/admin/feed-bins/binsentry-refs" },
];

type AdminShellProps = {
  children: ReactNode;
  displayName: string;
  embedded: boolean;
  roleKey: string;
  roleLabel: string;
  scopeLabel: string | null;
  versionLine: string | null;
  copyrightLine: string;
};

function renderSidebarCopyright(value: string) {
  const match = value.match(/all rights reserved\./i);

  if (!match || match.index === undefined) {
    return <p>{value}</p>;
  }

  const firstLine = value.slice(0, match.index + match[0].length).trim();
  const secondLine = value.slice(match.index + match[0].length).trim();

  return (
    <>
      <p>{firstLine}</p>
      {secondLine ? <p>{secondLine}</p> : null}
    </>
  );
}

function normalizeRoleKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function AdminShell({ children, displayName, embedded, roleKey, roleLabel, scopeLabel, versionLine, copyrightLine }: AdminShellProps) {
  const pathname = usePathname();
  const workspace = useAdminSplitWorkspace(pathname, embedded);
  const [syncBadgeCount, setSyncBadgeCount] = useState(0);
  const canOpenSettings = (() => {
    const normalized = normalizeRoleKey(roleKey);
    return normalized === "admin" || normalized === "super_admin" || normalized === "superadmin";
  })();

  useEffect(() => {
    if (embedded) return;

    let cancelled = false;

    async function loadSyncBadge() {
      try {
        const response = await fetch("/api/sync-engine-badge", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { count?: number };
        if (!cancelled) {
          setSyncBadgeCount(typeof payload.count === "number" ? payload.count : 0);
        }
      } catch {
        if (!cancelled) {
          setSyncBadgeCount(0);
        }
      }
    }

    void loadSyncBadge();
    const intervalId = window.setInterval(() => {
      void loadSyncBadge();
    }, 30000);

    const handleFocus = () => {
      void loadSyncBadge();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [embedded, pathname]);

  if (embedded) {
    return (
      <main className="admin-embedded-pane">
        <SessionRecoveryLayer />
        <div className="content-shell">{children}</div>
      </main>
    );
  }

  const renderNavItem = (item: { href?: string; label: string }) => {
    if (!item.href) {
      const muted = item.label === "Rollups";
      return (
        <p className="splash-sidebar-item" data-muted={muted} key={item.label}>
          {item.label}
        </p>
      );
    }

    const itemPath = item.href.split(/[?#]/)[0];
    const activePath = workspace.enabled ? workspace.primaryHref.split(/[?#]/)[0] : pathname;
    const active = activePath === itemPath || activePath.startsWith(`${itemPath}/`);

    return (
      <div className="sidebar-split-nav-row" key={item.href}>
        <Link
          className="splash-sidebar-item splash-sidebar-item-link"
          data-has-badge={item.label === "Sync Engine" && syncBadgeCount > 0 ? "true" : undefined}
          data-active={active}
          href={item.href}
          onClick={workspace.enabled ? (event) => {
            event.preventDefault();
            workspace.openPrimary(item.href!);
          } : undefined}
          prefetch={item.label === "Sync Engine" ? false : undefined}
        >
          <span className={item.label === "Sync Engine" && syncBadgeCount > 0 ? "sidebar-link-label sidebar-link-label-sync" : "sidebar-link-label"}>
            {item.label}
          </span>
          {item.label === "Sync Engine" && syncBadgeCount > 0 ? (
            <span className="sidebar-notification-badge" aria-label={`${syncBadgeCount} sync items need attention`}>
              {syncBadgeCount}
            </span>
          ) : null}
        </Link>
        {workspace.enabled ? (
          <button
            aria-label={`Open ${item.label} in right pane`}
            className="sidebar-open-right-button"
            onClick={() => workspace.openSecondary(item.href!)}
            title={`Open ${item.label} in right pane`}
            type="button"
          >
            →
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <main className="splash-shell admin-shell" data-split={workspace.enabled ? "true" : "false"}>
      <SessionRecoveryLayer />
      <div className="splash-sidebar-stack">
        {versionLine ? <p className="splash-sidebar-version-tag">{versionLine}</p> : null}

        <aside className="splash-sidebar admin-sidebar">
          <div className="splash-sidebar-utility-row">
            {canOpenSettings ? (
              <Link
                aria-label="Open options and settings"
                className="splash-sidebar-utility-button"
                href="/admin/settings"
                title="Options & Settings"
              >
                ...
              </Link>
            ) : null}
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

          <div className="splash-sidebar-datetime">
            <LiveSidebarClock separator=" - " />
          </div>

          <button
            className="admin-split-toggle"
            data-active={workspace.enabled ? "true" : "false"}
            disabled={workspace.hydrated && !workspace.supported}
            onClick={workspace.toggle}
            title={workspace.supported ? "Open two FlockTrax screens side by side" : "Split View requires a wider window"}
            type="button"
          >
            <span aria-hidden="true">▥</span>
            {workspace.enabled ? "Close Split View" : "Split View"}
          </button>

          <div className="splash-sidebar-groups">
            <div className="splash-sidebar-group">
              <p className="splash-sidebar-label">Console</p>
              {consoleLinks.map(renderNavItem)}
            </div>

            <div className="splash-sidebar-group">
              <p className="splash-sidebar-label">Placements</p>
              {placementLinks.map(renderNavItem)}
            </div>

            <div className="splash-sidebar-group">
              <p className="splash-sidebar-label">Configuration</p>
              {configurationLinks.map(renderNavItem)}
            </div>

            <div className="splash-sidebar-group">
              <p className="splash-sidebar-label">Utilities</p>
              {utilityLinks.map(renderNavItem)}
            </div>
          </div>

          <div className="splash-sidebar-footer">
            <div className="splash-sidebar-footer-links">
              <Link className="splash-sidebar-footer-link" href="/privacy">
                Privacy Policy
              </Link>
              <Link className="splash-sidebar-footer-link" href="/delete-account">
                Delete Account Policy
              </Link>
            </div>
            {renderSidebarCopyright(copyrightLine)}
            {versionLine ? <p className="splash-sidebar-footer-version">{versionLine}</p> : null}
          </div>
        </aside>
      </div>

      <AdminWorkspaceContent workspace={workspace}>{children}</AdminWorkspaceContent>
    </main>
  );
}
