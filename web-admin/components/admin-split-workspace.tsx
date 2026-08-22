"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

const STORAGE_KEY = "flocktrax:admin-split-workspace:v1";
const MIN_PANE_PERCENT = 28;
const MAX_PANE_PERCENT = 72;
const DEFAULT_SECONDARY_HREF = "/admin/reports";

type SavedWorkspace = {
  enabled?: boolean;
  primaryHref?: string;
  secondaryHref?: string;
  primaryPercent?: number;
};

type PendingNavigation = {
  href: string;
  startedAt: number;
};

export type AdminSplitWorkspaceState = {
  enabled: boolean;
  supported: boolean;
  hydrated: boolean;
  primaryHref: string;
  secondaryHref: string;
  primaryPercent: number;
  gridRef: RefObject<HTMLDivElement | null>;
  primaryFrameRef: RefObject<HTMLIFrameElement | null>;
  secondaryFrameRef: RefObject<HTMLIFrameElement | null>;
  toggle: () => void;
  close: () => void;
  openPrimary: (href: string) => void;
  openSecondary: (href: string) => void;
  swap: () => void;
  reloadPrimary: () => void;
  reloadSecondary: () => void;
  beginResize: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  syncFrameLocations: () => void;
};

function currentAdminHref(fallback: string) {
  if (typeof window === "undefined") return fallback;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function normalizeAdminHref(value: string | null | undefined, fallback: string) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return fallback;

  try {
    const base = typeof window === "undefined" ? "https://flocktrax.com" : window.location.origin;
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base || !parsed.pathname.startsWith("/admin")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function readSavedWorkspace(): SavedWorkspace {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as SavedWorkspace;
  } catch {
    return {};
  }
}

function readFrameHref(frame: HTMLIFrameElement | null) {
  try {
    const location = frame?.contentWindow?.location;
    if (!location || location.origin !== window.location.origin || !location.pathname.startsWith("/admin")) return null;
    return `${location.pathname}${location.search}${location.hash}`;
  } catch {
    return null;
  }
}

function frameHref(frame: HTMLIFrameElement | null, fallback: string) {
  return readFrameHref(frame) ?? fallback;
}

function formatPaneTitle(href: string) {
  const path = href.split(/[?#]/)[0];
  const known = [
    ["/admin/overview", "Live Dashboard"],
    ["/admin/issues", "Action Items"],
    ["/admin/feed-tickets", "Feed Tickets"],
    ["/admin/reports", "Reports"],
    ["/admin/placements/new", "Placement Schedule"],
    ["/admin/placements/livehaul", "Livehaul"],
    ["/admin/flock-closeout", "Closeout"],
    ["/admin/flocks", "Flocks"],
    ["/admin/activity-log", "Activity Log"],
    ["/admin/about", "About FlockTrax"],
  ] as const;
  const match = known.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (match) return match[1];

  const segment = path.split("/").filter(Boolean).at(-1) ?? "FlockTrax";
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function useAdminSplitWorkspace(pathname: string, embedded: boolean): AdminSplitWorkspaceState {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [primaryHref, setPrimaryHref] = useState(pathname);
  const [secondaryHref, setSecondaryHref] = useState(DEFAULT_SECONDARY_HREF);
  const [primaryPercent, setPrimaryPercent] = useState(50);
  const gridRef = useRef<HTMLDivElement>(null);
  const primaryFrameRef = useRef<HTMLIFrameElement>(null);
  const secondaryFrameRef = useRef<HTMLIFrameElement>(null);
  const pendingPrimaryHrefRef = useRef<PendingNavigation | null>(null);
  const pendingSecondaryHrefRef = useRef<PendingNavigation | null>(null);

  useEffect(() => {
    if (embedded) {
      setHydrated(true);
      return;
    }

    const media = window.matchMedia("(min-width: 1181px)");
    const saved = readSavedWorkspace();
    const fallbackPrimary = currentAdminHref(pathname);
    setSupported(media.matches);
    setPrimaryHref(normalizeAdminHref(saved.primaryHref, fallbackPrimary));
    setSecondaryHref(normalizeAdminHref(saved.secondaryHref, DEFAULT_SECONDARY_HREF));
    setPrimaryPercent(
      typeof saved.primaryPercent === "number"
        ? Math.min(MAX_PANE_PERCENT, Math.max(MIN_PANE_PERCENT, saved.primaryPercent))
        : 50,
    );
    setEnabled(media.matches && saved.enabled === true);
    setHydrated(true);

    const handleWidthChange = (event: MediaQueryListEvent) => {
      setSupported(event.matches);
      if (!event.matches) {
        setEnabled(false);
        return;
      }
      setEnabled(readSavedWorkspace().enabled === true);
    };

    media.addEventListener("change", handleWidthChange);
    return () => media.removeEventListener("change", handleWidthChange);
  }, [embedded, pathname]);

  useEffect(() => {
    if (!hydrated || embedded || !supported) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ enabled, primaryHref, secondaryHref, primaryPercent } satisfies SavedWorkspace),
    );
  }, [embedded, enabled, hydrated, primaryHref, primaryPercent, secondaryHref, supported]);

  useEffect(() => {
    if (!hydrated || enabled || embedded) return;
    setPrimaryHref(currentAdminHref(pathname));
  }, [embedded, enabled, hydrated, pathname]);

  const syncFrameLocations = () => {
    const syncPane = (
      frame: HTMLIFrameElement | null,
      pendingRef: { current: PendingNavigation | null },
      setHref: (updater: (current: string) => string) => void,
    ) => {
      setHref((current) => {
        const observed = readFrameHref(frame);
        if (!observed) return current;
        const pending = pendingRef.current;
        if (!pending) return observed;
        if (observed === pending.href) {
          pendingRef.current = null;
          return observed;
        }
        if (Date.now() - pending.startedAt >= 10000) {
          pendingRef.current = null;
          return observed;
        }
        return current;
      });
    };

    syncPane(primaryFrameRef.current, pendingPrimaryHrefRef, setPrimaryHref);
    syncPane(secondaryFrameRef.current, pendingSecondaryHrefRef, setSecondaryHref);
  };

  const navigateFrame = (
    frame: HTMLIFrameElement | null,
    pendingRef: { current: PendingNavigation | null },
    setHref: (href: string) => void,
    href: string,
    fallback: string,
  ) => {
    const target = normalizeAdminHref(href, fallback);
    pendingRef.current = { href: target, startedAt: Date.now() };
    setHref(target);
    try {
      frame?.contentWindow?.location.assign(target);
    } catch {
      // The controlled src update remains the navigation fallback.
    }
  };

  useEffect(() => {
    if (!enabled || embedded) return;
    const intervalId = window.setInterval(syncFrameLocations, 750);
    return () => window.clearInterval(intervalId);
  }, [embedded, enabled]);

  const close = () => {
    const target = frameHref(primaryFrameRef.current, primaryHref);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ enabled: false, primaryHref: target, secondaryHref, primaryPercent } satisfies SavedWorkspace),
    );
    setEnabled(false);
    if (currentAdminHref(pathname) !== target) {
      window.location.assign(target);
    }
  };

  const toggle = () => {
    if (enabled) {
      close();
      return;
    }
    if (!supported) return;
    setPrimaryHref(currentAdminHref(pathname));
    setEnabled(true);
  };

  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const bounds = gridRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const handleMove = (moveEvent: PointerEvent) => {
      const rawPercent = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      setPrimaryPercent(Math.min(MAX_PANE_PERCENT, Math.max(MIN_PANE_PERCENT, rawPercent)));
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  };

  return {
    enabled,
    supported,
    hydrated,
    primaryHref,
    secondaryHref,
    primaryPercent,
    gridRef,
    primaryFrameRef,
    secondaryFrameRef,
    toggle,
    close,
    openPrimary: (href) => navigateFrame(primaryFrameRef.current, pendingPrimaryHrefRef, setPrimaryHref, href, primaryHref),
    openSecondary: (href) => navigateFrame(secondaryFrameRef.current, pendingSecondaryHrefRef, setSecondaryHref, href, secondaryHref),
    swap: () => {
      const currentPrimary = frameHref(primaryFrameRef.current, primaryHref);
      const currentSecondary = frameHref(secondaryFrameRef.current, secondaryHref);
      navigateFrame(primaryFrameRef.current, pendingPrimaryHrefRef, setPrimaryHref, currentSecondary, secondaryHref);
      navigateFrame(secondaryFrameRef.current, pendingSecondaryHrefRef, setSecondaryHref, currentPrimary, primaryHref);
    },
    reloadPrimary: () => primaryFrameRef.current?.contentWindow?.location.reload(),
    reloadSecondary: () => secondaryFrameRef.current?.contentWindow?.location.reload(),
    beginResize,
    syncFrameLocations,
  };
}

