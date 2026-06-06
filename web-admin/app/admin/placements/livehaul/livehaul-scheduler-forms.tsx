"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createLivehaulScheduleAction,
  deleteLivehaulScheduleAction,
  type LivehaulActionState,
  updateLivehaulScheduleAction,
} from "@/app/admin/placements/livehaul/actions";
import type { LivehaulScheduleRow, LivehaulSchedulerPlacement } from "@/lib/livehaul-scheduler-data";

const INITIAL_ACTION_STATE: LivehaulActionState = {
  status: "idle",
  message: "",
};

export function LivehaulCreateForm({
  barnCode,
  farmId,
  barnId,
  existingSchedules,
  month,
  returnHref,
  selectedDate,
  placements,
  selectedPlacementId,
}: {
  barnCode: string;
  farmId: string;
  barnId: string;
  existingSchedules: LivehaulScheduleRow[];
  month: string;
  returnHref: string;
  selectedDate: string;
  placements: LivehaulSchedulerPlacement[];
  selectedPlacementId: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createLivehaulScheduleAction, INITIAL_ACTION_STATE);
  const [placementId, setPlacementId] = useState(selectedPlacementId);
  const [lhDate, setLhDate] = useState(selectedDate);
  const [targetSex, setTargetSex] = useState("");
  const [headTarget, setHeadTarget] = useState("");
  const selectedPlacement =
    placements.find((placement) => placement.id === placementId) ??
    placements.find((placement) => placement.id === selectedPlacementId) ??
    placements[0] ??
    null;
  const nextSequenceValue = (() => {
    if (!selectedPlacement) {
      return "1";
    }

    const maxSequence = existingSchedules
      .filter((row) => row.placementId === selectedPlacement.id)
      .reduce<number>((max, row) => {
        const value = row.sequenceNum ?? 0;
        return Math.max(max, value);
      }, 0);

    return String(maxSequence + 1);
  })();
  const [sequenceNum, setSequenceNum] = useState(nextSequenceValue);

  useEffect(() => {
    setPlacementId(selectedPlacementId);
  }, [selectedPlacementId]);

  useEffect(() => {
    setLhDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setSequenceNum(nextSequenceValue);
    setTargetSex("");
    setHeadTarget("");
  }, [nextSequenceValue, placementId, selectedDate]);

  useEffect(() => {
    if (state.status === "success") {
      router.push(returnHref);
    }
  }, [returnHref, router, state.status]);

  return (
    <form action={formAction} className="placement-scheduler-form">
      <input name="farm_id" type="hidden" value={farmId} />
      <input name="barn_id" type="hidden" value={barnId} />
      <input name="month" type="hidden" value={month} />

      <div className="helper-banner">
        {`Schedule an additional livehaul for barn ${barnCode} on ${selectedDate}. This is designed to flex past 3 nights when the flock needs a 4th haul.`}
      </div>

      {state.status !== "idle" ? (
        <div className="placement-scheduler-feedback" data-tone={state.status === "success" ? "good" : "danger"}>
          <span className="status-pill" data-tone={state.status === "success" ? "good" : "danger"}>
            {state.status === "success" ? "Saved" : "Error"}
          </span>
          <p>{state.message}</p>
        </div>
      ) : null}

      <div className="form-grid">
        <label className="field">
          <span>Flock / Placement</span>
          <select
            name="placement_id"
            onChange={(event) => setPlacementId(event.target.value)}
            value={placementId}
            required
          >
            {placements.map((placement) => (
              <option key={placement.id} value={placement.id}>
                {`Flock ${placement.placementCode} | ${formatStage(placement.lifecycleStage)}`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input name="lh_date" onChange={(event) => setLhDate(event.target.value)} type="date" value={lhDate} required />
        </label>
        {selectedPlacement ? (
          <div className="field-note field-note-wide">
            {`Selected: flock ${selectedPlacement.flockCode}, placement ${selectedPlacement.placementCode}, ${formatStage(selectedPlacement.lifecycleStage)}`}
          </div>
        ) : null}
        <label className="field">
          <span>Sequence</span>
          <input name="sequence_num" onChange={(event) => setSequenceNum(event.target.value)} type="number" min="1" value={sequenceNum} />
        </label>
        <label className="field">
          <span>Target Sex</span>
          <select name="target_sex" onChange={(event) => setTargetSex(event.target.value)} value={targetSex}>
            <option value="">Open / Mixed</option>
            <option value="male">Roo</option>
            <option value="female">Hen</option>
          </select>
        </label>
        <label className="field">
          <span>Target Head</span>
          <input name="head_target" onChange={(event) => setHeadTarget(event.target.value)} type="number" min="0" value={headTarget} />
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue="scheduled">
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="legacy_migrated">Legacy Migrated</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Comment</span>
        <textarea name="comment" rows={3} placeholder="Optional planning note, change reason, or catch expectation." />
      </label>

      <button className="button" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Add Livehaul"}
      </button>
    </form>
  );
}

export function LivehaulScheduleEditor({ returnHref, month, row }: { returnHref: string; month: string; row: LivehaulScheduleRow }) {
  const router = useRouter();
  const [updateState, updateAction, updatePending] = useActionState(updateLivehaulScheduleAction, INITIAL_ACTION_STATE);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteLivehaulScheduleAction, INITIAL_ACTION_STATE);

  useEffect(() => {
    if (updateState.status === "success" || deleteState.status === "success") {
      router.push(returnHref);
    }
  }, [deleteState.status, returnHref, router, updateState.status]);

  return (
    <div className="placement-scheduler-window-card">
      <form action={updateAction} className="placement-scheduler-form">
        <input name="livehaul_id" type="hidden" value={row.livehaulId} />
        <input name="placement_id" type="hidden" value={row.placementId} />
        <input name="flock_id" type="hidden" value={row.flockId} />
        <input name="farm_id" type="hidden" value={row.farmId} />
        <input name="barn_id" type="hidden" value={row.barnId} />
        <input name="month" type="hidden" value={month} />

        {(updateState.status !== "idle" || deleteState.status !== "idle") ? (
          <div
            className="placement-scheduler-feedback"
            data-tone={
              updateState.status === "error" || deleteState.status === "error"
                ? "danger"
                : updateState.status === "success" || deleteState.status === "success"
                  ? "good"
                  : "good"
            }
          >
            <span
              className="status-pill"
              data-tone={
                updateState.status === "error" || deleteState.status === "error"
                  ? "danger"
                  : "good"
              }
            >
              {updateState.status === "error" || deleteState.status === "error" ? "Error" : "Saved"}
            </span>
            <p>{updateState.message || deleteState.message}</p>
          </div>
        ) : null}

        <div className="placement-scheduler-identity-row">
          <div className="placement-scheduler-identity-card">
            <span>Placement</span>
            <strong>{row.placementCode}</strong>
          </div>
          <div className="placement-scheduler-identity-card">
            <span>Flock</span>
            <strong>{row.flockCode}</strong>
          </div>
          <div className="placement-scheduler-identity-card placement-scheduler-identity-card-date">
            <span>Status</span>
            <strong>{formatStatus(row.status)}</strong>
          </div>
        </div>

        <div className="placement-scheduler-triplet">
          <label className="field">
            <span>Date</span>
            <input name="lh_date" type="date" defaultValue={row.lhDate} />
          </label>
          <label className="field">
            <span>Sequence</span>
            <input name="sequence_num" type="number" min="1" defaultValue={row.sequenceNum ?? ""} />
          </label>
          <label className="field">
            <span>Actual Date</span>
            <input name="actual_date" type="date" defaultValue={row.actualDate ?? ""} />
          </label>
        </div>

        <div className="placement-scheduler-triplet">
          <label className="field">
            <span>Target Head</span>
            <input name="head_target" type="number" min="0" defaultValue={row.headTarget ?? ""} />
          </label>
          <label className="field">
            <span>Target Sex</span>
            <select name="target_sex" defaultValue={row.targetSex ?? ""}>
              <option value="">Open / Mixed</option>
              <option value="male">Roo</option>
              <option value="female">Hen</option>
            </select>
          </label>
          <label className="field">
            <span>Actual Head</span>
            <input name="head_actual" type="number" min="0" defaultValue={row.headActual ?? ""} />
          </label>
        </div>

        <div className="placement-scheduler-triplet">
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={row.status}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="legacy_migrated">Legacy Migrated</option>
            </select>
          </label>
        </div>

        <div className="field-note field-note-wide">
          Entering an actual date or actual head count will mark this livehaul completed unless you explicitly set another status.
        </div>

        <label className="field">
          <span>Comment</span>
          <textarea name="comment" rows={2} defaultValue={row.comment ?? ""} />
        </label>

        <div className="placement-scheduler-projection">
          <span>Load Summary</span>
          <strong>{`${row.loadCount} load${row.loadCount === 1 ? "" : "s"} recorded`}</strong>
          <p>{`Head ${row.loadHeadCountTotal.toLocaleString()} Â· DOA ${row.loadDoaCountTotal.toLocaleString()}${row.actualAt ? ` Â· Marked ${formatTimestamp(row.actualAt)}` : ""}`}</p>
        </div>

        <div className="placement-scheduler-form-actions">
          <button className="button" disabled={updatePending} type="submit">
            {updatePending ? "Saving..." : "Save Livehaul"}
          </button>
        </div>
      </form>

      <form action={deleteAction}>
        <input name="livehaul_id" type="hidden" value={row.livehaulId} />
        <input name="placement_id" type="hidden" value={row.placementId} />
        <input name="flock_id" type="hidden" value={row.flockId} />
        <input name="farm_id" type="hidden" value={row.farmId} />
        <input name="barn_id" type="hidden" value={row.barnId} />
        <input name="month" type="hidden" value={month} />
        <input name="lh_date" type="hidden" value={row.lhDate} />
        <button className="button-secondary" disabled={deletePending} type="submit">
          {deletePending ? "Deleting..." : "Delete Livehaul"}
        </button>
      </form>
    </div>
  );
}

function formatStatus(value: string) {
  if (value === "legacy_migrated") return "Legacy Migrated";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStage(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
}

