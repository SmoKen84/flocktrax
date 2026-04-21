"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  saveGoogleSheetsColumnMapBatchAction,
  type GoogleSheetsColumnMapRowInput,
} from "@/app/admin/sync/googleapis-sheets/columns/actions";
import type { GoogleSheetsColumnMapRecord } from "@/lib/sync-data";

type FarmColumnMapEditorProps = {
  endpointId: string;
  endpointName: string;
  farmName: string;
  farmGroupName: string | null;
  spreadsheetName: string | null;
  spreadsheetId: string | null;
  isEnabled: boolean;
  rows: GoogleSheetsColumnMapRecord[];
};

export function FarmColumnMapEditor({
  endpointId,
  endpointName,
  farmName,
  farmGroupName,
  spreadsheetName,
  spreadsheetId,
  isEnabled,
  rows,
}: FarmColumnMapEditorProps) {
  const router = useRouter();
  const initialRows = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        sheetLabel: row.sheetLabel,
        valueMode: row.valueMode as GoogleSheetsColumnMapRowInput["valueMode"],
        mapState: row.mapState,
        notes: row.notes ?? "",
      })),
    [rows],
  );
  const [draftRows, setDraftRows] = useState<GoogleSheetsColumnMapRowInput[]>(initialRows);
  const [initialSnapshot, setInitialSnapshot] = useState<GoogleSheetsColumnMapRowInput[]>(initialRows);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = JSON.stringify(draftRows) !== JSON.stringify(initialSnapshot);
  const hasPausedRows = draftRows.some((row) => row.mapState === "paused");

  function updateRow(rowId: string, patch: Partial<GoogleSheetsColumnMapRowInput>) {
    setDraftRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
    setFeedback(null);
  }

  function resetDraft() {
    setDraftRows(initialSnapshot);
    setFeedback("Changes cleared.");
  }

  function saveDraft() {
    if (!isDirty || isPending) return;

    startTransition(async () => {
      const result = await saveGoogleSheetsColumnMapBatchAction({
        endpointId,
        rows: draftRows,
      });

      if (!result.ok) {
        setFeedback(`Could not save this farm map. Error key: ${result.error}`);
        return;
      }

      setInitialSnapshot(draftRows);
      setFeedback("Column map saved.");
      router.refresh();
    });
  }

  return (
    <article className="card sync-column-map-card" data-enabled={isEnabled} data-has-paused={hasPausedRows}>
      <div className="sync-engine-card-header">
        <div>
          <p className="settings-card-title">{farmName}</p>
          <p className="access-card-subtitle">{farmGroupName ?? "No farm group assigned"}</p>
        </div>
        <div className="sync-column-map-meta">
          <span className="settings-registry-badge" data-enabled={isEnabled}>
            {isEnabled ? "Enabled" : "Paused"}
          </span>
          <span>{endpointName}</span>
          <span>{spreadsheetName ?? spreadsheetId ?? "Workbook pending"}</span>
        </div>
      </div>

      <div className="sync-column-map-toolbar">
        <div className="sync-column-map-toolbar-copy">
          <strong>{isDirty ? "Unsaved changes" : "Saved"}</strong>
          <span>
            {feedback ??
              "Source is the FlockTrax datapoint. Maps to Sheets Behavior is where you decide the worksheet label, value treatment, and state."}
          </span>
        </div>
        <div className="sync-column-map-toolbar-actions">
          <button className="button-secondary" disabled={!isDirty || isPending} onClick={resetDraft} type="button">
            Undo Changes
          </button>
          <button className="button" disabled={!isDirty || isPending} onClick={saveDraft} type="button">
            {isPending ? "Saving..." : "Save Farm Map"}
          </button>
        </div>
      </div>

      <div className="sync-column-map-list">
        {rows.map((row, index) => {
          const draft = draftRows[index];
          if (!draft) return null;

          return (
            <section className="sync-column-map-row-card" data-state={draft.mapState} key={row.id}>
              <div className="sync-column-map-row-section">
                <p className="sync-column-map-section-title">Source</p>
                <div className="sync-column-map-source">
                  <strong>{row.sourceField}</strong>
                  <span>{[row.sourceTable.replace("public.", ""), row.sourceVariant].filter(Boolean).join(" - ")}</span>
                </div>
              </div>

              <div className="sync-column-map-row-section sync-column-map-row-section-behavior">
                <p className="sync-column-map-section-title">Maps to Sheets Behavior</p>
                <div className="sync-column-map-fields">
                  <label className="sync-engine-field">
                    <span>Worksheet Label</span>
                    <input
                      onChange={(event) => updateRow(row.id, { sheetLabel: event.target.value })}
                      type="text"
                      value={draft.sheetLabel}
                    />
                  </label>
                  <label className="sync-engine-field">
                    <span>Value Mode</span>
                    <select
                      onChange={(event) =>
                        updateRow(row.id, { valueMode: event.target.value as GoogleSheetsColumnMapRowInput["valueMode"] })
                      }
                      value={draft.valueMode}
                    >
                      <option value="direct">Direct</option>
                      <option value="boolean_flag">Boolean Flag</option>
                      <option value="note">Note</option>
                      <option value="derived">Derived</option>
                    </select>
                  </label>
                  <label className="sync-engine-field">
                    <span>State</span>
                    <select
                      onChange={(event) =>
                        updateRow(row.id, { mapState: event.target.value as GoogleSheetsColumnMapRowInput["mapState"] })
                      }
                      value={draft.mapState}
                    >
                      <option value="enabled">Enabled</option>
                      <option value="audit_log_only">Audit Log Only</option>
                      <option value="paused">Paused</option>
                    </select>
                  </label>
                  <label className="sync-engine-field">
                    <span>Notes</span>
                    <input onChange={(event) => updateRow(row.id, { notes: event.target.value })} type="text" value={draft.notes} />
                  </label>
                </div>
                <div className="sync-column-map-state-note" data-state={draft.mapState}>
                  {describeMapState(draft.mapState)}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function describeMapState(state: "enabled" | "audit_log_only" | "paused") {
  switch (state) {
    case "enabled":
      return "Write this datapoint into the worksheet column.";
    case "audit_log_only":
      return "Keep this datapoint only inside FlockTrax history and diary records.";
    default:
      return "Temporarily inactive for both worksheet sync and audit-only intent.";
  }
}
