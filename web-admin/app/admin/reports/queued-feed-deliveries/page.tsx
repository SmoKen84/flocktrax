import type { Metadata } from "next";
import Link from "next/link";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { getQueuedFeedDeliveriesReportData } from "@/lib/queued-feed-deliveries-report-data";

export const metadata: Metadata = {
  title: "Queued Feed Deliveries Not Received | FlockTrax Admin",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QueuedFeedDeliveriesReportPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const feedMill = firstParam(params.feedMill);
  const startDate = firstParam(params.startDate) ?? `${today.slice(0, 7)}-01`;
  const endDate = firstParam(params.endDate) ?? today;
  const report = await getQueuedFeedDeliveriesReportData({
    farmGroupId,
    farmId,
    barnId,
    feedMill,
    startDate,
    endDate,
  });

  return (
    <div className="feed-drops-report-page queued-feed-report-page">
      <section className="panel card feed-drops-report-shell queued-feed-report-shell">
        <div className="feed-drops-report-toolbar">
          <FeedProjectionReportActions />
          <Link
            className="button-secondary"
            href={buildBackHref({ farmGroupId, farmId, barnId, feedMill, startDate, endDate })}
          >
            <span aria-hidden="true">&larr;</span>
            <span>Back to Reports</span>
          </Link>
        </div>

        <header className="feed-drops-report-title">
          <p className="eyebrow">Feed Report</p>
          <h1>Queued Feed Deliveries Not Received</h1>
          <p>Feed-ticket drops currently held in the reconciliation queue and not yet posted as received.</p>
        </header>

        <div className="feed-drops-report-summary queued-feed-report-summary">
          <SummaryCard label="Delivery Date Range" value={`${formatDate(report.startDate)} - ${formatDate(report.endDate)}`} />
          <SummaryCard label="Farm Scope" value={report.scopeLabel} />
          {report.totalsByFeedType.map((total) => (
            <SummaryCard
              detail={`${total.dropCount} queued drop${total.dropCount === 1 ? "" : "s"}`}
              key={total.feedType}
              label={`${total.feedType} Queued`}
              value={`${formatWeight(total.pounds)} lbs`}
            />
          ))}
          <SummaryCard
            detail={`${report.rows.length} total queued drop${report.rows.length === 1 ? "" : "s"}`}
            label="Overall Feed In Queue"
            value={`${formatWeight(report.totalQueuedLbs)} lbs`}
          />
        </div>

        {report.rows.length > 0 ? (
          <div className="feed-drops-report-table-wrap">
            <table className="feed-drops-report-table queued-feed-report-table">
              <thead>
                <tr>
                  <th>Delivery Date</th>
                  <th>Queued At</th>
                  <th>Ticket</th>
                  <th>Feed Mill</th>
                  <th>Farm</th>
                  <th>Barn</th>
                  <th>Bin</th>
                  <th>Flock</th>
                  <th>Feed Type</th>
                  <th>Queued Weight</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{formatDate(row.deliveryDate)}</strong></td>
                    <td>{row.queuedAt ? formatDateTime(row.queuedAt) : "--"}</td>
                    <td><strong>{row.ticketNumber}</strong></td>
                    <td>{row.feedMill}</td>
                    <td>{row.farmName}</td>
                    <td className="feed-drops-report-bin">{row.barnCode}</td>
                    <td className="feed-drops-report-bin">{row.binCode}</td>
                    <td>{row.placementCode}</td>
                    <td>
                      <span className="feed-drops-report-type" data-known={row.feedType !== "Unknown"}>{row.feedType}</span>
                    </td>
                    <td className="feed-drops-report-weight"><strong>{formatWeight(row.queuedWeightLbs)} lbs</strong></td>
                  </tr>
                ))}
                <tr className="feed-drops-report-subtotal-row queued-feed-report-total-row">
                  <th colSpan={8}>Overall Feed Placed Into Queue</th>
                  <td>{report.rows.length} drops</td>
                  <td><strong>{formatWeight(report.totalQueuedLbs)} lbs</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="feed-drops-report-empty">
            No queued feed deliveries were found for the selected delivery dates and filters.
          </div>
        )}

        <footer className="feed-drops-report-footer">
          Date filtering is inclusive and uses the feed ticket delivery date. Only drops still marked for reconciliation are included.
        </footer>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(date);
}

function formatWeight(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function buildBackHref(options: {
  farmGroupId: string | null;
  farmId: string | null;
  barnId: string | null;
  feedMill: string | null;
  startDate: string;
  endDate: string;
}) {
  const params = new URLSearchParams({
    category: "feed_reports",
    report: "queued_feed_deliveries",
    startDate: options.startDate,
    endDate: options.endDate,
  });
  if (options.farmGroupId) params.set("farmGroupId", options.farmGroupId);
  if (options.farmId) params.set("farmId", options.farmId);
  if (options.barnId) params.set("barnId", options.barnId);
  if (options.feedMill) params.set("feedMill", options.feedMill);
  return `/admin/reports?${params.toString()}`;
}
