import Link from "next/link";

import { ActivePlacementDashboard } from "@/components/active-placement-dashboard";
import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { getAdminData } from "@/lib/admin-data";

export default async function OverviewPage() {
  const data = await getAdminData();

  return (
    <>
      <section className="panel hero-panel live-overview-hero">
        <p className="hero-kicker">Operations Overview</p>
        <div className="live-overview-hero-row">
          <div className="live-overview-hero-copy">
            <FlockTraxWordmark compact product="Admin" tone="accent" />
          </div>
          <div className="hero-actions">
            <Link className="button" href="/admin/placements/new">
              Placements
            </Link>
            <Link className="button-secondary" href="/admin/farms">
              Review Farms
            </Link>
          </div>
        </div>
      </section>

      <ActivePlacementDashboard
        farmGroups={data.farmGroups}
        farms={data.farms}
        placements={data.activePlacements}
      />

      <section className="grid-2">
        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Alerts</p>
              <h2>Operational watch items</h2>
            </div>
          </div>
          <div className="stack">
            {data.alerts.map((alert) => (
              <div className="card" key={alert.id}>
                <div className="section-header" style={{ marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>{alert.title}</h3>
                  <span className="status-pill" data-tone={alert.tone}>
                    {alert.tone}
                  </span>
                </div>
                <p className="body-copy">{alert.body}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Farm Groups</p>
              <h2>Operating-company rollup</h2>
            </div>
          </div>
          <div className="stack">
            {data.farmGroups.map((group) => (
              <div className="card" key={group.id}>
                <p className="table-title">{group.groupName}</p>
                <p className="table-subtitle">{group.legalName}</p>
                <p className="meta-copy">
                  {group.farmCount} farms · {group.activePlacements} active placements · {group.integrator}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Next Placements</p>
              <h2>Likely upcoming allocations</h2>
            </div>
          </div>
          <div className="stack">
            {data.placementHints.map((hint) => (
              <div className="card" key={hint.placementCode}>
                <p className="table-title">
                  {hint.farmName} · Barn {hint.barnCode}
                </p>
                <p className="table-subtitle">
                  Placement {hint.placementCode} from flock {hint.flockCode}
                </p>
                <p className="meta-copy">
                  {hint.startDate} to {hint.projectedEndDate}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
