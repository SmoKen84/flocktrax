import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { evaluateEnvironmentSafety } from "@/lib/environment-safety";

export default function GoogleSheetsSyncPage() {
  const environment = evaluateEnvironmentSafety();

  if (!environment.isDemo) {
    redirect("/admin/sync/googleapis-sheets/outbox");
  }

  return (
    <>
      <PageHeader
        eyebrow="Demo Integration"
        title="Google Sheets Sync is safely disabled"
        body="Production FlockTrax can send approved operational changes to each integrator's Google Sheets workbook. This demo preserves the complete queue and mapping workflow without contacting any external workbook."
      />

      <section className="panel sync-engine-page">
        <p className="sync-engine-banner sync-engine-banner-success">
          <strong>Intentional demo behavior:</strong> outbound Google Sheets credentials and scheduled processing are absent, and the demo outbound safety gate is set to disabled. Nothing entered here can alter an integrator's workbook.
        </p>

        <article className="card sync-engine-shell">
          <div className="sync-engine-shell-header">
            <div>
              <p className="eyebrow">Safe Functionality Preview</p>
              <h2>The production workflow remains represented</h2>
              <p className="hero-body">
                Evaluators can inspect the outbox, per-farm workbook configuration, and field-to-column mapping screens. External delivery is deliberately unavailable in this isolated environment.
              </p>
            </div>
            <div className="sync-engine-hero-card">
              <p className="sync-engine-hero-label">Demo Safety State</p>
              <strong>Outbound mode: disabled</strong>
              <p>Queued examples remain inside the synthetic demo database.</p>
            </div>
          </div>

          <div className="hero-actions">
            <Link className="button" href="/admin/sync/googleapis-sheets/outbox" prefetch={false}>
              Explore Outbox
            </Link>
            <Link className="button-secondary" href="/admin/sync/googleapis-sheets/config" prefetch={false}>
              View Workbook Setup
            </Link>
            <Link className="button-secondary" href="/admin/sync/googleapis-sheets/columns" prefetch={false}>
              View Column Mapping
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
