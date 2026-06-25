"use client";

import { useState } from "react";

type FeedProjectionReportTableProps = {
  rows: Array<{
    id: string;
    farmName: string;
    barnCode: string;
    placementCode: string;
    ageDays: number | null;
    statusLabel: string;
    statusTone: string;
    starterTotalLbs: number | null | undefined;
    growerTotalLbs: number | null | undefined;
    daily: Array<{
      date: string;
      pounds: number | null;
    }>;
    totalLbs: number | null | undefined;
    onHandLbs: number | null | undefined;
    onOrderLbs: number | null | undefined;
    recommendedOrderLbs: number | null | undefined;
    starterAccessibleLbs: number | null | undefined;
    growerAccessibleLbs: number | null | undefined;
    starterQueuedLbs: number | null | undefined;
    growerQueuedLbs: number | null | undefined;
    starterOnOrderLbs: number | null | undefined;
    growerOnOrderLbs: number | null | undefined;
    starterRecommendedLbs: number | null | undefined;
    growerRecommendedLbs: number | null | undefined;
    orderingMode: "typed" | "legacy" | "pending";
  }>;
  windowDates: string[];
  emptyColSpanExpanded: number;
  emptyColSpanCollapsed: number;
  windowLabel?: string;
  emptyMessage?: string;
  reportMode?: "operational" | "planning";
};

