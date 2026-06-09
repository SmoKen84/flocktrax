"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createPortal } from "react-dom";

import {
  archivePlacementCloseoutAction,
  savePlacementCloseoutDraftAction,
  type CloseoutFormState,
} from "@/app/admin/flock-closeout/actions";
import type { CloseoutQueueItem } from "@/lib/closeout-data";

const INITIAL_STATE: CloseoutFormState = {
  status: "idle",
  message: "",
};

export function CloseoutWorksheetForm({ item }: { item: CloseoutQueueItem }) {
  const closeout = item.closeout;
  const [state, formAction, isPending] = useActionState(savePlacementCloseoutDraftAction, INITIAL_STATE);
  const [showFirst7Popup, setShowFirst7Popup] = useState(false);

  if (!closeout) {
    return null;
  }

  const processedHeadVariancePercent = deriveHeadVariancePercent(
    closeout.processedHeadFinal ?? closeout.derived.processedHead,
    item.finalHeadCount,
  );

  return (
    <section className="panel card closeout-worksheet-card">
      <div className="closeout-worksheet-header">
        <div>
          <p className="eyebrow">Closeout Worksheet</p>
          <h3 className="closeout-worksheet-title">Finalize Production And Feed</h3>
          <p className="table-subtitle">
            Save the confirmed final birds, final live weight, closeout task checks, and any notes. Feed delivered and breed comparison stay derived around that final closeout record.
          </p>
        </div>
        <div className="closeout-worksheet-pill-stack">
          <span className="status-pill" data-tone={closeout.status === "draft" ? "warn" : "good"}>
            {formatCloseoutStatus(closeout.status)}
          </span>
          {closeout.submittedAt ? <span className="closeout-worksheet-meta">{`Submitted ${formatDateTime(closeout.submittedAt)}`}</span> : null}
        </div>
      </div>

      <form action={formAction} className="closeout-worksheet-form">
        <input name="placement_id" type="hidden" value={item.placementId} />
        <input name="flock_id" type="hidden" value={item.flockId} />
        <input name="farm_id" type="hidden" value={item.farmId} />
        <input name="barn_id" type="hidden" value={item.barnId} />
        <input name="placement_code" type="hidden" value={item.placementCode} />
        <input name="breed_expected_avg_weight" type="hidden" value={toFormValue(closeout.breedExpectedAvgWeight)} />
        <input name="breed_actual_avg_weight" type="hidden" value={toFormValue(closeout.breedActualAvgWeight)} />
        <input name="breed_weight_percent" type="hidden" value={toFormValue(closeout.breedWeightPercent)} />
        <input name="removed_age_days" type="hidden" value={toFormValue(closeout.removedAgeDays)} />

        <div className="closeout-worksheet-grid">
          <label className="field">
            <span className="field-label">Processed Head</span>
            <input defaultValue={toFormValue(closeout.processedHeadFinal)} name="processed_head_final" type="number" />
            <span className="field-hint">
              {`Derived now: ${formatCount(closeout.derived.processedHead)} | Mort calc: ${formatCount(item.finalHeadCount)} | Var: ${formatSignedPercent(processedHeadVariancePercent)}`}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Live Weight</span>
            <input defaultValue={toFormValue(closeout.liveWeightFinal)} name="live_weight_final" step="0.01" type="number" />
            <span className="field-hint">{`Derived now: ${formatWeight(closeout.derived.liveWeight)}`}</span>
          </label>

          <div className="closeout-worksheet-stat-card">
            <span className="field-label">Feed Delivered</span>
            <strong>{formatWeight(closeout.feedDeliveredTotalLbs)}</strong>
            <span className="field-hint">{`${formatWeight(closeout.derived.starterDelivered)} starter | ${formatWeight(closeout.derived.growerDelivered)} grower`}</span>
          </div>

          <div className="closeout-worksheet-stat-card">
            <span className="field-label">Feed Consumed</span>
            <strong>{formatWeight(closeout.feedConsumedTotalLbs)}</strong>
            <span className="field-hint">{`${formatWeight(closeout.starterConsumedLbs)} starter | ${formatWeight(closeout.growerConsumedLbs)} grower`}</span>
          </div>

          <div className="closeout-worksheet-stat-card">
            <div className="closeout-worksheet-stat-head">
              <span className="field-label">Per Head / FCR</span>
              <Link
                aria-label={`Open feed report for ${item.placementCode}`}
                className="closeout-stat-icon-button"
                href={buildFeedReportHref({
                  flockCode: item.placementCode,
                })}
                rel="noreferrer"
                target="_blank"
                title="Open flock feed report"
              >
                <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path
                    d="M4.75 2.75h6.5v3h-6.5zM3.5 4.5a1.75 1.75 0 0 0-1.75 1.75v3h2v4h8.5v-4h2v-3A1.75 1.75 0 0 0 12.5 4.5h-1"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.25"
                  />
                  <path
                    d="M5.25 10.25h5.5M5.25 12h3.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.25"
                  />
                </svg>
              </Link>
            </div>
            <strong>{`${formatRatio(closeout.feedPerHeadLbs)} feed/hd | ${formatRatio(closeout.feedConversion)} fcr`}</strong>
            <span className="field-hint">{`${formatRatio(closeout.starterPerHeadLbs)} starter | ${formatRatio(closeout.growerPerHeadLbs)} grower`}</span>
          </div>

          <div className="closeout-worksheet-stat-card">
            <span className="field-label">Breed Compare</span>
            <strong>{`${formatRatio(closeout.breedActualAvgWeight)} actual | ${formatRatio(closeout.breedExpectedAvgWeight)} target`}</strong>
            <span className="field-hint">{`${formatPercent(closeout.breedWeightPercent)} of target, weighted across livehaul dates`}</span>
          </div>

          <div className="closeout-worksheet-stat-card">
            <div className="closeout-worksheet-stat-head">
              <span className="field-label">Live % / First 7d Mort</span>
              <button
                aria-label={`Open first 7-day mortality popup for ${item.placementCode}`}
                className="closeout-stat-icon-button"
                onClick={() => setShowFirst7Popup(true)}
                title="Open first 7-day mortality popup"
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path
                    d="M8 3.25a4.75 4.75 0 1 0 0 9.5a4.75 4.75 0 0 0 0-9.5Zm0 1.5v3.25l2 1.25"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.25"
                  />
                </svg>
              </button>
            </div>
            <strong>{`${formatPercent(closeout.overallLivePercent)} live | ${formatCount(closeout.first7DayTotalLosses)} total`}</strong>
            <span className="field-hint">{`${formatCount(closeout.first7DayFemaleLosses)} hen | ${formatCount(closeout.first7DayMaleLosses)} roo`}</span>
          </div>

          <div className="closeout-worksheet-stat-card">
            <div className="closeout-worksheet-stat-head">
              <span className="field-label">Mortality %</span>
              <Link
                aria-label={`Open mortality summary report for ${item.placementCode}`}
                className="closeout-stat-icon-button"
                href={`/admin/flocks/${item.flockId}/report`}
                rel="noreferrer"
                target="_blank"
                title="Open mortality summary report"
              >
                <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path
                    d="M3.75 2.75h8.5v10.5h-8.5zM5.25 5.25h5.5M5.25 7.5h5.5M5.25 9.75h3.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.25"
                  />
                </svg>
              </Link>
            </div>
            <strong>{`${formatPercent(closeout.femaleMortalityPercent)} hen | ${formatPercent(closeout.maleMortalityPercent)} roo`}</strong>
            <span className="field-hint">Loss percentages based on starting female and male counts.</span>
          </div>

          <label className="field closeout-worksheet-field--wide">
            <span className="field-label">Manual Override Reason</span>
            <input defaultValue={closeout.manualOverrideReason ?? ""} name="manual_override_reason" type="text" />
          </label>

          <fieldset className="closeout-task-checks" name="closeout_task_checks">
            <legend className="field-label">Closeout Steps</legend>
            <label className="closeout-task-check closeout-task-check--left">
              <input defaultChecked={closeout.livehaulComplete} name="livehaul_complete" type="checkbox" />
              <span>LH Complete</span>
            </label>
            <label className="closeout-task-check closeout-task-check--left">
              <input defaultChecked={closeout.feedVerified} name="feed_verified" type="checkbox" />
              <span>Feed Verified</span>
            </label>
            <label className="closeout-task-check closeout-task-check--left">
              <input defaultChecked={closeout.invoiceCreated} name="invoice_created" type="checkbox" />
              <span>Invoice Created</span>
            </label>
            <label className="closeout-task-check closeout-task-check--right">
              <input defaultChecked={closeout.submitted} name="submitted" type="checkbox" />
              <span>Submitted</span>
            </label>
            <label className="closeout-task-check closeout-task-check--right">
              <input defaultChecked={closeout.settlementReceived} name="settlement_received" type="checkbox" />
              <span>Settlement Received</span>
            </label>
            <label className="closeout-task-check closeout-task-check--right">
              <input defaultChecked={closeout.closeoutCompleted} name="closeout_completed" type="checkbox" />
              <span>Closeout Complete</span>
            </label>
          </fieldset>

          <label className="field closeout-worksheet-field--full">
            <span className="field-label">Notes</span>
            <textarea defaultValue={closeout.notes ?? ""} name="notes" rows={3} />
          </label>
        </div>

        <div className="closeout-worksheet-footer">
          {state.status !== "idle" ? (
            <div className="placement-scheduler-feedback" data-tone={state.status === "success" ? "good" : "danger"}>
              <span className="status-pill" data-tone={state.status === "success" ? "good" : "danger"}>
                {state.status === "success" ? "Saved" : "Error"}
              </span>
              <div className="closeout-worksheet-feedback-body">
                <p>{state.message}</p>
                {state.status === "success" && state.readyToArchive ? (
                  <form action={archivePlacementCloseoutAction}>
                    <input name="placement_id" type="hidden" value={item.placementId} />
                    <button className="button-secondary" type="submit">
                      Move To Archive
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="table-subtitle">Feed consumed is taken directly from feed-ticket totals, including any flock-to-flock credit activity already booked through `f2f` tickets.</p>
          )}

          <button className="button-primary" disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Save Closeout Draft"}
          </button>
        </div>
      </form>

      {showFirst7Popup ? <First7MortalityPopup item={item} onClose={() => setShowFirst7Popup(false)} /> : null}
    </section>
  );
}

function First7MortalityPopup({
  item,
  onClose,
}: {
  item: CloseoutQueueItem;
  onClose: () => void;
}) {
  const closeout = item.closeout;
  if (!closeout || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="mortality-popup-shell" onClick={onClose}>
      <div className="mortality-popup-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mortality-popup-header">
          <div className="mortality-popup-title-block">
            <p className="mortality-popup-placement-line">
              {item.farmName} · Barn {item.barnCode} · {item.placementCode}
            </p>
            <h3>First 7-Days Mortality</h3>
          </div>
          <div className="mortality-popup-sidecar">
            <button className="button-secondary" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="mortality-popup-summary">
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Losses</span>
            <div className="mortality-popup-stat-lines">
              <strong>
                <span>Roos:</span>
                <span>{formatCount(closeout.first7DayMaleLosses)}</span>
                <span>{formatPercent(closeout.first7DayMaleMortalityPercent)}</span>
              </strong>
              <strong>
                <span>Hens:</span>
                <span>{formatCount(closeout.first7DayFemaleLosses)}</span>
                <span>{formatPercent(closeout.first7DayFemaleMortalityPercent)}</span>
              </strong>
              <strong className="mortality-popup-stat-total-row">
                <span>Totals</span>
                <span>{formatCount(closeout.first7DayTotalLosses)}</span>
                <span>{formatPercent(closeout.first7DayLivePercent === null ? null : 100 - closeout.first7DayLivePercent)}</span>
              </strong>
            </div>
          </div>
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Livability After 7 Days</span>
            <div className="mortality-popup-stat-lines">
              <strong>
                <span>Overall</span>
                <span>{formatPercent(closeout.first7DayLivePercent)}</span>
              </strong>
            </div>
            <p className="mortality-popup-stat-footer">Industry-style first 7-day cumulative mortality window: day 1 through day 7.</p>
          </div>
        </div>

        <div className="mortality-popup-grid">
          {closeout.first7DayBreakdown.map((day) => (
            <div className="mortality-popup-day" key={`${item.placementId}-${day.date}`}>
              <strong>{day.label}</strong>
              <span>Roo / Hen</span>
              <p>
                {day.male} / {day.female}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function formatCloseoutStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCount(value: number | null) {
  return value === null ? "--" : value.toLocaleString();
}

function formatWeight(value: number | null) {
  return value === null ? "--" : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} lb`;
}

function formatRatio(value: number | null) {
  return value === null ? "--" : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null) {
  return value === null ? "--" : `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatSignedPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  const formatted = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `-${formatted}%`;
  return `${formatted}%`;
}

function deriveHeadVariancePercent(actualHead: number | null, expectedHead: number | null) {
  if (
    actualHead === null ||
    expectedHead === null ||
    Number.isNaN(actualHead) ||
    Number.isNaN(expectedHead) ||
    expectedHead <= 0
  ) {
    return null;
  }

  return ((actualHead - expectedHead) / expectedHead) * 100;
}

function toFormValue(value: number | null) {
  return value === null || Number.isNaN(value) ? "" : String(value);
}

function buildFeedReportHref({
  flockCode,
}: {
  flockCode: string;
}) {
  const params = new URLSearchParams();
  params.set("flockCode", flockCode);
  return `/admin/feed-tickets/report?${params.toString()}`;
}
