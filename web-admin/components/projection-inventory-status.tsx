import type { FeedInventoryReportRow } from "@/lib/feed-inventory-report-data";

export function ProjectionInventoryStatus({ readings, problems, warnings, simulated }: {
  readings: FeedInventoryReportRow[]; problems: string[]; warnings: string[]; simulated: boolean;
}) {
  const times = readings.map(row => row.capturedAt ? Date.parse(row.capturedAt) : NaN).filter(Number.isFinite);
  const oldest = times.length ? new Date(Math.min(...times)).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "Not supplied";
  return <section className="panel card">
    <h2>{simulated ? "Simulated inventory" : "Inventory fetched for this report"}</h2>
    <p>{simulated ? "Demo values are simulated, not live farm readings." : "Inventory is requested from BinSentry each time this report runs. Stored snapshots are not used as a fallback. Measurement times below are Central time."}</p>
    <p><strong>Oldest measurement in this report (Central): {oldest}</strong></p>
    <p>Missing, unclassified, or readings older than 24 hours withhold the affected barn’s inventory and order recommendation (shown as --). Summary totals are also withheld if any barn is incomplete.</p>
    {problems.length > 0 && <div role="alert"><strong>Inventory incomplete — do not use the affected order recommendations.</strong><ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
    {warnings.length > 0 && <div><strong>Check feed delivery timing</strong><p>These estimates use full projected daily consumption and on-hand feed only; they exclude pending deliveries and are not exact runout times. A sufficient period total does not guarantee feed will arrive before the barn runs out.</p><ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
    <p><strong>Listed orders are planned supply, not confirmation of delivery.</strong> The net order figure assumes those orders arrive. Confirm availability and arrival dates with the supplier; use the on-hand warning to check the gap before delivery.</p>
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
