"use client";

import { useActionState, useMemo, useState } from "react";

import {
  savePlacementLogMatrixAction,
} from "@/app/admin/placements/[placementId]/logs/actions";
import {
  INITIAL_PLACEMENT_LOG_MATRIX_STATE,
  type PlacementLogMatrixFormState,
} from "@/app/admin/placements/[placementId]/logs/form-state";
import type { PlacementLogMatrixBundle, PlacementLogMatrixRow } from "@/lib/placement-log-matrix";

const BOOLEAN_OPTIONS = [
  { label: "--", value: "" },
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
];

const ROWS_PER_PAGE = 12;

export function PlacementLogMatrixEditor({ bundle }: { bundle: PlacementLogMatrixBundle }) {
  const [rows, setRows] = useState<PlacementLogMatrixRow[]>(bundle.rows);
  const [newDate, setNewDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [state, formAction, isPending] = useActionState<PlacementLogMatrixFormState, FormData>(
    savePlacementLogMatrixAction,
    INITIAL_PLACEMENT_LOG_MATRIX_STATE,
  );

  const sortedRows = useMemo(
    () => rows.slice().sort((left, right) => left.logDate.localeCompare(right.logDate)),
    [rows],
  );
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const pagedRows = sortedRows.slice(pageStart, pageStart + ROWS_PER_PAGE);

  function updateRow(logDate: string, updater: (row: PlacementLogMatrixRow) => PlacementLogMatrixRow) {
    setRows((current) => current.map((row) => (row.logDate === logDate ? updater(row) : row)));
  }

  function addDate() {
    if (!newDate) {
      return;
    }

    if (newDate < bundle.placedDate || newDate > bundle.rangeEndDate) {
      return;
    }

    setRows((current) => {
      if (current.some((row) => row.logDate === newDate)) {
        return current;
      }

      return [
        ...current,
        {
          logDate: newDate,
          ageDays: deriveAgeDays(newDate, bundle.placedDate),
          hasDaily: false,
          hasMortality: false,
          hasMaleWeight: false,
          hasFemaleWeight: false,
          daily: {
            amTemp: null,
            setTemp: null,
            relHumidity: null,
            outsideTempCurrent: null,
            outsideTempLow: null,
            outsideTempHigh: null,
            waterMeterReading: null,
            minVent: null,
            isOdaOpen: null,
            odaException: null,
            naoh: null,
            comment: null,
          },
          mortality: {
            deadFemale: null,
            deadMale: null,
            cullFemale: null,
            cullMale: null,
            cullFemaleNote: null,
            cullMaleNote: null,
            deadReason: null,
            gradeLitter: null,
            gradeFootpad: null,
            gradeFeathers: null,
            gradeLame: null,
            gradePecking: null,
          },
          weight: {
            male: {
              cntWeighed: null,
              avgWeight: null,
              stddevWeight: null,
              procure: null,
              otherNote: null,
            },
            female: {
              cntWeighed: null,
              avgWeight: null,
              stddevWeight: null,
              procure: null,
              otherNote: null,
            },
          },
        },
      ];
    });

    setCurrentPage(Math.ceil((sortedRows.length + 1) / ROWS_PER_PAGE));
    setNewDate("");
  }

  return (
    <section className="panel card placement-log-matrix-shell">
      <div className="placement-log-matrix-header">
        <div>
          <p className="eyebrow">Placement Log Matrix</p>
          <h2>{`${bundle.placementCode} | ${bundle.farmName} | Barn ${bundle.barnCode}`}</h2>
          <p className="table-subtitle">
            Edit or add missing `log_daily`, `log_mortality`, and `log_weight` entries across the full placement record, then save everything in one commit.
          </p>
        </div>
        <div className="placement-log-matrix-meta">
          <span>{`Range: ${bundle.placedDate} through ${bundle.removedDate ?? bundle.rangeEndDate}`}</span>
          <span>{`Rows: ${sortedRows.length}`}</span>
          <span>{`State: ${formatLifecycleStage(bundle.lifecycleStage)}`}</span>
        </div>
      </div>

      <form action={formAction} className="placement-log-matrix-form">
        <input name="placement_id" type="hidden" value={bundle.placementId} />
        <input name="rows_json" type="hidden" value={JSON.stringify(sortedRows)} />

        <div className="placement-log-matrix-toolbar">
          <label className="field placement-log-matrix-add-field">
            <span className="field-label">Add Date</span>
            <input
              max={bundle.rangeEndDate}
              min={bundle.placedDate}
              onChange={(event) => setNewDate(event.target.value)}
              type="date"
              value={newDate}
            />
          </label>
          <button className="button-secondary" onClick={addDate} type="button">
            Add Date
          </button>
          <div className="placement-log-matrix-toolbar-note">
            Dates only appear automatically when at least one log table already has an entry for that day.
          </div>
        </div>

        <div className="placement-log-matrix-pagination">
          <p className="placement-log-matrix-pagination-copy">
            {sortedRows.length > 0
              ? `Showing rows ${pageStart + 1}-${Math.min(pageStart + ROWS_PER_PAGE, sortedRows.length)} of ${sortedRows.length}`
              : "No matrix rows yet"}
          </p>
          <div className="placement-log-matrix-pagination-actions">
            <button
              className="button-secondary"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              type="button"
            >
              Previous
            </button>
            <span className="placement-log-matrix-pagination-page">{`Page ${safeCurrentPage} of ${totalPages}`}</span>
            <button
              className="button-secondary"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        <div className="placement-log-matrix-table-wrap">
          <table className="placement-log-matrix-table">
            <colgroup>
              <col className="placement-log-matrix-col placement-log-matrix-col--date" />
              <col className="placement-log-matrix-col placement-log-matrix-col--age" />
              <col className="placement-log-matrix-col placement-log-matrix-col--have" />
              <col className="placement-log-matrix-col placement-log-matrix-col--narrow" span={6} />
              <col className="placement-log-matrix-col placement-log-matrix-col--medium" />
              <col className="placement-log-matrix-col placement-log-matrix-col--medium" />
              <col className="placement-log-matrix-col placement-log-matrix-col--narrow" />
              <col className="placement-log-matrix-col placement-log-matrix-col--wide" />
              <col className="placement-log-matrix-col placement-log-matrix-col--medium" />
              <col className="placement-log-matrix-col placement-log-matrix-col--wide" />
              <col className="placement-log-matrix-col placement-log-matrix-col--narrow" span={4} />
              <col className="placement-log-matrix-col placement-log-matrix-col--wide" span={3} />
              <col className="placement-log-matrix-col placement-log-matrix-col--narrow" span={5} />
              <col className="placement-log-matrix-col placement-log-matrix-col--narrow" span={3} />
              <col className="placement-log-matrix-col placement-log-matrix-col--medium" />
              <col className="placement-log-matrix-col placement-log-matrix-col--wide" />
              <col className="placement-log-matrix-col placement-log-matrix-col--narrow" span={3} />
              <col className="placement-log-matrix-col placement-log-matrix-col--medium" />
              <col className="placement-log-matrix-col placement-log-matrix-col--wide" />
            </colgroup>
            <thead>
              <tr className="placement-log-matrix-head-row placement-log-matrix-head-row--top">
                <th className="placement-log-matrix-pin-left-1" rowSpan={2}>Date</th>
                <th className="placement-log-matrix-pin-left-2" rowSpan={2}>Age</th>
                <th className="placement-log-matrix-pin-left-3" rowSpan={2}>Have</th>
                <th className="placement-log-matrix-group placement-log-matrix-group--daily" colSpan={12}>Daily</th>
                <th className="placement-log-matrix-group placement-log-matrix-group--mortality" colSpan={12}>Mortality</th>
                <th className="placement-log-matrix-group placement-log-matrix-group--weight-male" colSpan={5}>Weight Male</th>
                <th className="placement-log-matrix-group placement-log-matrix-group--weight-female" colSpan={5}>Weight Female</th>
              </tr>
              <tr className="placement-log-matrix-head-row placement-log-matrix-head-row--sub">
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">AM</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">Set</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">RH</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">Out</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">Low</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">High</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">Water</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">Min Vent</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">ODA</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">ODA Note</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">NaOH</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--daily">Comment</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Dead F</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Dead M</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Cull F</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Cull M</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Cull F Note</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Cull M Note</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Dead Reason</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Litter</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Footpad</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Feathers</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Lame</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--mortality">Pecking</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-male">Cnt</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-male">Avg</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-male">StdDev</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-male">Procure</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-male">Note</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-female">Cnt</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-female">Avg</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-female">StdDev</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-female">Procure</th>
                <th className="placement-log-matrix-subgroup placement-log-matrix-subgroup--weight-female">Note</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length > 0 ? (
                pagedRows.map((row) => (
                  <tr key={row.logDate}>
                    <td className="placement-log-matrix-date-cell">{row.logDate}</td>
                    <td className="placement-log-matrix-sticky-cell placement-log-matrix-sticky-cell--age">{row.ageDays ?? "--"}</td>
                    <td className="placement-log-matrix-sticky-cell placement-log-matrix-sticky-cell--have">{presenceLabel(row)}</td>
                    <td>{renderNumberInput(row.daily.amTemp, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, amTemp: value } })))}</td>
                    <td>{renderNumberInput(row.daily.setTemp, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, setTemp: value } })))}</td>
                    <td>{renderNumberInput(row.daily.relHumidity, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, relHumidity: value } })))}</td>
                    <td>{renderNumberInput(row.daily.outsideTempCurrent, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, outsideTempCurrent: value } })))}</td>
                    <td>{renderNumberInput(row.daily.outsideTempLow, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, outsideTempLow: value } })))}</td>
                    <td>{renderNumberInput(row.daily.outsideTempHigh, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, outsideTempHigh: value } })))}</td>
                    <td>{renderNumberInput(row.daily.waterMeterReading, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, waterMeterReading: value } })))}</td>
                    <td>{renderTextInput(row.daily.minVent, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, minVent: value } })))}</td>
                    <td>{renderBooleanSelect(row.daily.isOdaOpen, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, isOdaOpen: value } })))}</td>
                    <td>{renderTextInput(row.daily.odaException, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, odaException: value } })))}</td>
                    <td>{renderTextInput(row.daily.naoh, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, naoh: value } })))}</td>
                    <td>{renderTextInput(row.daily.comment, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, daily: { ...current.daily, comment: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.deadFemale, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, deadFemale: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.deadMale, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, deadMale: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.cullFemale, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, cullFemale: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.cullMale, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, cullMale: value } })))}</td>
                    <td>{renderTextInput(row.mortality.cullFemaleNote, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, cullFemaleNote: value } })))}</td>
                    <td>{renderTextInput(row.mortality.cullMaleNote, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, cullMaleNote: value } })))}</td>
                    <td>{renderTextInput(row.mortality.deadReason, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, deadReason: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.gradeLitter, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, gradeLitter: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.gradeFootpad, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, gradeFootpad: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.gradeFeathers, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, gradeFeathers: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.gradeLame, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, gradeLame: value } })))}</td>
                    <td>{renderNumberInput(row.mortality.gradePecking, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, mortality: { ...current.mortality, gradePecking: value } })))}</td>
                    <td>{renderNumberInput(row.weight.male.cntWeighed, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, male: { ...current.weight.male, cntWeighed: value } } })))}</td>
                    <td>{renderNumberInput(row.weight.male.avgWeight, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, male: { ...current.weight.male, avgWeight: value } } })))}</td>
                    <td>{renderNumberInput(row.weight.male.stddevWeight, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, male: { ...current.weight.male, stddevWeight: value } } })))}</td>
                    <td>{renderNumberInput(row.weight.male.procure, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, male: { ...current.weight.male, procure: value } } })))}</td>
                    <td>{renderTextInput(row.weight.male.otherNote, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, male: { ...current.weight.male, otherNote: value } } })))}</td>
                    <td>{renderNumberInput(row.weight.female.cntWeighed, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, female: { ...current.weight.female, cntWeighed: value } } })))}</td>
                    <td>{renderNumberInput(row.weight.female.avgWeight, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, female: { ...current.weight.female, avgWeight: value } } })))}</td>
                    <td>{renderNumberInput(row.weight.female.stddevWeight, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, female: { ...current.weight.female, stddevWeight: value } } })))}</td>
                    <td>{renderNumberInput(row.weight.female.procure, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, female: { ...current.weight.female, procure: value } } })))}</td>
                    <td>{renderTextInput(row.weight.female.otherNote, isPending, (value) => updateRow(row.logDate, (current) => ({ ...current, weight: { ...current.weight, female: { ...current.weight.female, otherNote: value } } })))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="placement-log-matrix-empty" colSpan={37}>
                    No existing log dates were found for this placement yet. Use Add Date to start the first correction row.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="placement-log-matrix-footer">
          <div className="placement-log-matrix-footer-copy">
          {state.status !== "idle" ? (
            <div className="placement-scheduler-feedback" data-tone={state.status === "success" ? "good" : "danger"}>
              <span className="status-pill" data-tone={state.status === "success" ? "good" : "danger"}>
                {state.status === "success" ? "Saved" : "Error"}
              </span>
              <p>{state.message}</p>
            </div>
          ) : (
            <p className="table-subtitle">
              Blank values on existing rows will be submitted back as `null`, allowing the Google Sheets outbox to send a clearing update instead of deleting the date.
            </p>
          )}
          </div>

          <div className="placement-log-matrix-footer-actions">
            <div className="placement-log-matrix-pagination placement-log-matrix-pagination--footer">
              <p className="placement-log-matrix-pagination-copy">{`Page ${safeCurrentPage} of ${totalPages}`}</p>
              <div className="placement-log-matrix-pagination-actions">
                <button
                  className="button-secondary"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="button-secondary"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>

            <button className="button" disabled={isPending} type="submit">
              {isPending ? "Saving All..." : "Save All Changes"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function renderNumberInput(
  value: number | null,
  disabled: boolean,
  onChange: (value: number | null) => void,
) {
  return (
    <input
      className="placement-log-matrix-input"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value.trim() ? Number(event.target.value) : null)}
      step="0.01"
      type="number"
      value={value ?? ""}
    />
  );
}

