import { PageHeader } from "@/components/page-header";
import { getFeedTicketFlockReportBundle, type FeedTicketAdminFilters } from "@/lib/feed-ticket-data";

import { FeedTicketReportActions } from "../feed-ticket-report-actions";

type FeedTicketReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedTicketReportPage({ searchParams }: FeedTicketReportPageProps) {
  const params = (await searchParams) ?? {};
  const filters: FeedTicketAdminFilters = {
    flockCode: firstParam(params.flockCode),
    dateFrom: firstParam(params.dateFrom),
    dateTo: firstParam(params.dateTo),
    includeStarter: toBoolean(params.includeStarter),
    includeGrower: toBoolean(params.includeGrower),
  };
  const report = await getFeedTicketFlockReportBundle(filters);
  const flockCode = report.filters.flockCode || "No flock selected";

  return (
    <>
      <PageHeader
        eyebrow="Report"
        title={`Feed Drops by Flock`}
        body={`Print-ready feed drop history for flock ${flockCode}.`}
        actions={<FeedTicketReportActions />}
      />

      <section className="panel card feed-ticket-report-shell">
        <div className="feed-ticket-report-header-block">
          <div className="feed-ticket-report-meta">
            <div>
              <span>Flock</span>
              <strong>{flockCode}</strong>
            </div>
            <div>
              <span>Date Range</span>
              <strong>{report.filters.dateFrom || "Beginning"} to {report.filters.dateTo || "Today"}</strong>
            </div>
            <div>
              <span>Generated</span>
              <strong>{formatTimestamp(report.generatedAt)}</strong>
            </div>
          </div>

          <div className="feed-ticket-report-totals-grid">
            <article className="feed-ticket-report-total-card">
              <span>Overall Net Pounds</span>
              <strong>{formatWeightCompact(report.totals.netDropWeightLbs)}</strong>
            </article>
            <article className="feed-ticket-report-total-card">
              <span>Starter Net</span>
              <strong>{formatWeightCompact(report.totals.starterNetLbs)}</strong>
            </article>
            <article className="feed-ticket-report-total-card">
              <span>Grower Net</span>
              <strong>{formatWeightCompact(report.totals.growerNetLbs)}</strong>
            </article>
          </div>

          <div className="feed-ticket-report-breakdown-grid">
            <article className="feed-ticket-report-breakdown-card">
              <h2>By Ticket Type</h2>
              <div className="feed-ticket-report-breakdown-list">
                {report.totals.byTicketType.map((entry) => (
                  <div className="feed-ticket-report-breakdown-row" key={entry.key}>
                    <span>{entry.key}</span>
                    <strong>{formatWeightCompact(entry.pounds)}</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="feed-ticket-report-breakdown-card">
              <h2>By Source</h2>
              <div className="feed-ticket-report-breakdown-list">
                {report.totals.bySource.map((entry) => (
                  <div className="feed-ticket-report-breakdown-row" key={entry.key}>
                    <span>{entry.key}</span>
                    <strong>{formatWeightCompact(entry.pounds)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>

        <div className="feed-ticket-report-detail-page">
          <div className="feed-ticket-report-table-wrap">
            <table className="feed-ticket-report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticket</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Barn</th>
                  <th>Bin</th>
                  <th>Feed</th>
                  <th className="feed-ticket-report-number-col">Drop</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length > 0 ? (
                  report.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.deliveryDate)}</td>
                      <td>{row.ticketNumber || "--"}</td>
                      <td>{row.ticketType || "--"}</td>
                      <td>{row.source || "--"}</td>
                      <td>{row.barnCode || "--"}</td>
                      <td>{row.binCode || "--"}</td>
                      <td>{row.feedType || "--"}</td>
                      <td className="feed-ticket-report-number-col">{formatWeightAccounting(row.dropWeightLbs)}</td>
                      <td>{row.comment || "--"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="feed-ticket-report-empty" colSpan={9}>
                      No feed drops matched the selected flock and report filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toBoolean(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "true" || raw === "on" || raw === "1";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWeightCompact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatWeightAccounting(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  const absolute = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(value));
  if (value < 0) {
    return `(${absolute})`;
  }
  return absolute;
}
