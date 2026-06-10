import type { Metadata } from "next";
import { Fragment } from "react";
import { notFound } from "next/navigation";

import { ArchiveSummaryActions } from "@/app/admin/flock-closeout/archive-summary-actions";
import { PageHeader } from "@/components/page-header";
import { getCloseoutQueueData } from "@/lib/closeout-data";
import { getFeedTicketFlockReportBundle } from "@/lib/feed-ticket-data";
import { getFlockHistoryReportBundle } from "@/lib/flock-history-report";

type ArchiveSummaryPageProps = {
  params: Promise<{
    placementId: string;
  }>;
};

export async function generateMetadata({ params }: ArchiveSummaryPageProps): Promise<Metadata> {
  const { placementId } = await params;
  const queue = await getCloseoutQueueData({ placement: placementId });
  const item = queue.items.find((entry) => entry.placementId === placementId) ?? null;
  const placementCode = item?.placementCode ?? "Digital Archive Summary";

  return {
    title: `Digital Archive Summary | ${placementCode} | FlockTrax Admin`,
  };
}

export default async function ArchiveSummaryPage({ params }: ArchiveSummaryPageProps) {
  const { placementId } = await params;
  const queue = await getCloseoutQueueData({ placement: placementId });
  const item = queue.items.find((entry) => entry.placementId === placementId) ?? null;

  if (!item || !item.closeout) {
    notFound();
  }

  const closeout = item.closeout;
  const [feedReport, flockHistory] = await Promise.all([
    getFeedTicketFlockReportBundle({
      flockCode: item.placementCode,
    }),
    getFlockHistoryReportBundle(item.flockId),
  ]);

  if (!flockHistory) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow="Digital Archive Summary"
        title={
          <>
            <span>{item.placementCode}</span>
            <br />
            <span>{`${item.farmName} | Barn ${item.barnCode}`}</span>
          </>
        }
        body="Combined print packet for grower settlement support, including closeout summary, first 7-day mortality archive, livehaul/load history, feed activity, and flock history matrices."
        actions={<ArchiveSummaryActions />}
      />

      <section className="digital-archive-summary-shell">
        <section className="panel card closeout-report-shell">
          <div className="closeout-report-summary-strip">
            <span className="closeout-report-summary-pill">
              <small>Closeout</small>
              <strong>{formatCloseoutStatus(closeout.status)}</strong>
            </span>
            <span className="closeout-report-summary-pill">
              <small>Placement</small>
              <strong>{formatPlacementState(item.lifecycleStage)}</strong>
            </span>
            <span className="closeout-report-summary-pill">
              <small>Placed / Removed</small>
              <strong>{`${formatShortDate(item.placedDate)} | ${formatShortDate(item.removedDate)}`}</strong>
            </span>
            <span className="closeout-report-summary-pill">
              <small>Started / Final</small>
              <strong>{`${formatWhole(item.headCount)} | ${formatWhole(item.finalHeadCount)}`}</strong>
            </span>
            <span className="closeout-report-summary-pill">
              <small>Oldest Age</small>
              <strong>{formatAge(closeout.removedAgeDays)}</strong>
            </span>
          </div>

          <section className="closeout-report-section">
            <div className="closeout-report-section-header">
              <div>
                <p className="eyebrow">Closeout Header</p>
                <h2>Overall Process Summary</h2>
              </div>
              <p>Rolled-up production, feed, mortality, and breed results across all livehauls for this placement.</p>
            </div>

            <div className="closeout-report-metric-grid">
              <article className="closeout-report-metric-card">
                <span>Processed Head</span>
                <strong>{formatWholeNullable(closeout.processedHeadFinal)}</strong>
                <small>{`Derived ${formatWholeNullable(closeout.derived.processedHead)}`}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Live Weight</span>
                <strong>{formatWeight(closeout.liveWeightFinal)}</strong>
                <small>{`Avg ${formatRatio(closeout.averageHeadWeight)}`}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Feed Delivered</span>
                <strong>{formatWeight(closeout.feedDeliveredTotalLbs)}</strong>
                <small>{`${formatWeight(closeout.derived.starterDelivered)} starter | ${formatWeight(closeout.derived.growerDelivered)} grower`}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Feed Consumed</span>
                <strong>{formatWeight(closeout.feedConsumedTotalLbs)}</strong>
                <small>{`${formatWeight(closeout.starterConsumedLbs)} starter | ${formatWeight(closeout.growerConsumedLbs)} grower`}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Per Head / FCR</span>
                <strong>{`${formatRatio(closeout.feedPerHeadLbs)} | ${formatRatio(closeout.feedConversion)}`}</strong>
                <small>{`${formatRatio(closeout.starterPerHeadLbs)} starter | ${formatRatio(closeout.growerPerHeadLbs)} grower`}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Breed Compare</span>
                <strong>{`${formatRatio(closeout.breedActualAvgWeight)} | ${formatRatio(closeout.breedExpectedAvgWeight)}`}</strong>
                <small>{`${formatPercent(closeout.breedWeightPercent)} of target`}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Live %</span>
                <strong>{formatPercent(closeout.overallLivePercent)}</strong>
                <small>{`First 7d live ${formatPercent(closeout.first7DayLivePercent)}`}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Mortality %</span>
                <strong>{`${formatPercent(closeout.femaleMortalityPercent)} hen | ${formatPercent(closeout.maleMortalityPercent)} roo`}</strong>
                <small>{`${formatWhole(closeout.first7DayFemaleLosses)} hen | ${formatWhole(closeout.first7DayMaleLosses)} roo first 7d`}</small>
              </article>
            </div>

            {closeout.notes || closeout.manualOverrideReason ? (
              <div className="closeout-report-notes-grid">
                <article className="closeout-report-note-card">
                  <span>Manual Override Reason</span>
                  <p>{closeout.manualOverrideReason || "--"}</p>
                </article>
                <article className="closeout-report-note-card">
                  <span>Notes</span>
                  <p>{closeout.notes || "--"}</p>
                </article>
              </div>
            ) : null}
          </section>

          <section className="closeout-report-section">
            <div className="closeout-report-section-header">
              <div>
                <p className="eyebrow">First 7 Days</p>
                <h2>First 7-Day Mortality Archive</h2>
              </div>
              <p>Industry-style cumulative day 1 through day 7 mortality archive for attachment and grower packet support.</p>
            </div>

            <div className="closeout-report-metric-grid">
              <article className="closeout-report-metric-card">
                <span>Roo 7d Loss</span>
                <strong>{formatWhole(closeout.first7DayMaleLosses)}</strong>
                <small>{formatPercent(closeout.first7DayMaleMortalityPercent)}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Hen 7d Loss</span>
                <strong>{formatWhole(closeout.first7DayFemaleLosses)}</strong>
                <small>{formatPercent(closeout.first7DayFemaleMortalityPercent)}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>Total 7d Loss</span>
                <strong>{formatWhole(closeout.first7DayTotalLosses)}</strong>
                <small>{formatPercent(closeout.first7DayLivePercent === null ? null : 100 - closeout.first7DayLivePercent)}</small>
              </article>
              <article className="closeout-report-metric-card">
                <span>7d Live %</span>
                <strong>{formatPercent(closeout.first7DayLivePercent)}</strong>
                <small>Day 1 through day 7 cumulative</small>
              </article>
            </div>

            <div className="closeout-report-table-wrap">
              <table className="closeout-report-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Date</th>
                    <th>Roo</th>
                    <th>Hen</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {closeout.first7DayBreakdown.map((day) => (
                    <tr key={day.date}>
                      <td>{day.label}</td>
                      <td>{formatShortDate(day.date)}</td>
                      <td>{formatWhole(day.male)}</td>
                      <td>{formatWhole(day.female)}</td>
                      <td>{formatWhole(day.male + day.female)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="closeout-report-section">
            <div className="closeout-report-section-header">
              <div>
                <p className="eyebrow">Livehaul Detail</p>
                <h2>Livehauls And Load Detail</h2>
              </div>
              <p>Oldest to newest livehaul dates with each livehaul's actual load lines captured in the archive packet.</p>
            </div>

            {item.livehauls.length > 0 ? (
              <div className="closeout-report-livehaul-stack">
                {item.livehauls.map((livehaul) => {
                  const liveWeight = livehaul.loads.reduce((sum, load) => sum + (load.liveWeight ?? 0), 0);
                  const actualHead = livehaul.loadHeadCountTotal > 0 ? livehaul.loadHeadCountTotal : livehaul.headActual;
                  return (
                    <article className="closeout-report-livehaul-card" key={livehaul.livehaulId}>
                      <div className="closeout-report-livehaul-head">
                        <div>
                          <p className="eyebrow">{`LH${livehaul.sequenceNum ?? "--"}`}</p>
                          <h3>{formatDayDate(livehaul.actualDate ?? livehaul.lhDate)}</h3>
                        </div>
                        <div className="closeout-report-livehaul-pills">
                          <span className="closeout-report-summary-pill">
                            <small>Status</small>
                            <strong>{formatLivehaulStatus(livehaul.status)}</strong>
                          </span>
                          <span className="closeout-report-summary-pill">
                            <small>Sex</small>
                            <strong>{formatTargetSex(livehaul.targetSex)}</strong>
                          </span>
                          <span className="closeout-report-summary-pill">
                            <small>Target / Actual</small>
                            <strong>{`${formatWholeNullable(livehaul.headTarget)} | ${formatWholeNullable(actualHead)}`}</strong>
                          </span>
                          <span className="closeout-report-summary-pill">
                            <small>Loads</small>
                            <strong>{formatWhole(livehaul.loadCount)}</strong>
                          </span>
                          <span className="closeout-report-summary-pill">
                            <small>Live Wt / Avg</small>
                            <strong>{`${formatWeightNullable(liveWeight > 0 ? liveWeight : null)} | ${formatRatio(livehaul.breedActualAvgWeight)}`}</strong>
                          </span>
                          <span className="closeout-report-summary-pill">
                            <small>Breed / %</small>
                            <strong>{`${formatRatio(livehaul.breedExpectedAvgWeight)} | ${formatPercent(livehaul.breedWeightPercent)}`}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="closeout-report-table-wrap">
                        <table className="closeout-report-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Truck</th>
                              <th>Trailer</th>
                              <th>Head</th>
                              <th>Scale Loc</th>
                              <th>Empty</th>
                              <th>Loaded</th>
                              <th>Live Wt</th>
                              <th>Avg/Head</th>
                              <th>Comment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {livehaul.loads.length > 0 ? (
                              livehaul.loads.map((load, index) => {
                                const avgHeadWeight =
                                  load.liveWeight !== null &&
                                  load.headCount !== null &&
                                  load.headCount > 0
                                    ? load.liveWeight / load.headCount
                                    : null;
                                return (
                                  <tr key={load.loadId}>
                                    <td>{index + 1}</td>
                                    <td>{load.truckNum || "--"}</td>
                                    <td>{load.trailerNum || "--"}</td>
                                    <td>{formatWholeNullable(load.headCount)}</td>
                                    <td>{load.scaleLocation || "--"}</td>
                                    <td>{formatWeightNullable(load.scaleEmpty)}</td>
                                    <td>{formatWeightNullable(load.scaleLoaded)}</td>
                                    <td>{formatWeightNullable(load.liveWeight)}</td>
                                    <td>{formatRatio(avgHeadWeight)}</td>
                                    <td>{load.comment || "--"}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td className="closeout-report-empty" colSpan={10}>
                                  No load rows were entered for this livehaul.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="closeout-report-table-wrap">
                <table className="closeout-report-table">
                  <tbody>
                    <tr>
                      <td className="closeout-report-empty">No livehaul rows were found for this placement.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="closeout-report-section">
            <div className="closeout-report-section-header">
              <div>
                <p className="eyebrow">Feed Report</p>
                <h2>Flock Feed Report</h2>
              </div>
              <p>Feed-ticket activity for this flock from placement date through removal date, included directly in the archive packet.</p>
            </div>

            <div className="closeout-report-feed-stack">
              <div className="closeout-report-feed-summary-strip">
                <span className="closeout-report-summary-pill">
                  <small>Date Range</small>
                  <strong>{`${formatShortDate(item.placedDate)} | ${formatShortDate(item.removedDate)}`}</strong>
                </span>
                <span className="closeout-report-summary-pill">
                  <small>Overall Net</small>
                  <strong>{formatWeightNullable(feedReport.totals.netDropWeightLbs)}</strong>
                </span>
                <span className="closeout-report-summary-pill">
                  <small>Starter Net</small>
                  <strong>{formatWeightNullable(feedReport.totals.starterNetLbs)}</strong>
                </span>
                <span className="closeout-report-summary-pill">
                  <small>Grower Net</small>
                  <strong>{formatWeightNullable(feedReport.totals.growerNetLbs)}</strong>
                </span>
              </div>

              <div className="closeout-report-feed-breakdown-grid">
                <article className="closeout-report-feed-breakdown-card">
                  <h3>By Ticket Type</h3>
                  <div className="closeout-report-feed-breakdown-list">
                    {feedReport.totals.byTicketType.map((entry) => (
                      <div className="closeout-report-feed-breakdown-row" key={`type-${entry.key}`}>
                        <span>{entry.key}</span>
                        <strong>{formatWeightNullable(entry.pounds)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="closeout-report-feed-breakdown-card">
                  <h3>By Source</h3>
                  <div className="closeout-report-feed-breakdown-list">
                    {feedReport.totals.bySource.map((entry) => (
                      <div className="closeout-report-feed-breakdown-row" key={`source-${entry.key}`}>
                        <span>{entry.key}</span>
                        <strong>{formatWeightNullable(entry.pounds)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <div className="closeout-report-table-wrap">
                <table className="closeout-report-table closeout-report-feed-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ticket</th>
                      <th>Type</th>
                      <th>Source</th>
                      <th>Barn</th>
                      <th>Bin</th>
                      <th>Feed</th>
                      <th className="closeout-report-number-col">Drop</th>
                      <th>Redirect</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedReport.rows.length > 0 ? (
                      feedReport.rows.map((row) => (
                        <tr key={row.id}>
                          <td>{formatShortDate(row.deliveryDate)}</td>
                          <td>{row.ticketNumber || "--"}</td>
                          <td>{row.ticketType || "--"}</td>
                          <td>{row.source || "--"}</td>
                          <td>{row.barnCode || "--"}</td>
                          <td>{row.binCode || "--"}</td>
                          <td>{row.feedType || "--"}</td>
                          <td className="closeout-report-number-col">{formatWeightAccounting(row.dropWeightLbs)}</td>
                          <td className="closeout-report-flag-col">{row.offFarmRedirect ? "X" : ""}</td>
                          <td>{row.comment || "--"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="closeout-report-empty" colSpan={10}>
                          No feed drops matched this flock within the placement-to-removal date window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>

        <section className="panel card flock-history-report-shell">
          <div className="flock-history-report-summary-grid">
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Flock</span>
              <strong>{flockHistory.flockCode}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Farm</span>
              <strong>{flockHistory.farmName}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Group</span>
              <strong>{flockHistory.farmGroupName}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Status</span>
              <strong>{flockHistory.status}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Placed</span>
              <strong>{formatHistoryDate(flockHistory.placedDate)}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>First Catch</span>
              <strong>{formatHistoryDate(flockHistory.estimatedFirstCatch)}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Females</span>
              <strong>{formatWhole(flockHistory.femaleCount)}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Males</span>
              <strong>{formatWhole(flockHistory.maleCount)}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Placements</span>
              <strong>{formatWhole(flockHistory.totals.placementCount)}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Daily Rows</span>
              <strong>{formatWhole(flockHistory.totals.dailyRowCount)}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Mortality Rows</span>
              <strong>{formatWhole(flockHistory.totals.mortalityRowCount)}</strong>
            </div>
            <div className="flock-history-report-summary-card flock-history-report-summary-card--compact">
              <span>Generated</span>
              <strong>{formatTimestamp(flockHistory.generatedAt)}</strong>
            </div>
          </div>

          <div className="flock-history-report-pages">
            <section className="flock-history-report-page">
              <div className="flock-history-report-page-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h2>Daily Log Matrix</h2>
                </div>
                <p>Dates run down the page. Daily flock-history log data points run across the page for archive review.</p>
              </div>

              {flockHistory.placements.map((placement) => (
                <article className="flock-history-report-placement-block" key={`archive-daily-${placement.placementId}`}>
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
                      <strong>{formatHistoryDate(placement.removedDate)}</strong>
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
                                <td className="flock-history-report-col-date">{formatHistoryDate(row.logDate)}</td>
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
              ))}
            </section>

            <section className="flock-history-report-page">
              <div className="flock-history-report-page-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h2>Mortality Matrix</h2>
                </div>
                <p>Companion mortality and health-marker matrix included for archive and settlement support.</p>
              </div>

              <div className="flock-history-report-hero flock-history-report-hero--totals">
                <span>
                  <strong>Final Pop:</strong> {formatWhole(flockHistory.totals.finalPopulation)}
                  {` (${formatWhole(flockHistory.totals.finalMalePopulation)} Roo / ${formatWhole(flockHistory.totals.finalFemalePopulation)} Hen)`}
                </span>
                <span><strong>Mortality %:</strong> {formatPercent(flockHistory.totals.finalMortalityPercent)}</span>
                <span><strong>Live %:</strong> {formatPercent(flockHistory.totals.finalLivePercent)}</span>
                <span><strong>Total Losses:</strong> {formatWhole(flockHistory.totals.totalLosses)}</span>
                <span><strong>Dead:</strong> {`${formatWhole(flockHistory.totals.deadMale)} Roo / ${formatWhole(flockHistory.totals.deadFemale)} Hen`}</span>
                <span><strong>Cull:</strong> {`${formatWhole(flockHistory.totals.cullMale)} Roo / ${formatWhole(flockHistory.totals.cullFemale)} Hen`}</span>
              </div>

              {flockHistory.placements.map((placement) => (
                <article className="flock-history-report-placement-block" key={`archive-mortality-${placement.placementId}`}>
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
                      <strong>{formatHistoryDate(placement.projectedEndDate)}</strong>
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
                              <td className="flock-history-report-col-date">{formatHistoryDate(row.logDate)}</td>
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
              ))}
            </section>
          </div>
        </section>
      </section>
    </>
  );
}

function formatCloseoutStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPlacementState(value: string) {
  if (value === "waiting_closeout") return "Waiting Closeout";
  if (value === "closeout_submitted") return "Closeout Submitted";
  if (value === "archived") return "Archived";
  return value;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

function formatDayDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const shortDate = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
  const dayCode = date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3).toUpperCase();
  return `${dayCode} ${shortDate}`;
}

function formatHistoryDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
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
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAge(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}d`;
}

function formatWhole(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatWholeNullable(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return formatWhole(value);
}

function formatNullableWhole(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return formatWhole(value);
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} lb`;
}

function formatWeightNullable(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatWeightAccounting(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  const absolute = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(value));
  if (value < 0) {
    return `(${absolute})`;
  }
  return absolute;
}

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
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

function formatLivehaulStatus(value: string) {
  if (value === "legacy_migrated") return "Legacy";
  if (value === "cancelled") return "Canceled";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTargetSex(value: "male" | "female" | null) {
  if (value === "male") return "Roo";
  if (value === "female") return "Hen";
  return "Open / Mixed";
}