function renderTextInput(
  value: string | null,
  disabled: boolean,
  onChange: (value: string | null) => void,
) {
  return (
    <input
      className="placement-log-matrix-input"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value.trim() ? event.target.value : null)}
      type="text"
      value={value ?? ""}
    />
  );
}

function renderBooleanSelect(
  value: boolean | null,
  disabled: boolean,
  onChange: (value: boolean | null) => void,
) {
  return (
    <select
      className="placement-log-matrix-select"
      disabled={disabled}
      onChange={(event) => {
        if (!event.target.value) {
          onChange(null);
          return;
        }
        onChange(event.target.value === "true");
      }}
      value={value === null ? "" : value ? "true" : "false"}
    >
      {BOOLEAN_OPTIONS.map((option) => (
        <option key={option.value || "blank"} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function presenceLabel(row: PlacementLogMatrixRow) {
  const parts: string[] = [];
  if (row.hasDaily) parts.push("D");
  if (row.hasMortality) parts.push("M");
  if (row.hasMaleWeight || row.hasFemaleWeight) parts.push("W");
  return parts.length > 0 ? parts.join("/") : "New";
}

function deriveAgeDays(logDate: string, placedDate: string) {
  const log = new Date(`${logDate}T00:00:00Z`);
  const placed = new Date(`${placedDate}T00:00:00Z`);
  if (Number.isNaN(log.getTime()) || Number.isNaN(placed.getTime())) {
    return null;
  }

  return Math.round((log.getTime() - placed.getTime()) / 86400000);
}

function formatLifecycleStage(value: string) {
  if (value === "in_barn_growing") return "In Barn";
  if (value === "awaiting_arrival") return "Awaiting Arrival";
  if (value === "waiting_closeout") return "Waiting Closeout";
  if (value === "closeout_submitted") return "Closeout Submitted";
  return value.replace(/[_-]+/g, " ");
}