export function AdminWorkspaceContent({
  children,
  workspace,
}: {
  children: ReactNode;
  workspace: AdminSplitWorkspaceState;
}) {
  if (!workspace.enabled) {
    return <div className="content-shell">{children}</div>;
  }

  const gridStyle = {
    gridTemplateColumns: `${workspace.primaryPercent}fr 10px ${100 - workspace.primaryPercent}fr`,
  } satisfies CSSProperties;

  return (
    <div className="content-shell admin-split-content-shell">
      <div className="admin-split-toolbar">
        <strong>Split Workspace</strong>
        <span>Use the arrow beside any sidebar option to open it in the right pane.</span>
        <div className="admin-split-toolbar-actions">
          <button className="button-secondary" onClick={workspace.swap} type="button">Swap panes</button>
          <button className="button-secondary" onClick={workspace.close} type="button">Close split</button>
        </div>
      </div>
      <div className="admin-split-grid" ref={workspace.gridRef} style={gridStyle}>
        <section className="admin-split-pane">
          <header className="admin-split-pane-header">
            <span><small>Left</small>{formatPaneTitle(workspace.primaryHref)}</span>
            <button aria-label="Reload left pane" onClick={workspace.reloadPrimary} title="Reload left pane" type="button">↻</button>
          </header>
          <iframe
            allow="clipboard-read; clipboard-write"
            onLoad={workspace.syncFrameLocations}
            ref={workspace.primaryFrameRef}
            src={workspace.primaryHref}
            title="FlockTrax left workspace pane"
          />
        </section>
        <button
          aria-label="Resize split panes"
          className="admin-split-divider"
          onPointerDown={workspace.beginResize}
          role="separator"
          title="Drag to resize panes"
          type="button"
        ><span /></button>
        <section className="admin-split-pane">
          <header className="admin-split-pane-header">
            <span><small>Right</small>{formatPaneTitle(workspace.secondaryHref)}</span>
            <button aria-label="Reload right pane" onClick={workspace.reloadSecondary} title="Reload right pane" type="button">↻</button>
          </header>
          <iframe
            allow="clipboard-read; clipboard-write"
            onLoad={workspace.syncFrameLocations}
            ref={workspace.secondaryFrameRef}
            src={workspace.secondaryHref}
            title="FlockTrax right workspace pane"
          />
        </section>
      </div>
    </div>
  );
}