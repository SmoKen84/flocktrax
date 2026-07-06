import type { Metadata } from "next";
import Link from "next/link";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { getPlacementsCalendarReportData } from "@/lib/placements-calendar-report-data";
import { buildMonthSections } from "@/lib/report-calendar";

export const metadata: Metadata = {
  title: "Placements Report | FlockTrax Admin",
};

type QuickPlacementsReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuickPlacementsReportPage({ searchParams }: QuickPlacementsReportPageProps) {
  const params = (await searchParams) ?? {};
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const flockCode = firstParam(params.flockCode);
  const startDate = firstParam(params.startDate) ?? new Date().toISOString().slice(0, 10);
  const endDate = firstParam(params.endDate) ?? addDays(startDate, 30);
  const report = await getPlacementsCalendarReportData({
    variant: "quick",
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
          <strong>Placements - Schedule</strong>
        </div>
        <div className="calendar-report-summary-grid">
          <article className="calendar-report-summary-card">
            <span>Scheduled Placements</span>
            <strong>{formatWhole(report.totals.placements)}</strong>
            <small>Placement rows in the selected future range</small>
          </article>
          <article className="calendar-report-summary-card">
            <span>Head Scheduled</span>
            <strong>{formatWhole(report.totals.headPlaced)}</strong>
            <small>Total head expected across scheduled placements</small>
          </article>
          <article className="calendar-report-summary-card">
            <span>Range</span>
            <strong>{formatDate(report.startDate)} - {formatDate(report.endDate)}</strong>
            <small>Quick Access stays in today-forward planning mode</small>
          </article>
          <article className="calendar-report-summary-card">
            <span>Scope</span>
            <strong>{report.scopeLabel}</strong>
            <small>Farm group, farm, barn, or flock filtered scope</small>
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
                      <p className="eyebrow">Quick Access</p>
                      <h2>{section.title}</h2>
                    </div>
                    <div className="calendar-report-month-meta">
                      <span>{month.rows.length} placement{month.rows.length === 1 ? "" : "s"}</span>
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
                      <span>{month.rows.length} placement{month.rows.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  <div className="calendar-report-list">
                    {month.rows.length > 0 ? (
                      month.rows.map((row) => (
                        <article className="calendar-report-item" key={row.placementId}>
                          <div className="calendar-report-item-head">
                            <strong>{formatDate(row.placedDate)} | {row.barnCode} | {row.flockCode}</strong>
                            <span className="calendar-report-item-pill" data-tone={row.lifecycleStage === "in_barn_growing" ? "good" : "warn"}>
                              {formatLifecycle(row.lifecycleStage)}
                            </span>
                          </div>
                          <div className="calendar-report-item-grid">
                            <div>
                              <span>Placement</span>
                              <strong>{row.placementCode}</strong>
                            </div>
                            <div>
                              <span>Barn</span>
                              <strong>{row.barnCode}</strong>
                            </div>
                            <div>
                              <span>Head To Place</span>
                              <strong>{formatWhole(row.headPlaced)}</strong>
                            </div>
                            <div>
                              <span>Est. First Livehaul</span>
                              <strong>{formatDate(row.estFirstLivehaul)}</strong>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="calendar-report-empty">No placement rows fall inside this month.</div>
                    )}
                  </div>
                </section>
              </section>
            );
          })
        ) : (
          <div className="calendar-report-empty">No placement rows matched the selected filters.</div>
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
    category: "quick_access_reports",
    report: "quick_placements_report",
    startDate,
    endDate,
  });
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  return `/admin/reports?${params.toString()}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatWhole(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function formatLifecycle(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
