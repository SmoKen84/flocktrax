import type { Metadata } from "next";
import Link from "next/link";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { FeedProjectionReportTable } from "@/app/admin/reports/feed-projection/feed-projection-report-table";
import { PageHeader } from "@/components/page-header";
import { getFeedProjectionReportData } from "@/lib/feed-projection-report-data";

export const metadata: Metadata = {
  title: "10 Day Feed Projection | FlockTrax Admin",
};

type FeedProjectionReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedProjectionReportPage({ searchParams }: FeedProjectionReportPageProps) {
  const params = (await searchParams) ?? {};
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const flockCode = firstParam(params.flockCode)?.toLowerCase() ?? null;
  const report = await getFeedProjectionReportData({
    windowDays: 10,
    farmGroupId,
    farmId,
    barnId,
    flockCode,
    reportMode: "operational",
  });

  return (
    <div className="feed-projection-report-page">
      <PageHeader
        eyebrow="Reports"
        title="10 Day Feed Projection"
        body="Matrix view of projected daily feed demand, on-hand inventory, and open orders across all barns."
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
            <span>10 Day Requirement</span>
            <strong>{formatWeight(report.overallTotal)}</strong>
            <small>Summed from daily projected feed values</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>On Hand Inventory</span>
            <strong>{formatWeight(report.overallOnHand)}</strong>
            <small>Latest mapped feed-bin inventory where available</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>Recommended Order</span>
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
          windowLabel="10 Day"
          reportMode="operational"
          emptyMessage="No live or qualifying scheduled placements were found for the next 10 day window."
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
}: {
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
}) {
  const params = new URLSearchParams({
    category: "feed_reports",
    report: "ten_day_feed_requirements",
  });
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  return `/admin/reports?${params.toString()}`;
}
