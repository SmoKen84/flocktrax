"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type { DocumentArchiveListItem, DocumentArchiveSummary } from "@/lib/document-archive";
import {
  type CloseoutDocumentActionState,
  uploadCloseoutSummarySnapshotAction,
  uploadPlacementMiscDocumentAction,
} from "@/app/admin/flock-closeout/actions";
import {
  type PlacementHatchTicketActionState,
  uploadPlacementHatchTicketAction,
} from "@/app/admin/placements/[placementId]/logs/actions";
import {
  type LivehaulDocumentActionState,
  uploadLivehaulBillOfLadingAction,
} from "@/app/admin/placements/livehaul/actions";

const INITIAL_CLOSEOUT_STATE: CloseoutDocumentActionState = {
  status: "idle",
  message: "",
};

const INITIAL_HATCH_STATE: PlacementHatchTicketActionState = {
  status: "idle",
  message: "",
};

const INITIAL_LIVEHAUL_STATE: LivehaulDocumentActionState = {
  status: "idle",
  message: "",
};

export function CloseoutDocumentChecklist({
  closeoutSummary,
  hatchTicket,
  livehaulPacket,
  miscDocuments,
  placementCode,
  placementId,
  archiveWarning,
}: {
  closeoutSummary: DocumentArchiveSummary | null;
  hatchTicket: DocumentArchiveSummary | null;
  livehaulPacket: DocumentArchiveSummary | null;
  miscDocuments: DocumentArchiveListItem[];
  placementCode: string;
  placementId: string;
  archiveWarning?: string | null;
}) {
  const [modal, setModal] = useState<
    | { kind: "hatch" }
    | { kind: "summary" }
    | { kind: "livehaul" }
    | { kind: "misc" }
    | null
  >(null);

  return (
    <>
      <section className="panel card closeout-document-checklist">
        <div className="closeout-document-checklist-head">
          <div>
            <p className="eyebrow">Document Archive</p>
            <h3>Closeout Document Checklist</h3>
            <p className="table-subtitle">
              Required flock documents live here in one place during closeout. Open filed originals or attach missing ones without leaving this workspace.
            </p>
            {archiveWarning ? <p className="feed-ticket-doc-error">{archiveWarning}</p> : null}
          </div>
        </div>

        <div className="closeout-document-table">
          <div className="closeout-document-row closeout-document-row-head">
            <span>Document</span>
            <span>Status</span>
            <span>Attached File</span>
            <span>Actions</span>
          </div>

          <RequiredDocumentRow
            actionLabel={hatchTicket?.isOnFile ? "Replace" : "Attach"}
            documentLabel="Hatch Ticket"
            onArchive={() => setModal({ kind: "hatch" })}
            summary={hatchTicket}
          />

          <RequiredDocumentRow
            actionLabel={livehaulPacket?.isOnFile ? "Replace" : "Attach"}
            documentLabel="Livehaul Packet"
            note="Combined GPC bill of lading and all included weight tickets for the placement."
            onArchive={() => setModal({ kind: "livehaul" })}
            summary={livehaulPacket}
          />

          <RequiredDocumentRow
            actionLabel={closeoutSummary?.isOnFile ? "Replace" : "Attach"}
            documentLabel="Summary Snapshot"
            onArchive={() => setModal({ kind: "summary" })}
            summary={closeoutSummary}
          />
        </div>

        <div className="closeout-document-misc-block">
          <div className="closeout-document-misc-head">
            <div>
              <strong>Other Documents</strong>
              <p className="table-subtitle">Supporting flock paperwork like declarations, veterinary statements, or inspection support files.</p>
            </div>
            <button className="button-secondary" onClick={() => setModal({ kind: "misc" })} type="button">
              Add Other Doc
            </button>
          </div>

        <div className="closeout-document-misc-listbox">
            {miscDocuments.length > 0 ? (
              <ul>
                {miscDocuments.map((document) => (
                  <li key={document.documentId}>
                    <div className="closeout-document-misc-copy">
                      <strong>{document.title || document.originalFilename || "Supporting Document"}</strong>
                      <small>{document.originalFilename || "Untitled file"}</small>
                    </div>
                    <a className="button-secondary" href={`/api/document-archive/${document.documentId}`} rel="noreferrer" target="_blank">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="table-subtitle">No supporting documents linked yet.</p>
            )}
          </div>
        </div>
      </section>

      {modal?.kind === "hatch" ? (
        <HatchTicketUploader
          onClose={() => setModal(null)}
          placementCode={placementCode}
          placementId={placementId}
        />
      ) : null}
      {modal?.kind === "summary" ? (
        <CloseoutSummaryUploader
          onClose={() => setModal(null)}
          placementCode={placementCode}
          placementId={placementId}
        />
      ) : null}
      {modal?.kind === "livehaul" ? (
        <LivehaulDocumentUploader
          onClose={() => setModal(null)}
          placementCode={placementCode}
          placementId={placementId}
        />
      ) : null}
      {modal?.kind === "misc" ? (
        <MiscDocumentUploader
          onClose={() => setModal(null)}
          placementCode={placementCode}
          placementId={placementId}
        />
      ) : null}
    </>
  );
}

function RequiredDocumentRow({
  actionLabel,
  documentLabel,
  note,
  onArchive,
  summary,
}: {
  actionLabel: string;
  documentLabel: string;
  note?: string | null;
  onArchive: () => void;
  summary: DocumentArchiveSummary | null;
}) {
  return (
    <div className="closeout-document-row">
      <span className="closeout-document-copy">
        <strong>{documentLabel}</strong>
        {note ? <small>{note}</small> : null}
      </span>
      <span>
        <StatusBadge summary={summary} />
      </span>
      <span className="closeout-document-filename">{summary?.originalFilename || "--"}</span>
      <span className="closeout-document-actions">
        {summary?.documentId ? (
          <a className="button-secondary" href={`/api/document-archive/${summary.documentId}`} rel="noreferrer" target="_blank">
            Open
          </a>
        ) : null}
        <button className="button-secondary" onClick={onArchive} type="button">
          {actionLabel}
        </button>
      </span>
    </div>
  );
}

function StatusBadge({ summary }: { summary: DocumentArchiveSummary | null }) {
  return summary?.isOnFile ? (
    <span className="feed-ticket-doc-status feed-ticket-doc-status-ready">Filed</span>
  ) : (
    <span className="feed-ticket-doc-status feed-ticket-doc-status-missing">Missing</span>
  );
}

function HatchTicketUploader({
  placementId,
  placementCode,
  onClose,
}: {
  placementId: string;
  placementCode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(uploadPlacementHatchTicketAction, INITIAL_HATCH_STATE);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onClose();
    }
  }, [onClose, router, state.status]);

  return (
    <ArchiveUploadModal
      action={formAction}
      fileLabel="Hatch Ticket File"
      isPending={isPending}
      onClose={onClose}
      placementCode={placementCode}
      state={state}
      submitLabel="Archive Hatch Ticket"
    >
      <input name="placement_id" type="hidden" value={placementId} />
    </ArchiveUploadModal>
  );
}

function CloseoutSummaryUploader({
  placementId,
  placementCode,
  onClose,
}: {
  placementId: string;
  placementCode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(uploadCloseoutSummarySnapshotAction, INITIAL_CLOSEOUT_STATE);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onClose();
    }
  }, [onClose, router, state.status]);

  return (
    <ArchiveUploadModal
      action={formAction}
      fileLabel="Summary File"
      isPending={isPending}
      onClose={onClose}
      placementCode={placementCode}
      state={state}
      submitLabel="Archive Summary"
    >
      <input name="placement_id" type="hidden" value={placementId} />
    </ArchiveUploadModal>
  );
}

