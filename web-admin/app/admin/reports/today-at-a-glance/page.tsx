import type { Metadata } from "next";
import Link from "next/link";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { PageHeader } from "@/components/page-header";
import { getTodayAtAGlanceReportData } from "@/lib/today-at-a-glance-report-data";

export const metadata: Metadata = {
  title: "At-a-Glance | FlockTrax Admin",
};

type TodayAtAGlanceReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TodayAtAGlanceReportPage({ searchParams }: TodayAtAGlanceReportPageProps) {
  const params = (await searchParams) ?? {};
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const flockCode = firstParam(params.flockCode);
  const reportDate = firstParam(params.reportDate);
  const report = await getTodayAtAGlanceReportData({
    farmGroupId,
    farmId,
    barnId,
    flockCode,
    reportDate,
  });

  return (
    <div className="feed-projection-report-page">
      <PageHeader
        eyebrow="Reports"
        title="At-a-Glance"
        body="One-line operational snapshot of daily, mortality, and weight reporting by flock for the selected date, including who reported each section and when it was submitted."
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
                reportDate: reportDate ?? report.reportDate,
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
            <span>Placements Reported</span>
            <strong>{formatWhole(report.totals.placementsWithAnyData)}</strong>
            <small>Rows with any daily, mortality, or weight data entered today</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>Daily Logs</span>
            <strong>{formatWhole(report.totals.dailyCount)}</strong>
            <small>Placements with a daily environment/report row on the selected date</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>Mortality Logs</span>
            <strong>{formatWhole(report.totals.mortalityCount)}</strong>
            <small>Placements with mortality data entered on the selected date</small>
          </article>
          <article className="feed-projection-report-summary-card">
            <span>Weight Logs</span>
            <strong>{formatWhole(report.totals.weightCount)}</strong>
            <small>Placements with at least one weight sample on the selected date</small>
          </article>
        </div>

        <div className="feed-projection-report-meta-grid">
          <div>
            <span>Report Date</span>
            <strong>{formatDate(report.reportDate)}</strong>
          </div>
          <div>
            <span>Generated</span>
            <strong>{formatTimestamp(new Date())}</strong>
          </div>
          <div>
            <span>Scope</span>
            <strong>{buildScopeLabel({ farmGroupId, farmId, barnId, flockCode })}</strong>
          </div>
        </div>

        <div className="feed-projection-report-table-wrap">
          <table className="feed-projection-report-table today-glance-report-table">
            <thead>
              <tr>
                <th className="feed-projection-report-sticky-col feed-projection-report-sticky-col--farm">
                  <span className="feed-projection-report-header-cell"><span>Farm</span><small>Name</small></span>
                </th>
                <th className="feed-projection-report-sticky-col feed-projection-report-sticky-col--barn">
                  <span className="feed-projection-report-header-cell"><span>Barn</span><small>Code</small></span>
                </th>
                <th className="feed-projection-report-flock-col">
                  <span className="feed-projection-report-header-cell"><span>Flock</span><small>Code</small></span>
                </th>
                <th className="feed-projection-report-number-col feed-projection-report-age-col">
                  <span className="feed-projection-report-header-cell"><span>Age</span><small>Day</small></span>
                </th>
                <th>
                  <span className="feed-projection-report-header-cell"><span>Daily</span><small>Data</small></span>
                </th>
                <th>
                  <span className="feed-projection-report-header-cell"><span>Daily</span><small>By / Time</small></span>
                </th>
                <th>
                  <span className="feed-projection-report-header-cell"><span>Mortality</span><small>Data</small></span>
                </th>
                <th>
                  <span className="feed-projection-report-header-cell"><span>Mortality</span><small>By / Time</small></span>
                </th>
                <th>
                  <span className="feed-projection-report-header-cell"><span>Weight</span><small>Data</small></span>
                </th>
                <th>
                  <span className="feed-projection-report-header-cell"><span>Weight</span><small>By / Time</small></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {report.rows.length > 0 ? (
                report.rows.map((row) => (
                  <tr key={row.placementId}>
                    <td className="feed-projection-report-sticky-col feed-projection-report-sticky-col--farm" title={row.farmName}>
                      {truncateFarmName(row.farmName)}
                    </td>
                    <td className="feed-projection-report-sticky-col feed-projection-report-sticky-col--barn">{row.barnCode}</td>
                    <td className="feed-projection-report-flock-col"><strong>{row.placementCode}</strong></td>
                    <td className="feed-projection-report-number-col feed-projection-report-age-col">{formatAge(row.ageDays)}</td>
                    <td>{renderDailyData(row)}</td>
                    <td>{renderReporter(row.daily.reporter)}</td>
                    <td>{renderMortalityData(row)}</td>
                    <td>{renderReporter(row.mortality.reporter)}</td>
                    <td>{renderWeightData(row)}</td>
                    <td>{renderReporter(row.weight.reporter)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="feed-projection-report-empty" colSpan={10}>
                    No daily, mortality, or weight data was found for the selected date within the chosen scope.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function renderDailyData(
  row: Awaited<ReturnType<typeof getTodayAtAGlanceReportData>>["rows"][number],
) {
  if (!row.daily.present) return "--";
  return (
    <div className="today-glance-cell-stack">
      <strong>{row.daily.tempSummary ?? "Daily Logged"}</strong>
      <small>
        Humidity {formatShortNumber(row.daily.humidity)} · Water {formatShortNumber(row.daily.water)}
      </small>
      {row.daily.comment ? <small title={row.daily.comment}>{truncateText(row.daily.comment, 36)}</small> : null}
    </div>
  );
}

function renderMortalityData(
  row: Awaited<ReturnType<typeof getTodayAtAGlanceReportData>>["rows"][number],
) {
  if (!row.mortality.present) return "--";
  return (
    <div className="today-glance-cell-stack">
      <strong>
        H {formatWhole(row.mortality.deadFemale)} / R {formatWhole(row.mortality.deadMale)}
      </strong>
      <small>
        Cull H {formatWhole(row.mortality.cullFemale)} · Cull R {formatWhole(row.mortality.cullMale)}
      </small>
      {row.mortality.deadReason ? <small title={row.mortality.deadReason}>{truncateText(row.mortality.deadReason, 36)}</small> : null}
    </div>
  );
}

function renderWeightData(
  row: Awaited<ReturnType<typeof getTodayAtAGlanceReportData>>["rows"][number],
) {
  if (!row.weight.present) return "--";
  return (
    <div className="today-glance-cell-stack">
      <strong>
        M {formatWeight(row.weight.maleAvg)} ({formatWhole(row.weight.maleCount)}) · F {formatWeight(row.weight.femaleAvg)} ({formatWhole(row.weight.femaleCount)})
      </strong>
    </div>
  );
}

function renderReporter(reporter: { userName: string | null; reportedAt: string | null }) {
  if (!reporter.userName && !reporter.reportedAt) return "--";
  return (
    <div className="today-glance-cell-stack">
      <strong>{reporter.userName ?? "--"}</strong>
      <small>{reporter.reportedAt ? formatTimestamp(new Date(reporter.reportedAt)) : "--"}</small>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
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
  return value.toFixed(2);
}

function formatShortNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
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

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}...` : value;
}

function buildScopeLabel({
  farmGroupId,
  farmId,
  barnId,
  flockCode,
}: {
  farmGroupId: string | null;
  farmId: string | null;
  barnId: string | null;
  flockCode: string | null;
}) {
  if (flockCode) return `Flock ${flockCode}`;
  if (barnId) return "Single Barn";
  if (farmId) return "Single Farm";
  if (farmGroupId) return "Farm Group";
  return "All Active Scope";
}

function buildReportsHubHref({
  farmGroupId,
  farmId,
  barnId,
  flockCode,
  reportDate,
}: {
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
  reportDate?: string;
}) {
  const params = new URLSearchParams({
    category: "quick_access_reports",
    report: "at_a_glance",
  });
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  if (reportDate) params.set("reportDate", reportDate);
  return `/admin/reports?${params.toString()}`;
}
