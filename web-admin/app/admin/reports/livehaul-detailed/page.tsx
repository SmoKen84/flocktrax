import type { Metadata } from "next";
import Link from "next/link";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { getLivehaulCalendarReportData } from "@/lib/livehaul-calendar-report-data";
import { buildMonthSections } from "@/lib/report-calendar";

export const metadata: Metadata = {
  title: "Livehaul Detailed Report | FlockTrax Admin",
};

type DetailedLivehaulReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DetailedLivehaulReportPage({ searchParams }: DetailedLivehaulReportPageProps) {
  const params = (await searchParams) ?? {};
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const flockCode = firstParam(params.flockCode);
  const today = new Date().toISOString().slice(0, 10);
  const startDate = firstParam(params.startDate) ?? `${today.slice(0, 7)}-01`;
  const endDate = firstParam(params.endDate) ?? today;
  const report = await getLivehaulCalendarReportData({
    variant: "detailed",
    farmGroupId,
    farmId,
    barnId,
    flockCode,
    startDate,
    endDate,
  });

  return (
    <div className="calendar-report-page">
      <section className="panel card calendar-report-shell">
        <div className="calendar-report-toolbar">
          <FeedProjectionReportActions />
          <Link
            className="button-secondary"
            href={buildBackHref({ farmGroupId, farmId, barnId, flockCode, startDate: report.startDate, endDate: report.endDate })}
          >
            <span aria-hidden="true">←</span>
            <span>Back to Reports</span>
          </Link>
        </div>
        <div className="calendar-report-inline-title">
          <strong>Livehaul - Detail</strong>
        </div>
        <div className="calendar-report-summary-grid">
          <article className="calendar-report-summary-card">
            <span>Livehaul Rows</span>
            <strong>{formatWhole(report.totals.livehauls)}</strong>
            <small>All livehaul schedule records in the selected range</small>
          </article>
          <article className="calendar-report-summary-card">
            <span>Loads Recorded</span>
            <strong>{formatWhole(report.totals.loadCount)}</strong>
            <small>Historical load-detail lines included below each catch</small>
          </article>
          <article className="calendar-report-summary-card">
            <span>Actual Head</span>
            <strong>{formatWhole(report.totals.actualHead)}</strong>
            <small>Total recorded processed head from livehaul header rows</small>
          </article>
          <article className="calendar-report-summary-card">
            <span>Scope</span>
            <strong>{report.scopeLabel}</strong>
            <small>{formatDate(report.startDate)} - {formatDate(report.endDate)}</small>
          </article>
        </div>

        {report.months.length > 0 ? (
          report.months.map((month) => {
            const section = buildMonthSections([month.monthKey], month.badgesByDate)[0];
            return (
              <section className="calendar-report-month-set" key={month.monthKey}>
                <section className="calendar-report-month-block calendar-report-month-calendar-page">
                  <div className="calendar-report-month-head">
                    <div>
                      <p className="eyebrow">Detailed Report</p>
                      <h2>{section.title}</h2>
                    </div>
                    <div className="calendar-report-month-meta">
                      <span>{month.rows.length} livehaul record{month.rows.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  <div className="calendar-report-weekdays">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  <div className="calendar-report-grid">
                    {section.days.map((day) => (
                      <div className="calendar-report-day" data-current-month={day.isCurrentMonth} key={day.date}>
                        <span className="calendar-report-day-number">{day.dayNumber}</span>
                        <div className="calendar-report-day-badges">
                          {day.badges.map((badge, index) => (
                            <span className="calendar-report-day-badge" data-tone={badge.tone ?? "neutral"} key={`${day.date}-${index}`}>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="calendar-report-month-block calendar-report-month-detail-page calendar-report-month-break">
                  <div className="calendar-report-month-head">
                    <div>
                      <p className="eyebrow">Month Detail</p>
                      <h2>{section.title}</h2>
                    </div>
                    <div className="calendar-report-month-meta">
                      <span>{month.rows.length} livehaul record{month.rows.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  <div className="calendar-report-list">
                    {month.rows.length > 0 ? (
                      month.rows.map((row) => (
                        <article className="calendar-report-item" key={row.livehaulId}>
                          <div className="calendar-report-item-head">
                            <strong>{formatDate(row.livehaulDate)} | {row.barnCode} | {row.flockCode}</strong>
                            <span className="calendar-report-item-pill" data-tone={row.status === "completed" ? "good" : row.status === "cancelled" ? "danger" : "warn"}>
                              {formatStatus(row.status)}
                            </span>
                          </div>

                          <div className="calendar-report-item-grid">
                            <div>
                              <span>Placement</span>
                              <strong>{row.placementCode}</strong>
                            </div>
                            <div>
                              <span>Target / Actual</span>
                              <strong>{formatWhole(row.headTarget)} / {formatWhole(row.headActual)}</strong>
                            </div>
                            <div>
                              <span>Loads / DOA</span>
                              <strong>{formatWhole(row.loadCount)} / {formatWhole(row.loadDoaCountTotal)}</strong>
                            </div>
                            <div>
                              <span>Actual Date</span>
                              <strong>{formatDate(row.actualDate)}</strong>
                            </div>
                          </div>

                          {row.comment ? <p className="calendar-report-item-note">{row.comment}</p> : null}

                          <div className="calendar-report-loads">
                            <div className="calendar-report-loads-head">
                              <strong>Load Detail</strong>
                            </div>
                            {row.loads.length > 0 ? (
                              <table className="calendar-report-load-table">
                                <thead>
                                  <tr>
                                    <th>Truck</th>
                                    <th>Trailer</th>
                                    <th>Scale</th>
                                    <th>Head</th>
                                    <th>DOA</th>
                                    <th>Live Wt</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.loads.map((load) => (
                                    <tr key={load.loadId}>
                                      <td>{load.truckNum ?? "--"}</td>
                                      <td>{load.trailerNum ?? "--"}</td>
                                      <td>{load.scaleLocation ?? "--"}</td>
                                      <td>{formatWhole(load.headCount)}</td>
                                      <td>{formatWhole(load.doaCount)}</td>
                                      <td>{formatWeight(load.liveWeight)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="calendar-report-empty">No load-detail rows were recorded for this livehaul entry.</div>
                            )}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="calendar-report-empty">No livehaul rows fall inside this month.</div>
                    )}
                  </div>
                </section>
              </section>
            );
          })
        ) : (
          <div className="calendar-report-empty">No livehaul rows matched the selected filters.</div>
        )}
      </section>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildBackHref({
  farmGroupId,
  farmId,
  barnId,
  flockCode,
  startDate,
  endDate,
}: {
  farmGroupId: string | null;
  farmId: string | null;
  barnId: string | null;
  flockCode: string | null;
  startDate: string;
  endDate: string;
}) {
  const params = new URLSearchParams({
    category: "detailed_reports",
    report: "detailed_livehaul_report",
    startDate,
    endDate,
  });
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  return `/admin/reports?${params.toString()}`;
}

function formatWhole(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function formatStatus(value: string) {
  if (value === "legacy_migrated") return "Legacy";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
