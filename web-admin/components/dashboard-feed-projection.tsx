"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDashboardFeedProjection } from "@/app/admin/overview/feed-projection-action";
import { ProjectionInventoryStatus } from "@/components/projection-inventory-status";
import feedBinIcon from "@/screens/FeedBin.png";
import type { ActivePlacementRecord } from "@/lib/types";

type Projection = Awaited<ReturnType<typeof getDashboardFeedProjection>>;
const CACHE_MS = 60_000;
const pounds = (value: number | null | undefined) => value == null ? "Pending" : `${Math.round(value).toLocaleString()} lb`;
const dateLabel = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function DashboardFeedProjection({ placement }: { placement: ActivePlacementRecord }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cached = useRef<Projection | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function load(force = false) {
    if (pending.current) return pending.current;
    if (!force && cached.current && Date.now() - cached.current.loadedAt < CACHE_MS) return;
    setLoading(true);
    setError(null);
    pending.current = getDashboardFeedProjection(placement.barnId)
      .then((data) => { cached.current = data; setReport(data); })
      .catch(() => { setError("Feed readings could not be loaded. Please retry."); })
      .finally(() => { pending.current = null; setLoading(false); });
    return pending.current;
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const row = report?.rows.find((entry) => entry.placementId === placement.placementId);
  const net = row?.onHandLbs != null && row.onOrderLbs != null && row.totalLbs != null
    ? row.onHandLbs + row.onOrderLbs - row.totalLbs : null;

  return <>
    <button ref={trigger} type="button" className="tile-feed-action-button"
      aria-label={`Open 10 day feed requirement for ${placement.placementCode}`} aria-haspopup="dialog"
      onMouseEnter={() => void load()} onFocus={() => void load()}
      onClick={() => { setOpen(true); void load(); }}>
      <Image alt="" className="tile-feed-action-icon" priority={false} src={feedBinIcon} />
    </button>
    {open && createPortal(<dialog ref={dialog} className="mortality-popup-panel feed-projection-popup-panel feed-quick-dialog"
      aria-labelledby={titleId} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
      } }}>
      <div className="mortality-popup-header">
        <div className="mortality-popup-title-block">
          <p className="mortality-popup-placement-line">{placement.farmName} · Barn {placement.barnCode} · {placement.placementCode}</p>
          <h3 id={titleId}>10 Day Feed Requirement</h3>
          {report && <small>{dateLabel(report.today)} to {dateLabel(report.windowEnd)} · Checked {new Date(report.loadedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>}
        </div>
        <div className="mortality-popup-sidecar">
          <button type="button" className="button-secondary" disabled={loading} onClick={() => void load(true)}>Refresh</button>
          <button type="button" className="button-secondary" autoFocus onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
      {loading && <p role="status">{report ? "Refreshing live inventory and orders…" : "Checking live inventory and orders… You can close this window and keep working."}</p>}
      {error && <p role="alert">{error} <button type="button" className="button-secondary" onClick={() => void load(true)}>Retry</button></p>}
      {report && row && <div aria-busy={loading}>
        <div className="mortality-popup-summary feed-projection-popup-summary">
          {[["Total Requirement", row.totalLbs], ["On Hand Inventory", row.onHandLbs], ["Open Orders", row.onOrderLbs], ["Recommended Order", row.recommendedOrderLbs],
            ["Average Per Day", row.totalLbs == null ? null : row.totalLbs / report.windowDays], ["Net Position", net],
            ["Starter to Order", row.starterRecommendedLbs], ["Grower to Order", row.growerRecommendedLbs]].map(([label, value]) =>
            <div className="mortality-popup-stat mortality-popup-stat-compact" key={String(label)}><span>{label}</span><strong>{pounds(value as number | null | undefined)}</strong></div>)}
        </div>
        {report.projectionProblems.length > 0 && <div role="alert"><strong>Projection cannot be calculated</strong><ul>{report.projectionProblems.map((problem, index) => <li key={index}>{problem}</li>)}</ul></div>}
        <div className="mortality-popup-stat feed-projection-popup-note"><span>Starter Program</span>
          <strong>Target {pounds(row.starterTargetLbs)} · Delivered {pounds(row.starterDeliveredLbs)} · Recognized Supply {pounds(row.starterRecognizedSupplyLbs)}</strong>
          <small>Starter on order {pounds(row.starterOnOrderLbs)} · Grower on order in this window {pounds(row.growerOnOrderLbs)}</small>
          {row.ageDays != null && row.ageDays >= 14 && <small>Grower-only ordering from day 14. Historical starter shortfall: {pounds(row.historicalStarterShortfallLbs)}.</small>}
        </div>
        <div className="feed-projection-popup-grid">{row.daily.map((day) => {
          const detail = row.dailyDetails.find((entry) => entry.date === day.date);
          return <div className="feed-projection-popup-day" key={day.date}><strong>{dateLabel(day.date)}</strong><p>{pounds(day.pounds)}</p>
            <small>Starter {pounds(detail?.starterFeed)} · Grower {pounds(detail?.growerFeed)}</small>
            {detail && <small>Age {detail.ageDays} days · {detail.totalBirds.toLocaleString()} birds</small>}</div>;
        })}</div>
        <ProjectionInventoryStatus rows={report.rows} orders={report.onOrderRows} readings={report.inventoryReadings}
          problems={report.inventoryProblems} warnings={report.onHandWarnings} simulated={report.inventoryIsSimulated} />
      </div>}
      {report && !row && <p role="alert">This placement is no longer available for projection. Close this window and refresh the dashboard.</p>}
    </dialog>, document.body)}
  </>;
}
