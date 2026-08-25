import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import {
  getFeedInventoryReportData,
  type FeedInventoryReportRow,
  type FeedInventoryTypeTotal,
} from "@/lib/feed-inventory-report-data";

export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Current Feed Inventory | FlockTrax Admin",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedInventoryReportPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const farmGroupId = firstParam(params.farmGroupId);
  const farmId = firstParam(params.farmId);
  const barnId = firstParam(params.barnId);
  const includeComingOrdersParam = firstParam(params.includeBinSentryOnOrder);
  const includeComingOrders = includeComingOrdersParam === null ? true : includeComingOrdersParam === "1";
  const report = await getFeedInventoryReportData({ farmGroupId, farmId, barnId, includeComingOrders });
  const farmGroups = groupRows(report.rows);

  return (
    <div className="feed-drops-report-page feed-inventory-report-page">
      <section className="panel card feed-drops-report-shell feed-inventory-report-shell">
        <div className="feed-drops-report-toolbar">
          <FeedProjectionReportActions />
          <Link className="button-secondary" href={buildBackHref({ farmGroupId, farmId, barnId, includeComingOrders })}>
            <span aria-hidden="true">&larr;</span>
            <span>Back to Reports</span>
          </Link>
        </div>

        <header className="feed-drops-report-title">
          <p className="eyebrow">Feed Report</p>
          <h1>Current Feed Inventory</h1>
          <p>Point-in-time BinSentry inventory by feed bin, subtotaled by barn and farm.</p>
        </header>

        <div className="feed-drops-report-summary feed-inventory-report-summary">
          <SummaryCard label="Generated" value={formatDateTime(report.generatedAt)} detail={report.scopeLabel} />
          <SummaryCard
            label="Bins Reporting"
            value={`${report.currentBinCount} of ${report.mappedBinCount}`}
            detail={`${report.rows.length} configured bin${report.rows.length === 1 ? "" : "s"} in scope`}
          />
          {report.onHandByFeedType.map((total) => (
            <SummaryCard
              detail={`${total.binCount} measured bin${total.binCount === 1 ? "" : "s"}`}
              key={total.feedType}
              label={`${total.feedType} On Hand`}
              value={`${formatWeight(total.pounds)} lbs`}
            />
          ))}
          <SummaryCard label="Total On Hand" value={`${formatWeight(report.totalOnHandLbs)} lbs`} />
          {includeComingOrders ? (
            <SummaryCard
              detail={`${report.comingOrders.length} pending order${report.comingOrders.length === 1 ? "" : "s"}`}
              label="Coming Orders"
              value={`${formatWeight(report.totalComingLbs)} lbs`}
            />
          ) : null}
        </div>

        {report.warnings.length > 0 ? (
          <div className="feed-inventory-warning" role="status">
            <strong>{report.warnings.length} BinSentry item{report.warnings.length === 1 ? " needs" : "s need"} attention.</strong>
            <ul>{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>
        ) : null}

        <section className="feed-inventory-section">
          <div className="feed-inventory-section-heading">
            <div>
              <p className="eyebrow">Measured Inventory</p>
              <h2>Feed On Hand</h2>
            </div>
            <strong>{formatWeight(report.totalOnHandLbs)} lbs</strong>
          </div>

          {report.rows.length > 0 ? (
            <div className="feed-drops-report-table-wrap">
              <table className="feed-drops-report-table feed-inventory-table">
                <thead>
                  <tr>
                    <th>Farm</th>
                    <th>Barn</th>
                    <th>Bin</th>
                    <th>Feed Type</th>
                    <th>Feed / Ration</th>
                    <th>Current On Hand</th>
                    <th>Reading Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {farmGroups.map((farm) => (
                    <Fragment key={farm.farmId}>
                      {farm.barns.map((barn) => (
                        <Fragment key={barn.barnId}>
                          {barn.rows.map((row) => (
                            <tr key={row.feedBinId}>
                              <td>{row.farmName}</td>
                              <td className="feed-drops-report-bin">{row.barnCode}</td>
                              <td className="feed-drops-report-bin">{row.binNumber}</td>
                              <td><span className="feed-drops-report-type" data-known={row.feedType !== "Unknown"}>{row.feedType}</span></td>
                              <td>{row.feedName ?? "--"}</td>
                              <td className="feed-drops-report-weight"><strong>{row.onHandLbs === null ? "--" : `${formatWeight(row.onHandLbs)} lbs`}</strong></td>
                              <td>{row.capturedAt ? formatDateTime(row.capturedAt) : "--"}</td>
                              <td><span className="feed-inventory-status" data-status={row.status}>{statusLabel(row.status)}</span></td>
                            </tr>
                          ))}
                          <SubtotalRow label={`${farm.farmName} / ${barn.barnCode} barn subtotal`} rows={barn.rows} />
                          <SpacerRow />
                        </Fragment>
                      ))}
                      <SubtotalRow farm label={`${farm.farmName} farm subtotal`} rows={farm.rows} />
                      <SpacerRow farm />
                    </Fragment>
                  ))}
                  <SubtotalRow grand label="Overall feed on hand" rows={report.rows} />
                </tbody>
              </table>
            </div>
          ) : (
            <div className="feed-drops-report-empty">No configured feed bins were found for the selected scope.</div>
          )}
        </section>

        {includeComingOrders ? (
          <section className="feed-inventory-section feed-inventory-coming-section">
            <div className="feed-inventory-section-heading">
              <div>
                <p className="eyebrow">Separate From On Hand</p>
                <h2>Coming Orders</h2>
                <p>Finalized BinSentry Order Manager orders that have not yet been received. These pounds are not included in inventory on hand.</p>
              </div>
              <strong>{formatWeight(report.totalComingLbs)} lbs</strong>
            </div>

            {report.comingOrders.length > 0 ? (
              <div className="feed-drops-report-table-wrap">
                <table className="feed-drops-report-table feed-inventory-coming-table">
                  <thead><tr><th>Expected</th><th>Farm</th><th>Barn</th><th>Bin</th><th>Feed Type</th><th>Feed / Ration</th><th>Order</th><th>Coming Weight</th></tr></thead>
                  <tbody>
                    {report.comingOrders.map((order) => (
                      <tr key={order.id}>
                        <td><strong>{order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : "Not dated"}</strong></td>
                        <td>{order.farmName}</td>
                        <td className="feed-drops-report-bin">{order.barnCode}</td>
                        <td className="feed-drops-report-bin">{order.binNumber}</td>
                        <td><span className="feed-drops-report-type" data-known={order.feedType !== "Unknown"}>{order.feedType}</span></td>
                        <td>{order.feedName ?? "--"}</td>
                        <td>{order.externalRef}</td>
                        <td className="feed-drops-report-weight"><strong>{order.pounds === null ? `${formatDecimal(order.volumeM3)} m³` : `${formatWeight(order.pounds)} lbs`}</strong></td>
                      </tr>
                    ))}
                    <tr className="feed-drops-report-subtotal-row feed-inventory-grand-total">
                      <th colSpan={5}>All coming orders</th>
                      <td>{formatTypeTotals(report.comingByFeedType)}</td>
                      <td>{report.comingOrders.length} orders</td>
                      <td><strong>{formatWeight(report.totalComingLbs)} lbs</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="feed-drops-report-empty">No mapped BinSentry orders are currently in the Scheduled state for this scope.</div>
            )}
          </section>
        ) : null}

        <footer className="feed-drops-report-footer">
          On-hand values come from each mapped bin&apos;s latest valid BinSentry reading at report time. Unavailable and unmapped bins are excluded from weight totals. Coming orders remain separate from on-hand inventory.
        </footer>
      </section>
    </div>
  );
}

