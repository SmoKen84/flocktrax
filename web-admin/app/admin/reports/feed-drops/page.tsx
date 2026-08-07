import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { getFeedDropsReportData, type FeedDropsSortOrder } from "@/lib/feed-drops-report-data";

export const metadata: Metadata = {
  title: "BinSentry API - Feed Received Polling Report | FlockTrax Admin",
};

type FeedDropsReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedDropsReportPage({ searchParams }: FeedDropsReportPageProps) {
  const params = (await searchParams) ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const startDate = firstParam(params.startDate) ?? `${today.slice(0, 7)}-01`;
  const endDate = firstParam(params.endDate) ?? today;
  const sortOrder = firstParam(params.sortOrder) ?? "date";
  const useDefaultTypeDensity = firstParam(params.useDefaultTypeDensity) === "1";
  const includeRollupSummary = firstParam(params.includeRollupSummary) === "1";
  const report = await getFeedDropsReportData({
    farmGroupId,
    farmId,
    barnId,
    startDate,
    endDate,
    sortOrder,
    useDefaultTypeDensity,
  });
  const deliveryGroups = buildDeliveryGroups(report.rows, report.sortOrder);

  return (
    <div className="feed-drops-report-page">
      <section className="panel card feed-drops-report-shell">
        <div className="feed-drops-report-toolbar">
          <FeedProjectionReportActions />
          <Link
            className="button-secondary"
            href={buildBackHref({
              farmGroupId,
              farmId,
              barnId,
              startDate: report.startDate,
              endDate: report.endDate,
              sortOrder: report.sortOrder,
              useDefaultTypeDensity: report.useDefaultTypeDensity,
              includeRollupSummary,
            })}
          >
            <span aria-hidden="true">&larr;</span>
            <span>Back to Reports</span>
          </Link>
        </div>

        <header className="feed-drops-report-title">
          <p className="eyebrow">Feed Report</p>
          <h1>BinSentry API - Feed Received Polling Report</h1>
          <p>BinSentry-detected refill events ready to be checked and reconciled against feed tickets.</p>
        </header>

        <div className="feed-drops-report-summary">
          <div>
            <span>Report Range</span>
            <strong>{formatDate(report.startDate)} - {formatDate(report.endDate)}</strong>
          </div>
          <div>
            <span>Farm / Barn Scope</span>
            <strong>{report.scopeLabel}</strong>
          </div>
          <div>
            <span>Refills Detected</span>
            <strong>{report.rows.length.toLocaleString("en-US")}</strong>
          </div>
          <div>
            <span>Mapped Bins Checked</span>
            <strong>{report.mappedBinCount.toLocaleString("en-US")}</strong>
          </div>
        </div>

        {report.errors.length > 0 ? (
          <div className="feed-drops-report-warning" role="alert">
            <strong>Some BinSentry bins could not be checked.</strong>
            <span>{report.errors.join(" ")}</span>
          </div>
        ) : null}

        {report.rows.length > 0 ? (
          <div className="feed-drops-report-table-wrap">
            <table className="feed-drops-report-table">
              <thead>
                <tr>
                  <th className="feed-drops-report-check-column">Worked</th>
                  <th>Date</th>
                  <th>Farm</th>
                  <th>Bin #</th>
                  <th>Volume of Refill</th>
                  <th>Feed Type</th>
                  <th>Density Applied</th>
                  <th>Estimated Weight</th>
                </tr>
              </thead>
              <tbody>
                {deliveryGroups.map((group) => (
                  <Fragment key={group.id}>
                    {group.rows.map((row) => (
                      <tr className="feed-drops-report-data-row" key={row.id}>
                        <td className="feed-drops-report-check-cell">
                          <span aria-label="Not yet reconciled" className="feed-drops-report-checkbox" role="img" />
                        </td>
                        <td>
                          <strong>{formatDate(row.occurredAt)}</strong>
                          <small>{formatTime(row.occurredAt)}</small>
                        </td>
                        <td>{row.farmName}</td>
                        <td className="feed-drops-report-bin">{row.binNumber ?? "--"}</td>
                        <td>
                          <strong>{formatDecimal(row.volumeCubicFeet)} ft&sup3;</strong>
                          <small>{refillVolumeDetail(row)}</small>
                        </td>
                        <td>
                          <span className="feed-drops-report-type" data-known={Boolean(row.feedType)}>
                            {titleCase(row.feedType ?? "Unknown")}
                          </span>
                        </td>
                        <td>
                          <strong>{formatDecimal(row.weightDensityLbPerCubicFoot)} lb/ft&sup3;</strong>
                          <small>{densityAppliedLabel(row)}</small>
                        </td>
                        <td className="feed-drops-report-weight">
                          <strong>{formatWhole(row.estimatedWeightLbs)} lbs</strong>
                          <small>{weightSourceLabel(row.weightDensitySource, row.weightDensityLbPerCubicFoot)}</small>
                        </td>
                      </tr>
                    ))}
                    <tr className="feed-drops-report-subtotal-row">
                      <th colSpan={4}>{group.label}</th>
                      <td>
                        <strong>{formatDecimal(group.volumeCubicFeet)} ft&sup3;</strong>
                        <small>{formatDecimal(group.volumeCubicMeters)} m&sup3;</small>
                      </td>
                      <td>{group.rows.length} refill{group.rows.length === 1 ? "" : "s"}</td>
                      <td>--</td>
                      <td><strong>{formatWhole(group.estimatedWeightLbs)} lbs</strong></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="feed-drops-report-empty">
            No BinSentry refill events were detected for the selected farm/barn scope and inclusive date range.
          </div>
        )}

        <footer className="feed-drops-report-footer">
          Sorted by {sortLabel(report.sortOrder)}. Refill volume is reported from BinSentry. Density Applied is the
          exact density used for Estimated Weight: {report.useDefaultTypeDensity ? "configured feed-type defaults where the type is known" : "each refill's stored BinSentry density"}.
        </footer>

        {includeRollupSummary ? <FeedDropsRollupSummary rows={report.rows} /> : null}
      </section>
    </div>
  );
}

type FeedDropRow = Awaited<ReturnType<typeof getFeedDropsReportData>>["rows"][number];

type FeedDropRollup = {
  id: string;
  label: string;
  detail?: string;
  refillCount: number;
  volumeCubicFeet: number;
  estimatedWeightLbs: number;
};

function FeedDropsRollupSummary({ rows }: { rows: FeedDropRow[] }) {
  const byBin = buildRollups(
    rows,
    (row) => `${row.farmName}\u0000${row.barnCode}\u0000${row.binNumber ?? "unknown"}`,
    (row) => ({
      label: `Bin ${row.binNumber ?? "Unknown"}`,
      detail: `${row.farmName} / ${row.barnCode}`,
    }),
  );
  const byBarn = buildRollups(
    rows,
    (row) => `${row.farmName}\u0000${row.barnCode}`,
    (row) => ({ label: row.barnCode, detail: row.farmName }),
  );
  const byType = buildRollups(
    rows,
    (row) => row.feedType?.toLowerCase() || "unknown",
    (row) => ({ label: titleCase(row.feedType ?? "Unknown") }),
  );
  const overall = summarizeRows(rows);

  return (
    <section className="feed-drops-rollup-page">
      <header className="feed-drops-rollup-title">
        <p className="eyebrow">Optional Summary</p>
        <h2>Feed Received Rollup Summary</h2>
        <p>Totals reflect the refill volume and density method used by this report.</p>
      </header>

      <div className="feed-drops-rollup-overall">
        <div><span>Refills</span><strong>{overall.refillCount.toLocaleString("en-US")}</strong></div>
        <div><span>Total Volume</span><strong>{formatDecimal(overall.volumeCubicFeet)} ft&sup3;</strong></div>
        <div><span>Overall Estimated Weight</span><strong>{formatWhole(overall.estimatedWeightLbs)} lbs</strong></div>
      </div>

      <div className="feed-drops-rollup-grid">
        <RollupTable heading="Totals by Feed Type" rows={byType} />
        <RollupTable heading="Totals by Barn" rows={byBarn} />
        <RollupTable className="feed-drops-rollup-bins" heading="Totals by Bin" rows={byBin} />
      </div>
    </section>
  );
}

function RollupTable({
  className = "",
  heading,
  rows,
}: {
  className?: string;
  heading: string;
  rows: FeedDropRollup[];
}) {
  return (
    <section className={`feed-drops-rollup-block ${className}`.trim()}>
      <h3>{heading}</h3>
      <table>
        <thead>
          <tr>
            <th>Group</th>
            <th>Refills</th>
            <th>Volume</th>
            <th>Estimated Weight</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.label}</strong>{row.detail ? <small>{row.detail}</small> : null}</td>
              <td>{row.refillCount.toLocaleString("en-US")}</td>
              <td>{formatDecimal(row.volumeCubicFeet)} ft&sup3;</td>
              <td><strong>{formatWhole(row.estimatedWeightLbs)} lbs</strong></td>
            </tr>
          )) : (
            <tr><td colSpan={4}>No refill data in the selected report scope.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function buildRollups(
  rows: FeedDropRow[],
  getKey: (row: FeedDropRow) => string,
  getLabel: (row: FeedDropRow) => { label: string; detail?: string },
) {
  const groups = new Map<string, { label: string; detail?: string; rows: FeedDropRow[] }>();
  for (const row of rows) {
    const key = getKey(row);
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, { ...getLabel(row), rows: [row] });
    }
  }
  return [...groups.entries()].map(([id, group]) => ({
    id,
    label: group.label,
    detail: group.detail,
    ...summarizeRows(group.rows),
  })).sort((left, right) =>
    (left.detail ?? "").localeCompare(right.detail ?? "", undefined, { numeric: true })
      || left.label.localeCompare(right.label, undefined, { numeric: true }),
  );
}

function summarizeRows(rows: FeedDropRow[]) {
  return {
    refillCount: rows.length,
    volumeCubicFeet: rows.reduce((sum, row) => sum + row.volumeCubicFeet, 0),
    estimatedWeightLbs: rows.reduce((sum, row) => sum + row.estimatedWeightLbs, 0),
  };
}

function buildDeliveryGroups(rows: FeedDropRow[], sortOrder: FeedDropsSortOrder) {
  const byFarmDate = new Map<string, FeedDropRow[]>();
  for (const row of rows) {
    const key = `${row.farmName}\u0000${centralDateKey(row.occurredAt)}`;
    byFarmDate.set(key, [...(byFarmDate.get(key) ?? []), row]);
  }

  const groups = [...byFarmDate.values()].flatMap((dateRows) => {
    const chronological = [...dateRows].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    const hasClosePair = chronological.some((row, index) =>
      index > 0 && minutesBetween(chronological[index - 1].occurredAt, row.occurredAt) <= 60,
    );
    const clusters: FeedDropRow[][] = [];

    if (!hasClosePair) {
      clusters.push(chronological);
    } else {
      for (const row of chronological) {
        const current = clusters[clusters.length - 1];
        const previous = current?.[current.length - 1];
        if (!previous || minutesBetween(previous.occurredAt, row.occurredAt) > 60) {
          clusters.push([row]);
        } else {
          current.push(row);
        }
      }
    }

    return clusters.map((cluster, index) => {
      const sortedRows = [...cluster].sort((left, right) => compareGroupRows(left, right, sortOrder));
      const first = chronologicalValue(cluster, "first");
      const last = chronologicalValue(cluster, "last");
      const dateLabel = formatDate(first.occurredAt);
      const timeLabel = cluster.length > 1
        ? `${formatTime(first.occurredAt)} - ${formatTime(last.occurredAt)}`
        : formatTime(first.occurredAt);
      return {
        id: `${first.farmName}-${centralDateKey(first.occurredAt)}-${index}`,
        firstOccurredAt: first.occurredAt,
        farmName: first.farmName,
        rows: sortedRows,
        label: hasClosePair
          ? `${first.farmName} delivery subtotal | ${dateLabel} | ${timeLabel}`
          : `${first.farmName} date subtotal | ${dateLabel}`,
        volumeCubicFeet: cluster.reduce((sum, row) => sum + row.volumeCubicFeet, 0),
        volumeCubicMeters: cluster.reduce((sum, row) => sum + row.volumeCubicMeters, 0),
        estimatedWeightLbs: cluster.reduce((sum, row) => sum + row.estimatedWeightLbs, 0),
      };
    });
  });

  return groups.sort((left, right) => {
    if (sortOrder === "bin") {
      const leftBin = Math.min(...left.rows.map((row) => row.binNumber ?? Number.MAX_SAFE_INTEGER));
      const rightBin = Math.min(...right.rows.map((row) => row.binNumber ?? Number.MAX_SAFE_INTEGER));
      return left.farmName.localeCompare(right.farmName) || leftBin - rightBin || left.firstOccurredAt.localeCompare(right.firstOccurredAt);
    }
    if (sortOrder === "feed_type") {
      const leftType = left.rows[0]?.feedType ?? "Unknown";
      const rightType = right.rows[0]?.feedType ?? "Unknown";
      return leftType.localeCompare(rightType) || left.firstOccurredAt.localeCompare(right.firstOccurredAt);
    }
    return left.firstOccurredAt.localeCompare(right.firstOccurredAt) || left.farmName.localeCompare(right.farmName);
  });
}

function compareGroupRows(left: FeedDropRow, right: FeedDropRow, sortOrder: FeedDropsSortOrder) {
  if (sortOrder === "bin") {
    return (left.binNumber ?? Number.MAX_SAFE_INTEGER) - (right.binNumber ?? Number.MAX_SAFE_INTEGER)
      || left.occurredAt.localeCompare(right.occurredAt);
  }
  if (sortOrder === "feed_type") {
    return (left.feedType ?? "Unknown").localeCompare(right.feedType ?? "Unknown")
      || left.occurredAt.localeCompare(right.occurredAt);
  }
  return left.occurredAt.localeCompare(right.occurredAt) || (left.binNumber ?? 0) - (right.binNumber ?? 0);
}

function chronologicalValue(rows: FeedDropRow[], position: "first" | "last") {
  const sorted = [...rows].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  return position === "first" ? sorted[0] : sorted[sorted.length - 1];
}

function minutesBetween(left: string, right: string) {
  return Math.abs(new Date(right).getTime() - new Date(left).getTime()) / 60000;
}

function centralDateKey(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Chicago",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value: string) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(isDateOnly ? `${value}T12:00:00.000Z` : value);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: isDateOnly ? "UTC" : "America/Chicago",
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(date);
}

function formatDecimal(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWhole(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function weightSourceLabel(
  source: "type_default" | "type_default_average" | "binsentry" | "binsentry_fallback",
  density: number,
) {
  const densityLabel = `${formatDecimal(density)} lb/ft³`;
  if (source === "type_default") return `${densityLabel} type default`;
  if (source === "type_default_average") return `${densityLabel} default average`;
  if (source === "binsentry_fallback") return `${densityLabel} BinSentry fallback`;
  return `${densityLabel} BinSentry`;
}

function densityAppliedLabel(row: FeedDropRow) {
  if (row.weightDensitySource === "type_default") {
    return `${titleCase(row.feedType ?? "Feed type")} default`;
  }
  if (row.weightDensitySource === "type_default_average") {
    return "Starter/Grower default average";
  }
  if (row.weightDensitySource === "binsentry_fallback") {
    return `${formatDecimal(row.densityKgPerCubicMeter)} kg/m³ · BinSentry fallback`;
  }
  return `${formatDecimal(row.densityKgPerCubicMeter)} kg/m³ · BinSentry refill`;
}

function refillVolumeDetail(row: FeedDropRow) {
  if (row.preRefillVolumeCubicMeters === null) {
    return `${formatDecimal(row.volumeCubicMeters)} m³ · baseline unavailable`;
  }
  const preRefillCubicFeet = row.preRefillVolumeCubicMeters * 35.3146667;
  const postRefillCubicFeet = row.postRefillVolumeCubicMeters * 35.3146667;
  return `${formatDecimal(postRefillCubicFeet)} - ${formatDecimal(preRefillCubicFeet)} ft³`;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sortLabel(sortOrder: FeedDropsSortOrder) {
  if (sortOrder === "bin") return "bin number";
  if (sortOrder === "feed_type") return "feed type";
  return "date";
}

function buildBackHref(options: {
  farmGroupId: string | null;
  farmId: string | null;
  barnId: string | null;
  startDate: string;
  endDate: string;
  sortOrder: FeedDropsSortOrder;
  useDefaultTypeDensity: boolean;
  includeRollupSummary: boolean;
}) {
  const params = new URLSearchParams({
    category: "feed_reports",
    report: "feed_drops_report",
    startDate: options.startDate,
    endDate: options.endDate,
    sortOrder: options.sortOrder,
  });
  if (options.farmGroupId) params.set("farmGroupId", options.farmGroupId);
  if (options.farmId) params.set("farmId", options.farmId);
  if (options.barnId) params.set("barnId", options.barnId);
  if (options.useDefaultTypeDensity) params.set("useDefaultTypeDensity", "1");
  if (options.includeRollupSummary) params.set("includeRollupSummary", "1");
  return `/admin/reports?${params.toString()}`;
}
