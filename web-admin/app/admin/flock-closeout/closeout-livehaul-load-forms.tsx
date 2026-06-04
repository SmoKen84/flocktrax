"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  saveCloseoutLivehaulStatusAction,
  type CloseoutLivehaulStatusFormState,
} from "@/app/admin/flock-closeout/actions";
import {
  createLivehaulLoadAction,
  deleteLivehaulLoadAction,
  type LivehaulActionState,
  updateLivehaulLoadAction,
} from "@/app/admin/placements/livehaul/actions";
import type { CloseoutLivehaulRow, CloseoutQueueItem } from "@/lib/closeout-data";

const INITIAL_ACTION_STATE: LivehaulActionState = {
  status: "idle",
  message: "",
};

const INITIAL_STATUS_ACTION_STATE: CloseoutLivehaulStatusFormState = {
  status: "idle",
  message: "",
};

export function CloseoutLivehaulLoadsPanel({
  item,
  livehaul,
}: {
  item: CloseoutQueueItem;
  livehaul: CloseoutLivehaulRow;
}) {
  const [showCreateRow, setShowCreateRow] = useState(false);

  return (
    <section className="panel card closeout-loads-panel">
      <div className="closeout-livehaul-header">
        <div>
          <p className="eyebrow">Livehaul Detail</p>
          <h3 className="closeout-livehaul-mainline">
            <span>{item.placementCode}</span>
            <span>{formatLivehaulDay(livehaul.lhDate)}</span>
          </h3>
          <p className="table-subtitle">{`LH${livehaul.sequenceNum ?? "--"} | ${formatStatus(livehaul.status)} | ${formatTargetSex(livehaul.targetSex)} | Target ${formatCount(livehaul.headTarget)} | Actual ${formatCount(livehaul.headActual)}`}</p>
          <CloseoutLivehaulStatusControl item={item} livehaul={livehaul} />
        </div>
        <div className="closeout-livehaul-summary">
          <span className="livehaul-summary-pill">
            <span className="livehaul-summary-pill-label">Loads</span>
            <strong>{livehaul.loadCount.toLocaleString()}</strong>
          </span>
          <span className="livehaul-summary-pill">
            <span className="livehaul-summary-pill-label">Head</span>
            <strong>{livehaul.loadHeadCountTotal.toLocaleString()}</strong>
          </span>
          <span className="livehaul-summary-pill">
            <span className="livehaul-summary-pill-label">Breed</span>
            <strong>{`${formatRatio(livehaul.breedActualAvgWeight)} | ${formatRatio(livehaul.breedExpectedAvgWeight)}`}</strong>
          </span>
          <span className="livehaul-summary-pill">
            <span className="livehaul-summary-pill-label">% Target</span>
            <strong>{formatPercent(livehaul.breedWeightPercent)}</strong>
          </span>
        </div>
      </div>

      <div className="closeout-load-header">
        <p className="closeout-load-title">Loads:</p>
        <button
          className="button-secondary closeout-load-add-button"
          onClick={() => setShowCreateRow((current) => !current)}
          type="button"
        >
          {showCreateRow ? "Close" : "+ Add Load"}
        </button>
      </div>

      <div className="closeout-load-frame">
        <div className="closeout-load-table">
          <div className="closeout-load-row closeout-load-row-head">
            <span>#</span>
            <span>Truck</span>
            <span>Trailer</span>
            <span>Head</span>
            <span>Scale Loc</span>
            <span>Empty</span>
            <span>Loaded</span>
            <span>Live / Avg</span>
            <span>Comment</span>
            <span>Act</span>
          </div>

          {showCreateRow ? (
            <CloseoutLivehaulLoadCreateRow
              item={item}
              livehaul={livehaul}
              onSaved={() => setShowCreateRow(false)}
            />
          ) : null}

          {livehaul.loads.length > 0 ? (
            livehaul.loads.map((load, index) => (
              <CloseoutLivehaulLoadEditorRow
                item={item}
                key={load.loadId}
                livehaul={livehaul}
                load={{
                  id: load.loadId,
                  truckNum: load.truckNum ?? "",
                  trailerNum: load.trailerNum ?? "",
                  headCount: toFormNumber(load.headCount),
                  scaleLocation: load.scaleLocation ?? "",
                  scaleEmpty: toFormNumber(load.scaleEmpty),
                  scaleLoaded: toFormNumber(load.scaleLoaded),
                  liveWeight: toFormNumber(load.liveWeight),
                  comment: load.comment ?? "",
                  doaCount: toFormNumber(load.doaCount),
                }}
                loadIndex={index}
              />
            ))
          ) : (
            <div className="feed-ticket-editor-empty">No loads added yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function CloseoutLivehaulStatusControl({
  item,
  livehaul,
}: {
  item: CloseoutQueueItem;
  livehaul: CloseoutLivehaulRow;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveCloseoutLivehaulStatusAction, INITIAL_STATUS_ACTION_STATE);
  const [selectedStatus, setSelectedStatus] = useState(livehaul.status);

  useEffect(() => {
    setSelectedStatus(livehaul.status);
  }, [livehaul.status]);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="closeout-livehaul-status-form">
      <input name="livehaul_id" type="hidden" value={livehaul.livehaulId} />
      <input name="placement_id" type="hidden" value={item.placementId} />

      <span className="closeout-livehaul-status-label">Status:</span>
      <label className="closeout-livehaul-status-option">
        <input
          checked={selectedStatus === "scheduled"}
          name="status"
          onChange={() => setSelectedStatus("scheduled")}
          type="radio"
          value="scheduled"
        />
        <span>Scheduled</span>
      </label>
      <label className="closeout-livehaul-status-option">
        <input
          checked={selectedStatus === "completed"}
          name="status"
          onChange={() => setSelectedStatus("completed")}
          type="radio"
          value="completed"
        />
        <span>Complete</span>
      </label>
      <label className="closeout-livehaul-status-option">
        <input
          checked={selectedStatus === "cancelled"}
          name="status"
          onChange={() => setSelectedStatus("cancelled")}
          type="radio"
          value="cancelled"
        />
        <span>Canceled</span>
      </label>
      <button className="button-secondary closeout-livehaul-status-save" type="submit">
        Save
      </button>
      {state.status !== "idle" ? (
        <span className="closeout-livehaul-status-feedback" data-tone={state.status === "success" ? "good" : "danger"}>
          {state.status === "success" ? "Saved" : state.message}
        </span>
      ) : null}
    </form>
  );
}

function CloseoutLivehaulLoadCreateRow({
  item,
  livehaul,
  onSaved,
}: {
  item: CloseoutQueueItem;
  livehaul: CloseoutLivehaulRow;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createLivehaulLoadAction, INITIAL_ACTION_STATE);

  useEffect(() => {
    if (state.status === "success") {
      onSaved();
      router.refresh();
    }
  }, [onSaved, router, state.status]);

  return (
    <LoadRowForm
      action={formAction}
      actionLabel={isPending ? "..." : "OK"}
      feedbackState={state}
      hiddenFields={{
        livehaul_id: livehaul.livehaulId,
        placement_id: item.placementId,
        flock_id: item.flockId,
        farm_id: item.farmId,
        barn_id: item.barnId,
        lh_date: livehaul.lhDate,
        doa_count: "",
      }}
      rowLabel="+"
      values={{
        truckNum: "",
        trailerNum: "",
        headCount: "",
        scaleLocation: "",
        scaleEmpty: "",
        scaleLoaded: "",
        liveWeight: "",
        comment: "",
      }}
    />
  );
}

function CloseoutLivehaulLoadEditorRow({
  item,
  livehaul,
  load,
  loadIndex,
}: {
  item: CloseoutQueueItem;
  livehaul: CloseoutLivehaulRow;
  load: {
    id: string;
    truckNum: string;
    trailerNum: string;
    headCount: string;
    scaleLocation: string;
    scaleEmpty: string;
    scaleLoaded: string;
    liveWeight: string;
    comment: string;
    doaCount: string;
  };
  loadIndex: number;
}) {
  const router = useRouter();
  const [updateState, updateAction, updatePending] = useActionState(updateLivehaulLoadAction, INITIAL_ACTION_STATE);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteLivehaulLoadAction, INITIAL_ACTION_STATE);

  useEffect(() => {
    if (updateState.status === "success" || deleteState.status === "success") {
      router.refresh();
    }
  }, [deleteState.status, router, updateState.status]);

  return (
    <div className="closeout-load-row-wrap">
      <LoadRowForm
        action={updateAction}
        actionLabel={updatePending ? "..." : "OK"}
        deleteAction={deleteAction}
        deleteActionLabel={deletePending ? "..." : "X"}
        feedbackState={updateState.status !== "idle" ? updateState : deleteState}
        hiddenFields={{
          load_id: load.id,
          livehaul_id: livehaul.livehaulId,
          placement_id: item.placementId,
          flock_id: item.flockId,
          farm_id: item.farmId,
          barn_id: item.barnId,
          lh_date: livehaul.lhDate,
          doa_count: load.doaCount,
        }}
        rowLabel={String(loadIndex + 1)}
        values={{
          truckNum: load.truckNum,
          trailerNum: load.trailerNum,
          headCount: load.headCount,
          scaleLocation: load.scaleLocation,
          scaleEmpty: load.scaleEmpty,
          scaleLoaded: load.scaleLoaded,
          liveWeight: load.liveWeight,
          comment: load.comment,
        }}
      />
    </div>
  );
}

function LoadRowForm({
  action,
  actionLabel,
  deleteAction,
  deleteActionLabel,
  feedbackState,
  hiddenFields,
  rowLabel,
  values,
}: {
  action: (formData: FormData) => void;
  actionLabel: string;
  deleteAction?: (formData: FormData) => void;
  deleteActionLabel?: string;
  feedbackState: LivehaulActionState;
  hiddenFields: Record<string, string>;
  rowLabel: string;
  values: {
    truckNum: string;
    trailerNum: string;
    headCount: string;
    scaleLocation: string;
    scaleEmpty: string;
    scaleLoaded: string;
    liveWeight: string;
    comment: string;
  };
}) {
  const [scaleEmpty, setScaleEmpty] = useState(values.scaleEmpty);
  const [scaleLoaded, setScaleLoaded] = useState(values.scaleLoaded);
  const [headCount, setHeadCount] = useState(values.headCount);

  useEffect(() => {
    setScaleEmpty(values.scaleEmpty);
    setScaleLoaded(values.scaleLoaded);
    setHeadCount(values.headCount);
  }, [values.headCount, values.scaleEmpty, values.scaleLoaded]);

  const derivedLiveWeight = deriveLiveWeight(scaleEmpty, scaleLoaded);
  const liveWeightValue = derivedLiveWeight ?? values.liveWeight;
  const avgHeadWeight = deriveAverageHeadWeight(liveWeightValue, headCount);
  const liveAvgDisplay = formatLiveAvg(liveWeightValue, avgHeadWeight);

  return (
    <form action={action} className="closeout-load-row-form">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}

      {feedbackState.status !== "idle" ? (
        <div className="placement-scheduler-feedback closeout-load-feedback" data-tone={feedbackState.status === "success" ? "good" : "danger"}>
          <span className="status-pill" data-tone={feedbackState.status === "success" ? "good" : "danger"}>
            {feedbackState.status === "success" ? "Saved" : "Error"}
          </span>
          <p>{feedbackState.message}</p>
        </div>
      ) : null}

      <div className="closeout-load-row">
        <span className="feed-ticket-editor-ordinal closeout-load-ordinal">{rowLabel}</span>
        <input defaultValue={values.truckNum} maxLength={4} name="truck_num" />
        <input defaultValue={values.trailerNum} maxLength={4} name="trailer_num" />
        <input maxLength={4} name="head_count" onChange={(event) => setHeadCount(event.target.value)} type="number" value={headCount} />
        <input defaultValue={values.scaleLocation} maxLength={4} name="scale_location" />
        <input name="scale_empty" onChange={(event) => setScaleEmpty(event.target.value)} type="number" value={scaleEmpty} />
        <input name="scale_loaded" onChange={(event) => setScaleLoaded(event.target.value)} type="number" value={scaleLoaded} />
        <div className="closeout-load-live-cell">
          <input readOnly type="text" value={liveAvgDisplay} />
          <input name="live_weight" type="hidden" value={liveWeightValue} />
        </div>
        <input defaultValue={values.comment} name="comment" type="text" />
        <div className="closeout-load-action-group">
          <button
            aria-label="Save load"
            className="button-secondary closeout-load-action closeout-load-icon-button"
            title="Save load"
            type="submit"
          >
            {actionLabel}
          </button>
          {deleteAction ? (
            <button
              aria-label="Delete load"
              className="feed-ticket-editor-remove closeout-load-remove"
              formAction={deleteAction}
              title="Delete load"
              type="submit"
            >
              {deleteActionLabel ?? "X"}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function deriveLiveWeight(scaleEmpty: string, scaleLoaded: string) {
  const empty = Number(scaleEmpty);
  const loaded = Number(scaleLoaded);
  if (!Number.isFinite(empty) || !Number.isFinite(loaded)) {
    return null;
  }
  return String(Math.max(0, loaded - empty));
}

function deriveAverageHeadWeight(liveWeight: string, headCount: string) {
  const live = Number(liveWeight);
  const head = Number(headCount);
  if (!Number.isFinite(live) || !Number.isFinite(head) || head <= 0) {
    return null;
  }
  return (live / head).toFixed(2);
}

function formatLiveAvg(liveWeight: string, averageHeadWeight: string | null) {
  const weight = liveWeight.trim();
  if (!weight) {
    return "";
  }
  return averageHeadWeight ? `${weight} (${averageHeadWeight})` : weight;
}

function toFormNumber(value: number | null) {
  return value === null || Number.isNaN(value) ? "" : String(value);
}

function formatStatus(value: string) {
  if (value === "legacy_migrated") return "Legacy Migrated";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLivehaulDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).toUpperCase();
}

function formatCount(value: number | null) {
  if (value === null || Number.isNaN(value)) return "TBD";
  return value.toLocaleString();
}

function formatRatio(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatTargetSex(value: "male" | "female" | null) {
  if (value === "male") return "Roo";
  if (value === "female") return "Hen";
  return "Open / Mixed";
}
