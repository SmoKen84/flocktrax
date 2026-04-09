"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";

const navSections = [
  {
    label: "Operate",
    items: [
      { href: "/admin/overview", label: "Overview" },
      { href: "/admin/placements/new", label: "New Placement" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { href: "/admin/farm-groups", label: "Farm Groups" },
      { href: "/admin/farms", label: "Farms" },
      { href: "/admin/flocks", label: "Flocks" },
    ],
  },
];

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <div className="brand-badge">
            <img alt="FlockTrax Victor mark" className="brand-logo" src="/victor.svg" />
          </div>
          <div className="brand-copy">
            <FlockTraxWordmark
              compact
              descriptor="Admin and reporting console"
              product="Admin"
              tone="light"
            />
          </div>
        </div>

        {navSections.map((section) => (
          <div className="nav-group" key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link className="nav-link" data-active={active} href={item.href} key={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="content-shell">{children}</div>
    </main>
  );
}
