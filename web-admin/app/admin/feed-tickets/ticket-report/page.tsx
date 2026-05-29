import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getFeedTicketPrintBundle } from "@/lib/feed-ticket-data";
import {
  formatFeedTicketTypeOptionLabel,
  getFeedTicketTypeOptionByCode,
  getFeedTicketTypeSettingNames,
} from "@/lib/feed-ticket-types";
import { getAppSettingTextValues, getPlatformReportOption } from "@/lib/platform-content";

import { FeedTicketPrintActions } from "./print-actions";

type FeedTicketPrintPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedTicketPrintPage({ searchParams }: FeedTicketPrintPageProps) {
  const params = (await searchParams) ?? {};
  const ticketId = firstParam(params.ticketId);
  if (!ticketId) {
    notFound();
  }

  const report = await getFeedTicketPrintBundle(ticketId);
  if (!report) {
    notFound();
  }
  const [reportOption, ticketTypeSettings] = await Promise.all([
    getPlatformReportOption({
      location: "admin_feed_tickets",
      name: "feed_ticket_editor",
    }),
    getAppSettingTextValues(getFeedTicketTypeSettingNames()),
  ]);
  const ticketTypeDisplay = describeTicketType(report.ticket.ticketType, ticketTypeSettings);
  const reportTitle = reportOption?.title || "Feed Ticket Print";
  const reportSubtitle = reportOption?.subtitle || "Print-ready feed ticket header and drop detail.";

  return (
    <div className="feed-ticket-print-page">
      <PageHeader
        eyebrow="Report"
        title={reportTitle}
        body={reportSubtitle}
        actions={<FeedTicketPrintActions />}
      />

      <section className="panel card feed-ticket-print-shell">
        <div className="feed-ticket-print-header-card">
          <div className="feed-ticket-print-title-row">
            <div>
              <p className="feed-ticket-print-kicker">{reportTitle}</p>
              <h2 className="feed-ticket-print-ticket-number">{report.ticket.ticketNumber || "Untitled Ticket"}</h2>
              <p className="feed-ticket-print-subtitle">{reportSubtitle}</p>
            </div>
            <div className="feed-ticket-print-generated">
              <span>Generated</span>
              <strong>{formatTimestamp(report.generatedAt)}</strong>
            </div>
          </div>

          <div className="feed-ticket-print-title-block">
            <article>
              <span>Date</span>
              <strong>{formatDate(report.ticket.deliveryDate)}</strong>
            </article>
            <article>
              <span>Ticket Type</span>
              <strong className="feed-ticket-print-ticket-type-value">{ticketTypeDisplay || "--"}</strong>
            </article>
            <article>
              <span>Load Type</span>
              <strong>{report.ticket.loadType || "--"}</strong>
            </article>
            <article>
              <span>Gross Weight</span>
              <strong className="feed-ticket-print-gross-weight-value">{formatWeight(report.ticket.grossWeightLbs)}</strong>
            </article>
            <article>
              <span>Feedmill / Vendor</span>
              <strong>{report.ticket.vendorName || "--"}</strong>
            </article>
            <article>
              <span>Feed Name</span>
              <strong>{report.ticket.feedName || "--"}</strong>
            </article>
            <article>
              <span>Drops</span>
              <strong>{report.totals.dropCount}</strong>
            </article>
            <article>
              <span>Drops Total</span>
              <strong>{formatWeight(report.totals.totalDropWeightLbs)}</strong>
            </article>
            <article>
              <span>Not Allocated</span>
              <strong>{formatWeight(report.totals.remainingWeightLbs)}</strong>
            </article>
            <article className="feed-ticket-print-title-block-note">
              <span>Comment</span>
              <strong>{report.ticket.comment || "--"}</strong>
            </article>
          </div>
        </div>

        <div className="feed-ticket-print-detail-card">
          <table className="feed-ticket-print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Farm</th>
                <th>Barn</th>
                <th>Bin#</th>
                <th>Flock</th>
                <th>Feed Type</th>
                <th className="feed-ticket-print-number-col">Drop Weight</th>
                <th>Redirect</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {report.drops.length > 0 ? (
                report.drops.map((drop) => (
                  <tr key={drop.id}>
                    <td>{drop.dropOrder}</td>
                    <td>{drop.farmName || "--"}</td>
                    <td>{drop.barnCode || "--"}</td>
                    <td className="feed-ticket-print-emphasis">{drop.binCode || "--"}</td>
                    <td className="feed-ticket-print-emphasis">{drop.placementCode || "--"}</td>
                    <td>{drop.feedType || "--"}</td>
                    <td className="feed-ticket-print-number-col">{formatWeight(drop.dropWeightLbs)}</td>
                    <td className="feed-ticket-print-flag-col">{drop.offFarmRedirect ? "X" : ""}</td>
                    <td>{drop.comment || "--"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="feed-ticket-print-empty" colSpan={9}>
                    No drop lines are saved for this feed ticket.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="feed-ticket-print-audit">
          <div className="feed-ticket-print-audit-row">
            <span>Created By</span>
            <strong>{report.ticket.createdByName || "--"}</strong>
            <span>Created</span>
            <strong>{formatTimestamp(report.ticket.createdAt)}</strong>
          </div>
          <div className="feed-ticket-print-audit-row">
            <span>Updated By</span>
            <strong>{report.ticket.updatedByName || "--"}</strong>
            <span>Updated</span>
            <strong>{formatTimestamp(report.ticket.updatedAt)}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "--";
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

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function describeTicketType(
  ticketType: string | null | undefined,
  settings: Map<string, { value: string; desc: string }>,
) {
  const option = getFeedTicketTypeOptionByCode(ticketType, settings);
  if (!option) {
    return String(ticketType ?? "").trim();
  }

  return formatFeedTicketTypeOptionLabel(option.value, option.description);
}
