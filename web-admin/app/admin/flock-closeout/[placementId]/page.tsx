import Link from "next/link";
import { notFound } from "next/navigation";

import { CloseoutLivehaulLoadsPanel } from "@/app/admin/flock-closeout/closeout-livehaul-load-forms";
import { CloseoutWorksheetForm } from "@/app/admin/flock-closeout/closeout-worksheet-form";
import { PageHeader } from "@/components/page-header";
import { getCloseoutQueueData } from "@/lib/closeout-data";

type CloseoutPlacementPageProps = {
  params: Promise<{
    placementId: string;
  }>;
};

export default async function CloseoutPlacementPage({ params }: CloseoutPlacementPageProps) {
  const { placementId } = await params;
  const queue = await getCloseoutQueueData({ placement: placementId });
  const item = queue.items.find((entry) => entry.placementId === placementId) ?? null;

  if (!item) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Closeout"
        title={item.placementCode}
        body={`Focused closeout workspace for ${item.farmName}, Barn ${item.barnCode}. Enter actual livehaul detail, reconcile what has been done, and then return to the queue when this placement is ready for final submission.`}
        actions={
          <>
            <Link
              className="button"
              href={`/admin/flock-closeout/${item.placementId}/report`}
              rel="noreferrer"
              target="_blank"
            >
              Closeout Report
            </Link>
            <Link
              className="button"
              href={`/admin/flock-closeout/${item.placementId}/archive-summary`}
              rel="noreferrer"
              target="_blank"
            >
              Save Digital Archive Summary
            </Link>
            <Link className="button-secondary" href="/admin/flock-closeout">
              Return To Queue
            </Link>
          </>
        }
      />

      <section className="closeout-summary-grid">
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">State</p>
          <strong>{formatStage(item.lifecycleStage)}</strong>
          <p className="table-subtitle">Current placement closeout state</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Placed / Removed</p>
          <strong>{`${formatDate(item.placedDate)} | ${formatDate(item.removedDate)}`}</strong>
          <p className="table-subtitle">Placement lifecycle dates</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Birds Started</p>
          <strong>{item.headCount.toLocaleString()}</strong>
          <p className="table-subtitle">Starting head count</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Final / Oldest Age</p>
          <strong>{`${item.finalHeadCount.toLocaleString()} | ${formatAge(item.placedDate, item.removedDate)}`}</strong>
          <p className="table-subtitle">Final actual population and age</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Issues: Barn / Placement</p>
          <strong>{`${item.openBarnIssueCount.toLocaleString()} | ${item.openPlacementIssueCount.toLocaleString()}`}</strong>
          <p className="table-subtitle">Open issue counts</p>
        </article>
      </section>

      <section className="closeout-detail-stack">
        <CloseoutWorksheetForm item={item} />

        {item.livehauls.length > 0 ? (
          item.livehauls.map((livehaul) => (
            <CloseoutLivehaulLoadsPanel item={item} key={livehaul.livehaulId} livehaul={livehaul} />
          ))
        ) : (
          <section className="panel card">
            <div className="placement-scheduler-projection">
              <span>No scheduled livehauls</span>
              <strong>This placement does not yet have livehaul schedule rows available for closeout work.</strong>
              <p>Schedule the livehaul dates first in Placements &gt; Livehaul, then return here to complete the actual closeout detail.</p>
            </div>
          </section>
        )}
      </section>
    </>
  );
}

function formatStage(value: string) {
  if (value === "waiting_closeout") return "Waiting Closeout";
  if (value === "closeout_submitted") return "Closeout Submitted";
  return "Closeout";
}

function formatDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

function formatAge(placedDate: string | null, removedDate: string | null) {
  if (!placedDate || !removedDate) return "--";
  const placed = new Date(`${placedDate}T00:00:00`);
  const removed = new Date(`${removedDate}T00:00:00`);
  if (Number.isNaN(placed.getTime()) || Number.isNaN(removed.getTime())) return "--";
  const days = Math.max(0, Math.round((removed.getTime() - placed.getTime()) / 86400000));
  return `${days}d`;
}