function LivehaulDocumentUploader({
  placementId,
  placementCode,
  onClose,
}: {
  placementId: string;
  placementCode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(uploadLivehaulBillOfLadingAction, INITIAL_LIVEHAUL_STATE);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onClose();
    }
  }, [onClose, router, state.status]);

  return (
    <ArchiveUploadModal
      action={formAction}
      fileLabel="Livehaul Packet"
      isPending={isPending}
      onClose={onClose}
      placementCode={placementCode}
      state={state}
      submitLabel="Archive Livehaul Packet"
    >
      <input name="placement_id" type="hidden" value={placementId} />
    </ArchiveUploadModal>
  );
}

function MiscDocumentUploader({
  placementId,
  placementCode,
  onClose,
}: {
  placementId: string;
  placementCode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(uploadPlacementMiscDocumentAction, INITIAL_CLOSEOUT_STATE);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      onClose();
    }
  }, [onClose, router, state.status]);

  return (
    <ArchiveUploadModal
      action={formAction}
      extraFields={
        <>
          <label className="feed-ticket-doc-field">
            <span>Document Title</span>
            <input name="title" placeholder="Clean wood declaration, vet statement, etc." type="text" />
          </label>
        </>
      }
      fileLabel="Supporting Document"
      isPending={isPending}
      onClose={onClose}
      placementCode={placementCode}
      state={state}
      submitLabel="Archive Supporting Doc"
    >
      <input name="placement_id" type="hidden" value={placementId} />
    </ArchiveUploadModal>
  );
}

function ArchiveUploadModal({
  action,
  children,
  extraFields,
  fileLabel,
  isPending,
  onClose,
  placementCode,
  state,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  children: ReactNode;
  extraFields?: ReactNode;
  fileLabel: string;
  isPending: boolean;
  onClose: () => void;
  placementCode: string;
  state: { status: "idle" | "success" | "error"; message: string };
  submitLabel: string;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!isMounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="feed-ticket-doc-scrim" onClick={onClose}>
      <div className="feed-ticket-doc-card" onClick={(event) => event.stopPropagation()}>
        <div className="feed-ticket-doc-header">
          <div>
            <p className="eyebrow">Document Archive</p>
            <h3 className="section-title">{placementCode}</h3>
          </div>
          <button className="button-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form action={action} className="feed-ticket-doc-form">
          {children}
          {extraFields}

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
            <span>{fileLabel}</span>
            <input accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif" name="document" type="file" />
          </label>

          <label className="feed-ticket-doc-field">
            <span>Notes</span>
            <textarea name="notes" placeholder="Optional archive note" rows={3} />
          </label>

          {state.message ? (
            <p className={state.status === "error" ? "feed-ticket-doc-error" : "feed-ticket-doc-success"}>{state.message}</p>
          ) : null}

          <div className="feed-ticket-doc-actions">
            <button className="button" disabled={isPending} type="submit">
              {isPending ? "Archiving..." : submitLabel}
            </button>
            <button className="button-secondary" onClick={onClose} type="button">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
