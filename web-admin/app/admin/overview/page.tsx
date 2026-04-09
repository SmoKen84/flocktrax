import Link from "next/link";

import { ActivePlacementDashboard } from "@/components/active-placement-dashboard";
import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";

export default async function OverviewPage() {
  const data = await getAdminData();

  return (
    <>
      <PageHeader
        eyebrow="Operations Overview"
        title="See the operation, spot the gaps, and stay ahead of placement turnover."
        body="This admin view is for planning and supervision. It keeps the desktop side dense and useful while the mobile app stays simple for line crews."
        actions={
          <>
            <Link className="button" href="/admin/placements/new">
              Start Placement Wizard
            </Link>
            <Link className="button-secondary" href="/admin/farms">
              Review Farms
            </Link>
          </>
        }
      />

      <section className="grid-3">
        <article className="card">
          <p className="stat-label">Active Placements</p>
          <p className="stat-value">{data.stats.activePlacements}</p>
          <p className="stat-help">Placements visible to worker crews right now.</p>
        </article>
        <article className="card">
          <p className="stat-label">Farm Groups</p>
          <p className="stat-value">{data.farmGroups.length}</p>
          <p className="stat-help">Operating companies managing one or more grow-out farms.</p>
        </article>
        <article className="card">
          <p className="stat-label">Farms Online</p>
          <p className="stat-value">{data.stats.farmsOnline}</p>
          <p className="stat-help">Farm locations with active or near-term activity.</p>
        </article>
        <article className="card">
          <p className="stat-label">Barns Ready</p>
          <p className="stat-value">{data.stats.barnsReady}</p>
          <p className="stat-help">Barns either in cycle now or available for the next placement plan.</p>
        </article>
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
