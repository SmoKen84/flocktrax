"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import type { GoogleSheetsOutboxRecord } from "@/lib/sync-data";

type OutboxTableProps = {
  items: GoogleSheetsOutboxRecord[];
  onRetry: (outboxId: string) => Promise<void>;
  retryingOutboxId: string | null;
};

type ActiveOutboxField = {
  label: string;
  value: string;
};

export function OutboxTable({ items, onRetry, retryingOutboxId }: OutboxTableProps) {
  const [activeField, setActiveField] = useState<ActiveOutboxField | null>(null);
  const [mounted, setMounted] = useState(false);
  const normalizedItems = useMemo(() => items, [items]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="sync-outbox-table-wrap">
        <table className="sync-outbox-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Farm</th>
              <th>Endpoint</th>
              <th>Placement</th>
              <th>Log Date</th>
              <th>Entity</th>
              <th>Requested</th>
              <th>Attempts</th>
              <th>Last Error</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {normalizedItems.length > 0 ? (
              normalizedItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="status-pill" data-tone={statusTone(item.status)}>
                      {item.status}
                    </span>
                  </td>
                  <td>{renderFieldButton("Farm", item.farmName ?? "Unknown farm", setActiveField)}</td>
                  <td>
                    {renderFieldButton(
                      "Endpoint",
                      [item.endpointName, item.spreadsheetName ?? item.spreadsheetId ?? "Workbook pending"].join("\n"),
                      setActiveField,
                      <span className="sync-outbox-inline-summary">{truncateText(item.endpointName, 12)}</span>,
                    )}
                  </td>
                  <td>
                    {renderFieldButton(
                      "Placement",
                      [item.placementKey ?? "No placement key", item.operation].join("\n"),
                      setActiveField,
                      <div className="sync-outbox-cell-stack">
                        <strong>{item.placementKey ?? "No placement key"}</strong>
                        <span>{item.operation}</span>
                      </div>,
                    )}
                  </td>
                  <td>{renderFieldButton("Log Date", item.logDate ?? "n/a", setActiveField)}</td>
                  <td>{renderFieldButton("Entity", item.entityType, setActiveField)}</td>
                  <td>{renderFieldButton("Requested", formatTimestamp(item.requestedAt), setActiveField)}</td>
                  <td>{renderFieldButton("Attempts", String(item.attempts), setActiveField)}</td>
                  <td>
                    {renderFieldButton(
                      "Last Error",
                      item.lastError ?? "OK",
                      setActiveField,
                      <span className="sync-outbox-truncated-text">{item.lastError ?? "OK"}</span>,
                    )}
                  </td>
                  <td>
                    {canRetry(item.status) ? (
                      <button
                        className="button-secondary"
                        disabled={retryingOutboxId === item.id}
                        onClick={() => void onRetry(item.id)}
                        type="button"
                      >
                        {retryingOutboxId === item.id ? "Retrying..." : "Retry"}
                      </button>
                    ) : (
                      <span className="sync-outbox-action-muted">No action</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="sync-outbox-empty" colSpan={10}>
                  No outbox rows exist yet. Once the worker-facing logs start writing through enabled farm workbooks, this queue will fill here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mounted && activeField
        ? createPortal(
            <div
              className="sync-outbox-modal-shell"
              onClick={() => setActiveField(null)}
              role="presentation"
            >
              <div
                aria-labelledby="sync-outbox-modal-title"
                aria-modal="true"
                className="sync-outbox-modal-panel"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="sync-outbox-modal-header">
                  <div>
                    <p className="eyebrow">Outbox Field</p>
                    <h3 id="sync-outbox-modal-title">{activeField.label}</h3>
                  </div>
                  <button className="button-secondary" onClick={() => setActiveField(null)} type="button">
                    Close
                  </button>
                </div>
                <pre className="sync-outbox-modal-value">{activeField.value}</pre>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function renderFieldButton(
  label: string,
  value: string,
  onOpen: (field: ActiveOutboxField) => void,
  children?: ReactNode,
) {
  return (
    <button
      className="sync-outbox-field-button"
      onClick={() => onOpen({ label, value })}
      type="button"
    >
      {children ?? value}
    </button>
  );
}

function canRetry(status: string) {
  return status === "failed" || status === "rejected";
}

function statusTone(status: string) {
  switch (status) {
    case "sent":
      return "good";
    case "failed":
    case "rejected":
      return "danger";
    case "in_progress":
      return "warn";
    default:
      return "pending";
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}
