"use client";

import { useState } from "react";
import type { FeedProjectionOnOrderRow, FeedProjectionReportRow } from "@/lib/feed-projection-report-data";
import { projectFeedDeliveries, type ScenarioDelivery } from "@/lib/feed-delivery-scenario";

const pounds = (value: number) => Math.round(value).toLocaleString("en-US");
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });

export function FeedDeliveryWhatIf({ rows, orders }: { rows: FeedProjectionReportRow[]; orders: FeedProjectionOnOrderRow[] }) {
  const [selected, setSelected] = useState(rows[0]?.id ?? "");
  const row = rows.find(candidate => candidate.id === selected) ?? rows[0];
  if (!row) return null;
  const matching = orders.filter(order => order.placementId ? order.placementId === row.placementId : order.barnId === row.barnId);
  return <div style={{ marginTop: "1rem" }}>
    <label>What-if flock <select value={row.id} onChange={event => setSelected(event.target.value)}>
      {rows.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.farmName} · {candidate.placementCode || candidate.barnCode}</option>)}
    </select></label>
    <FlockScenario key={JSON.stringify([row, matching])} row={row} orders={matching} />
  </div>;
}

function FlockScenario({ row, orders }: { row: FeedProjectionReportRow; orders: FeedProjectionOnOrderRow[] }) {
  const initial = () => {
    const references = new Set<string>();
    return orders.map(order => {
      const ref = order.externalOrderRef?.trim().toLowerCase();
      const duplicate = Boolean(ref && references.has(ref));
      if (ref) references.add(ref);
      return { id: order.id, date: order.deliveryDate ?? "", pounds: order.remainingLbs, feedType: order.feedType ?? "", included: !duplicate && Boolean(order.deliveryDate && order.deliveryDate >= row.daily[0]?.date), label: `${order.source}${order.binNumber ? ` · Bin ${order.binNumber}` : ""}${order.externalOrderRef ? ` · ${order.externalOrderRef}` : ""}${duplicate ? " · repeated reference (excluded)" : ""}` };
    });
  };
  const [deliveries, setDeliveries] = useState(initial);
  const update = (id: string, change: Partial<ScenarioDelivery>) => setDeliveries(current => current.map(order => order.id === id ? { ...order, ...change } : order));
  const baseline = projectFeedDeliveries(row.starterAccessibleLbs, row.growerAccessibleLbs, row.whatIfDaily, []);
  const scenario = projectFeedDeliveries(row.starterAccessibleLbs, row.growerAccessibleLbs, row.whatIfDaily, deliveries);
  if (baseline.error) return <p role="status">{row.projectionProblems.join(" ") || baseline.error}</p>;
  return <>
    <p>Adjust deliveries below to compare with on-hand feed only. Changes here do not save or place orders.</p>
    <div style={{ overflowX: "auto" }}>
      <table><thead><tr><th>Include</th><th>Delivery</th><th>Arrival date</th><th>Remaining pounds</th><th>Feed</th></tr></thead>
        <tbody>{deliveries.map(order => <tr key={order.id}>
          <td><input type="checkbox" aria-label={`Include ${order.label}`} checked={order.included} onChange={event => update(order.id, { included: event.target.checked })} /></td>
          <td>{order.label}</td>
          <td><input type="date" aria-label={`Arrival date for ${order.label}`} min={row.daily[0]?.date} value={order.date} onChange={event => update(order.id, { date: event.target.value })} /></td>
          <td><input type="number" aria-label={`Pounds for ${order.label}`} min="1" step="1" value={Number.isFinite(order.pounds) ? order.pounds : ""} onChange={event => update(order.id, { pounds: event.target.value === "" ? NaN : Number(event.target.value) })} /></td>
          <td><select aria-label={`Feed type for ${order.label}`} value={order.feedType} onChange={event => update(order.id, { feedType: event.target.value })}><option value="">Choose feed</option><option value="starter">Starter</option><option value="grower">Grower</option></select></td>
        </tr>)}</tbody>
      </table>
    </div>
    {!deliveries.length && <p>No listed deliveries for this flock.</p>}
    <button type="button" className="button-secondary" onClick={() => setDeliveries(current => [...current, { id: `what-if:${crypto.randomUUID()}`, label: `Hypothetical delivery ${current.filter(order => order.id.startsWith("what-if:")).length + 1}`, date: row.daily[0]?.date ?? "", pounds: 0, feedType: "grower", included: true }])}>Add hypothetical delivery</button>{" "}
    <button type="button" className="button-secondary" onClick={() => setDeliveries(initial())}>Reset scenario</button>
    <p>Assumes delivery before that day’s consumption. Listed dates are not delivery confirmation. Include each physical delivery only once.</p>
    <div aria-live="polite">
      <p><strong>On hand only:</strong> {baseline.firstShortfall ? `First projected shortfall ${dateLabel(baseline.firstShortfall)}` : "Covers the report period"}.</p>
      {scenario.error ? <p role="alert">{scenario.error}</p> : <>
        <p><strong>With selected deliveries:</strong> {scenario.firstShortfall ? `First projected shortfall ${dateLabel(scenario.firstShortfall)}; ${pounds(scenario.totalShortfall)} lb uncovered during the period` : "Covers the report period"}.</p>
        <div style={{ overflowX: "auto" }}><table><thead><tr><th>Date</th><th>Delivery lb</th><th>Required lb</th><th>Available at day end lb</th><th>Uncovered lb</th></tr></thead>
          <tbody>{scenario.days.map(day => <tr key={day.date}><td>{dateLabel(day.date)}</td><td>{pounds(day.arriving)}</td><td>{pounds(day.demand)}</td><td>{pounds(day.balance)}</td><td>{day.shortfall > 0 ? <strong>{pounds(day.shortfall)}</strong> : "0"}</td></tr>)}</tbody>
        </table></div>
      </>}
    </div>
  </>;
}
