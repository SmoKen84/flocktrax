import Link from "next/link";
import { notFound } from "next/navigation";

import { GoBackButton } from "@/components/go-back-button";
import { PageHeader } from "@/components/page-header";
import { getFlockById } from "@/lib/admin-data";
import { getFlockHistoryReportBundle } from "@/lib/flock-history-report";

type FlockDetailPageProps = {
  params: Promise<{ flockId: string }>;
};

export default async function FlockDetailPage({ params }: FlockDetailPageProps) {
  const { flockId } = await params;
  const [flock, report] = await Promise.all([
    getFlockById(flockId),
    getFlockHistoryReportBundle(flockId),
  ]);

  if (!flock || !report || flock.status !== "complete") {
    notFound();
  }

  const primaryPlacement = report.placements[0] ?? null;
  const archiveLabel = primaryPlacement?.placementCode ?? flock.flockCode;

  return (
    <>
      <PageHeader
        eyebrow="Flock Detail"
        title={`Archived Flock ${archiveLabel}`}
        body="This flock has been Completed & Archived. To preserve audit continuity; Documents may be attached for reference and Comments/Notes may be updated only. Final flock reports are also available to be reprinted."
        actions={
          <>
            {primaryPlacement ? (
              <>
                <Link
                  className="button"
                  href={`/admin/flock-closeout/${primaryPlacement.placementId}/report`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Closeout Report
                </Link>
                <Link
                  className="button"
                  href={`/admin/flock-closeout/${primaryPlacement.placementId}/archive-summary`}
                  rel="noreferrer"
                  target="_blank"
                >
                  Flock Detail Report
                </Link>
              </>
            ) : null}
            <GoBackButton />
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

      <section className="panel card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Archived Placements</p>
            <h2>Placement records and documents</h2>
          </div>
          <p className="hero-body">
            Open a placement record to review its archived details, attach reference documents, or update its comments and notes.
          </p>
        </div>

        {report.placements.length > 0 ? (
          <div className="closeout-summary-grid">
            {report.placements.map((placement) => (
              <article className="panel card closeout-summary-card" key={placement.placementId}>
                <p className="eyebrow">Placement</p>
                <strong>{placement.placementCode}</strong>
                <p className="table-subtitle">{`${placement.farmName} | Barn ${placement.barnCode}`}</p>
                <p className="table-subtitle">
                  {`Placed ${formatDate(placement.placedDate)} | Removed ${formatDate(placement.removedDate)}`}
                </p>
                <div className="closeout-action-links">
                  <Link
                    className="button"
                    href={`/admin/flock-closeout/${placement.placementId}?source=flocks`}
                  >
                    Open Full Flock Record
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="placement-scheduler-projection">
            <span>No placement context available</span>
            <strong>This archived flock does not currently expose any linked placement records.</strong>
          </div>
        )}
      </section>
    </>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}
