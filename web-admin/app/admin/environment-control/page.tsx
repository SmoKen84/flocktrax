import { notFound } from "next/navigation";

import { getEnvironmentControlSnapshot, hasEnvironmentControlAccess } from "@/lib/environment-control";

const statusLabels = {
  configured: "Configured",
  missing: "Missing",
  external: "Verify externally",
  action: "Action required",
} as const;

export const dynamic = "force-dynamic";

export default async function EnvironmentControlPage() {
  if (!(await hasEnvironmentControlAccess())) {
    notFound();
  }

  const snapshot = getEnvironmentControlSnapshot();

  return (
    <>
      <section className="panel environment-control-hero">
        <div>
          <p className="hero-kicker">Very Superadmin · Owner access only</p>
          <h1 className="hero-title">Environment Control</h1>
          <p className="hero-body">
            One place to verify everything that binds FlockTrax to production or demo data. This screen deliberately
            does not accept or reveal secrets, and it cannot retarget a running production deployment.
          </p>
        </div>
        <div className="environment-control-score" data-ready={snapshot.webConfiguredCount === snapshot.webRequiredCount}>
          <span>Web binding</span>
          <strong>{snapshot.webConfiguredCount}/{snapshot.webRequiredCount}</strong>
          <small>required values configured</small>
        </div>
      </section>

      <section className="environment-summary-grid" aria-label="Current deployment identity">
        <article className="card environment-summary-card">
          <span>Environment</span>
          <strong>{snapshot.environmentName}</strong>
          <small>{snapshot.environmentNameIsExplicit ? "Explicitly labeled" : "Label must be configured"}</small>
        </article>
        <article className="card environment-summary-card">
          <span>Application</span>
          <strong>{snapshot.appHost}</strong>
          <small>{snapshot.deploymentProvider} · {snapshot.deploymentStage}</small>
        </article>
        <article className="card environment-summary-card">
          <span>Supabase project</span>
          <strong>{snapshot.supabaseProjectRef}</strong>
          <small>{snapshot.supabaseHost}</small>
        </article>
      </section>

      <section className="panel environment-topology-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Required topology</p>
            <h2>Production and demo stay parallel</h2>
          </div>
        </div>
        <div className="environment-topology">
          <div className="environment-topology-node">
            <span>Production URL</span>
            <strong>flocktrax.com</strong>
          </div>
          <span className="environment-topology-arrow" aria-hidden="true">→</span>
          <div className="environment-topology-node">
            <span>Production deployment</span>
            <strong>Production variables</strong>
          </div>
          <span className="environment-topology-arrow" aria-hidden="true">→</span>
          <div className="environment-topology-node environment-topology-node-database">
            <span>Production Supabase</span>
            <strong>Live data</strong>
          </div>
        </div>
        <div className="environment-topology environment-topology-demo">
          <div className="environment-topology-node">
            <span>Demo URL</span>
            <strong>demo.flocktrax.com</strong>
          </div>
          <span className="environment-topology-arrow" aria-hidden="true">→</span>
          <div className="environment-topology-node">
            <span>Demo deployment</span>
            <strong>Demo variables</strong>
          </div>
          <span className="environment-topology-arrow" aria-hidden="true">→</span>
          <div className="environment-topology-node environment-topology-node-database">
            <span>Demo Supabase</span>
            <strong>Scrubbed demo data</strong>
          </div>
        </div>
        <p className="environment-topology-note">
          The same tested commit can serve both environments. The deployment variables select the database before the
          application starts; production never changes its own destination at runtime.
        </p>
      </section>

      <div className="environment-check-groups">
        {snapshot.groups.map((group) => (
          <section className="panel environment-check-panel" key={group.title}>
            <div className="environment-check-heading">
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <div className="environment-check-list">
              {group.checks.map((check) => (
                <article className="environment-check-row" key={check.name}>
                  <div className="environment-check-name">
                    <strong>{check.name}</strong>
                    <code>{check.location}</code>
                  </div>
                  <div className="environment-check-value">
                    <span className="environment-status" data-status={check.status}>
                      {statusLabels[check.status]}
                    </span>
                    <strong>{check.value}</strong>
                  </div>
                  <p>{check.detail}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="panel environment-activation-panel">
        <p className="eyebrow">Activation gate</p>
        <h2>No one-click switch by design</h2>
        <p>
          A demo becomes available only after its Supabase project, Vercel deployment, domain, authentication redirects,
          storage, Edge Functions, and safe integration policy are independently complete. At that point this screen can
          be extended to trigger or verify deployment automation without ever storing infrastructure secrets in the app database.
        </p>
      </section>
    </>
  );
}
