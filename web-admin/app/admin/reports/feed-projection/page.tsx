import type { Metadata } from "next";
import Link from "next/link";

import { FeedProjectionReportTable } from "@/app/admin/reports/feed-projection/feed-projection-report-table";
import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";
import type { ActivePlacementRecord } from "@/lib/types";

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
  const adminData = await getAdminData();
  const today = isoDate(new Date());
  const windowDates = Array.from({ length: 10 }, (_, index) => addDays(today, index + 1));
  const windowEnd = windowDates[windowDates.length - 1] ?? today;

  const rows = adminData.activePlacements
    .filter((placement) => {
      if (farmGroupId && placement.farmGroupId !== farmGroupId) return false;
      if (farmId && placement.farmId !== farmId) return false;
      if (barnId && placement.barnId !== barnId) return false;
      if (flockCode) {
        const haystack = `${placement.placementCode} ${placement.flockCode ?? ""}`.toLowerCase();
        if (!haystack.includes(flockCode)) return false;
      }
      return true;
    })
    .map((placement) => toReportRow(placement, windowDates))
    .sort(compareReportRows);

  const dailyTotals = windowDates.map((date, index) => ({
    date,
    pounds: rows.reduce((sum, row) => sum + (row.daily[index]?.pounds ?? 0), 0),
  }));
  const overallTotal = rows.reduce((sum, row) => sum + (row.totalLbs ?? 0), 0);
  const overallOnHand = rows.reduce((sum, row) => sum + (row.onHandLbs ?? 0), 0);
  const overallOnOrder = rows.reduce((sum, row) => sum + (row.onOrderLbs ?? 0), 0);
  const overallRecommended = rows.reduce((sum, row) => sum + (row.recommendedOrderLbs ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="10 Day Feed Projection"
        body="Matrix view of projected daily feed demand, on-hand inventory, and open orders across all barns."
        actions={
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
        }
      />

      <section className="panel card feed-projection-report-shell">
        <div className="feed-projection-report-summary-grid">
          <article className="feed-projection-report-summary-card">
            <span>Barns In Scope</span>
            <strong>{formatWhole(rows.length)}</strong>
            <small>All barns, including inventory-only and future-assigned barns</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>10 Day Requirement</span>
            <strong>{formatWeight(overallTotal)}</strong>
            <small>Summed from daily projected feed values</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>On Hand Inventory</span>
            <strong>{formatWeight(overallOnHand)}</strong>
            <small>Latest mapped feed-bin inventory where available</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>Recommended Order</span>
            <strong>{formatWeight(overallRecommended)}</strong>
            <small>10 day requirement minus on hand and on order</small>
          </article>
        </div>

        <div className="feed-projection-report-meta-grid">
          <div>
            <span>Window</span>
            <strong>{formatDate(windowDates[0] ?? today)} to {formatDate(windowEnd)}</strong>
          </div>
          <div>
            <span>Generated</span>
            <strong>{formatTimestamp(new Date())}</strong>
          </div>
          <div>
            <span>Open Orders</span>
            <strong>{formatWeight(overallOnOrder)}</strong>
          </div>
        </div>

        <div className="feed-projection-report-totals-strip">
          {dailyTotals.map((entry) => (
            <div className="feed-projection-report-totals-pill" key={entry.date}>
              <span>{formatMonthDay(entry.date)}</span>
              <strong>{formatWeight(entry.pounds)}</strong>
            </div>
          ))}
        </div>

        <FeedProjectionReportTable
          rows={rows}
          windowDates={windowDates}
          emptyColSpanExpanded={12 + windowDates.length}
          emptyColSpanCollapsed={12}
        />
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

function toReportRow(placement: ActivePlacementRecord, windowDates: string[]) {
  const dailyByDate = new Map(placement.feedProjectionTenDayDaily.map((day) => [day.date, day]));
  const daily = windowDates.map((date) => {
    const match = dailyByDate.get(date);
    return {
      date,
      pounds: match?.totalFeed ?? null,
    };
  });

  return {
    id: placement.id,
    farmName: placement.farmName,
    barnCode: placement.barnCode,
    placementCode: placement.placementCode,
    placedDateLabel:
      placement.tileState === "scheduled"
        ? `Arrives ${formatDate(placement.placedDate)}`
        : `Placed ${formatDate(placement.placedDate)}`,
    statusLabel:
      placement.tileState === "scheduled"
        ? "Scheduled"
        : placement.tileState === "awaiting"
          ? "Awaiting"
          : "In Barn",
    statusTone:
      placement.tileState === "scheduled"
        ? "scheduled"
        : placement.tileState === "awaiting"
          ? "awaiting"
          : "live",
    headCount: placement.headCount,
    starterTotalLbs: placement.feedProjectionTenDayStarterTotal,
    growerTotalLbs: placement.feedProjectionTenDayGrowerTotal,
    daily,
    totalLbs: placement.feedProjectionTenDayTotal,
    onHandLbs: placement.feedInventoryOnHandLbs,
    onOrderLbs: placement.feedOnOrderLbs,
    recommendedOrderLbs: placement.feedRecommendedOrderLbs,
  };
}

function compareReportRows(
  left: ReturnType<typeof toReportRow>,
  right: ReturnType<typeof toReportRow>,
) {
  const farmCompare = left.farmName.localeCompare(right.farmName);
  if (farmCompare !== 0) return farmCompare;
  const barnCompare = left.barnCode.localeCompare(right.barnCode, undefined, { numeric: true });
  if (barnCompare !== 0) return barnCompare;
  return left.placementCode.localeCompare(right.placementCode, undefined, { numeric: true });
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return isoDate(value);
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
