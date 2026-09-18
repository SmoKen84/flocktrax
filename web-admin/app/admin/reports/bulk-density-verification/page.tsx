import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { getFeedInventoryReportData } from "@/lib/feed-inventory-report-data";
import { mixedDensityFeedTypes } from "@/lib/bulk-density-validation";
import Link from "next/link";

export const metadata = { title: "Bulk Density Verification Report | FlockTrax Admin" };
export const maxDuration = 60;

export default async function BulkDensityVerificationReport({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const first = (key: string) => { const value = params[key]; return (Array.isArray(value) ? value[0] : value) || null; };
  const report = await getFeedInventoryReportData({
    farmGroupId: first("farmGroupId"), farmId: first("farmId"), barnId: first("barnId"), includeComingOrders: false,
  });
  const mixed = mixedDensityFeedTypes(report.rows);
  return <div className="feed-drops-report-page"><section className="panel card feed-drops-report-shell">
    <div className="feed-drops-report-toolbar"><FeedProjectionReportActions />
      <Link className="button-secondary" href="/admin/reports?category=feed_reports&report=bulk_density_verification">Back to Reports</Link>
    </div>
    <header className="feed-drops-report-title"><p className="eyebrow">Feed Report</p>
      <h1>Bulk Density Verification Report</h1><p>{report.scopeLabel}</p>
      <p>Compares current bins with the same listed feed type. Starter and Grower are checked separately. Scheduled orders are excluded.</p>
    </header>
    <p>{mixed.size ? "Mixed densities found for: " + [...mixed].join(", ") : "No mixed densities found among bins with known feed types and reported densities."}</p>
    <p>Missing densities or unspecified feed types cannot be verified. Matching densities do not confirm that the configured density is correct.</p>
    {report.warnings.length > 0 && <div className="feed-inventory-warning"><ul>{report.warnings.map(w => <li key={w}>{w}</li>)}</ul></div>}
    <div className="feed-projection-on-order-table-wrap"><table className="feed-projection-on-order-table">
      <thead><tr><th>Farm</th><th>Barn</th><th>Bin</th><th>Feed Type</th><th>Bulk Density (lb/ft³)</th><th>Status</th><th>Last Reading</th></tr></thead>
      <tbody>{report.rows.map(row => <tr key={row.feedBinId}>
        <td>{row.farmName}</td><td>{row.barnCode}</td><td>{row.binNumber}</td><td>{row.feedType}</td>
        <td>{row.bulkDensityLbPerFt3?.toFixed(2) ?? "Unavailable"}</td>
        <td>{mixed.has(row.feedType.trim().toUpperCase()) ? "MIXED" : row.bulkDensityLbPerFt3 === null || ["UNKNOWN", "UNSPECIFIED", "--", "MIXED", ""].includes(row.feedType.trim().toUpperCase()) ? "Cannot verify" : "No mismatch found"}</td>
        <td>{row.capturedAt ? new Date(row.capturedAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "Unavailable"}</td>
      </tr>)}{!report.rows.length && <tr><td colSpan={7}>No bins in the selected scope.</td></tr>}</tbody>
    </table></div>
  </section></div>;
}
