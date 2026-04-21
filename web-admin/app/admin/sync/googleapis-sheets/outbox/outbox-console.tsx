"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import {
  processGoogleSheetsOutboxAction,
  retryGoogleSheetsOutboxAction,
  retryGoogleSheetsOutboxBulkAction,
  type OutboxActionResult,
} from "@/app/admin/sync/googleapis-sheets/actions";
import { OutboxRefreshButton } from "@/app/admin/sync/googleapis-sheets/outbox/outbox-refresh-button";
import { OutboxTable } from "@/app/admin/sync/googleapis-sheets/outbox/outbox-table";
import type {
  GoogleSheetsCurrentOperation,
  GoogleSheetsOutboxFilters,
  GoogleSheetsOutboxRecord,
  GoogleSheetsOutboxStats,
} from "@/lib/sync-data";

type OutboxConsoleProps = {
  currentOperation: GoogleSheetsCurrentOperation;
  filters: Required<GoogleSheetsOutboxFilters>;
  initialBanner: { tone: "success" | "error"; message: string } | null;
  items: GoogleSheetsOutboxRecord[];
  stats: GoogleSheetsOutboxStats;
};

export function OutboxConsole({ currentOperation, filters, initialBanner, items, stats }: OutboxConsoleProps) {
  const router = useRouter();
  const [batchSize, setBatchSize] = useState("10");
  const [banner, setBanner] = useState(initialBanner);
  const [processPending, setProcessPending] = useState(false);
  const [bulkRetryPending, setBulkRetryPending] = useState(false);
  const [rowRetryId, setRowRetryId] = useState<string | null>(null);
  const refreshTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    setBanner(initialBanner);
  }, [initialBanner]);

  useEffect(() => {
    return () => {
      for (const timeoutId of refreshTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  function queueSettlingRefresh() {
    for (const timeoutId of refreshTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }

    refreshTimeoutsRef.current = [800, 2200, 4500].map((delay) =>
      window.setTimeout(() => {
        startTransition(() => {
          router.refresh();
        });
      }, delay),
    );
  }

  async function runProcessOutbox() {
    setProcessPending(true);
    const limit = Number.parseInt(batchSize, 10);
    const result = await processGoogleSheetsOutboxAction(Number.isFinite(limit) ? limit : 10);
    setBanner({
      tone: result.ok ? "success" : "error",
      message: result.message,
    });
    setProcessPending(false);

    startTransition(() => {
      router.refresh();
    });
    queueSettlingRefresh();
  }

  async function runBulkRetry() {
    setBulkRetryPending(true);
    const result = await retryGoogleSheetsOutboxBulkAction(filters);
    setBanner({
      tone: result.ok ? "success" : "error",
      message: result.message,
    });
    setBulkRetryPending(false);

    startTransition(() => {
      router.refresh();
    });
  }

  async function runRowRetry(outboxId: string) {
    setRowRetryId(outboxId);
    const result = await retryGoogleSheetsOutboxAction(outboxId);
    setBanner({
      tone: result.ok ? "success" : "error",
      message: result.message,
    });
    setRowRetryId(null);

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <>
      <div className="sync-engine-hero-card sync-engine-hero-card-wide">
        <div className="sync-engine-hero-card-top">
          <div className="sync-engine-hero-intro">
            <p className="sync-engine-hero-label">Queue Stats</p>
            <div className="sync-engine-hero-total-row">
              <strong>{stats.total}</strong>
              <span>Total outbox rows across pending, in-progress, sent, failed, and rejected work.</span>
            </div>
          </div>
          <div className="sync-outbox-top-actions">
            <div className="sync-outbox-process-form">
              <label className="sync-outbox-process-field">
                <span>Batch Size</span>
                <input
                  disabled={processPending}
                  max="100"
                  min="1"
                  onChange={(event) => setBatchSize(event.target.value)}
                  type="number"
                  value={batchSize}
                />
              </label>
              <button className="button" disabled={processPending} onClick={runProcessOutbox} type="button">
                {processPending ? "Starting..." : "Process Outbox"}
              </button>
            </div>
            <button className="button-secondary" disabled={bulkRetryPending} onClick={runBulkRetry} type="button">
              {bulkRetryPending ? "Retrying..." : bulkRetryLabel(filters.status)}
            </button>
            <OutboxRefreshButton />
          </div>
        </div>

        <p className={`sync-engine-banner ${currentOperation.item ? "sync-engine-banner-live" : "sync-engine-banner-neutral"}`}>
          {formatCurrentOperationBanner(currentOperation.item, currentOperation.totalInProgress)}
        </p>

        <div className="sync-outbox-stat-grid">
          <div className="sync-outbox-stat-card" data-tone="pending">
            <span>Pending</span>
            <strong>{stats.pending}</strong>
          </div>
          <div className="sync-outbox-stat-card" data-tone="warn">
            <span>In Progress</span>
            <strong>{stats.inProgress}</strong>
          </div>
          <div className="sync-outbox-stat-card" data-tone="danger">
            <span>Failed</span>
            <strong>{stats.failed}</strong>
          </div>
          <div className="sync-outbox-stat-card" data-tone="good">
            <span>Sent</span>
            <strong>{stats.sent}</strong>
          </div>
          <div className="sync-outbox-stat-card" data-tone="neutral">
            <span>Rejected</span>
            <strong>{stats.rejected}</strong>
          </div>
        </div>

        {banner ? (
          <p className={`sync-engine-banner ${banner.tone === "error" ? "sync-engine-banner-error" : "sync-engine-banner-success"}`}>
            {banner.message}
          </p>
        ) : null}
      </div>

      <OutboxTable items={items} onRetry={runRowRetry} retryingOutboxId={rowRetryId} />
    </>
  );
}

function bulkRetryLabel(status: string | null) {
  if (status === "failed") {
    return "Retry Failed";
  }

  if (status === "rejected") {
    return "Retry Rejected";
  }

  return "Retry Failed/Rejected";
}

function formatCurrentOperationBanner(
  item: GoogleSheetsCurrentOperation["item"],
  totalInProgress: number,
) {
  if (!item) {
    return "Current operation: no queue job is actively in progress right now.";
  }

  const remainingCount = Math.max(totalInProgress - 1, 0);
  const details = [
    item.farmName,
    item.placementKey,
    item.entityType,
    item.logDate ? `for ${item.logDate}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (remainingCount > 0) {
    return `Current operation: processing ${details}. ${remainingCount} more in-progress ${remainingCount === 1 ? "job is" : "jobs are"} active behind it.`;
  }

  return `Current operation: processing ${details}.`;
}
