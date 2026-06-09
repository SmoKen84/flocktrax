"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import {
  makePlacementCurrentAction,
  markBarnEmptyAction,
  markChicksArrivedAction,
  saveDashboardPlacementEditorAction,
  savePlacementLhDatesAction,
  type LhDateActionResult,
} from "@/app/admin/overview/actions";
import feedBinIcon from "@/screens/FeedBin.png";
import type { ActivePlacementRecord, BreedOptionRecord, FarmGroupRecord, FarmRecord } from "@/lib/types";

type ActivePlacementDashboardProps = {
  breedOptions: BreedOptionRecord[];
  placements: ActivePlacementRecord[];
  farmGroups: FarmGroupRecord[];
  farms: FarmRecord[];
  historyReportLabel: string;
};

type SubmissionFilter = "all" | ActivePlacementRecord["submissionStatus"];

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function safePercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function formatWeight(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Pending";
  }

  return value.toFixed(2);
}

function formatExpectedWeightPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }

  return `${value.toFixed(1)}%`;
}

function formatSampleCount(value: number | null) {
  return value ?? 0;
}

function formatFeedAmount(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Pending";
  }

  return `${Math.round(value).toLocaleString()} lb`;
}

function formatFeedRange(first: number | null, last: number | null) {
  if (first === null || last === null || Number.isNaN(first) || Number.isNaN(last)) {
    return "Pending";
  }

  return `${Math.round(first).toLocaleString()} to ${Math.round(last).toLocaleString()} lb`;
}

