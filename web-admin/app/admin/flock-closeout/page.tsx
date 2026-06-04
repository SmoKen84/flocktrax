import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getCloseoutQueueData } from "@/lib/closeout-data";

const CLOSEOUT_QUEUE_PAGE_SIZE = 9;

type FlockCloseoutPageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export default async function FlockCloseoutPage({ searchParams }: FlockCloseoutPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const queue = await getCloseoutQueueData();
  const totalPages = Math.max(1, Math.ceil(queue.items.length / CLOSEOUT_QUEUE_PAGE_SIZE));
  const currentPage = clampPage(params?.page, totalPages);
  const pageStart = (currentPage - 1) * CLOSEOUT_QUEUE_PAGE_SIZE;
  const visibleItems = queue.items.slice(pageStart, pageStart + CLOSEOUT_QUEUE_PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="Closeout"
        title="Flock Closeout Queue"
        body="This workspace holds post-checkout flocks that have left live production but are still moving through closeout review, actual livehaul reconciliation, and final historical retirement."
        actions={
          <Link className="button-secondary" href="/admin/flocks">
            Archive View
          </Link>
        }
      />

      <section className="closeout-summary-grid">
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Queue</p>
          <strong>{queue.totals.all.toLocaleString()}</strong>
          <p className="table-subtitle">Visible closeout placements</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Waiting</p>
          <strong>{queue.totals.waitingCloseout.toLocaleString()}</strong>
          <p className="table-subtitle">Still being worked</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Submitted</p>
          <strong>{queue.totals.closeoutSubmitted.toLocaleString()}</strong>
          <p className="table-subtitle">Pending finalization</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Birds</p>
          <strong>{queue.totals.totalBirds.toLocaleString()}</strong>
          <p className="table-subtitle">Starting head across queue</p>
        </article>
      </section>

      <section className="panel table-card">
        <div className="closeout-queue-header">
          <div>
            <p className="eyebrow">Queue</p>
            <h2 className="section-title closeout-queue-title">Placements Ready For Closeout</h2>
            <p className="hero-body closeout-shell-body">
              Select one placement line to open a focused closeout workspace for that flock.
            </p>
          </div>
          {totalPages > 1 ? (
            <div className="closeout-queue-pager">
              <span className="closeout-queue-pager-meta">{`Page ${currentPage} of ${totalPages}`}</span>
              <div className="closeout-queue-pager-actions">
                <Link className="button-secondary closeout-queue-pager-button" href={buildPageHref(currentPage)}>
                  Refresh
                </Link>
                {currentPage > 1 ? (
                  <Link className="button-secondary closeout-queue-pager-button" href={buildPageHref(currentPage - 1)}>
                    Prev
                  </Link>
                ) : (
                  <span className="closeout-queue-pager-button is-disabled">Prev</span>
                )}
                {currentPage < totalPages ? (
                  <Link className="button-secondary closeout-queue-pager-button" href={buildPageHref(currentPage + 1)}>
                    Next
                  </Link>
                ) : (
                  <span className="closeout-queue-pager-button is-disabled">Next</span>
                )}
              </div>
            </div>
          ) : (
            <div className="closeout-queue-pager closeout-queue-pager--solo">
              <div className="closeout-queue-pager-actions">
                <Link className="button-secondary closeout-queue-pager-button" href={buildPageHref(currentPage)}>
                  Refresh
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="table-wrap closeout-table-wrap">
          <table className="closeout-table closeout-queue-table">
            <thead>
              <tr>
                <th>Placement</th>
                <th>State</th>
                <th>Removed</th>
                <th>Head</th>
                <th>LH-Head</th>
                <th>FCR</th>
                <th className="closeout-queue-task-head">LH</th>
                <th className="closeout-queue-task-head">Feed</th>
                <th className="closeout-queue-task-head">Inv</th>
                <th className="closeout-queue-task-head">Sent</th>
                <th className="closeout-queue-task-head">Paid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => (
                  <tr key={item.placementId}>
                    <td>
                      <Link className="closeout-queue-primary-link" href={`/admin/flock-closeout/${item.placementId}`}>
                        <span className="closeout-queue-placement-line">{item.placementCode}</span>
                      </Link>
                    </td>
                    <td>
                      <span className="status-pill" data-tone={item.lifecycleStage === "waiting_closeout" ? "warn" : "good"}>
                        {formatStage(item.lifecycleStage)}
                      </span>
                    </td>
                    <td>{formatDate(item.removedDate)}</td>
                    <td>{item.finalHeadCount.toLocaleString()}</td>
                    <td>{item.closeout?.processedHeadFinal != null ? item.closeout.processedHeadFinal.toLocaleString() : "--"}</td>
                    <td>{formatRatio(item.closeout?.feedConversion ?? null)}</td>
                    <td>{renderTaskMark(item.queueTasks.livehaulComplete)}</td>
                    <td>{renderTaskMark(item.queueTasks.feedVerified)}</td>
                    <td>{renderTaskMark(item.queueTasks.invoiceCreated)}</td>
                    <td>{renderTaskMark(item.queueTasks.submitted)}</td>
                    <td>{renderTaskMark(item.queueTasks.settlementReceived)}</td>
                    <td className="closeout-queue-open-cell">
                      <Link
                        aria-label={`Edit closeout ${item.placementCode}`}
                        className="closeout-inline-link closeout-inline-icon-button"
                        href={`/admin/flock-closeout/${item.placementId}`}
                        title={`Edit ${item.placementCode}`}
                      >
                        <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
                          <path
                            d="M10.9 2.35a1.5 1.5 0 0 1 2.12 0l.63.63a1.5 1.5 0 0 1 0 2.12l-7.4 7.4-2.9.78.78-2.9 7.4-7.4Z"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.2"
                          />
                          <path d="m9.8 3.45 2.75 2.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12}>
                    <p className="table-subtitle">No closeout placements are currently waiting in the queue.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function formatStage(value: string) {
  if (value === "waiting_closeout") return "Waiting";
  if (value === "closeout_submitted") return "Submitted";
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

function formatRatio(value: number | null) {
  return value === null ? "--" : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderTaskMark(value: boolean) {
  return (
    <span className="closeout-queue-task-mark" data-complete={value ? "true" : "false"}>
      {value ? "✓" : ""}
    </span>
  );
}

function clampPage(value: string | undefined, totalPages: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(totalPages, Math.floor(parsed));
}

function buildPageHref(page: number) {
  return page <= 1 ? "/admin/flock-closeout" : `/admin/flock-closeout?page=${page}`;
}
