import Link from "next/link";

type SyncEngineNavProps = {
  current: "config" | "outbox" | "columns";
};

const NAV_ITEMS: Array<{ key: SyncEngineNavProps["current"]; href: string; label: string }> = [
  { key: "outbox", href: "/admin/sync/googleapis-sheets/outbox", label: "Outbox" },
  { key: "config", href: "/admin/sync/googleapis-sheets/config", label: "Config" },
  { key: "columns", href: "/admin/sync/googleapis-sheets/columns", label: "Column Map" },
];

export function SyncEngineNav({ current }: SyncEngineNavProps) {
  return (
    <div className="sync-engine-nav" role="navigation" aria-label="Google Sheets sync sections">
      {NAV_ITEMS.map((item) => (
        <Link
          aria-current={item.key === current ? "page" : undefined}
          className={`sync-engine-nav-link ${item.key === current ? "button is-active" : "button-secondary"}`}
          href={item.href}
          key={item.key}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
