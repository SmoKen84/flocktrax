import { Fragment } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { FlockHistoryReportActions } from "@/app/admin/flocks/flock-history-report-actions";
import { getFlockHistoryReportBundle } from "@/lib/flock-history-report";
import { getAppSettingTextValues } from "@/lib/platform-content";

type FlockHistoryReportPageProps = {
  params: Promise<{ flockId: string }>;
};

export default async function FlockHistoryReportPage({ params }: FlockHistoryReportPageProps) {
  const { flockId } = await params;
  const [report, appText] = await Promise.all([
    getFlockHistoryReportBundle(flockId),
    getAppSettingTextValues([
      "flock_history_title",
      "flock_history_pg1",
      "flock_history_pg2",
      "flock_history_pg3",
    ]),
  ]);

  if (!report) {
    notFound();
  }

  const titlePlacementCode = report.placements[0]?.placementCode || report.flockCode;
  const reportBody =
    appText.get("flock_history_title")?.desc ||
    "Print-ready flock history with daily log data on one matrix page and mortality data on a companion matrix page.";
  const page1Title = appText.get("flock_history_pg1")?.value || "Daily Log Matrix";
  const page1Body =
    appText.get("flock_history_pg1")?.desc ||
    "Dates run down the page. Daily log data points run across the page.";
  const page2Title = appText.get("flock_history_pg2")?.value || "Mortality Matrix";
  const page2Body =
    appText.get("flock_history_pg2")?.desc ||
    "Companion matrix for mortality and health-marker fields so the layout stays readable in landscape format.";

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.35in;
          }
        }
      `}</style>

      <PageHeader
        eyebrow="Flock History Report"
        title={
          <>
            <span>{`Flock ${titlePlacementCode}`}</span>
            <br />
            <span>Historical Summary</span>
          </>
        }
        body={reportBody}
        actions={<FlockHistoryReportActions />}
      />

      <section className="panel card flock-history-report-shell">
        <div className="flock-history-report-summary-grid">
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Flock</span>
            <strong>{report.flockCode}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Farm</span>
            <strong>{report.farmName}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Group</span>
            <strong>{report.farmGroupName}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Status</span>
            <strong>{report.status}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Placed</span>
            <strong>{formatDate(report.placedDate)}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>First Catch</span>
            <strong>{formatDate(report.estimatedFirstCatch)}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Females</span>
            <strong>{formatWhole(report.femaleCount)}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Males</span>
            <strong>{formatWhole(report.maleCount)}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Placements</span>
            <strong>{formatWhole(report.totals.placementCount)}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Daily Rows</span>
            <strong>{formatWhole(report.totals.dailyRowCount)}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Mortality Rows</span>
            <strong>{formatWhole(report.totals.mortalityRowCount)}</strong>
          </div>
          <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
            <span>Generated</span>
            <strong>{formatTimestamp(report.generatedAt)}</strong>
          </div>
        </div>

        <div className="flock-history-report-pages">
          <section className="flock-history-report-page flock-history-report-page--after-header">
            <div className="flock-history-report-page-header">
              <div>
                <p className="eyebrow">Page 2</p>
                <h2>{page1Title}</h2>
              </div>
              <p>{page1Body}</p>
            </div>

            {report.placements.length > 0 ? (
              report.placements.map((placement) => (
                <article className="flock-history-report-placement-block" key={`daily-${placement.placementId}`}>
                  <div className="flock-history-report-placement-meta">
                    <div>
                      <span>Placement</span>
                      <strong>{placement.placementCode}</strong>
                    </div>
                    <div>
                      <span>Barn</span>
                      <strong>{placement.barnCode}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{placement.status}</strong>
                    </div>
                    <div>
                      <span>Removed</span>
                      <strong>{formatDate(placement.removedDate)}</strong>
                    </div>
                  </div>

                  <div className="flock-history-report-table-wrap">
                    <table className="flock-history-report-table">
                      <thead>
                        <tr>
                          <th className="flock-history-report-col-date" rowSpan={2}>Date</th>
                          <th className="flock-history-report-col-age" rowSpan={2}>Age</th>
                          <th colSpan={2}>Temp</th>
                          <th rowSpan={2}>RH</th>
                          <th colSpan={3}>Forecast</th>
                          <th rowSpan={2}>Min Vent</th>
                          <th colSpan={2}>Outdoor Access</th>
                          <th rowSpan={2}>NaOH</th>
                        </tr>
                        <tr>
                          <th>Barn</th>
                          <th>Set</th>
                          <th>Curr</th>
                          <th>Low</th>
                          <th>High</th>
                          <th>Open</th>
                          <th>Exception</th>
                        </tr>
                      </thead>
                      <tbody>
                        {placement.dailyRows.length > 0 ? (
                          placement.dailyRows.map((row) => (
                            <Fragment key={`${row.placementId}-${row.logDate}`}>
                              <tr className={hasVisibleText(row.comment) ? "flock-history-report-row--with-comment" : undefined}>
                                <td className="flock-history-report-col-date">{formatDate(row.logDate)}</td>
                                <td className="flock-history-report-col-age">{formatNullableWhole(row.ageDays)}</td>
                                <td>{formatNumber(row.amTemp)}</td>
                                <td>{formatNumber(row.setTemp)}</td>
                                <td>{formatNumber(row.relHumidity)}</td>
                                <td>{formatNumber(row.outsideTempCurrent)}</td>
                                <td>{formatNumber(row.outsideTempLow)}</td>
                                <td>{formatNumber(row.outsideTempHigh)}</td>
                                <td>{formatText(row.minVent)}</td>
                                <td>{formatFlag(row.isOdaOpen)}</td>
                                <td>{formatText(row.odaException)}</td>
                                <td>{formatText(row.naoh)}</td>
                              </tr>
                              {hasVisibleText(row.comment) ? (
                                <tr className="flock-history-report-comment-row">
                                  <td className="flock-history-report-comment-cell" colSpan={12}>
                                    <span className="flock-history-report-comment-label">Comment:</span>{" "}
                                    {formatText(row.comment)}
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          ))
                        ) : (
                          <tr>
                            <td className="flock-history-report-empty" colSpan={12}>
                              No daily log rows were found for this placement.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))
            ) : (
              <div className="helper-banner">No placements were found for this flock.</div>
            )}
          </section>

          <section className="flock-history-report-page flock-history-report-page--break">
            <div className="flock-history-report-page-header">
              <div>
                <p className="eyebrow">Page 3</p>
                <h2>{page2Title}</h2>
              </div>
              <p>{page2Body}</p>
            </div>

            <div className="flock-history-report-hero flock-history-report-hero--totals">
              <span>
                <strong>Final Pop:</strong> {formatWhole(report.totals.finalPopulation)}
                {` (${formatWhole(report.totals.finalMalePopulation)} Roo / ${formatWhole(report.totals.finalFemalePopulation)} Hen)`}
              </span>
              <span><strong>Mortality %:</strong> {formatPercent(report.totals.finalMortalityPercent)}</span>
              <span><strong>Live %:</strong> {formatPercent(report.totals.finalLivePercent)}</span>
              <span><strong>Total Losses:</strong> {formatWhole(report.totals.totalLosses)}</span>
              <span><strong>Dead:</strong> {`${formatWhole(report.totals.deadMale)} Roo / ${formatWhole(report.totals.deadFemale)} Hen`}</span>
              <span><strong>Cull:</strong> {`${formatWhole(report.totals.cullMale)} Roo / ${formatWhole(report.totals.cullFemale)} Hen`}</span>
            </div>

            {report.placements.length > 0 ? (
              report.placements.map((placement) => (
                <article className="flock-history-report-placement-block" key={`mortality-${placement.placementId}`}>
                  <div className="flock-history-report-placement-meta">
                    <div>
                      <span>Placement</span>
                      <strong>{placement.placementCode}</strong>
                    </div>
                    <div>
                      <span>Barn</span>
                      <strong>{placement.barnCode}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{placement.status}</strong>
                    </div>
                    <div>
                      <span>Projected End</span>
                      <strong>{formatDate(placement.projectedEndDate)}</strong>
                    </div>
                  </div>

                  <div className="flock-history-report-table-wrap">
                    <table className="flock-history-report-table flock-history-report-table--mortality">
                      <thead>
                        <tr>
                          <th className="flock-history-report-col-date" rowSpan={2}>Date</th>
                          <th className="flock-history-report-col-age" rowSpan={2}>Age</th>
                          <th colSpan={2}>Dead</th>
                          <th colSpan={2}>Cull</th>
                          <th colSpan={2}>Cull Notes</th>
                          <th rowSpan={2}>Dead Reason</th>
                          <th colSpan={5}>Grade / Score</th>
                        </tr>
                        <tr>
                          <th>Roo</th>
                          <th>Hen</th>
                          <th>Roo</th>
                          <th>Hen</th>
                          <th>Roo</th>
                          <th>Hen</th>
                          <th>Litter</th>
                          <th>Footpad</th>
                          <th>Feathers</th>
                          <th>Lame</th>
                          <th>Pecking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {placement.mortalityRows.length > 0 ? (
                          placement.mortalityRows.map((row) => (
                            <tr key={`${row.placementId}-${row.logDate}`}>
                              <td className="flock-history-report-col-date">{formatDate(row.logDate)}</td>
                              <td className="flock-history-report-col-age">{formatNullableWhole(row.ageDays)}</td>
                              <td>{formatWhole(row.deadMale)}</td>
                              <td>{formatWhole(row.deadFemale)}</td>
                              <td>{formatWhole(row.cullMale)}</td>
                              <td>{formatWhole(row.cullFemale)}</td>
                              <td>{formatText(row.cullFemaleNote)}</td>
                              <td>{formatText(row.cullMaleNote)}</td>
                              <td>{formatText(row.deadReason)}</td>
                              <td>{formatNullableWhole(row.gradeLitter)}</td>
                              <td>{formatNullableWhole(row.gradeFootpad)}</td>
                              <td>{formatNullableWhole(row.gradeFeathers)}</td>
                              <td>{formatNullableWhole(row.gradeLame)}</td>
                              <td>{formatNullableWhole(row.gradePecking)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="flock-history-report-empty" colSpan={14}>
                              No mortality log rows were found for this placement.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))
            ) : null}
          </section>
        </div>
      </section>
    </>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const shortDate = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
  const dayCode = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .slice(0, 2);
  return `${shortDate} ${dayCode}`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWhole(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatNullableWhole(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return formatWhole(value);
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || "--";
}

function hasVisibleText(value: string | null | undefined) {
  return String(value ?? "").trim().length > 0;
}

function formatFlag(value: boolean) {
  return value ? "Y" : "--";
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}%`;
}
