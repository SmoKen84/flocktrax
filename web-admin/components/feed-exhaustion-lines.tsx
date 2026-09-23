import type { FeedProjectionOnOrderRow, FeedProjectionReportRow } from "@/lib/feed-projection-report-data";
import { firstOnHandShortfall } from "@/lib/live-projection-inventory";

export function FeedExhaustionLines({ rows, orders }: { rows: FeedProjectionReportRow[]; orders: FeedProjectionOnOrderRow[] }) {
  const lines = rows.flatMap(row => {
    if (row.onHandLbs == null || row.daily.some(day => day.pounds == null)) return [];
    const baseline = firstOnHandShortfall(row.daily, row.onHandLbs);
    if (!baseline) return [];
    const onOrder = orders
      .filter(order => order.placementId ? order.placementId === row.placementId : order.barnId === row.barnId)
      .reduce((sum, order) => sum + Math.max(0, order.remainingLbs), 0);
    const combined = firstOnHandShortfall(row.daily, row.onHandLbs + onOrder);
    return [<details key={row.id}>
      <summary style={{ listStyle: "none", cursor: "pointer" }}><span aria-hidden="true">&gt; </span>{row.placementCode || row.barnCode}: on-hand feed covers about {baseline.days.toFixed(1)} projected days. Confirm delivery before this supply is exhausted.</summary>
      <p style={{ marginLeft: "1.5rem" }}>Including {Math.round(onOrder).toLocaleString("en-US")} lb on order (assuming delivery): {combined ? `feed covers about ${combined.days.toFixed(1)} projected days.` : `feed covers at least the ${row.daily.length}-day report period.`}</p>
    </details>];
  });
  return lines.length ? <div>{lines}</div> : <p>No exhaustion projected within this period for barns with complete data.</p>;
}