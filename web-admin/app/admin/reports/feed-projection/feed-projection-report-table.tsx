"use client";

import { useState } from "react";

import type { FeedProjectionOnOrderRow } from "@/lib/feed-projection-report-data";

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
    headCount: number | null | undefined;
    starterTargetLbs: number | null | undefined;
    starterDeliveredLbs: number | null | undefined;
    starterRecognizedSupplyLbs: number | null | undefined;
    starterRemainingObligationLbs: number | null | undefined;
    starterDeliveredPlusOnOrderLbs: number | null | undefined;
    starterLbsPerChick: number | null | undefined;
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
    starterRecommendationConvertedToGrowerLbs: number;
    growerRecommendedLbs: number | null | undefined;
    orderingMode: "typed" | "legacy" | "pending";
  }>;
  windowDates: string[];
  windowLabel?: string;
  emptyMessage?: string;
  reportMode?: "operational" | "planning";
  onOrderRows: FeedProjectionOnOrderRow[];
};

export function FeedProjectionReportTable({
  rows,
  windowDates,
  windowLabel = "10 Day",
  emptyMessage = "No live or qualifying scheduled placements were found for the next 10 day window.",
  reportMode = "operational",
  onOrderRows,
}: FeedProjectionReportTableProps) {
  const [showDailyBreakdown, setShowDailyBreakdown] = useState(false);
  const [showFeedDetail, setShowFeedDetail] = useState(false);
  const [selectedStarterMathRowId, setSelectedStarterMathRowId] = useState<string | null>(null);
  const toggleDailyBreakdown = () => setShowDailyBreakdown((current) => !current);
  const toggleFeedDetail = () => setShowFeedDetail((current) => !current);
  const selectedStarterMathRow = rows.find((row) => row.id === selectedStarterMathRowId) ?? null;
  const columnCount = 10 + (showFeedDetail ? 6 : 3) + (showDailyBreakdown ? windowDates.length : 0);

  return (
    <div className="feed-projection-report-table-shell">
      {showFeedDetail ? <style media="print">{`@page { size: landscape; }`}</style> : null}
      <div className="feed-projection-report-table-toolbar">
        <div className="feed-projection-report-table-toolbar-buttons">
          <button className="button-secondary feed-projection-report-toggle-button" type="button" onClick={toggleDailyBreakdown}>
            {showDailyBreakdown ? "Hide Daily Columns" : "Show Daily Columns"}
          </button>
          <button className="button-secondary feed-projection-report-toggle-button" type="button" onClick={toggleFeedDetail}>
            {showFeedDetail ? "Hide Detail" : "Show Detail"}
          </button>
        </div>
        <small>
          {showDailyBreakdown ? "Daily detail is expanded." : `Daily detail is collapsed to the ${windowLabel.toLowerCase()} total view.`}
          {showFeedDetail ? " Feed columns are expanded by starter and grower, and print will use landscape mode." : ""}
        </small>
      </div>

      <div className="feed-projection-report-table-wrap">
      <table
        className={`feed-projection-report-table${showDailyBreakdown ? " is-expanded" : " is-collapsed"}${showFeedDetail ? " is-feed-detail-expanded" : ""}`}
      >
        <thead>
          {showFeedDetail ? (
            <>
              <tr>
                <th className="feed-projection-report-sticky-col feed-projection-report-sticky-col--farm" rowSpan={2}>
                  <HeaderCell title="Farm" subtitle="Name" />
                </th>
                <th className="feed-projection-report-sticky-col feed-projection-report-sticky-col--barn" rowSpan={2}>
                  <HeaderCell title="Barn" subtitle="Code" />
                </th>
                <th className="feed-projection-report-flock-col" rowSpan={2}>
                  <HeaderCell title="Flock" subtitle="Code" />
                </th>
                <th className="feed-projection-report-number-col feed-projection-report-age-col" rowSpan={2}>
                  <HeaderCell title="Age" subtitle="Day" />
                </th>
                <th className="feed-projection-report-status-col" rowSpan={2}>
                  <HeaderCell title="Status" subtitle="State" />
                </th>
                <th className="feed-projection-report-number-col" rowSpan={2}>
                  <HeaderCell title="Starter" subtitle="Req'd" />
                </th>
                <th className="feed-projection-report-number-col" rowSpan={2}>
                  <HeaderCell title="Grower" subtitle="Need" />
                </th>
                {showDailyBreakdown
                  ? windowDates.map((date) => (
                      <th className="feed-projection-report-number-col" key={date} rowSpan={2}>
                        {formatMonthDay(date)}
                      </th>
                    ))
                  : null}
                <th
                  className="feed-projection-report-number-col feed-projection-report-drilldown-header"
                  data-expanded={showDailyBreakdown ? "true" : "false"}
                  onClick={toggleDailyBreakdown}
                  title={showDailyBreakdown ? "Click to collapse daily detail" : "Click to expand daily detail"}
                  rowSpan={2}
                >
                  <span>{`${windowLabel} [-]`}</span>
                  <small>{showDailyBreakdown ? "Required" : "Required [+]"}</small>
                </th>
                <th className="feed-projection-report-number-col" colSpan={2}>
                  <span className="feed-projection-report-group-header">On-Hand</span>
                </th>
                <th className="feed-projection-report-number-col" colSpan={2}>
                  <span className="feed-projection-report-group-header">On-Order</span>
                </th>
                <th className="feed-projection-report-number-col" colSpan={2}>
                  <span className="feed-projection-report-group-header">
                    {reportMode === "operational" ? "Order Needed" : "Req'd Feed"}
                  </span>
                </th>
                <th className="feed-projection-report-mode-col" rowSpan={2}>
                  <HeaderCell title="Mode" />
                </th>
              </tr>
              <tr>
                <th className="feed-projection-report-number-col">
                  <span className="feed-projection-report-sub-header">Starter</span>
                </th>
                <th className="feed-projection-report-number-col">
                  <span className="feed-projection-report-sub-header">Grower</span>
                </th>
                <th className="feed-projection-report-number-col">
                  <span className="feed-projection-report-sub-header">Starter</span>
                </th>
                <th className="feed-projection-report-number-col">
                  <span className="feed-projection-report-sub-header">Grower</span>
                </th>
                <th className="feed-projection-report-number-col">
                  <span className="feed-projection-report-sub-header">Starter</span>
                </th>
                <th className="feed-projection-report-number-col">
                  <span className="feed-projection-report-sub-header">Grower</span>
                </th>
              </tr>
            </>
          ) : (
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
                <HeaderCell title="Starter" subtitle="Req'd" />
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
          )}
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
                <td className="feed-projection-report-number-col">
                  {row.starterTotalLbs !== null && row.starterTotalLbs !== undefined ? (
                    <button
                      className="feed-projection-report-math-trigger"
                      type="button"
                      onClick={() => setSelectedStarterMathRowId(row.id)}
                      title="Show starter requirement math"
                    >
                      {formatWeight(row.starterTotalLbs)}
                    </button>
                  ) : (
                    formatWeight(row.starterTotalLbs)
                  )}
                </td>
                <td className="feed-projection-report-number-col">{formatWeight(row.growerTotalLbs)}</td>
                {showDailyBreakdown
                  ? row.daily.map((day) => (
                      <td className="feed-projection-report-number-col" key={`${row.id}-${day.date}`}>
                        {day.pounds === null ? "--" : formatWeight(day.pounds)}
                      </td>
                    ))
                  : null}
                <td className="feed-projection-report-number-col">{formatWeight(row.totalLbs)}</td>
                {showFeedDetail ? (
                  <>
                    <td className="feed-projection-report-number-col">{formatWeight(row.starterAccessibleLbs)}</td>
                    <td className="feed-projection-report-number-col">{formatWeight(row.growerAccessibleLbs)}</td>
                    <td className="feed-projection-report-number-col">{formatWeight(row.starterOnOrderLbs)}</td>
                    <td className="feed-projection-report-number-col">{formatWeight(row.growerOnOrderLbs)}</td>
                    <td className="feed-projection-report-number-col">{formatWeight(row.starterRecommendedLbs)}</td>
                    <td className="feed-projection-report-number-col">{formatWeight(row.growerRecommendedLbs)}</td>
                  </>
                ) : (
                  <>
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
                  </>
                )}
                <td className="feed-projection-report-mode-col">{formatMode(row.orderingMode)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="feed-projection-report-empty" colSpan={columnCount}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      <FeedOnOrderSection rows={onOrderRows} />
      {selectedStarterMathRow ? (
        <div className="feed-projection-report-math-modal-shell" role="dialog" aria-modal="true" aria-labelledby="starter-obligation-math-title">
          <button
            className="feed-projection-report-math-modal-backdrop"
            type="button"
            aria-label="Close starter requirement math"
            onClick={() => setSelectedStarterMathRowId(null)}
          />
          <div className="feed-projection-report-math-modal-panel">
            <div className="feed-projection-report-math-modal-header">
              <div>
                <span>Lifetime Starter Math</span>
                <strong id="starter-obligation-math-title">{selectedStarterMathRow.placementCode}</strong>
              </div>
              <button className="button-secondary" type="button" onClick={() => setSelectedStarterMathRowId(null)}>
                Close
              </button>
            </div>
            <div className="feed-projection-report-math-grid">
              <div>
                <span>Lifetime Starter Required</span>
                <strong>{formatWeight(selectedStarterMathRow.starterTotalLbs)}</strong>
                <small>
                  Head placed multiplied by the configured starter pounds per chick
                </small>
              </div>
              <div>
                <span>Starter Delivered</span>
                <strong>{formatWeight(selectedStarterMathRow.starterDeliveredLbs)}</strong>
                <small>
                  Scale-ticket starter pounds already delivered to this flock
                </small>
              </div>
              <div>
                <span>Starter On Hand</span>
                <strong>{formatWeight(selectedStarterMathRow.starterAccessibleLbs)}</strong>
                <small>Current accessible Starter inventory reported for the barn</small>
              </div>
              <div>
                <span>Starter On Order</span>
                <strong>{formatWeight(selectedStarterMathRow.starterOnOrderLbs)}</strong>
                <small>All open starter orders counted against the flock requirement</small>
              </div>
              <div>
                <span>Starter Gap</span>
                <strong>{formatWeight(selectedStarterMathRow.starterRecommendedLbs)}</strong>
                <small>
                  {selectedStarterMathRow.starterRecommendationConvertedToGrowerLbs > 0
                    ? `${formatWeight(selectedStarterMathRow.starterRecommendationConvertedToGrowerLbs)} was moved to Grower because flock age plus the 5-day order lead exceeds 21 days.`
                    : "Additional starter still needed for the flock"}
                </small>
              </div>
            </div>
            <div className="feed-projection-report-math-formula">
              <span>Formula</span>
              <strong>
                {formatWeight(selectedStarterMathRow.starterTotalLbs)} - {formatWeight(selectedStarterMathRow.starterRecognizedSupplyLbs)} -{" "}
                {formatWeight(selectedStarterMathRow.starterOnOrderLbs)} ={" "}
                {selectedStarterMathRow.starterRecommendationConvertedToGrowerLbs > 0
                  ? `${formatWeight(selectedStarterMathRow.starterRecommendationConvertedToGrowerLbs)} → Grower`
                  : formatWeight(selectedStarterMathRow.starterRecommendedLbs)}
              </strong>
              <small>
                {selectedStarterMathRow.starterRecommendationConvertedToGrowerLbs > 0
                  ? `The calculated Starter gap was ${formatWeight(selectedStarterMathRow.starterRecommendationConvertedToGrowerLbs)}; it is reported as Grower under the 21-day age rule.`
                  : "Recognized supply is the greater of recorded Starter deliveries or accessible Starter on hand, preventing either source from being ignored or counted twice."}
              </small>
            </div>
            <div className="feed-projection-report-math-formula">
              <span>Starter Obligation Before On-Hand / Orders</span>
              <strong>{formatWeight(selectedStarterMathRow.starterRemainingObligationLbs)}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeedOnOrderSection({ rows }: { rows: FeedProjectionOnOrderRow[] }) {
  const totalRemainingLbs = rows.reduce((sum, row) => sum + row.remainingLbs, 0);

  return (
    <section className="feed-projection-on-order-section">
      <div className="feed-projection-on-order-header">
        <div>
          <span>Open Commitments</span>
          <h2>Feed On Order</h2>
          <p>All remaining open and partially received feed orders in the selected report scope, including orders due after the projection window.</p>
        </div>
        <div className="feed-projection-on-order-total">
          <span>Total Remaining</span>
          <strong>{formatWeight(totalRemainingLbs)}</strong>
          <small>{rows.length} {rows.length === 1 ? "order" : "orders"}</small>
        </div>
      </div>
      <div className="feed-projection-on-order-table-wrap">
        <table className="feed-projection-on-order-table">
          <thead>
            <tr>
              <th>Delivery</th>
              <th>Farm</th>
              <th>Barn</th>
              <th>Bin</th>
              <th>Flock</th>
              <th>Feed</th>
              <th>Source</th>
              <th>Status</th>
              <th className="feed-projection-report-number-col">Ordered</th>
              <th className="feed-projection-report-number-col">Received</th>
              <th className="feed-projection-report-number-col">Remaining</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatOrderDate(row.deliveryDate)}</td>
                  <td>{row.farmName}</td>
                  <td>{row.barnCode}</td>
                  <td>{row.binNumber ?? "—"}</td>
                  <td>{row.placementCode ?? "—"}</td>
                  <td>{formatFeedDescription(row.feedType, row.feedName)}</td>
                  <td>{row.source}</td>
                  <td>{row.status}</td>
                  <td className="feed-projection-report-number-col">{formatWeight(row.orderedLbs)}</td>
                  <td className="feed-projection-report-number-col">{formatWeight(row.receivedLbs)}</td>
                  <td className="feed-projection-report-number-col"><strong>{formatWeight(row.remainingLbs)}</strong></td>
                  <td>{row.externalOrderRef ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="feed-projection-report-empty" colSpan={12}>No feed is currently on order in this report scope.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatOrderDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function formatFeedDescription(feedType: string | null, feedName: string | null) {
  const type = feedType ? feedType.charAt(0).toUpperCase() + feedType.slice(1) : null;
  if (type && feedName && feedName.toLowerCase() !== feedType?.toLowerCase()) return `${type} · ${feedName}`;
  return type ?? feedName ?? "Unspecified";
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
