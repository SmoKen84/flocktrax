import type { Metadata } from "next";
import Link from "next/link";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { getMortalityReportData } from "@/lib/mortality-report-data";

export const metadata: Metadata = {
  title: "Mortality Report | FlockTrax Admin",
};

type MortalityReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MortalityReportPage({ searchParams }: MortalityReportPageProps) {
  const params = (await searchParams) ?? {};
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const flockCode = firstParam(params.flockCode);
  const today = new Date().toISOString().slice(0, 10);
  const startDate = firstParam(params.startDate) ?? `${today.slice(0, 7)}-01`;
  const endDate = firstParam(params.endDate) ?? today;
  const report = await getMortalityReportData({
    farmGroupId,
    farmId,
    barnId,
    flockCode,
    startDate,
    endDate,
  });

  return (
    <div className="mortality-report-page">
      <section className="panel card mortality-report-shell">
        <div className="mortality-report-toolbar">
          <FeedProjectionReportActions />
          <Link
            className="button-secondary"
            href={buildBackHref({
              farmGroupId,
              farmId,
              barnId,
              flockCode,
              startDate: report.startDate,
              endDate: report.endDate,
            })}
          >
            <span aria-hidden="true">←</span>
            <span>Back to Reports</span>
          </Link>
        </div>

        <header className="mortality-report-title">
          <p className="eyebrow">Detailed Report</p>
          <h1>Mortality</h1>
          <p>
            Daily female and male mortality with opening balance-forward and ending population for each flock.
          </p>
        </header>

        <div className="mortality-report-summary-grid">
          <SummaryCard
            label="Report Range"
            value={`${formatDate(report.startDate)} - ${formatDate(report.endDate)}`}
            detail={`${report.scopeLabel} | ${formatWhole(report.sections.length)} flock section${report.sections.length === 1 ? "" : "s"}`}
          />
          <SummaryCard
            label="Day 1 Balance Forward"
            value={formatWhole(report.totals.openingFemalePopulation + report.totals.openingMalePopulation)}
            detail={`Female ${formatWhole(report.totals.openingFemalePopulation)} | Male ${formatWhole(report.totals.openingMalePopulation)}`}
          />
          <SummaryCard
            label="Mortality In Range"
            value={formatWhole(report.totals.lossFemale + report.totals.lossMale)}
            detail={`Female ${formatWhole(report.totals.lossFemale)} | Male ${formatWhole(report.totals.lossMale)}`}
          />
          <SummaryCard
            label="Ending Population"
            value={formatWhole(report.totals.endingFemalePopulation + report.totals.endingMalePopulation)}
            detail={`Female ${formatWhole(report.totals.endingFemalePopulation)} | Male ${formatWhole(report.totals.endingMalePopulation)}`}
          />
        </div>

        {report.sections.length > 0 ? (
          <div className="mortality-report-sections">
            {report.sections.map((section) => (
              <section className="mortality-report-section" key={section.placementId}>
                <div className="mortality-report-section-head">
                  <div>
                    <p className="eyebrow">{section.farmGroupName}</p>
                    <h2>{section.farmName} | Barn {section.barnCode} | Flock {section.flockCode}</h2>
                  </div>
                  <div className="mortality-report-section-meta">
                    <span>Placed {formatDate(section.placedDate)}</span>
                    <strong>{formatDate(section.reportStartDate)} - {formatDate(section.reportEndDate)}</strong>
                  </div>
                </div>

                <div className="mortality-report-table-wrap mortality-report-table-wrap--screen">
                  <table className="mortality-report-table">
                    <thead>
                      <tr>
                        <th rowSpan={2}>Date</th>
                        <th colSpan={5}>Female</th>
                        <th colSpan={5}>Male</th>
                        <th colSpan={2}>Combined</th>
                      </tr>
                      <tr>
                        <th>Placed</th>
                        <th>Dead</th>
                        <th>Cull</th>
                        <th>Daily Loss</th>
                        <th>Population</th>
                        <th>Placed</th>
                        <th>Dead</th>
                        <th>Cull</th>
                        <th>Daily Loss</th>
                        <th>Population</th>
                        <th>Daily Loss</th>
                        <th>Population</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="mortality-report-balance-row">
                        <th>Day 1 - Balance Forward</th>
                        <td>--</td>
                        <td>--</td>
                        <td>--</td>
                        <td>--</td>
                        <td>{formatWhole(section.openingFemalePopulation)}</td>
                        <td>--</td>
                        <td>--</td>
                        <td>--</td>
                        <td>--</td>
                        <td>{formatWhole(section.openingMalePopulation)}</td>
                        <td>--</td>
                        <td>{formatWhole(section.openingTotalPopulation)}</td>
                      </tr>
                      {section.days.map((day) => (
                        <tr key={day.date}>
                          <th>{formatDayDate(day.date)}</th>
                          <td>{formatActivity(day.femalePlaced)}</td>
                          <td>{formatActivity(day.femaleDead)}</td>
                          <td>{formatActivity(day.femaleCull)}</td>
                          <td>{formatActivity(day.femaleLoss)}</td>
                          <td>{formatWhole(day.femalePopulation)}</td>
                          <td>{formatActivity(day.malePlaced)}</td>
                          <td>{formatActivity(day.maleDead)}</td>
                          <td>{formatActivity(day.maleCull)}</td>
                          <td>{formatActivity(day.maleLoss)}</td>
                          <td>{formatWhole(day.malePopulation)}</td>
                          <td>{formatActivity(day.totalLoss)}</td>
                          <td>{formatWhole(day.totalPopulation)}</td>
                        </tr>
                      ))}
                      <tr className="mortality-report-ending-row">
                        <th>Ending Population</th>
                        <td colSpan={3}>Female Loss: {formatWhole(section.femaleLossInRange)}</td>
                        <td>--</td>
                        <td>{formatWhole(section.endingFemalePopulation)}</td>
                        <td colSpan={3}>Male Loss: {formatWhole(section.maleLossInRange)}</td>
                        <td>--</td>
                        <td>{formatWhole(section.endingMalePopulation)}</td>
                        <td>{formatWhole(section.totalLossInRange)}</td>
                        <td>{formatWhole(section.endingTotalPopulation)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mortality-report-print-table-wrap">
                  <table className="mortality-report-print-table">
                    <colgroup>
                      <col className="mortality-report-print-date-column" />
                      <col className="mortality-report-print-loss-column" />
                      <col className="mortality-report-print-population-column" />
                      <col className="mortality-report-print-loss-column" />
                      <col className="mortality-report-print-population-column" />
                      <col className="mortality-report-print-loss-column" />
                      <col className="mortality-report-print-total-column" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2}>Date</th>
                        <th colSpan={2}>Female</th>
                        <th colSpan={2}>Male</th>
                        <th colSpan={2}>Combined</th>
                      </tr>
                      <tr>
                        <th>Mortality</th>
                        <th>Population</th>
                        <th>Mortality</th>
                        <th>Population</th>
                        <th>Mortality</th>
                        <th>Population</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="mortality-report-balance-row">
                        <th>Day 1 - Balance Forward</th>
                        <td>--</td>
                        <td>{formatWhole(section.openingFemalePopulation)}</td>
                        <td>--</td>
                        <td>{formatWhole(section.openingMalePopulation)}</td>
                        <td>--</td>
                        <td>{formatWhole(section.openingTotalPopulation)}</td>
                      </tr>
                      {section.days.map((day) => (
                        <tr key={day.date}>
                          <th>{formatDayDate(day.date)}</th>
                          <td>{formatActivity(day.femaleLoss)}</td>
                          <td>
                            {formatWhole(day.femalePopulation)}
                            {day.femalePlaced > 0 ? <small>Placed +{formatWhole(day.femalePlaced)}</small> : null}
                          </td>
                          <td>{formatActivity(day.maleLoss)}</td>
                          <td>
                            {formatWhole(day.malePopulation)}
                            {day.malePlaced > 0 ? <small>Placed +{formatWhole(day.malePlaced)}</small> : null}
                          </td>
                          <td>{formatActivity(day.totalLoss)}</td>
                          <td>{formatWhole(day.totalPopulation)}</td>
                        </tr>
                      ))}
                      <tr className="mortality-report-ending-row">
                        <th>Ending Population</th>
                        <td>{formatWhole(section.femaleLossInRange)}</td>
                        <td>{formatWhole(section.endingFemalePopulation)}</td>
                        <td>{formatWhole(section.maleLossInRange)}</td>
                        <td>{formatWhole(section.endingMalePopulation)}</td>
                        <td>{formatWhole(section.totalLossInRange)}</td>
                        <td>{formatWhole(section.endingTotalPopulation)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mortality-report-empty">
            No flock mortality records overlap the selected date range and filters.
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="mortality-report-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
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
    report: "detailed_mortality_report",
    startDate,
    endDate,
  });
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  return `/admin/reports?${params.toString()}`;
}

function formatWhole(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatActivity(value: number) {
  return value === 0 ? "--" : formatWhole(value);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function formatDayDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}
