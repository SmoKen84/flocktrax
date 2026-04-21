"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { ActivityLogRecord } from "@/lib/types";

type ActivityLogTableProps = {
  entries: ActivityLogRecord[];
};

type ActiveLogField = {
  label: string;
  value: string;
};

export function ActivityLogTable({ entries }: ActivityLogTableProps) {
  const [activeField, setActiveField] = useState<ActiveLogField | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="table-wrap activity-log-table-wrap">
        <table className="activity-log-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Farm</th>
              <th>Barn</th>
              <th>Flock</th>
              <th>Type</th>
              <th>Details</th>
              <th>User</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {entries.length > 0 ? (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <div className="activity-log-when">
                      <span>{formatActivityDate(entry.occurredAt)}</span>
                      <span>{formatActivityTime(entry.occurredAt)}</span>
                    </div>
                  </td>
                  <td>{entry.farmName ?? "Unknown Farm"}</td>
                  <td>{entry.barnCode ?? "Unknown Barn"}</td>
                  <td>{entry.placementCode ?? "No flock linked"}</td>
                  <td>
                    <span className="status-pill" data-tone={toneForEntryType(entry.entryType)}>
                      {entry.entryType}
                    </span>
                  </td>
                  <td>
                    <button
                      className="activity-log-details-button"
                      onClick={() =>
                        setActiveField({
                          label: entry.actionKey,
                          value: entry.details || entry.actionKey,
                        })}
                      type="button"
                    >
                      <p className="table-title activity-log-details-clamp">{entry.details || entry.actionKey}</p>
                      <p className="table-subtitle">{entry.actionKey}</p>
                    </button>
                  </td>
                  <td>
                    <button
                      className="activity-log-details-button"
                      onClick={() =>
                        setActiveField({
                          label: "User",
                          value: entry.userName ?? "System",
                        })}
                      type="button"
                    >
                      <span className="activity-log-user-clamp">{entry.userName ?? "System"}</span>
                    </button>
                  </td>
                  <td>
                    <button
                      className="activity-log-details-button"
                      onClick={() =>
                        setActiveField({
                          label: "Source",
                          value: entry.source ?? "Unknown",
                        })}
                      type="button"
                    >
                      <span className="activity-log-source-clamp">{entry.source ?? "Unknown"}</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <p className="table-subtitle">No activity entries have been recorded yet.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mounted && activeField
        ? createPortal(
            <div className="sync-outbox-modal-shell" onClick={() => setActiveField(null)} role="presentation">
              <div
                aria-labelledby="activity-log-modal-title"
                aria-modal="true"
                className="sync-outbox-modal-panel"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="sync-outbox-modal-header">
                  <div>
                    <p className="eyebrow">Activity Log</p>
                    <h3 id="activity-log-modal-title">{activeField.label}</h3>
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

function toneForEntryType(entryType: string) {
  const normalized = entryType.trim().toLowerCase();

  if (normalized === "state_change") {
    return "warn";
  }

  if (normalized === "comment") {
    return "good";
  }

  return "neutral";
}

function formatActivityDate(value: string) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" });
  const month = date.toLocaleDateString("en-US", { month: "numeric", timeZone: "America/Chicago" });
  const day = date.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Chicago" });
  const year = date.toLocaleDateString("en-US", { year: "2-digit", timeZone: "America/Chicago" });

  return `${weekday} ${month}/${day}/${year}`;
}

function formatActivityTime(value: string) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Chicago",
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const tenths = Math.floor(date.getMilliseconds() / 100);

  return `${get("hour")}:${get("minute")}:${get("second")}.${tenths}`;
}
