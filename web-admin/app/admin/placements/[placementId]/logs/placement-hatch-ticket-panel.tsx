"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { PlacementDocumentSummary } from "@/lib/document-archive";
import {
  type PlacementHatchTicketActionState,
  uploadPlacementHatchTicketAction,
} from "@/app/admin/placements/[placementId]/logs/actions";

const INITIAL_STATE: PlacementHatchTicketActionState = {
  status: "idle",
  message: "",
};

export function PlacementHatchTicketPanel({
  placementId,
  placementCode,
  summary,
}: {
  placementId: string;
  placementCode: string;
  summary: PlacementDocumentSummary | null;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <section className="panel card placement-hatch-ticket-panel">
        <div className="placement-hatch-ticket-copy">
          <p className="eyebrow">Document Archive</p>
          <h2>Hatch Ticket Original</h2>
          <p className="table-subtitle">
            Keep the original hatchery ticket linked to this placement for one-click audit retrieval.
          </p>
        </div>

        <div className="placement-hatch-ticket-status">
          {summary?.isOnFile ? (
            <>
              <span className="feed-ticket-doc-status feed-ticket-doc-status-ready">Filed</span>
              <p>{summary.originalFilename || "Original on file"}</p>
              <small>{formatArchiveMeta(summary)}</small>
            </>
          ) : (
            <>
              <span className="feed-ticket-doc-status feed-ticket-doc-status-missing">Missing</span>
              <p>No hatch ticket original is linked yet.</p>
              <small>Archive the hatchery PDF or image to complete the placement record.</small>
            </>
          )}
        </div>

        <div className="placement-hatch-ticket-actions">
          {summary?.documentId ? (
            <a
              className="button-secondary"
              href={`/api/document-archive/${summary.documentId}`}
              rel="noreferrer"
              target="_blank"
            >
              Open Original
            </a>
          ) : null}
          <button className="button" onClick={() => setIsOpen(true)} type="button">
            {summary?.isOnFile ? "Replace Original" : "Archive Hatch Ticket"}
          </button>
        </div>
      </section>

      {isOpen ? (
        <PlacementHatchTicketUploader
          onClose={() => setIsOpen(false)}
          onSaved={() => {
            setIsOpen(false);
            router.refresh();
          }}
          placementCode={placementCode}
          placementId={placementId}
        />
      ) : null}
    </>
  );
}

function PlacementHatchTicketUploader({
  placementId,
  placementCode,
  onClose,
  onSaved,
}: {
  placementId: string;
  placementCode: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, isPending] = useActionState(uploadPlacementHatchTicketAction, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success") {
      onSaved();
    }
  }, [onSaved, state.status]);

  return (
    <div className="feed-ticket-doc-scrim" onClick={onClose}>
      <div className="feed-ticket-doc-card" onClick={(event) => event.stopPropagation()}>
        <div className="feed-ticket-doc-header">
          <div>
            <p className="eyebrow">Document Archive</p>
            <h3 className="section-title">{placementCode}</h3>
            <p className="table-subtitle">Archive the original hatchery PDF or field image for this placement.</p>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form action={formAction} className="feed-ticket-doc-form">
          <input name="placement_id" type="hidden" value={placementId} />

          <label className="feed-ticket-doc-field">
            <span>Source</span>
            <select defaultValue="manual_upload" name="source_kind">
              <option value="scanner_pdf">Scanner PDF</option>
              <option value="manual_upload">Manual Upload</option>
              <option value="mobile_camera">Mobile Camera</option>
              <option value="backfill_import">Backfill Import</option>
            </select>
          </label>

          <label className="feed-ticket-doc-field">
            <span>Original File</span>
            <input accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif" name="document" type="file" />
          </label>

          <label className="feed-ticket-doc-field">
            <span>Notes</span>
            <textarea name="notes" placeholder="Optional hatchery note or scan context" rows={3} />
          </label>

          {state.message ? (
            <p className={state.status === "error" ? "feed-ticket-doc-error" : "feed-ticket-doc-success"}>{state.message}</p>
          ) : null}

          <div className="feed-ticket-doc-actions">
            <button className="button" disabled={isPending} type="submit">
              {isPending ? "Archiving..." : "Archive Original"}
            </button>
            <button className="button-secondary" onClick={onClose} type="button">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatArchiveMeta(summary: PlacementDocumentSummary) {
  const parts = [summary.sourceKind?.replace(/_/g, " ") ?? null, formatShortDateTime(summary.uploadedAt)];
  return parts.filter(Boolean).join(" | ");
}

function formatShortDateTime(value: string | null) {
  if (!value) return null;
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
