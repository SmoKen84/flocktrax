import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getFlockById } from "@/lib/admin-data";
import { getFlockHistoryReportBundle } from "@/lib/flock-history-report";
import { getAppSettingTextValues } from "@/lib/platform-content";

type FlockDetailPageProps = {
  params: Promise<{ flockId: string }>;
};

export default async function FlockDetailPage({ params }: FlockDetailPageProps) {
  const { flockId } = await params;
  const [flock, report, appText] = await Promise.all([
    getFlockById(flockId),
    getFlockHistoryReportBundle(flockId),
    getAppSettingTextValues(["flock_history_title"]),
  ]);

  if (!flock || !report) {
    notFound();
  }

  const historyReportLabel = appText.get("flock_history_title")?.value || "History Report";
  const primaryPlacement = report.placements[0] ?? null;
  const primaryForceLivehaulHref = primaryPlacement ? buildForceLivehaulHref(primaryPlacement) : null;

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
            {primaryForceLivehaulHref ? (
              <Link className="button" href={primaryForceLivehaulHref as string}>
                Force Open Livehaul Scheduler
              </Link>
            ) : null}
          </>
        }
      />

      {primaryPlacement ? (
        <section className="panel card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Quick Access</p>
              <h2>Retroactive closeout shortcut</h2>
            </div>
            <p className="hero-body">
              Use this shortcut to open the livehaul scheduler directly for {primaryPlacement.placementCode} and add prior livehaul rows needed for closeout work.
            </p>
          </div>
          <div className="closeout-action-links">
            <Link className="button" href={primaryForceLivehaulHref as string}>
              Force Open Livehaul Scheduler For {primaryPlacement.placementCode}
            </Link>
          </div>
        </section>
      ) : null}

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
            <p className="eyebrow">Retroactive Closeout Tools</p>
            <h2>Force open livehaul scheduler</h2>
          </div>
          <p className="hero-body">
            Use this to create or repair livehaul rows for any placement tied to this flock, even when it never showed in the closeout queue.
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
                  <Link className="button" href={buildForceLivehaulHref(placement)}>
                    Force Open Livehaul Scheduler
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="placement-scheduler-projection">
            <span>No placement context available</span>
            <strong>This flock does not currently expose any placement rows to anchor a livehaul scheduler jump.</strong>
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

function buildForceLivehaulHref(placement: {
  placementId: string;
  farmId: string;
  barnId: string;
  placedDate: string | null;
  projectedEndDate: string | null;
  removedDate: string | null;
}) {
  const anchorDate = placement.removedDate ?? placement.projectedEndDate ?? placement.placedDate;
  const month = anchorDate ? anchorDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const query = new URLSearchParams();
  if (placement.farmId) {
    query.set("farm", placement.farmId);
  }
  if (placement.barnId) {
    query.set("barn", placement.barnId);
  }
  query.set("placement", placement.placementId);
  query.set("month", month);
  if (anchorDate) {
    query.set("date", anchorDate);
  }
  return `/admin/placements/livehaul?${query.toString()}`;
}
