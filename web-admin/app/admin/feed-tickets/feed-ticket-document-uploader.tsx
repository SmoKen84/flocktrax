"use client";

import { useActionState, useEffect } from "react";

import {
  type FeedTicketDocumentActionState,
  uploadFeedTicketOriginalAction,
} from "@/app/admin/feed-tickets/actions";

const INITIAL_STATE: FeedTicketDocumentActionState = {
  status: "idle",
  message: "",
};

export function FeedTicketDocumentUploader({
  ticketId,
  ticketNumber,
  onClose,
  onSaved,
}: {
  ticketId: string;
  ticketNumber: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, isPending] = useActionState(uploadFeedTicketOriginalAction, INITIAL_STATE);

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
            <h3 className="section-title">{ticketNumber?.trim() || "Feed Ticket"}</h3>
            <p className="table-subtitle">Archive the original PDF or field image for one-click audit retrieval.</p>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form action={formAction} className="feed-ticket-doc-form">
          <input name="feed_ticket_id" type="hidden" value={ticketId} />

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
            <textarea name="notes" placeholder="Optional audit note or scan context" rows={3} />
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
