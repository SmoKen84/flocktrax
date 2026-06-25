import type { Metadata } from "next";
import Link from "next/link";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { FeedProjectionReportTable } from "@/app/admin/reports/feed-projection/feed-projection-report-table";
import { PageHeader } from "@/components/page-header";
import { getFeedProjectionReportData } from "@/lib/feed-projection-report-data";

export const metadata: Metadata = {
  title: "Custom Feed Projection | FlockTrax Admin",
};

type FeedProjectionCustomReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedProjectionCustomReportPage({
  searchParams,
}: FeedProjectionCustomReportPageProps) {
  const params = (await searchParams) ?? {};
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const flockCode = firstParam(params.flockCode)?.toLowerCase() ?? null;
  const requestedDays = Number.parseInt(firstParam(params.days) ?? "14", 10);
  const report = await getFeedProjectionReportData({
    windowDays: requestedDays,
    farmGroupId,
    farmId,
    barnId,
    flockCode,
    reportMode: "planning",
  });

  return (
    <div className="feed-projection-report-page">
      <PageHeader
        eyebrow="Reports"
        title="Custom Feed Projection"
        body="Planning-only matrix view of projected feed demand across a user-selected horizon so you can look past holidays and see where supply may get tight."
        actions={
          <>
            <FeedProjectionReportActions />
            <Link
              className="button-secondary"
              href={buildReportsHubHref({
                farmGroupId: farmGroupId ?? "",
                farmId: farmId ?? "",
                barnId: barnId ?? "",
                flockCode: flockCode ?? "",
                days: String(report.windowDays),
              })}
            >
              <span aria-hidden="true">←</span>
              <span>Back to Reports</span>
            </Link>
          </>
        }
      />

      <section className="panel card feed-projection-report-shell">
        <div className="feed-projection-report-summary-grid">
          <article className="feed-projection-report-summary-card">
            <span>Barns In Scope</span>
            <strong>{formatWhole(report.rows.length)}</strong>
            <small>All barns, including inventory-only and future-assigned barns</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>{`${report.windowDays} Day Requirement`}</span>
            <strong>{formatWeight(report.overallTotal)}</strong>
            <small>Summed from daily projected feed values</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>On Hand Inventory</span>
            <strong>{formatWeight(report.overallOnHand)}</strong>
            <small>Latest mapped feed-bin inventory where available</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>Req'd Feed</span>
            <strong>{formatWeight(report.overallRecommended)}</strong>
            <small>{`Starter ${formatWeight(report.overallStarterRecommended)} · Grower ${formatWeight(report.overallGrowerRecommended)}`}</small>
          </article>
        </div>

        <div className="feed-projection-report-meta-grid">
          <div>
            <span>Window</span>
            <strong>{formatDate(report.windowDates[0] ?? report.today)} to {formatDate(report.windowEnd)}</strong>
          </div>
          <div>
            <span>Generated</span>
            <strong>{formatTimestamp(new Date())}</strong>
          </div>
          <div>
            <span>Open Orders</span>
            <strong>{formatWeight(report.overallOnOrder)}</strong>
          </div>
        </div>

        <div className="feed-projection-report-totals-strip">
          {report.dailyTotals.map((entry) => (
            <div className="feed-projection-report-totals-pill" key={entry.date}>
              <span>{formatMonthDay(entry.date)}</span>
              <strong>{formatWeight(entry.pounds)}</strong>
            </div>
          ))}
        </div>

        <FeedProjectionReportTable
          rows={report.rows}
          windowDates={report.windowDates}
          emptyColSpanExpanded={12 + report.windowDates.length}
          emptyColSpanCollapsed={12}
          windowLabel={`${report.windowDays} Day`}
          reportMode="planning"
          emptyMessage={`No live or qualifying scheduled placements were found for the next ${report.windowDays} day window.`}
        />
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

function formatMonthDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function formatTimestamp(value: Date) {
  if (Number.isNaN(value.getTime())) return "--";
  return value.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWhole(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function buildReportsHubHref({
  farmGroupId,
  farmId,
  barnId,
  flockCode,
  days,
}: {
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
  days?: string;
}) {
  const params = new URLSearchParams({
    category: "feed_reports",
    report: "custom_feed_projection",
  });
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  if (days) params.set("days", days);
  return `/admin/reports?${params.toString()}`;
}
