import Link from "next/link";

import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { applicationRegistry } from "@/lib/app-registry";

export default function HomePage() {
  return (
    <main className="app-shell" style={{ gridTemplateColumns: "1fr" }}>
      <section className="panel hero-panel">
        <div className="landing-utility-row">
          <Link
            aria-label="Open application registry"
            className="button-ghost landing-utility-button"
            href="/admin/app-registry"
            title="Application registry"
          >
            ...
          </Link>
        </div>
        <FlockTraxWordmark
          compact
          descriptor="Operational command surface for setup, oversight, and reporting."
          product="Admin"
          tone="accent"
        />
        <h1 className="hero-title">Build the operation around real farms, barns, flocks, and placements.</h1>
        <p className="hero-body">
          This web console is the admin side of FlockTrax. It is designed for setup, allocation, reporting,
          and oversight while the mobile app stays focused on fast barn-floor data entry.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/admin/overview">
            Open Admin Console
          </Link>
          <Link className="button-secondary" href="/admin/placements/new">
            Create Placement
          </Link>
        </div>
      </section>

      <section className="landing-signature-block" aria-label="FlockTrax platform signature">
        <p className="registry-subtitle-line">
          <FlockTraxWordmark compact product="Admin" />
          <span className="registry-subtitle-separator" aria-hidden="true">
            &
          </span>
          <FlockTraxWordmark compact product="Mobile" />
        </p>
        <p className="registry-subtitle-platform">{applicationRegistry.subtitleLine[2]}</p>
        <p className="registry-subtitle-copy">{applicationRegistry.descriptorLine}</p>
        <p className="registry-subtitle-copy">
          Copyright &copy; 2026 All Rights Reserved. Smotherman Farms, Ltd. West, Texas.
        </p>
      </section>
    </main>
  );
}
