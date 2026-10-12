import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { addCalendarDays, clipVacancy, vacancyColor, vacancyDateRange } from "@/lib/barn-vacancy";
import { getBarnVacancyReport } from "@/lib/barn-vacancy-report-data";
import { getPlacementEditorActorAccess } from "@/lib/placement-editor-access";
import { collectMonthKeys } from "@/lib/report-calendar";
import styles from "./vacancy.module.css";

export const metadata: Metadata = { title: "Barn Vacancy Calendar | FlockTrax Admin" };

export default async function BarnVacancyPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getPlacementEditorActorAccess();
  if (!actor.actorId) redirect("/login");
  if (!actor.hasDashboardView) return <section className="panel card">You do not have access to this report.</section>;
  const params = (await searchParams) ?? {};
  const farmGroupId = first(params.farmGroupId);
  const farmId = first(params.farmId);
  const barnId = first(params.barnId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { startDate, endDate } = vacancyDateRange(first(params.startDate), first(params.endDate), today);
  const backParams = new URLSearchParams({ category: "quick_access_reports", report: "barn_vacancy", startDate, endDate });
  if (farmGroupId) backParams.set("farmGroupId", farmGroupId);
  if (farmId) backParams.set("farmId", farmId);
  if (barnId) backParams.set("barnId", barnId);
  let rows: Awaited<ReturnType<typeof getBarnVacancyReport>> = [];
  let loadFailed = false;
  try {
    rows = await getBarnVacancyReport(actor, { farmGroupId, farmId, barnId, startDate, endDate });
  } catch {
    loadFailed = true;
  }
  return (
    <div className={`calendar-report-page ${styles.report}`}>
      <div className={`calendar-report-toolbar ${styles.toolbar}`}>
        <FeedProjectionReportActions />
        <Link className="button-secondary" href={`/admin/reports?${backParams}`}>← Back to Reports</Link>
      </div>
      <header className={styles.header}>
        <p className="eyebrow">Quick Access Reports</p>
        <h1>Barn Vacancy Calendar</h1>
        <p>{formatDate(startDate)} – {formatDate(endDate)} · {rows.length} barns</p>
        <p><strong>Solid colored lines = projected vacancy.</strong> Vacancy begins on placement start + 43 days and ends the day before the next placement. Blank dates have a placement or fall outside the selected range.</p>
        <p className={styles.note}>Planning estimate based on recorded placements; no cleanup days are added. Dates after the last known placement remain projected vacant through the report end date.</p>
      </header>
      {loadFailed ? <p role="alert" className="panel card">The placement schedule could not be loaded. Please reload this report; vacancy dates have not been calculated.</p>
        : !rows.length ? <p className="panel card">No active barns match your filters and account access.</p>
        : collectMonthKeys(startDate, endDate).map((monthKey) => {
          const monthStart = `${monthKey}-01`;
          const date = new Date(`${monthStart}T00:00:00Z`);
          const dayCount = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
          const monthEnd = `${monthKey}-${dayCount}`;
          const dates = Array.from({ length: dayCount }, (_, index) => addCalendarDays(monthStart, index));
          const title = date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
          return (
            <section className={styles.month} key={monthKey} aria-label={`${title} vacancy calendar`}>
              <h2>{title}</h2>
              <p className={styles.note}>Each row is one barn. The line covers every vacant date, including weekends.</p>
              <div className={styles.scroll} tabIndex={0} aria-label={`${title} calendar, scroll horizontally on smaller screens`}>
                <div className={styles.calendar} role="table" aria-label={`${title} projected barn vacancies`}>
                  <div className={styles.row} role="row">
                    <div className={styles.barn} role="columnheader">Barn / Farm</div>
                    <div className={styles.days} style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }} role="presentation">
                      {dates.map((value, index) => {
                        const weekday = new Date(`${value}T00:00:00Z`).getUTCDay();
                        return <div className={styles.day} data-weekend={weekday === 0 || weekday === 6} data-today={value === today} data-outside={value < startDate || value > endDate} key={value} role="columnheader">
                          <small>{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][weekday]}</small><strong>{index + 1}</strong>
                        </div>;
                      })}
                    </div>
                  </div>
                  {rows.map((barn) => {
                    const intervals = barn.intervals.flatMap((interval) => {
                      const clipped = clipVacancy(interval, monthStart, monthEnd);
                      return clipped ? [clipped] : [];
                    });
                    const description = barn.unknown ? "Start date missing; vacancy unknown" : intervals.length ? intervals.map((interval) => `${formatDate(interval.startDate)} through ${formatDate(interval.endDate)}`).join("; ") : "No projected vacant dates in this month";
                    const color = vacancyColor(barn.id);
                    return <div className={styles.row} role="row" key={barn.id}>
                      <div className={styles.barn} role="rowheader"><strong><span className={styles.swatch} style={{ backgroundColor: color }} />{barn.barnCode}</strong><small>{barn.farmName}</small></div>
                      <div className={styles.lane} style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }} role="cell" aria-label={`${barn.barnCode}: ${description}`}>
                        {dates.map((value, index) => <span aria-hidden="true" className={styles.cell} data-weekend={[0, 6].includes(new Date(`${value}T00:00:00Z`).getUTCDay())} data-outside={value < startDate || value > endDate} style={{ gridColumn: index + 1, gridRow: 1 }} key={value} />)}
                        {intervals.map((interval) => <span aria-hidden="true" className={styles.bar} key={interval.startDate} title={`${barn.barnCode}: ${formatDate(interval.startDate)} – ${formatDate(interval.endDate)}`} style={{ backgroundColor: color, gridColumn: `${Number(interval.startDate.slice(8))} / ${Number(interval.endDate.slice(8)) + 1}`, gridRow: 1 }} />)}
                        {barn.unknown ? <span className={styles.unknown}>Start date missing — vacancy unknown</span> : null}
                      </div>
                    </div>;
                  })}
                </div>
              </div>
              <details className={styles.details}>
                <summary>Vacancy dates by barn</summary>
                <dl>{rows.map((barn) => {
                  const intervals = barn.intervals.flatMap((interval) => { const clipped = clipVacancy(interval, monthStart, monthEnd); return clipped ? [clipped] : []; });
                  return <div key={barn.id}><dt>{barn.barnCode} · {barn.farmName}</dt><dd>{barn.unknown ? "Unknown — placement start date missing" : intervals.length ? intervals.map((interval) => `${formatDate(interval.startDate)} – ${formatDate(interval.endDate)}`).join("; ") : "No projected vacancy"}</dd></div>;
                })}</dl>
              </details>
            </section>
          );
        })}
    </div>
  );
}

function first(value: string | string[] | undefined) { return (Array.isArray(value) ? value[0] : value) || null; }
function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