function SubtotalRow({ label, rows, farm = false, grand = false }: { label: string; rows: FeedInventoryReportRow[]; farm?: boolean; grand?: boolean }) {
  const totals = summarizeRows(rows);
  return (
    <tr className={`feed-drops-report-subtotal-row feed-inventory-subtotal${farm ? " feed-inventory-farm-total" : ""}${grand ? " feed-inventory-grand-total" : ""}`}>
      <th colSpan={4}>{label}</th>
      <td>{formatTypeTotals(totals)}</td>
      <td><strong>{formatWeight(rows.reduce((sum, row) => sum + (row.onHandLbs ?? 0), 0))} lbs</strong></td>
      <td colSpan={2}>{rows.filter((row) => row.status === "current").length} bins measured</td>
    </tr>
  );
}

function SpacerRow({ farm = false }: { farm?: boolean }) {
  return (
    <tr aria-hidden="true" className={`feed-inventory-spacer-row${farm ? " feed-inventory-farm-spacer-row" : ""}`}>
      <td colSpan={8} />
    </tr>
  );
}

function groupRows(rows: FeedInventoryReportRow[]) {
  const farms = new Map<string, { farmId: string; farmName: string; rows: FeedInventoryReportRow[]; barns: Array<{ barnId: string; barnCode: string; rows: FeedInventoryReportRow[] }> }>();
  for (const row of rows) {
    const farm = farms.get(row.farmId) ?? { farmId: row.farmId, farmName: row.farmName, rows: [], barns: [] };
    farm.rows.push(row);
    let barn = farm.barns.find((candidate) => candidate.barnId === row.barnId);
    if (!barn) {
      barn = { barnId: row.barnId, barnCode: row.barnCode, rows: [] };
      farm.barns.push(barn);
    }
    barn.rows.push(row);
    farms.set(row.farmId, farm);
  }
  return [...farms.values()];
}

function summarizeRows(rows: FeedInventoryReportRow[]): FeedInventoryTypeTotal[] {
  const totals = new Map<string, FeedInventoryTypeTotal>();
  for (const row of rows) {
    if (row.onHandLbs === null) continue;
    const current = totals.get(row.feedType) ?? { feedType: row.feedType, pounds: 0, binCount: 0 };
    current.pounds += row.onHandLbs;
    current.binCount += 1;
    totals.set(row.feedType, current);
  }
  return [...totals.values()].sort((left, right) => left.feedType.localeCompare(right.feedType));
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(value));
}

function formatWeight(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatDecimal(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatTypeTotals(totals: FeedInventoryTypeTotal[]) {
  return totals.length ? totals.map((total) => `${total.feedType} ${formatWeight(total.pounds)}`).join(" / ") : "No measured weight";
}

function statusLabel(status: FeedInventoryReportRow["status"]) {
  if (status === "current") return "Current";
  if (status === "unmapped") return "Not mapped";
  return "Unavailable";
}

function buildBackHref(options: { farmGroupId: string | null; farmId: string | null; barnId: string | null; includeComingOrders: boolean }) {
  const params = new URLSearchParams({ category: "feed_reports", report: "feed_inventory" });
  if (options.farmGroupId) params.set("farmGroupId", options.farmGroupId);
  if (options.farmId) params.set("farmId", options.farmId);
  if (options.barnId) params.set("barnId", options.barnId);
  params.set("includeBinSentryOnOrder", options.includeComingOrders ? "1" : "0");
  return `/admin/reports?${params.toString()}`;
}
