import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getFlockById } from "@/lib/admin-data";
import { getAppSettingTextValues } from "@/lib/platform-content";

type FlockDetailPageProps = {
  params: Promise<{ flockId: string }>;
};

export default async function FlockDetailPage({ params }: FlockDetailPageProps) {
  const { flockId } = await params;
  const [flock, appText] = await Promise.all([
    getFlockById(flockId),
    getAppSettingTextValues(["flock_history_title"]),
  ]);

  if (!flock) {
    notFound();
  }

  const historyReportLabel = appText.get("flock_history_title")?.value || "History Report";

  return (
    <>
      <PageHeader
        eyebrow="Flock Detail"
        title={`Flock ${flock.flockCode} is the planning source for one or more placements.`}
        body="This is where admins will eventually maintain flock-specific planning data such as placed date, estimated first live haul, bird counts, and allocation intent."
        actions={
          <>
            <Link className="button" href={`/admin/flocks/${flock.id}/report`} rel="noreferrer" target="_blank">
              {historyReportLabel}
            </Link>
            <Link
              className="button-secondary"
              href={`/admin/flocks/${flock.id}/report?mode=micro`}
              rel="noreferrer"
              target="_blank"
            >
              Micro Archive Copy
            </Link>
          </>
        }
      />

      <section className="panel card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Planning Profile</p>
            <h2>Flock data</h2>
          </div>
        </div>
        <dl className="detail-grid">
          <div className="detail-item">
            <dt>Integrator</dt>
            <dd>{flock.integrator}</dd>
          </div>
          <div className="detail-item">
            <dt>Placed Date</dt>
            <dd>{flock.placedDate}</dd>
          </div>
          <div className="detail-item">
            <dt>Est. First Catch</dt>
            <dd>{flock.estimatedFirstCatch}</dd>
          </div>
          <div className="detail-item">
            <dt>Status</dt>
            <dd>{flock.status}</dd>
          </div>
          <div className="detail-item">
            <dt>Female Count</dt>
            <dd>{flock.femaleCount.toLocaleString()}</dd>
          </div>
          <div className="detail-item">
            <dt>Male Count</dt>
            <dd>{flock.maleCount.toLocaleString()}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
