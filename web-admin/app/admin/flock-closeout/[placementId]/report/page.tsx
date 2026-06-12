import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CloseoutReportActions } from "@/app/admin/flock-closeout/closeout-report-actions";
import { PageHeader } from "@/components/page-header";
import { getCloseoutQueueData } from "@/lib/closeout-data";
import { getFeedTicketFlockReportBundle } from "@/lib/feed-ticket-data";

type CloseoutReportPageProps = {
  params: Promise<{
    placementId: string;
  }>;
};

export async function generateMetadata({ params }: CloseoutReportPageProps): Promise<Metadata> {
  const { placementId } = await params;
  const queue = await getCloseoutQueueData({ placement: placementId });
  const item = queue.items.find((entry) => entry.placementId === placementId) ?? null;
  const placementCode = item?.placementCode ?? "Closeout";

  return {
    title: `Closeout Report | ${placementCode} | FlockTrax Admin`,
  };
}

export default async function CloseoutReportPage({ params }: CloseoutReportPageProps) {
  const { placementId } = await params;
  const queue = await getCloseoutQueueData({ placement: placementId });
  const item = queue.items.find((entry) => entry.placementId === placementId) ?? null;

  if (!item || !item.closeout) {
    notFound();
  }

  const closeout = item.closeout;
  const processedHeadVariancePercent = deriveHeadVariancePercent(
    closeout.processedHeadFinal ?? closeout.derived.processedHead,
    item.finalHeadCount,
  );
  const feedReport = await getFeedTicketFlockReportBundle({
    flockCode: item.placementCode,
  });

  return (
    <div className="closeout-report-page">
      <PageHeader
        eyebrow="Flock Closeout Report"
        title={
          <>
            <span>{item.placementCode}</span>
            <br />
            <span>{`${item.farmName} | Barn ${item.barnCode}`}</span>
          </>
        }
        body="Print-ready closeout summary with final closeout state, production metrics, and livehaul results for this placement."
        actions={<CloseoutReportActions />}
      />

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

        <section className="closeout-report-section closeout-report-section--header">
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
              <small>
                {`Derived now: ${formatWholeNullable(closeout.derived.processedHead)} | Mort calc: ${formatWholeNullable(item.finalHeadCount)} | Var: ${formatSignedPercent(processedHeadVariancePercent)}`}
              </small>
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

        <section className="closeout-report-section closeout-report-section--livehaul">
          <div className="closeout-report-section-header">
            <div>
              <p className="eyebrow">Livehaul Detail</p>
              <h2>Livehauls And Load Detail</h2>
            </div>
            <p>Oldest to newest livehaul dates with each livehaul's actual load lines shown after the closeout summary.</p>
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

        <section className="closeout-report-section closeout-report-section--feed">
          <div className="closeout-report-section-header">
            <div>
              <p className="eyebrow">Feed Report</p>
              <h2>Flock Feed Report</h2>
            </div>
            <p>Feed-ticket activity for this flock from placement date through removal date, included directly in the closeout packet.</p>
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
    </div>
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

function formatShortDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
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

function formatAge(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}d`;
}

function formatWhole(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatWholeNullable(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return formatWhole(value);
}

function formatWeight(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} lb`;
}

function formatWeightNullable(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
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

function formatRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  const formatted = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `-${formatted}%`;
  return `${formatted}%`;
}

function deriveHeadVariancePercent(actualHead: number | null, expectedHead: number | null) {
  if (
    actualHead === null ||
    expectedHead === null ||
    !Number.isFinite(actualHead) ||
    !Number.isFinite(expectedHead) ||
    expectedHead <= 0
  ) {
    return null;
  }

  return ((actualHead - expectedHead) / expectedHead) * 100;
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
