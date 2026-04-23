import Link from "next/link";

import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { getPlatformSplashContent } from "@/lib/platform-content";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const consoleLinks = [
  { label: "Live Dashboard", href: "/admin/overview" },
  { label: "Feed Tickets", href: "/admin/feed-tickets" },
  { label: "Placements", href: "/admin/placements/new" },
  { label: "Rollups" },
  { label: "Sync Engine", href: "/admin/sync/googleapis-sheets" },
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
];

export default async function HomePage() {
  const splash = await getPlatformSplashContent();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const isSignedIn = !!user;
  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "Signed In User";
  const roleLabel =
    user?.app_metadata?.role ??
    user?.user_metadata?.role ??
    user?.user_metadata?.title ??
    "Authorized User";
  const scopeLabel =
    user?.user_metadata?.farm_group ??
    user?.user_metadata?.company ??
    user?.user_metadata?.scope ??
    null;

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

  const renderSplashNavItem = (item: { label: string; href?: string }) => {
    if (isSignedIn && item.href) {
      return (
        <Link className="splash-sidebar-item splash-sidebar-item-link" href={item.href} key={item.label}>
          {item.label}
        </Link>
      );
    }

    return (
      <p className="splash-sidebar-item" key={item.label}>
        {item.label}
      </p>
    );
  };

  return (
    <main className="splash-shell">
      <aside className="splash-sidebar">
        <div className="splash-sidebar-utility-row">
          {isSignedIn ? (
            <Link
              aria-label="Open options and settings"
              className="splash-sidebar-utility-button"
              href="/admin/settings"
              title="Options & Settings"
            >
              ...
            </Link>
          ) : (
            <span aria-hidden="true" className="splash-sidebar-utility-button" data-disabled="true">
              ...
            </span>
          )}
        </div>

        <div className="splash-sidebar-brand">
          <img alt="FlockTrax Victor mark" className="splash-sidebar-logo" src="/victor.svg" />
          <div className="splash-sidebar-copy">
            <FlockTraxWordmark compact descriptor={splash.descriptor} product="Admin" tone="light" />
            <p className="splash-sidebar-subcopy">{splash.productLabel}</p>
          </div>
        </div>

        {!isSignedIn ? (
          <div className="splash-sidebar-login-row">
            <Link className="button splash-sidebar-login-button" href="/login">
              Login
            </Link>
          </div>
        ) : (
          <div className="splash-sidebar-identity-card" aria-label="Signed in user">
            <p className="splash-sidebar-identity-name">{displayName}</p>
            <p className="splash-sidebar-identity-role">{roleLabel}</p>
            {scopeLabel ? <p className="splash-sidebar-identity-scope">{scopeLabel}</p> : null}
          </div>
        )}

        <div className="splash-sidebar-datetime">
          <p>
            {sidebarDate} · {sidebarTime}
          </p>
        </div>

        <div className="splash-sidebar-groups" data-disabled={!isSignedIn}>
          <div className="splash-sidebar-group" data-disabled={!isSignedIn}>
            <p className="splash-sidebar-label">Console</p>
            {consoleLinks.map(renderSplashNavItem)}
          </div>

          <div className="splash-sidebar-group" data-disabled={!isSignedIn}>
            <p className="splash-sidebar-label">Configuration</p>
            {configurationLinks.map(renderSplashNavItem)}
          </div>

          <div className="splash-sidebar-group" data-disabled={!isSignedIn}>
            <p className="splash-sidebar-label">Archives</p>
            {archiveLinks.map(renderSplashNavItem)}
          </div>
        </div>

        <div className="splash-sidebar-footer">
          <p>{splash.copyrightLine}</p>
          {splash.versionLine ? <p>{splash.versionLine}</p> : null}
        </div>
      </aside>

      <section className="splash-workspace">
        <section className="panel hero-panel splash-hero-panel">
          <div className="splash-hero-copy">
            <div className="splash-hero-brand-lockup">
              <FlockTraxWordmark compact product="Admin" tone="accent" />
            </div>
            <p className="hero-kicker splash-hero-tagline">{splash.descriptor}</p>
            <h1 className="hero-title splash-hero-title">{splash.title}</h1>
            <p className="hero-body splash-hero-body">{splash.body}</p>
          </div>
        </section>

        <section className="splash-signature-band" aria-label="Platform signature">
          <div className="registry-subtitle-line splash-signature-line">
            <FlockTraxWordmark compact product="Admin" />
            <span className="registry-subtitle-separator" aria-hidden="true">
              &
            </span>
            <FlockTraxWordmark compact product="Mobile" />
          </div>
          <p className="registry-subtitle-platform splash-signature-type">{splash.productLabel}</p>
          {splash.subsystemLine ? (
            <p className="registry-subtitle-copy splash-signature-subsystems">{splash.subsystemLine}</p>
          ) : null}
          <p className="registry-subtitle-copy splash-signature-copyright">{splash.copyrightLine}</p>
          {splash.versionLine ? <p className="splash-signature-version">{splash.versionLine}</p> : null}
        </section>
      </section>
    </main>
  );
}
