import type { FeedInventoryReportRow } from "@/lib/feed-inventory-report-data";

export function ProjectionInventoryStatus({ readings, problems, warnings, simulated }: {
  readings: FeedInventoryReportRow[]; problems: string[]; warnings: string[]; simulated: boolean;
}) {
  return <section className="panel card">
    <h2>{simulated ? "Simulated inventory" : "Inventory fetched for this report"}</h2>
    {problems.length > 0 && <div role="alert"><strong>Inventory unavailable</strong><ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
    <details><summary>On-Hand Inventory Exhausted Projection</summary>
      {warnings.length > 0 ? <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul> : <p>No exhaustion projected within this period for barns with complete data.</p>}
    </details>
    <details><summary>Inventory readings used ({readings.length} bins)</summary>
      <table><thead><tr><th>Farm / Barn</th><th>Bin</th><th>Feed</th><th>Pounds</th><th>Measurement time (Central)</th><th>Source status</th></tr></thead>
        <tbody>{readings.map(row => <tr key={row.feedBinId}>
          <td>{row.farmName} / {row.barnCode}</td><td>{row.binNumber}</td><td>{row.feedType}</td>
          <td>{row.onHandLbs === null ? "Unavailable" : Math.round(row.onHandLbs).toLocaleString("en-US")}</td>
          <td>{row.capturedAt && Number.isFinite(Date.parse(row.capturedAt)) ? new Date(row.capturedAt).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "Not supplied"}</td>
          <td>{row.statusDetail}</td>
        </tr>)}</tbody>
      </table>
    </details>
  </section>;
}