function formatFeedSigned(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Pending";
  }

  const rounded = Math.round(value);
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toLocaleString()} lb`;
}

function formatShortDate(value: string) {
  const dt = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) {
    return value;
  }

  return dt.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatPeriodLossPercent(losses: number, started: number) {
  return formatPercent(safePercent(losses, started));
}

function formatLivabilityPercent(current: number, started: number) {
  return formatPercent(safePercent(current, started));
}

function getOperationalAction(placement: ActivePlacementRecord) {
  if (placement.tileState === "scheduled" && !placement.placementIsActive) {
    return {
      kind: "current" as const,
      label: "Prep Next Flock",
    };
  }

  if (placement.placementIsActive && !placement.flockIsInBarn) {
    return {
      kind: "arrival" as const,
      label: "Chicks Arrived",
    };
  }

  if (placement.placementIsActive && placement.flockIsInBarn && placement.canMarkBarnEmpty) {
    return {
      kind: "empty" as const,
      label: "Checkout Flock",
    };
  }

  return null;
}

function shouldPrioritizeOperationalAction(
  placement: ActivePlacementRecord,
  operationalAction: ReturnType<typeof getOperationalAction>,
) {
  if (!operationalAction) {
    return false;
  }

  return operationalAction.kind === "empty";
}

function needsLhDates(placement: ActivePlacementRecord) {
  return placement.ageDays >= 42 && (!placement.lh1Date || !placement.lh3Date);
}

function getPassiveTileActionLabel(placement: ActivePlacementRecord) {
  if (placement.tileState === "scheduled") {
    return "Scheduled";
  }

  if (placement.tileState === "empty") {
    return "No Flock";
  }

  return placement.ageDays < 0 ? "Placed Ok" : "Schedule Live Haul";
}

function buildLivehaulSchedulerHref(placement: ActivePlacementRecord) {
  const firstScheduledDate = placement.liveHaulDates[0] ?? null;
  const targetMonth = (firstScheduledDate ?? placement.liveHaulSchedulerDate)?.slice(0, 7) ?? null;
  const query = new URLSearchParams();
  query.set("farm", placement.farmId);
  query.set("barn", placement.barnId);
  query.set("placement", placement.placementId);
  if (targetMonth) {
    query.set("month", targetMonth);
  }
  return `/admin/placements/livehaul?${query.toString()}`;
}

function formatIssueSummary(placement: ActivePlacementRecord) {
  const parts: string[] = [];

  if (placement.openBarnIssueCount > 0) {
    parts.push(
      `${placement.openBarnIssueCount} Barn Issue${placement.openBarnIssueCount === 1 ? "" : "s"}`,
    );
  }

  if (placement.openPlacementIssueCount > 0) {
    parts.push(
      `${placement.openPlacementIssueCount} Placement Issue${placement.openPlacementIssueCount === 1 ? "" : "s"}`,
    );
  }

  return parts.length > 0 ? parts.join(" · ") : "No open issues";
}

function getIssueBadgeTone(placement: ActivePlacementRecord) {
  return placement.openPlacementIssueCount > 0 ? "danger" : "warn";
}

function getOpenItemsBadgeLabel(placement: ActivePlacementRecord) {
  const totalOpenItems = placement.openBarnIssueCount + placement.openPlacementIssueCount;
  if (totalOpenItems <= 0) {
    return "Open";
  }

  return `Open ${totalOpenItems}`;
}

function canShowHistoryReportLink(placement: ActivePlacementRecord) {
  return Boolean(
    placement.flockId &&
      (placement.flockIsInBarn || placement.flockIsComplete || placement.flockIsSettled || placement.dateRemoved),
  );
}

function buildActionItemsHref(placement: ActivePlacementRecord, status: "open" | "resolved" = "open") {
  const params = new URLSearchParams();
  params.set("farmId", placement.farmId);
  params.set("barnId", placement.barnId);
  params.set("placementId", placement.placementId);
  params.append("status", status);
  return `/admin/issues?${params.toString()}`;
}

function formatIssueCountLine(count: number, label: "Placement" | "Barn") {
  return `${count} ${label} Issue${count === 1 ? "" : "s"}`;
}

function formatDateInputValue(value: string | null | undefined) {
  return String(value ?? "").slice(0, 10);
}

function formatLifecycleFlag(value: boolean) {
  return value ? "Yes" : "No";
}

function derivePlacementLifecycle(placement: ActivePlacementRecord) {
  if (placement.tileState === "empty") {
    return {
      label: "Open Barn",
      detail: "No active or scheduled placement is attached to this barn right now.",
      systemState: "Placement No | Active No | Flock Active No | In Barn No | Complete No | Settled No",
    };
  }

  const systemState = `Placement ${formatLifecycleFlag(Boolean(placement.placementId))} | Active ${formatLifecycleFlag(
    placement.placementIsActive,
  )} | Flock Active ${formatLifecycleFlag(placement.flockIsActive)} | In Barn ${formatLifecycleFlag(
    placement.flockIsInBarn,
  )} | Complete ${formatLifecycleFlag(placement.flockIsComplete)} | Settled ${formatLifecycleFlag(
    placement.flockIsSettled,
  )}`;

  switch (placement.lifecycleStage) {
    case "scheduled":
      return {
        label: "Scheduled",
        detail: "The placement exists on the board but has not been activated yet.",
        systemState,
      };
    case "awaiting_arrival":
      return {
        label: "Awaiting Arrival",
        detail:
          "The placement is active in the system, but the flock has not been confirmed in the barn yet. Feed, prep work, and action items can still be linked during this get-ready stage.",
        systemState,
      };
    case "in_barn_growing":
      return {
        label: "In Barn / Growing",
        detail: "The flock is active, confirmed in the barn, and currently in live production.",
        systemState,
      };
    case "waiting_closeout":
      return {
        label: "Waiting Closeout",
        detail: placement.dateRemoved
          ? `This flock checked out on ${placement.dateRemoved}. Growout is over and closeout work now remains.`
          : "This flock has left live production and is waiting for closeout work.",
        systemState,
      };
    case "closeout_submitted":
      return {
        label: "Closeout Submitted",
        detail: "Closeout has been submitted and the flock is waiting on final review or archival.",
        systemState,
      };
    case "archived":
      return {
        label: "Archived",
        detail: "This flock has completed its operational lifecycle and now lives in history.",
        systemState,
      };
  }

  return {
    label: "System State Unknown",
    detail: "This placement does not match one of the standard lifecycle stages yet.",
    systemState,
  };
}

function PlacementEditorPopup({
  breedOptions,
  historyReportLabel,
  onClose,
  placement,
}: {
  breedOptions: BreedOptionRecord[];
  historyReportLabel: string;
  onClose: () => void;
  placement: ActivePlacementRecord;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<LhDateActionResult>({
    status: "idle",
    message: "",
  });
  const [projectedEndDate, setProjectedEndDate] = useState(formatDateInputValue(placement.projectedEndDate));
  const [dateRemoved, setDateRemoved] = useState(formatDateInputValue(placement.dateRemoved));
  const [startCntMales, setStartCntMales] = useState(String(placement.startedMaleCount || ""));
  const [startCntFemales, setStartCntFemales] = useState(String(placement.startedFemaleCount || ""));
  const [breedMales, setBreedMales] = useState(placement.breedMales ?? "");
  const [breedFemales, setBreedFemales] = useState(placement.breedFemales ?? "");
  const [lh1Date, setLh1Date] = useState(formatDateInputValue(placement.lh1Date));
  const [lh2Date, setLh2Date] = useState(formatDateInputValue(placement.lh2Date));
  const [lh3Date, setLh3Date] = useState(formatDateInputValue(placement.lh3Date));

  useEffect(() => {
    setProjectedEndDate(formatDateInputValue(placement.projectedEndDate));
    setDateRemoved(formatDateInputValue(placement.dateRemoved));
    setStartCntMales(String(placement.startedMaleCount || ""));
    setStartCntFemales(String(placement.startedFemaleCount || ""));
    setBreedMales(placement.breedMales ?? "");
    setBreedFemales(placement.breedFemales ?? "");
    setLh1Date(formatDateInputValue(placement.lh1Date));
    setLh2Date(formatDateInputValue(placement.lh2Date));
    setLh3Date(formatDateInputValue(placement.lh3Date));
    setActionState({ status: "idle", message: "" });
  }, [placement]);

  const maleBreedOptions = useMemo(
    () =>
      breedOptions.filter((option) => {
        const normalizedSex = String(option.sex ?? "").trim().toLowerCase();
        return !normalizedSex || normalizedSex.startsWith("m") || normalizedSex === "unsexed";
      }),
    [breedOptions],
  );
  const femaleBreedOptions = useMemo(
    () =>
      breedOptions.filter((option) => {
        const normalizedSex = String(option.sex ?? "").trim().toLowerCase();
        return !normalizedSex || normalizedSex.startsWith("f") || normalizedSex === "unsexed";
      }),
    [breedOptions],
  );
  const canSave =
    placement.placementEditorAccess.canEditFlockFields || placement.placementEditorAccess.canEditPlacementFields;
  const lifecycle = derivePlacementLifecycle(placement);
  const canShowHistoryReport = canShowHistoryReportLink(placement);

  if (typeof document === "undefined") {
    return null;
  }

  function savePlacement() {
    if (!canSave) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("placement_id", placement.placementId);
      formData.set("projected_end_date", projectedEndDate);
      formData.set("date_removed", dateRemoved);
      formData.set("start_cnt_males", startCntMales);
      formData.set("start_cnt_females", startCntFemales);
      formData.set("breed_males", breedMales);
      formData.set("breed_females", breedFemales);
      formData.set("lh1_date", lh1Date);
      formData.set("lh2_date", lh2Date);
      formData.set("lh3_date", lh3Date);

      const result = await saveDashboardPlacementEditorAction(formData);
      setActionState(result);

      if (result.status === "success") {
        onClose();
        router.refresh();
      }
    });
  }

  return createPortal(
    <div className="dashboard-placement-editor-shell" onClick={onClose}>
      <div
        aria-modal="true"
        className="dashboard-placement-editor-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="dashboard-placement-editor-header">
          <div className="dashboard-placement-editor-title-block">
            <p className="dashboard-placement-editor-placement-line">
              {placement.farmName} &middot; Barn {placement.barnCode} &middot; {placement.placementCode}
            </p>
            <h3>Placement Editor</h3>
            <p className="dashboard-placement-editor-copy">
              Placement date stays locked from the live dashboard. Other fields unlock only where your role has edit
              permission.
            </p>
          </div>
          <button className="button-secondary" disabled={isPending} onClick={onClose} type="button">
            Close
          </button>
        </div>

        {!placement.placementEditorAccess.canView ? (
          <div className="dashboard-placement-editor-blocked">
            <p>{placement.placementEditorAccess.message ?? "This placement is not available for viewing."}</p>
          </div>
        ) : (
          <>
            {placement.placementEditorAccess.message ? (
              <p className="dashboard-placement-editor-note">{placement.placementEditorAccess.message}</p>
            ) : null}

            {actionState.status !== "idle" ? (
              <p
                className={
                  actionState.status === "error"
                    ? "dashboard-placement-editor-feedback is-error"
                    : "dashboard-placement-editor-feedback is-success"
                }
              >
                {actionState.message}
              </p>
            ) : null}

            <div className="dashboard-placement-editor-summary">
              <div className="dashboard-placement-editor-card">
                <span>Placed Date</span>
                <strong>{placement.placedDate || "Pending"}</strong>
              </div>
              <div className="dashboard-placement-editor-card">
                <span>Flock</span>
                <strong>{placement.flockCode}</strong>
              </div>
              <div className="dashboard-placement-editor-card">
                <span>Status</span>
                <strong>{placement.dashboardStatusLabel}</strong>
              </div>
              <div className="dashboard-placement-editor-card dashboard-placement-editor-card--lifecycle">
                <span>Lifecycle</span>
                <strong>{lifecycle.label}</strong>
                <small>{lifecycle.detail}</small>
              </div>
            </div>
            <p className="dashboard-placement-editor-system-state">{lifecycle.systemState}</p>

            <div className="placement-scheduler-form dashboard-placement-editor-form">
              <div className="form-grid dashboard-placement-editor-grid">
                <label className="field dashboard-placement-editor-field dashboard-placement-editor-field--tight">
                  <span>Placed Date</span>
                  <input disabled readOnly type="date" value={formatDateInputValue(placement.placedDate)} />
                </label>
                <label className="field dashboard-placement-editor-field dashboard-placement-editor-field--tight">
                  <span>Projected End</span>
                  <input
                    disabled={!placement.placementEditorAccess.canEditFlockFields || isPending}
                    onChange={(event) => setProjectedEndDate(event.target.value)}
                    type="date"
                    value={projectedEndDate}
                  />
                </label>
                <label className="field dashboard-placement-editor-field dashboard-placement-editor-field--tight">
                  <span>Date Removed</span>
                  <input
                    disabled={!placement.placementEditorAccess.canEditPlacementFields || isPending}
                    onChange={(event) => setDateRemoved(event.target.value)}
                    type="date"
                    value={dateRemoved}
                  />
                </label>
                <div className="placement-scheduler-start-row dashboard-placement-editor-dual-row">
                  <label className="field dashboard-placement-editor-field dashboard-placement-editor-field--tight">
                    <span>Start Males</span>
                    <input
                      className="placement-scheduler-start-input"
                      disabled={!placement.placementEditorAccess.canEditFlockFields || isPending}
                      inputMode="numeric"
                      onChange={(event) => setStartCntMales(event.target.value)}
                      type="number"
                      value={startCntMales}
                    />
                  </label>
                  <label className="field dashboard-placement-editor-field dashboard-placement-editor-field--tight">
                    <span>Start Females</span>
                    <input
                      className="placement-scheduler-start-input"
                      disabled={!placement.placementEditorAccess.canEditFlockFields || isPending}
                      inputMode="numeric"
                      onChange={(event) => setStartCntFemales(event.target.value)}
                      type="number"
                      value={startCntFemales}
                    />
                  </label>
                </div>
                <div className="placement-scheduler-triplet dashboard-placement-editor-triplet-row">
                  <label className="field field-third dashboard-placement-editor-field dashboard-placement-editor-field--tight">
                    <span>LH 1 Date</span>
                    <input
                      disabled={!placement.placementEditorAccess.canEditPlacementFields || isPending}
                      onChange={(event) => setLh1Date(event.target.value)}
                      type="date"
                      value={lh1Date}
                    />
                  </label>
                  <label className="field field-third dashboard-placement-editor-field dashboard-placement-editor-field--tight">
                    <span>LH 2 Date</span>
                    <input
                      disabled={!placement.placementEditorAccess.canEditPlacementFields || isPending}
                      onChange={(event) => setLh2Date(event.target.value)}
                      type="date"
                      value={lh2Date}
                    />
                  </label>
                  <label className="field field-third dashboard-placement-editor-field dashboard-placement-editor-field--tight">
                    <span>LH 3 Date</span>
                    <input
                      disabled={!placement.placementEditorAccess.canEditPlacementFields || isPending}
                      onChange={(event) => setLh3Date(event.target.value)}
                      type="date"
                      value={lh3Date}
                    />
                  </label>
                </div>
                <label className="field dashboard-placement-editor-field dashboard-placement-editor-field--wide">
                  <span>Breed Males</span>
                  <select
                    disabled={!placement.placementEditorAccess.canEditFlockFields || isPending}
                    onChange={(event) => setBreedMales(event.target.value)}
                    value={breedMales}
                  >
                    <option value=""></option>
                    {maleBreedOptions.map((breed) => (
                      <option key={breed.id} value={breed.id}>
                        {breed.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field dashboard-placement-editor-field dashboard-placement-editor-field--wide">
                  <span>Breed Females</span>
                  <select
                    disabled={!placement.placementEditorAccess.canEditFlockFields || isPending}
                    onChange={(event) => setBreedFemales(event.target.value)}
                    value={breedFemales}
                  >
                    <option value=""></option>
                    {femaleBreedOptions.map((breed) => (
                      <option key={breed.id} value={breed.id}>
                        {breed.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="dashboard-placement-editor-actions">
              {canShowHistoryReport ? (
                <>
                  <Link
                    className="tile-action-button tile-action-button--secondary"
                    href={`/admin/flocks/${placement.flockId}/report`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {historyReportLabel}
                  </Link>
                  <Link
                    className="tile-action-button tile-action-button--secondary"
                    href={`/admin/flocks/${placement.flockId}/report?mode=micro`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Micro Archive Copy
                  </Link>
                </>
              ) : null}
              <button className="tile-action-button tile-action-button--secondary" disabled={isPending} onClick={onClose} type="button">
                Cancel
              </button>
              {canSave ? (
                <button className="tile-action-button" disabled={isPending} onClick={savePlacement} type="button">
                  {isPending ? "Saving..." : "Save Placement"}
                </button>
              ) : (
                <div className="tile-action-button dashboard-placement-editor-readonly">Read Only</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function CheckoutFlockPopup({
  placement,
  removedDate,
  pending,
  feedback,
  onChangeRemovedDate,
  onClose,
  onConfirm,
}: {
  placement: ActivePlacementRecord;
  removedDate: string;
  pending: boolean;
  feedback: LhDateActionResult;
  onChangeRemovedDate: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="checkout-popup-shell" onClick={onClose}>
      <div className="checkout-popup-panel" onClick={(event) => event.stopPropagation()}>
        <div className="checkout-popup-header">
          <div className="checkout-popup-title-block">
            <p className="checkout-popup-placement-line">
              {placement.farmName} &middot; Barn {placement.barnCode}
            </p>
            <h3>Checkout Current Flock</h3>
            <p className="checkout-popup-copy">
              Close out the shipped flock, stamp the removal date, and move the next scheduled flock into a
              get-ready state so incoming feed and other items can land on that new placement.
            </p>
          </div>
          <button className="button-secondary" disabled={pending} onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="checkout-popup-grid">
          <div className="checkout-popup-card">
            <span>Current flock</span>
            <strong>{placement.placementCode}</strong>
            <p>Flock {placement.flockCode}</p>
          </div>
          <div className="checkout-popup-card">
            <span>Next state</span>
            <strong>{placement.nextPlacement?.placementCode ?? "No Next Placement"}</strong>
            <p>
              {placement.nextPlacement
                ? `Flock ${placement.nextPlacement.flockCode}${placement.nextPlacement.placedDate ? ` · Scheduled ${placement.nextPlacement.placedDate}` : ""}`
                : "This barn will be left empty until another flock is scheduled."}
            </p>
          </div>
        </div>

        <label className="checkout-popup-field">
          <span>Flock removed date</span>
          <input
            disabled={pending}
            onChange={(event) => onChangeRemovedDate(event.target.value)}
            type="date"
            value={removedDate}
          />
        </label>

        {feedback.status !== "idle" ? (
          <p
            className={
              feedback.status === "error" ? "checkout-popup-feedback is-error" : "checkout-popup-feedback is-success"
            }
          >
            {feedback.message}
          </p>
        ) : null}

        <div className="checkout-popup-actions">
          <button className="tile-action-button tile-action-button--secondary" disabled={pending} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="tile-action-button" disabled={pending || !removedDate} onClick={onConfirm} type="button">
            {pending ? "Checking Out..." : "Checkout"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MortalityPopup({
  placement,
  mode,
  onClose,
}: {
  placement: ActivePlacementRecord;
  mode: "first7" | "last7";
  onClose: () => void;
}) {
  const startedTotal = placement.startedMaleCount + placement.startedFemaleCount;
  const breakdown =
    mode === "first7" ? placement.mortalityFirst7DayBreakdown : placement.mortalityLast7DayBreakdown;
  const periodLosses = breakdown.reduce((sum, day) => sum + day.male + day.female, 0);
  const maleMortalityTotal =
    mode === "first7" ? placement.mortalityMaleFirst7Days : placement.mortalityMaleLast7Days;
  const femaleMortalityTotal =
    mode === "first7" ? placement.mortalityFemaleFirst7Days : placement.mortalityFemaleLast7Days;
  const title = mode === "first7" ? "First 7-Days Mortality" : "Last 7-Days Mortality";
  const livabilityMaleCount =
    mode === "first7"
      ? Math.max(0, placement.startedMaleCount - maleMortalityTotal)
      : placement.currentMaleCount;
  const livabilityFemaleCount =
    mode === "first7"
      ? Math.max(0, placement.startedFemaleCount - femaleMortalityTotal)
      : placement.currentFemaleCount;
  const livabilityTotal = livabilityMaleCount + livabilityFemaleCount;
  const livabilityLabel = mode === "first7" ? "Livability after 7-days" : "Current Livability";
  const maleLivePercent = safePercent(livabilityMaleCount, placement.startedMaleCount);
  const femaleLivePercent = safePercent(livabilityFemaleCount, placement.startedFemaleCount);
  const maleMortPercent = Math.max(0, 100 - maleLivePercent);
  const femaleMortPercent = Math.max(0, 100 - femaleLivePercent);
  const mortalityCountTotal = mode === "first7" ? maleMortalityTotal + femaleMortalityTotal : periodLosses;
  const totalMortPercent = safePercent(mortalityCountTotal, startedTotal);
  const totalLivePercent = Math.max(0, 100 - totalMortPercent);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="mortality-popup-shell" onClick={onClose}>
      <div className="mortality-popup-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mortality-popup-header">
          <div className="mortality-popup-title-block">
            <p className="mortality-popup-placement-line">
              {placement.farmName} &middot; Barn {placement.barnCode} &middot; {placement.placementCode}
            </p>
            <h3>{title}</h3>
          </div>
          <div className="mortality-popup-sidecar">
            <button className="button-secondary" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="mortality-popup-summary">
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>{livabilityLabel}</span>
            <div className="mortality-popup-stat-lines">
              <strong>
                <span>Roos:</span>
                <span>{formatCount(livabilityMaleCount)}</span>
                <span>{formatPercent(maleLivePercent)}</span>
              </strong>
              <strong>
                <span>Hens:</span>
                <span>{formatCount(livabilityFemaleCount)}</span>
                <span>{formatPercent(femaleLivePercent)}</span>
              </strong>
              <strong className="mortality-popup-stat-total-row">
                <span>Totals</span>
                <span>{formatCount(livabilityTotal)}</span>
                <span>{formatPercent(totalLivePercent)}</span>
              </strong>
            </div>
          </div>
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Mortality</span>
            {mode === "first7" ? (
              <div className="mortality-popup-metric-stack">
                <div className="mortality-popup-metric-table mortality-popup-metric-table--head">
                  <div className="mortality-popup-metric-head" />
                  <div className="mortality-popup-metric-head">Dead</div>
                  <div className="mortality-popup-metric-head">Mort %</div>
                </div>

                <div className="mortality-popup-metric-table">
                  <div className="mortality-popup-metric-label">Roos:</div>
                  <div>{formatCount(maleMortalityTotal)}</div>
                  <div>{formatPercent(maleMortPercent)}</div>
                </div>

                <div className="mortality-popup-metric-table">
                  <div className="mortality-popup-metric-label">Hens:</div>
                  <div>{formatCount(femaleMortalityTotal)}</div>
                  <div>{formatPercent(femaleMortPercent)}</div>
                </div>

                <div className="mortality-popup-metric-table mortality-popup-metric-table--totals">
                  <div className="mortality-popup-metric-label mortality-popup-metric-total">Totals:</div>
                  <div className="mortality-popup-metric-total">{formatCount(mortalityCountTotal)}</div>
                  <div className="mortality-popup-metric-total">{formatPercent(totalMortPercent)}</div>
                </div>
              </div>
            ) : (
              <div className="mortality-popup-stat-lines">
                <strong>
                  <span>Roos:</span>
                  <span>{formatCount(maleMortalityTotal)}</span>
                  <span>{formatPercent(safePercent(maleMortalityTotal, placement.startedMaleCount))}</span>
                </strong>
                <strong>
                  <span>Hens:</span>
                  <span>{formatCount(femaleMortalityTotal)}</span>
                  <span>{formatPercent(safePercent(femaleMortalityTotal, placement.startedFemaleCount))}</span>
                </strong>
              </div>
            )}
            {mode !== "first7" ? (
              <p className="mortality-popup-stat-footer">
                Window total {formatPeriodLossPercent(periodLosses, startedTotal)} &middot; Overall{" "}
                {formatPercent(
                  safePercent(
                    placement.mortalityMaleTotal + placement.mortalityFemaleTotal,
                    startedTotal,
                  ),
                )}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mortality-popup-grid">
          {breakdown.map((day) => (
            <div className="mortality-popup-day" key={`${mode}-${placement.id}-${day.date}`}>
              <strong>{day.label}</strong>
              <span>
                Roo / Hen
              </span>
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

function FeedProjectionPopup({
  placement,
  onClose,
}: {
  placement: ActivePlacementRecord;
  onClose: () => void;
}) {
  const startDate = placement.feedProjectionTenDayDaily[0]?.date ?? null;
  const endDate =
    placement.feedProjectionTenDayDaily[placement.feedProjectionTenDayDaily.length - 1]?.date ?? null;
  const liveHaulAdjustmentLabel =
    placement.feedProjectionLiveHaulDates.length > 0
      ? placement.feedProjectionLiveHaulDates.map((date) => formatShortDate(date)).join(", ")
      : "None in window";
  const inventoryStatusLabel =
    placement.feedInventorySnapshotAt
      ? `Inventory snapshot recorded ${formatShortDate(placement.feedInventorySnapshotAt.slice(0, 10))}.`
      : "Inventory snapshot pending BinSentry sync.";
  const onOrderStatusLabel =
    placement.feedOnOrderLbs === null
      ? "Open feed orders are not connected yet."
      : placement.feedOnOrderOpenCount > 0
        ? `${placement.feedOnOrderOpenCount} open feed order${placement.feedOnOrderOpenCount === 1 ? "" : "s"}${
            placement.feedOnOrderNextEta ? ` · next ETA ${formatShortDate(placement.feedOnOrderNextEta)}` : ""
          }`
        : "No open feed orders recorded.";
  const recommendedOrderLabel =
    placement.feedRecommendedOrderLbs === null
      ? "Pending inventory / on-order inputs."
      : placement.feedRecommendedOrderLbs > 0
        ? "Recommended new feed to order now."
        : "Current supply covers the next 10 days.";
  const requirementTypeSplitLabel =
    placement.feedProjectionTenDayStarterTotal === null && placement.feedProjectionTenDayGrowerTotal === null
      ? "Type split pending."
      : `Starter ${formatFeedAmount(placement.feedProjectionTenDayStarterTotal)} · Grower ${formatFeedAmount(placement.feedProjectionTenDayGrowerTotal)}`;
  const starterProgramLabel =
    placement.starterTargetLbs > 0
      ? `Target ${formatFeedAmount(placement.starterTargetLbs)} at ${placement.starterLbsPerChick.toFixed(2)} lbs/chick · delivered ${formatFeedAmount(placement.starterDeliveredLbs)} · orderable through day 14 ${formatFeedAmount(placement.starterOrderableRemainingLbs)}`
      : "Starter target pending placement counts.";

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="mortality-popup-shell" onClick={onClose}>
      <div className="mortality-popup-panel feed-projection-popup-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mortality-popup-header">
          <div className="mortality-popup-title-block">
            <p className="mortality-popup-placement-line">
              {placement.farmName} &middot; Barn {placement.barnCode} &middot; {placement.placementCode}
            </p>
            <h3>10 Day Feed Requirement</h3>
          </div>
          <div className="mortality-popup-sidecar">
            <button className="button-secondary" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="mortality-popup-summary feed-projection-popup-summary">
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Total Requirement</span>
            <strong>{formatFeedAmount(placement.feedProjectionTenDayTotal)}</strong>
          </div>
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>On Hand Inventory</span>
            <strong>{formatFeedAmount(placement.feedInventoryOnHandLbs)}</strong>
          </div>
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Open Orders</span>
            <strong>{formatFeedAmount(placement.feedOnOrderLbs)}</strong>
          </div>
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Recommended Order</span>
            <strong>{formatFeedAmount(placement.feedRecommendedOrderLbs)}</strong>
          </div>
        </div>

        <div className="mortality-popup-summary feed-projection-popup-summary">
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Average Per Day</span>
            <strong>{formatFeedAmount(placement.feedProjectionTenDayAverage)}</strong>
          </div>
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Daily Range</span>
            <strong>
              {formatFeedRange(
                placement.feedProjectionTenDayRange.first,
                placement.feedProjectionTenDayRange.last,
              )}
            </strong>
          </div>
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Window</span>
            <strong>
              {startDate && endDate ? `${formatShortDate(startDate)} to ${formatShortDate(endDate)}` : "Pending"}
            </strong>
          </div>
          <div className="mortality-popup-stat mortality-popup-stat-compact">
            <span>Net Position</span>
            <strong>{formatFeedSigned(placement.feedProjectedNetPositionLbs)}</strong>
          </div>
        </div>

        <div className="mortality-popup-stat feed-projection-popup-note">
          <span>Live Haul Adjustment</span>
          <strong>{liveHaulAdjustmentLabel}</strong>
        </div>
        <div className="mortality-popup-stat feed-projection-popup-note">
          <span>Inventory</span>
          <strong>{inventoryStatusLabel}</strong>
        </div>
        <div className="mortality-popup-stat feed-projection-popup-note">
          <span>On Order</span>
          <strong>{onOrderStatusLabel}</strong>
        </div>
        <div className="mortality-popup-stat feed-projection-popup-note">
          <span>Ordering Position</span>
          <strong>{recommendedOrderLabel}</strong>
        </div>
        <div className="mortality-popup-stat feed-projection-popup-note">
          <span>Requirement Split</span>
          <strong>{requirementTypeSplitLabel}</strong>
        </div>
        <div className="mortality-popup-stat feed-projection-popup-note">
          <span>Starter Program</span>
          <strong>{starterProgramLabel}</strong>
        </div>

        <div className="feed-projection-popup-grid">
          {placement.feedProjectionTenDayDaily.map((day) => (
            <div className="feed-projection-popup-day" key={`${placement.id}-${day.date}`}>
              <strong>{formatShortDate(day.date)}</strong>
              <span>Age {day.ageDays} days</span>
              <p>{formatFeedAmount(day.totalFeed)}</p>
              <small>Starter {formatFeedAmount(day.starterFeed)} · Grower {formatFeedAmount(day.growerFeed)}</small>
              <small>{day.totalBirds.toLocaleString()} birds</small>
              {day.liveHaulLabel ? (
                <em>
                  {day.liveHaulLabel}
                </em>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PlacementTile({
  historyReportLabel,
  onOpenPlacementEditor,
  placement,
  editingPlacementId,
  onBeginEdit,
  onEndEdit,
}: {
  historyReportLabel: string;
  onOpenPlacementEditor: (placementId: string) => void;
  placement: ActivePlacementRecord;
  editingPlacementId: string | null;
  onBeginEdit: (placementId: string) => void;
  onEndEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lh1DateValue, setLh1DateValue] = useState(placement.lh1Date ?? "");
  const [lh3DateValue, setLh3DateValue] = useState(placement.lh3Date ?? "");
  const [savedLh1Date, setSavedLh1Date] = useState(placement.lh1Date ?? "");
  const [savedLh3Date, setSavedLh3Date] = useState(placement.lh3Date ?? "");
  const [actionState, setActionState] = useState<LhDateActionResult>({
    status: "idle",
    message: "",
  });
  const [mortalityPopupMode, setMortalityPopupMode] = useState<"first7" | "last7" | null>(null);
  const [showFeedProjectionPopup, setShowFeedProjectionPopup] = useState(false);
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
  const [checkoutRemovedDate, setCheckoutRemovedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const isEditingLhDates = editingPlacementId === placement.id;
  const anotherTileIsEditing = editingPlacementId !== null && editingPlacementId !== placement.id;

  useEffect(() => {
    setLh1DateValue(placement.lh1Date ?? "");
    setLh3DateValue(placement.lh3Date ?? "");
  }, [placement.lh1Date, placement.lh3Date]);

  useEffect(() => {
    setSavedLh1Date(placement.lh1Date ?? "");
    setSavedLh3Date(placement.lh3Date ?? "");
  }, [placement.lh1Date, placement.lh3Date]);

  const startedTotal = placement.startedMaleCount + placement.startedFemaleCount;
  const mortalityTotal = placement.mortalityMaleTotal + placement.mortalityFemaleTotal;
  const currentTotal = placement.currentMaleCount + placement.currentFemaleCount;
  const first7Total = placement.mortalityMaleFirst7Days + placement.mortalityFemaleFirst7Days;
  const last7Total = placement.mortalityMaleLast7Days + placement.mortalityFemaleLast7Days;
  const operationalAction = getOperationalAction(placement);
  const lhDatesNeeded = needsLhDates(placement);
  const canEditLhDates = placement.placementIsActive && placement.ageDays >= 42;
  const prioritizeOperationalAction = shouldPrioritizeOperationalAction(placement, operationalAction);
  const hasOpenItems = placement.openBarnIssueCount > 0 || placement.openPlacementIssueCount > 0;
  const openActionItemsHref = buildActionItemsHref(placement, "open");
  const resolvedActionItemsHref = buildActionItemsHref(placement, "resolved");
  const livehaulSchedulerHref = buildLivehaulSchedulerHref(placement);
  const issueBadgeTone = getIssueBadgeTone(placement);
  const shouldShowCompletionBadge = placement.tileState === "live" && Boolean(placement.completedTodayLabel);
  const shouldShowPendingBadge = placement.tileState === "live" && !hasOpenItems && !shouldShowCompletionBadge;
  const shouldShowDefaultHeaderBadge = placement.tileState !== "live";
  const hasFeedProjection = placement.feedProjectionTenDayDaily.length > 0 && placement.feedProjectionTenDayTotal !== null;

  function beginEdit() {
    if (!canEditLhDates || anotherTileIsEditing) {
      return;
    }

    setActionState({ status: "idle", message: "" });
    setLh1DateValue(savedLh1Date);
    setLh3DateValue(savedLh3Date);
    onBeginEdit(placement.id);
  }

  function cancelEdit() {
    setActionState({ status: "idle", message: "" });
    setLh1DateValue(savedLh1Date);
    setLh3DateValue(savedLh3Date);
    onEndEdit();
  }

  function closeCheckoutPopup() {
    if (isPending) {
      return;
    }

    setShowCheckoutPopup(false);
  }

  function saveDates() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("placement_id", placement.id);
      formData.set("lh1_date", lh1DateValue);
      formData.set("lh3_date", lh3DateValue);

      const result = await savePlacementLhDatesAction(formData);
      setActionState(result);

      if (result.status === "success") {
        setSavedLh1Date(lh1DateValue);
        setSavedLh3Date(lh3DateValue);
        onEndEdit();
        router.refresh();
      }
    });
  }

  function runOperationalAction(overrideRemovedDate?: string) {
    if (!operationalAction) {
      return;
    }

    startTransition(async () => {
      const result =
        operationalAction.kind === "current"
          ? await makePlacementCurrentAction(placement.id)
          : operationalAction.kind === "arrival"
            ? await markChicksArrivedAction(placement.id)
            : await markBarnEmptyAction(placement.barnId, overrideRemovedDate);

      setActionState(result);

      if (result.status === "success") {
        setShowCheckoutPopup(false);
        router.refresh();
      }
    });
  }

  function handleOperationalActionClick() {
    if (operationalAction?.kind === "empty") {
      setActionState({ status: "idle", message: "" });
      setCheckoutRemovedDate(new Date().toISOString().slice(0, 10));
      setShowCheckoutPopup(true);
      return;
    }

    runOperationalAction();
  }

  function openPlacementEditor() {
    if (!placement.placementEditorAccess.canOpen) {
      return;
    }

    onOpenPlacementEditor(placement.placementId);
  }

  function handleTileClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a,button,input,select,textarea,label")) {
      return;
    }

    openPlacementEditor();
  }

  function handleTileKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a,button,input,select,textarea")) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPlacementEditor();
    }
  }

  return (
    <article
      aria-label={`Open placement editor for ${placement.placementCode} in ${placement.farmName} barn ${placement.barnCode}`}
      className="placement-tile placement-tile--clickable"
      data-state={placement.tileState}
      onClick={handleTileClick}
      onKeyDown={handleTileKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="placement-tile-header">
        <div>
          <p className="placement-tile-barn">{placement.barnCode}</p>
          <h3 className="placement-tile-farm">{placement.farmName}</h3>
          <p className="placement-kicker">{placement.farmGroupName}</p>
        </div>
        <div className="placement-tile-pill-stack">
          {shouldShowCompletionBadge ? (
            <span className="status-pill" data-tone="good">
              {placement.completedTodayLabel}
            </span>
          ) : null}
          {hasOpenItems ? (
            <Link className="status-pill" data-tone={issueBadgeTone} href={openActionItemsHref}>
              {getOpenItemsBadgeLabel(placement)}
            </Link>
          ) : null}
          {shouldShowPendingBadge ? (
            <span className="status-pill" data-tone={placement.dashboardStatusTone}>
              {placement.dashboardStatusLabel}
            </span>
          ) : null}
          {shouldShowDefaultHeaderBadge ? (
            <span className="status-pill" data-tone={placement.dashboardStatusTone}>
              {placement.dashboardStatusLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="placement-summary-grid">
        <div>
          <p className="stat-label">Flock</p>
          <p className="tile-value">{placement.placementCode}</p>
        </div>
        <div>
          <p className="stat-label">Placed</p>
          <p className="tile-value">{placement.placedDate || "Pending"}</p>
        </div>
        <div>
          <p className="stat-label">Age</p>
          <p className="tile-value">{placement.ageDays} days</p>
        </div>
      </div>

      <div className="tile-issue-summary-grid">
        <Link className="tile-issue-summary tile-issue-summary-link" data-tone={placement.dashboardStatusTone} href={openActionItemsHref}>
          <span className="tile-issue-summary-heading">Open Items:</span>
          <span>{formatIssueCountLine(placement.openPlacementIssueCount, "Placement")}</span>
          <span>{formatIssueCountLine(placement.openBarnIssueCount, "Barn")}</span>
        </Link>
        <Link
          className="tile-issue-summary tile-issue-summary-link tile-issue-summary-link--resolved"
          data-tone="neutral"
          href={resolvedActionItemsHref}
        >
          <span className="tile-issue-summary-heading">Closed Items:</span>
          <span>{formatIssueCountLine(placement.resolvedPlacementIssueCount, "Placement")}</span>
          <span>{formatIssueCountLine(placement.resolvedBarnIssueCount, "Barn")}</span>
        </Link>
      </div>

      <section className="tile-mortality-card">
        <div className="tile-mortality-table">
          <div className="tile-mortality-header" />
          <div className="tile-mortality-header">Started</div>
          <div className="tile-mortality-header">Dead</div>
          <div className="tile-mortality-header">Now</div>
          <div className="tile-mortality-header">Loss %</div>

          <div className="tile-mortality-label">Males</div>
          <div>{formatCount(placement.startedMaleCount)}</div>
          <div>{formatCount(placement.mortalityMaleTotal)}</div>
          <div>{formatCount(placement.currentMaleCount)}</div>
          <div>{formatPercent(safePercent(placement.mortalityMaleTotal, placement.startedMaleCount))}</div>

          <div className="tile-mortality-label">Females</div>
          <div>{formatCount(placement.startedFemaleCount)}</div>
          <div>{formatCount(placement.mortalityFemaleTotal)}</div>
          <div>{formatCount(placement.currentFemaleCount)}</div>
          <div>{formatPercent(safePercent(placement.mortalityFemaleTotal, placement.startedFemaleCount))}</div>

          <div className="tile-mortality-label tile-mortality-total">Total</div>
          <div className="tile-mortality-total">{formatCount(startedTotal)}</div>
          <div className="tile-mortality-total">{formatCount(mortalityTotal)}</div>
          <div className="tile-mortality-total">{formatCount(currentTotal)}</div>
          <div className="tile-mortality-total">{formatPercent(safePercent(mortalityTotal, startedTotal))}</div>
        </div>

        <div className="tile-chip-row">
          <button className="tile-chip tile-chip-button" onClick={() => setMortalityPopupMode("first7")} type="button">
            First 7 Days
          </button>
          <button className="tile-chip tile-chip-button" onClick={() => setMortalityPopupMode("last7")} type="button">
            Last 7 Days
          </button>
        </div>
      </section>

      <div className="tile-action-row">
        {isEditingLhDates ? (
          <button
            className="tile-action-button"
            disabled={isPending}
            onClick={saveDates}
            type="button"
          >
            {isPending ? "Saving..." : "Save Dates"}
          </button>
        ) : prioritizeOperationalAction && operationalAction ? (
          <button
            className="tile-action-button"
            disabled={isPending || anotherTileIsEditing}
            onClick={handleOperationalActionClick}
            type="button"
          >
            {isPending ? "Saving..." : operationalAction.label}
          </button>
        ) : lhDatesNeeded ? (
          <Link
            className="tile-action-button"
            href={livehaulSchedulerHref}
          >
            LH Dates
          </Link>
        ) : operationalAction ? (
          <button
            className="tile-action-button"
            disabled={isPending || anotherTileIsEditing}
            onClick={handleOperationalActionClick}
            type="button"
          >
            {isPending ? "Saving..." : operationalAction.label}
          </button>
        ) : canEditLhDates ? (
          <Link
            className="tile-action-button"
            href={livehaulSchedulerHref}
          >
            LH Dates
          </Link>
        ) : (
          <Link className="tile-action-button" href={livehaulSchedulerHref}>
            {getPassiveTileActionLabel(placement)}
          </Link>
        )}
        {isEditingLhDates ? (
          <button
            className="tile-action-button tile-action-button--secondary"
            disabled={isPending}
            onClick={cancelEdit}
            type="button"
          >
            Cancel
          </button>
        ) : prioritizeOperationalAction && canEditLhDates ? (
          <Link
            className="tile-action-button tile-action-button--secondary"
            href={livehaulSchedulerHref}
          >
            LH Dates
          </Link>
        ) : lhDatesNeeded && operationalAction ? (
          <button
            className="tile-action-button tile-action-button--secondary"
            disabled={isPending || anotherTileIsEditing}
            onClick={handleOperationalActionClick}
            type="button"
          >
            {operationalAction.label}
          </button>
        ) : operationalAction && canEditLhDates ? (
          <Link
            className="tile-action-button tile-action-button--secondary"
            href={livehaulSchedulerHref}
          >
            LH Dates
          </Link>
        ) : canShowHistoryReportLink(placement) ? (
          <Link
            className="tile-action-button"
            href={`/admin/flocks/${placement.flockId}/report`}
            rel="noreferrer"
            target="_blank"
          >
            {historyReportLabel}
          </Link>
        ) : (
          <div aria-hidden="true" className="tile-action-button tile-action-button--ghost" />
        )}
      </div>

      <div className="placement-subpanel-grid">
        <section className="tile-subpanel tile-subpanel--haul">
          <h4>Live Haul</h4>
          <dl className="tile-subpanel-list">
            <div className="tile-subpanel-item">
              <dt>Estimated</dt>
              <dd className="tile-subpanel-value">{placement.estimatedFirstCatch || "Pending"}</dd>
            </div>
            <div className="tile-subpanel-item">
              <dt>Dates</dt>
              <dd className="tile-subpanel-value">
                {placement.liveHaulDates.length > 0
                  ? placement.liveHaulDates.map((date) => formatShortDate(date)).join(", ")
                  : "No livehaul dates scheduled"}
              </dd>
            </div>
          </dl>
          {actionState.status === "error" ? (
            <p className="tile-subpanel-feedback">{actionState.message}</p>
          ) : null}
        </section>

        <section className="tile-subpanel tile-subpanel--weight">
          <h4>Weight</h4>
          <dl className="tile-subpanel-list">
            <div className="tile-subpanel-item">
              <dt>Male Avg</dt>
              <dd className="tile-subpanel-value tile-subpanel-value--accent tile-subpanel-value-inline">
                <span>{formatWeight(placement.latestMaleWeight)}</span>
                <span className="tile-subpanel-inline-meta">
                  {formatExpectedWeightPercent(placement.latestMaleWeightPercentExpected)}
                </span>
              </dd>
            </div>
            <div className="tile-subpanel-item">
              <dt>Female Avg</dt>
              <dd className="tile-subpanel-value tile-subpanel-value--accent tile-subpanel-value-inline">
                <span>{formatWeight(placement.latestFemaleWeight)}</span>
                <span className="tile-subpanel-inline-meta">
                  {formatExpectedWeightPercent(placement.latestFemaleWeightPercentExpected)}
                </span>
              </dd>
            </div>
            <div className="tile-subpanel-item">
              <dt>Sample Size</dt>
              <dd className="tile-subpanel-value tile-subpanel-value--accent">
                {formatSampleCount(placement.latestMaleWeightCount)} / {formatSampleCount(placement.latestFemaleWeightCount)}
              </dd>
            </div>
            <div className="tile-subpanel-item">
              <dt>As Of</dt>
              <dd className="tile-subpanel-value tile-subpanel-value--accent">
                {placement.latestMaleWeightDate ?? placement.latestFemaleWeightDate ?? "No scale data yet"}
              </dd>
            </div>
          </dl>
        </section>

      </div>

      <div className="progress-block">
        <div className="progress-copy">
          <span>Today&apos;s packet completion</span>
          <strong>{placement.completionPercent}%</strong>
        </div>
        <div aria-hidden="true" className="progress-track">
          <div className="progress-fill" style={{ width: `${placement.completionPercent}%` }} />
        </div>
      </div>
      {hasFeedProjection ? (
        <div className="tile-feed-action-row">
          <button
            aria-label={`Open 10 day feed requirement for ${placement.placementCode}`}
            className="tile-feed-action-button"
            onClick={() => setShowFeedProjectionPopup(true)}
            type="button"
          >
            <Image alt="" className="tile-feed-action-icon" priority={false} src={feedBinIcon} />
          </button>
        </div>
      ) : null}
      {mortalityPopupMode ? (
        <MortalityPopup
          mode={mortalityPopupMode}
          onClose={() => setMortalityPopupMode(null)}
          placement={placement}
        />
      ) : null}
      {showFeedProjectionPopup ? (
        <FeedProjectionPopup onClose={() => setShowFeedProjectionPopup(false)} placement={placement} />
      ) : null}
      {showCheckoutPopup ? (
        <CheckoutFlockPopup
          feedback={actionState}
          onChangeRemovedDate={setCheckoutRemovedDate}
          onClose={closeCheckoutPopup}
          onConfirm={() => runOperationalAction(checkoutRemovedDate)}
          pending={isPending}
          placement={placement}
          removedDate={checkoutRemovedDate}
        />
      ) : null}
    </article>
  );
}

export function ActivePlacementDashboard({
  breedOptions,
  historyReportLabel,
  placements,
  farmGroups,
  farms,
}: ActivePlacementDashboardProps) {
  const [editingPlacementId, setEditingPlacementId] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [farmGroupId, setFarmGroupId] = useState("all");
  const [farmId, setFarmId] = useState("all");
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>("all");
  const [search, setSearch] = useState("");

  const visibleFarms = useMemo(() => {
    if (farmGroupId === "all") {
      return farms;
    }

    return farms.filter((farm) => farm.farmGroupId === farmGroupId);
  }, [farmGroupId, farms]);

  const filteredPlacements = useMemo(() => {
    return placements.filter((placement) => {
      const matchesFarmGroup = farmGroupId === "all" || placement.farmGroupId === farmGroupId;
      const matchesFarm = farmId === "all" || placement.farmId === farmId;
      const matchesSubmission =
        submissionFilter === "all" || placement.submissionStatus === submissionFilter;
      const normalizedSearch = search.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        placement.placementCode.toLowerCase().includes(normalizedSearch) ||
        placement.farmName.toLowerCase().includes(normalizedSearch) ||
        placement.barnCode.toLowerCase().includes(normalizedSearch) ||
        placement.flockCode.toLowerCase().includes(normalizedSearch);

      return matchesFarmGroup && matchesFarm && matchesSubmission && matchesSearch;
    });
  }, [farmGroupId, farmId, placements, search, submissionFilter]);

  const alertCount = useMemo(
    () =>
      placements.filter(
        (placement) =>
          placement.dashboardStatusTone === "danger" ||
          (placement.dashboardStatusTone === "warn" &&
            !(placement.dashboardStatusLabel === "Awaiting Arrival" && placement.ageDays < -3)),
      ).length,
    [placements],
  );
  const selectedPlacement =
    (selectedPlacementId
      ? placements.find((placement) => placement.placementId === selectedPlacementId) ?? null
      : null);

  return (
    <section className="panel card live-dashboard-panel">
      <div className="live-dashboard-header">
        <div className="live-dashboard-title-block">
          <p className="eyebrow">Live Dashboard</p>
          <div className="live-dashboard-wordmark">
            <span className="flocktrax-wordmark-line">
              <span className="flocktrax-wordmark-brand">FlockTrax</span>
              <span className="flocktrax-wordmark-divider" aria-hidden="true">
                -
              </span>
              <span className="flocktrax-wordmark-product">
                Live
                <sup className="flocktrax-wordmark-tm">TM</sup>
              </span>
            </span>
          </div>
        </div>
        <div className="live-dashboard-summary">
          <span className="live-dashboard-summary-label">Placements with Open Items</span>
          <strong>{alertCount > 0 ? alertCount : "none"}</strong>
        </div>
      </div>

      <div className="filters-grid">
        <div className="field">
          <label htmlFor="overview-farm-group">Farm Group</label>
          <select
            id="overview-farm-group"
            onChange={(event) => {
              setFarmGroupId(event.target.value);
              setFarmId("all");
            }}
            value={farmGroupId}
          >
            <option value="all">All farm groups</option>
            {farmGroups.map((farmGroup) => (
              <option key={farmGroup.id} value={farmGroup.id}>
                {farmGroup.legalName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="overview-farm">Farm</label>
          <select id="overview-farm" onChange={(event) => setFarmId(event.target.value)} value={farmId}>
            <option value="all">All farms</option>
            {visibleFarms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.farmName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="overview-submission">Submission</label>
          <select
            id="overview-submission"
            onChange={(event) => setSubmissionFilter(event.target.value as SubmissionFilter)}
            value={submissionFilter}
          >
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="pending">Pending</option>
            <option value="attention">Needs attention</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="overview-search">Search</label>
          <input
            id="overview-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Farm, barn, placement, or flock"
            type="text"
            value={search}
          />
        </div>
      </div>

      <div className="tile-grid" style={{ marginTop: 22 }}>
        {filteredPlacements.map((placement) => (
          <PlacementTile
            editingPlacementId={editingPlacementId}
            historyReportLabel={historyReportLabel}
            key={placement.id}
            onBeginEdit={setEditingPlacementId}
            onEndEdit={() => setEditingPlacementId(null)}
            onOpenPlacementEditor={setSelectedPlacementId}
            placement={placement}
          />
        ))}
      </div>

      {filteredPlacements.length === 0 ? (
        <div className="helper-banner" style={{ marginTop: 18 }}>
          No barn tiles match the current filter set.
        </div>
      ) : null}
      {selectedPlacement ? (
        <PlacementEditorPopup
          breedOptions={breedOptions}
          historyReportLabel={historyReportLabel}
          onClose={() => setSelectedPlacementId(null)}
          placement={selectedPlacement}
        />
      ) : null}
    </section>
  );
}
