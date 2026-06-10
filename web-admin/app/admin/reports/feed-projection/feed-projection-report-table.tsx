"use client";

import { useState } from "react";

type FeedProjectionReportTableProps = {
  rows: Array<{
    id: string;
    farmName: string;
    barnCode: string;
    placementCode: string;
    placedDateLabel: string;
    statusLabel: string;
    statusTone: string;
    headCount: number | null | undefined;
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
  }>;
  windowDates: string[];
  emptyColSpanExpanded: number;
  emptyColSpanCollapsed: number;
};

export function FeedProjectionReportTable({
  rows,
  windowDates,
  emptyColSpanExpanded,
  emptyColSpanCollapsed,
}: FeedProjectionReportTableProps) {
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);
  const toggleDailyBreakdown = () => setShowDailyBreakdown((current) => !current);

  return (
    <div className="feed-projection-report-table-shell">
      <div className="feed-projection-report-table-toolbar">
        <button className="button-secondary feed-projection-report-toggle-button" type="button" onClick={toggleDailyBreakdown}>
          {showDailyBreakdown ? "Hide Daily Columns" : "Show Daily Columns"}
        </button>
        <small>{showDailyBreakdown ? "Daily detail is expanded." : "Daily detail is collapsed to the 10 day total view."}</small>
      </div>

      <div className="feed-projection-report-table-wrap">
      <table className={`feed-projection-report-table${showDailyBreakdown ? " is-expanded" : " is-collapsed"}`}>
        <thead>
          <tr>
            <th className="feed-projection-report-sticky-col feed-projection-report-sticky-col--farm">Farm</th>
            <th className="feed-projection-report-sticky-col feed-projection-report-sticky-col--barn">Barn</th>
            <th>Placement</th>
            <th>Status</th>
            <th className="feed-projection-report-number-col">Birds</th>
            <th className="feed-projection-report-number-col">Starter 10D</th>
            <th className="feed-projection-report-number-col">Grower 10D</th>
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
              <span>{showDailyBreakdown ? "10 Day Total [-]" : "10 Day Total [+]"}</span>
              <small>{showDailyBreakdown ? "Click to collapse" : "Click to expand"}</small>
            </th>
            <th className="feed-projection-report-number-col">On Hand</th>
            <th className="feed-projection-report-number-col">On Order</th>
            <th className="feed-projection-report-number-col">Recommended</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="feed-projection-report-sticky-col feed-projection-report-sticky-col--farm">{row.farmName}</td>
                <td className="feed-projection-report-sticky-col feed-projection-report-sticky-col--barn">{row.barnCode}</td>
                <td>
                  <div className="feed-projection-report-placement-cell">
                    <strong>{row.placementCode}</strong>
                    <span>{row.placedDateLabel}</span>
                  </div>
                </td>
                <td>
                  <span className="feed-projection-report-status-pill" data-state={row.statusTone}>
                    {row.statusLabel}
                  </span>
                </td>
                <td className="feed-projection-report-number-col">{formatWhole(row.headCount)}</td>
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
                <td className="feed-projection-report-number-col">{formatWeight(row.onHandLbs)}</td>
                <td className="feed-projection-report-number-col">{formatWeight(row.onOrderLbs)}</td>
                <td className="feed-projection-report-number-col">{formatWeight(row.recommendedOrderLbs)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="feed-projection-report-empty" colSpan={showDailyBreakdown ? emptyColSpanExpanded : emptyColSpanCollapsed}>
                No live or qualifying scheduled placements were found for the next 10 day window.
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

function formatWhole(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}