export function FeedProjectionReportTable({
  rows,
  windowDates,
  emptyColSpanExpanded,
  emptyColSpanCollapsed,
  windowLabel = "10 Day",
  emptyMessage = "No live or qualifying scheduled placements were found for the next 10 day window.",
  reportMode = "operational",
}: FeedProjectionReportTableProps) {
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);
  const toggleDailyBreakdown = () => setShowDailyBreakdown((current) => !current);

  return (
    <div className="feed-projection-report-table-shell">
      <div className="feed-projection-report-table-toolbar">
        <button className="button-secondary feed-projection-report-toggle-button" type="button" onClick={toggleDailyBreakdown}>
          {showDailyBreakdown ? "Hide Daily Columns" : "Show Daily Columns"}
        </button>
        <small>{showDailyBreakdown ? "Daily detail is expanded." : `Daily detail is collapsed to the ${windowLabel.toLowerCase()} total view.`}</small>
      </div>

      <div className="feed-projection-report-table-wrap">
      <table className={`feed-projection-report-table${showDailyBreakdown ? " is-expanded" : " is-collapsed"}`}>
        <thead>
          <tr>
            <th className="feed-projection-report-sticky-col feed-projection-report-sticky-col--farm">
              <HeaderCell title="Farm" subtitle="Name" />
            </th>
            <th className="feed-projection-report-sticky-col feed-projection-report-sticky-col--barn">
              <HeaderCell title="Barn" subtitle="Code" />
            </th>
            <th className="feed-projection-report-flock-col">
              <HeaderCell title="Flock" subtitle="Code" />
            </th>
            <th className="feed-projection-report-number-col feed-projection-report-age-col">
              <HeaderCell title="Age" subtitle="Day" />
            </th>
            <th className="feed-projection-report-status-col">
              <HeaderCell title="Status" subtitle="State" />
            </th>
            <th className="feed-projection-report-number-col">
              <HeaderCell title="Starter" subtitle={reportMode === "operational" ? "Oblg" : "Need"} />
            </th>
            <th className="feed-projection-report-number-col">
              <HeaderCell title="Grower" subtitle="Need" />
            </th>
            {showDailyBreakdown
              ? windowDates.map((date) => (
                  <th className="feed-projection-report-number-col" key={date}>
                    {formatMonthDay(date)}
                  </th>
                ))
              : null}
            <th
              className="feed-projection-report-number-col feed-projection-report-drilldown-header"
              data-expanded={showDailyBreakdown ? "true" : "false"}
              onClick={toggleDailyBreakdown}
              title={showDailyBreakdown ? "Click to collapse daily detail" : "Click to expand daily detail"}
            >
              <span>{`${windowLabel} [-]`}</span>
              <small>{showDailyBreakdown ? "Required" : "Required [+]"}</small>
            </th>
            <th className="feed-projection-report-number-col">
              <HeaderCell title="On" subtitle="Hand" />
            </th>
            <th className="feed-projection-report-number-col">
              <HeaderCell title="On" subtitle="Order" />
            </th>
            <th className="feed-projection-report-number-col">
              <HeaderCell
                title={reportMode === "operational" ? "Order" : "Req'd"}
                subtitle={reportMode === "operational" ? "Need" : "Feed"}
              />
            </th>
            <th className="feed-projection-report-mode-col">
              <HeaderCell title="Mode" />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr key={row.id}>
                <td
                  className="feed-projection-report-sticky-col feed-projection-report-sticky-col--farm"
                  title={row.farmName}
                >
                  {truncateFarmName(row.farmName)}
                </td>
                <td className="feed-projection-report-sticky-col feed-projection-report-sticky-col--barn">{row.barnCode}</td>
                <td className="feed-projection-report-flock-col">
                  <strong>{row.placementCode}</strong>
                </td>
                <td className="feed-projection-report-number-col feed-projection-report-age-col">{formatAge(row.ageDays)}</td>
                <td>
                  <span className="feed-projection-report-status-pill" data-state={row.statusTone}>
                    {row.statusLabel}
                  </span>
                </td>
                <td className="feed-projection-report-number-col">{formatWeight(row.starterTotalLbs)}</td>
                <td className="feed-projection-report-number-col">{formatWeight(row.growerTotalLbs)}</td>
                {showDailyBreakdown
                  ? row.daily.map((day) => (
                      <td className="feed-projection-report-number-col" key={`${row.id}-${day.date}`}>
                        {day.pounds === null ? "--" : formatWeight(day.pounds)}
                      </td>
                    ))
                  : null}
                <td className="feed-projection-report-number-col">{formatWeight(row.totalLbs)}</td>
                <td className="feed-projection-report-number-col" title={buildSplitTitle("Accessible", row.starterAccessibleLbs, row.growerAccessibleLbs, row.starterQueuedLbs, row.growerQueuedLbs)}>
                  {formatWeight(row.onHandLbs)}
                </td>
                <td className="feed-projection-report-number-col" title={buildSplitTitle("On order", row.starterOnOrderLbs, row.growerOnOrderLbs)}>
                  {formatWeight(row.onOrderLbs)}
                </td>
                <td
                  className="feed-projection-report-number-col"
                  title={buildSplitTitle(reportMode === "operational" ? "Recommended" : "Planning gap", row.starterRecommendedLbs, row.growerRecommendedLbs)}
                >
                  {formatWeight(row.recommendedOrderLbs)}
                </td>
                <td className="feed-projection-report-mode-col">{formatMode(row.orderingMode)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="feed-projection-report-empty" colSpan={showDailyBreakdown ? emptyColSpanExpanded : emptyColSpanCollapsed}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function formatMonthDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatAge(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return Math.round(value).toString();
}

function truncateFarmName(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 5) return normalized;
  return normalized.slice(0, 5);
}

function HeaderCell({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <span className="feed-projection-report-header-cell">
      <span>{title}</span>
      {subtitle ? <small>{subtitle}</small> : null}
    </span>
  );
}

function buildSplitTitle(
  label: string,
  starter: number | null | undefined,
  grower: number | null | undefined,
  starterQueued?: number | null | undefined,
  growerQueued?: number | null | undefined,
) {
  const parts = [
    `${label}: Starter ${formatWeight(starter)} / Grower ${formatWeight(grower)}`,
  ];

  if (starterQueued !== undefined || growerQueued !== undefined) {
    parts.push(`Queued: Starter ${formatWeight(starterQueued)} / Grower ${formatWeight(growerQueued)}`);
  }

  return parts.join(" | ");
}

function formatMode(value: "typed" | "legacy" | "pending") {
  if (value === "typed") return "Typed";
  if (value === "legacy") return "Legacy";
  return "Pending";
}
