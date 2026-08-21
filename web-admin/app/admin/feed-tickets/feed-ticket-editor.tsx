"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { FeedTicketDocumentUploader } from "@/app/admin/feed-tickets/feed-ticket-document-uploader";
import { reportSessionExpired } from "@/components/session-recovery-layer";
import {
  formatFeedTicketTypeHelp as formatHostedFeedTicketTypeHelp,
  formatFeedTicketTypeOptionLabel as formatHostedFeedTicketTypeOptionLabel,
} from "@/lib/feed-ticket-types";

type FeedTicketType = "Reg" | "xTran" | "iTran" | "f2f";

type EditorBinOption = {
  feed_bin_id: string;
  farm_id: string | null;
  barn_id: string | null;
  barn_code: string | null;
  farm_name: string | null;
  bin_code: string | null;
  capacity_lbs: number | null;
  active_placement_id: string | null;
  active_placement_code: string | null;
};

type PlacementOption = {
  placement_id: string;
  placement_code: string;
  farm_name: string | null;
  barn_code: string | null;
  barn_id: string | null;
  active_start: string | null;
  active_end: string | null;
  date_removed: string | null;
  lifecycle_stage: string | null;
  is_active: boolean;
  is_in_barn: boolean;
  is_complete: boolean;
};

type EditorDrop = {
  id?: string | null;
  feed_bin_id: string | null;
  bin_code?: string | null;
  barn_id?: string | null;
  barn_code?: string | null;
  placement_id: string | null;
  placement_code?: string | null;
  default_placement_id?: string | null;
  default_placement_code?: string | null;
  queued_from_feed_bin_id?: string | null;
  queued_from_bin_code?: string | null;
  queued_from_barn_id?: string | null;
  queued_from_barn_code?: string | null;
  queued_from_placement_id?: string | null;
  queued_from_placement_code?: string | null;
  queued_at?: string | null;
  feed_type: string | null;
  drop_weight_lbs: number | null;
  note: string | null;
  drop_order: number;
  off_farm_redirect?: boolean;
  queued_for_reconciliation?: boolean;
  manual_flock_override?: boolean;
};

type EditorItem = {
  id?: string | null;
  ticket_number: string | null;
  delivered_at: string;
  ticket_weight_lbs: number | null;
  ticket_type: FeedTicketType;
  feed_name: string | null;
  vendor_name: string | null;
  source_type: string | null;
  note: string | null;
  bins: EditorBinOption[];
  drops: EditorDrop[];
};

type EditorPayload = {
  ok: boolean;
  item?: EditorItem;
  placementOptions?: PlacementOption[];
  ticketNumberDefaults?: {
    voucherPrefix: string | null;
    nextVoucherNumber: string | null;
  };
  settings?: {
    allowHistoricalEntry?: boolean;
    canManualFlockCorrection?: boolean;
  };
  error?: string;
};

type Props = {
  ticketId: string | null;
  onClose: () => void;
  onSaved: (ticketId: string | null) => void;
  printReportHelpText?: string | null;
  ticketTypeOptions: Array<{
    key: FeedTicketType;
    value: string;
    description: string;
  }>;
};

const DROP_FEED_TYPES = ["Starter", "Grower", "Other"] as const;
const LOAD_TYPE_OPTIONS = ["Starter", "Grower", "Split"] as const;
const DRAFT_STORAGE_PREFIX = "flocktrax:feed-ticket-draft";
const SESSION_RESTORED_EVENT = "flocktrax:session-restored";
const OFF_FARM_PLACEMENT_CODE = "OFF-FARM";
const QUEUED_DROP_PLACEMENT_CODE = "DROP-QUEUE";

export function FeedTicketEditor({ ticketId, onClose, onSaved, printReportHelpText, ticketTypeOptions }: Props) {
  const isExistingTicket = Boolean(ticketId);
  const skipNextDraftWriteRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [item, setItem] = useState<EditorItem | null>(null);
  const [placementOptions, setPlacementOptions] = useState<PlacementOption[]>([]);
  const [ticketNumberDefaults, setTicketNumberDefaults] = useState<{
    voucherPrefix: string | null;
    nextVoucherNumber: string | null;
  }>({
    voucherPrefix: null,
    nextVoucherNumber: null,
  });
  const [allowHistoricalEntry, setAllowHistoricalEntry] = useState(false);
  const [canManualFlockCorrection, setCanManualFlockCorrection] = useState(false);
  const [recoverableDraft, setRecoverableDraft] = useState<EditorItem | null>(null);
  const [showDocumentUploader, setShowDocumentUploader] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage(null);
      try {
        const query = ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : "";
        const response = await fetch(`/api/feed-ticket-editor${query}`, { cache: "no-store" });
        const payload = (await response.json()) as EditorPayload;
        if (response.status === 401) {
          reportSessionExpired("Your JWT expired while opening the feed ticket editor. Sign in again and your draft will still be here.");
        }
        if (!response.ok || !payload.ok || !payload.item) {
          throw new Error(payload.error ?? "Feed ticket editor could not be loaded.");
        }
        if (cancelled) {
          return;
        }
        const normalized = hydrateManualFlockOverrides(normalizeItem(payload.item), payload.placementOptions ?? []);
        const restoredDraft = readDraft(ticketId);
        setItem(normalized);
        setRecoverableDraft(restoredDraft);
        if (restoredDraft) {
          setMessageTone("success");
          setMessage(
            ticketId
              ? "Unsaved edits for this ticket were found in this browser. Recover them only if you want to replace the saved ticket view."
              : "Unsaved new-ticket work was found in this browser. Recover it or start fresh.",
          );
        }
        setPlacementOptions(payload.placementOptions ?? []);
        setTicketNumberDefaults(payload.ticketNumberDefaults ?? { voucherPrefix: null, nextVoucherNumber: null });
        setAllowHistoricalEntry(payload.settings?.allowHistoricalEntry === true);
        setCanManualFlockCorrection(payload.settings?.canManualFlockCorrection === true);
      } catch (error) {
        if (!cancelled) {
          setMessageTone("error");
          setMessage(error instanceof Error ? error.message : "Feed ticket editor could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const totalDrops = useMemo(
    () => (item?.drops ?? []).reduce((sum, drop) => sum + (drop.drop_weight_lbs ?? 0), 0),
    [item],
  );
  const autoVoucherPreview = useMemo(() => {
    const prefix = ticketNumberDefaults.voucherPrefix?.trim() ?? "";
    const nextVoucherNumber = ticketNumberDefaults.nextVoucherNumber?.trim() ?? "";
    return `${prefix}${nextVoucherNumber}`.trim() || null;
  }, [ticketNumberDefaults]);
  const balance = useMemo(() => {
    if (!item) return 0;
    return (item.ticket_weight_lbs ?? 0) - totalDrops;
  }, [item, totalDrops]);

  useEffect(() => {
    if (!item || item.id || item.ticket_type === "Reg" || item.ticket_number?.trim() || !autoVoucherPreview) {
      return;
    }

    setItem({
      ...item,
      ticket_number: autoVoucherPreview,
    });
  }, [autoVoucherPreview, item]);

  useEffect(() => {
    if (!item || item.ticket_type !== "Reg") {
      return;
    }

    const normalizedDrops = item.drops.map((drop) => {
      if (drop.off_farm_redirect) {
        return {
          ...drop,
          feed_bin_id: null,
          bin_code: null,
          barn_code: null,
          placement_id: null,
          placement_code: OFF_FARM_PLACEMENT_CODE,
          default_placement_id: null,
          default_placement_code: OFF_FARM_PLACEMENT_CODE,
          manual_flock_override: false,
        };
      }

      if (drop.queued_for_reconciliation) {
        return {
          ...drop,
          feed_bin_id: null,
          bin_code: null,
          barn_id: null,
          barn_code: null,
          placement_id: null,
          placement_code: QUEUED_DROP_PLACEMENT_CODE,
          default_placement_id: null,
          default_placement_code: QUEUED_DROP_PLACEMENT_CODE,
          manual_flock_override: false,
        };
      }

      if (drop.manual_flock_override) {
        return drop;
      }

      const regPlacement = resolveRegPlacement(item, placementOptions, drop);
      const manualHistoricalFallbackAllowed = isRegManualFallbackAllowed(
        item,
        placementOptions,
        drop,
        allowHistoricalEntry,
      );

      if (!regPlacement && manualHistoricalFallbackAllowed) {
        return drop;
      }

      return {
        ...drop,
        default_placement_id: drop.default_placement_id ?? regPlacement?.placement_id ?? null,
        default_placement_code: drop.default_placement_code ?? regPlacement?.placement_code ?? null,
        placement_id: regPlacement?.placement_id ?? null,
        placement_code: regPlacement?.placement_code ?? null,
        manual_flock_override: false,
      };
    });

    const changed = normalizedDrops.some(
      (drop, index) =>
        drop.feed_bin_id !== item.drops[index]?.feed_bin_id ||
        drop.bin_code !== item.drops[index]?.bin_code ||
        drop.barn_id !== item.drops[index]?.barn_id ||
        drop.barn_code !== item.drops[index]?.barn_code ||
        drop.placement_id !== item.drops[index]?.placement_id ||
        drop.placement_code !== item.drops[index]?.placement_code ||
        drop.default_placement_id !== item.drops[index]?.default_placement_id ||
        drop.default_placement_code !== item.drops[index]?.default_placement_code ||
        drop.manual_flock_override !== item.drops[index]?.manual_flock_override,
    );

    if (!changed) {
      return;
    }

    setItem({
      ...item,
      drops: normalizedDrops,
    });
  }, [allowHistoricalEntry, item, placementOptions]);

  useEffect(() => {
    if (!item) {
      return;
    }

    if (skipNextDraftWriteRef.current) {
      skipNextDraftWriteRef.current = false;
      return;
    }

    writeDraft(ticketId, item);
  }, [item, ticketId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleSessionRestored = () => {
      setMessageTone("success");
      setMessage("Session restored. Your feed ticket draft is still here.");
    };

    window.addEventListener(SESSION_RESTORED_EVENT, handleSessionRestored);
    return () => {
      window.removeEventListener(SESSION_RESTORED_EVENT, handleSessionRestored);
    };
  }, []);

  async function handleSave() {
    if (!item) return;

    const preparedItem = prepareItemForSave(item);
    const validation = validateItem(preparedItem);
    if (validation) {
      setMessageTone("error");
      setMessage(validation);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/feed-ticket-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preparedItem),
      });
      const payload = (await response.json()) as EditorPayload;
      if (response.status === 401) {
        writeDraft(ticketId ?? preparedItem.id ?? null, preparedItem);
        reportSessionExpired("Your JWT expired before this feed ticket could save. Sign in again and the draft will stay loaded.");
      }
      if (!response.ok || !payload.ok || !payload.item) {
        throw new Error(payload.error ?? "Feed ticket save failed.");
      }
      const saved = hydrateManualFlockOverrides(normalizeItem(payload.item), placementOptions);
      skipNextDraftWriteRef.current = true;
      setItem(saved);
      clearDraft(ticketId);
      clearDraft(saved.id ?? null);
      clearDraft(null);
      setRecoverableDraft(null);
      setMessageTone("success");
      setMessage("Feed ticket saved.");
      onSaved(saved.id ?? null);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Feed ticket save failed.");
    } finally {
      setSaving(false);
    }
  }

  function handleRecoverDraft() {
    if (!recoverableDraft) {
      return;
    }

    setItem(normalizeItem(recoverableDraft));
    setRecoverableDraft(null);
    setMessageTone("success");
    setMessage("Recovered unsaved feed ticket work from this browser.");
  }

  function handleDiscardRecoveredDraft() {
    clearDraft(ticketId);
    clearDraft(null);
    setRecoverableDraft(null);
    setMessageTone("success");
    setMessage(isExistingTicket ? "Discarded browser draft. Showing the saved ticket." : "Discarded browser draft. Starting a fresh new ticket.");
  }

  async function handleDelete() {
    const deleteId = item?.id ?? ticketId;
    if (!deleteId) return;
    const confirmed = window.confirm(`Delete ticket ${item?.ticket_number ?? deleteId} and all of its drops?`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/feed-ticket-editor", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: deleteId }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (response.status === 401) {
        reportSessionExpired("Your JWT expired before this feed ticket could be deleted. Sign in again and then retry the delete.");
      }
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.error ?? "Feed ticket delete failed.");
      }
      clearDraft(deleteId);
      onSaved(null);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Feed ticket delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenPrintReport() {
    if (!item?.id) {
      setMessageTone("error");
      setMessage("Save this feed ticket before printing its report.");
      return;
    }

    const params = new URLSearchParams();
    params.set("ticketId", item.id);
    window.open(`/admin/feed-tickets/ticket-report?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div className="feed-ticket-editor-inline-shell">
        <div className="feed-ticket-editor-panel">
          <div className="feed-ticket-editor-loading">Loading feed ticket editor...</div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="feed-ticket-editor-inline-shell">
        <div className="feed-ticket-editor-panel">
          <div className="sync-outbox-modal-header">
            <div>
              <p className="eyebrow">Feed Ticket Editor</p>
              <h3 className="section-title">Load Failed</h3>
            </div>
            <button className="button-secondary" onClick={onClose} type="button">
              Close
            </button>
          </div>
          <p className="feed-ticket-editor-error">{message ?? "Feed ticket editor could not be opened."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-ticket-editor-inline-shell">
      <div className="feed-ticket-editor-panel">
        <div className="feed-ticket-editor-top-card">
          <div className="sync-outbox-modal-header">
            <div>
              <p className="eyebrow">Feed Ticket Editor</p>
              <h3 className="feed-ticket-editor-ticket-number">{item.ticket_number?.trim() || "New Ticket"}</h3>
            </div>
            <div className="feed-ticket-editor-toolbar">
              <button
                aria-label="Archive feed ticket original"
                className="button-secondary feed-ticket-editor-icon-button"
                disabled={saving || !item.id}
                onClick={() => {
                  if (!item.id) {
                    setMessageTone("error");
                    setMessage("Save the ticket before archiving its original document.");
                    return;
                  }
                  setShowDocumentUploader(true);
                }}
                title={item.id ? "Document IN: Archive Original" : "Save the ticket before archiving the original"}
                type="button"
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className="feed-ticket-editor-doc-icon"
                  draggable={false}
                  height={18}
                  src="/icons/doc-inA.png?v=2"
                  width={18}
                />
              </button>
              <button
                aria-label="Print feed ticket"
                className="button-secondary feed-ticket-editor-icon-button"
                disabled={saving}
                onClick={handleOpenPrintReport}
                title={item.id ? printReportHelpText || "Open print ticket report" : "Save the ticket before printing"}
                type="button"
              >
                <PrintIcon />
              </button>
              {isExistingTicket ? (
                <button className="button-secondary feed-ticket-editor-delete" disabled={saving || deleting} onClick={() => void handleDelete()} type="button">
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              ) : null}
              <button className="button" disabled={saving} onClick={() => void handleSave()} type="button">
                {saving ? "Saving..." : "Save"}
              </button>
              <button className="button-secondary" onClick={onClose} type="button">
                Close
              </button>
            </div>
          </div>

          {message ? (
            <div className={`feed-ticket-editor-banner ${messageTone === "success" ? "is-success" : "is-error"}`}>{message}</div>
          ) : null}

          {recoverableDraft ? (
            <div className="feed-ticket-editor-banner is-success feed-ticket-editor-recovery-actions">
              <span>{isExistingTicket ? "Unsaved ticket edits are available in this browser." : "Unsaved new-ticket work is available in this browser."}</span>
              <div className="feed-ticket-editor-recovery-buttons">
                <button className="button" onClick={handleRecoverDraft} type="button">
                  Recover Draft
                </button>
                <button className="button-secondary" onClick={handleDiscardRecoveredDraft} type="button">
                  Start Fresh
                </button>
              </div>
            </div>
          ) : null}

          <div className="feed-ticket-editor-grid">
            <label className="feed-ticket-editor-field">
              <span>Date</span>
              <input
                onChange={(event) => setItem({ ...item, delivered_at: toIsoDate(event.target.value) })}
                type="date"
                value={toDateInput(item.delivered_at)}
              />
            </label>

            <label className="feed-ticket-editor-field">
              <span>{item.ticket_type === "Reg" ? "Ticket Number" : "Voucher Number"}</span>
              <input
                onChange={(event) => setItem({ ...item, ticket_number: event.target.value || null })}
                readOnly={item.ticket_type !== "Reg"}
                type="text"
                value={item.ticket_number ?? ""}
              />
            </label>

            <label
              className="feed-ticket-editor-field"
              title={formatTicketTypeHelp(ticketTypeOptions.find((option) => option.key === item.ticket_type) ?? null)}
            >
              <span>Ticket Type</span>
              <select
                className="feed-ticket-editor-ticket-type-select"
                onChange={(event) => {
                  const nextType = event.target.value as FeedTicketType;
                  const shouldAssignPreview =
                    nextType !== "Reg" &&
                    (item.ticket_type === "Reg" || !item.ticket_number?.trim() || item.ticket_number === autoVoucherPreview) &&
                    autoVoucherPreview;
                  const shouldClearPreview =
                    nextType === "Reg" &&
                    item.ticket_number === autoVoucherPreview;

                  setItem({
                    ...item,
                    ticket_type: nextType,
                    ticket_number: shouldAssignPreview ? autoVoucherPreview : shouldClearPreview ? null : item.ticket_number,
                  });
                }}
                value={item.ticket_type}
              >
                {ticketTypeOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {formatTicketTypeOptionLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="feed-ticket-editor-field">
              <span>Total Weight</span>
              <input
                onChange={(event) => setItem({ ...item, ticket_weight_lbs: toNullableNumber(event.target.value) })}
                step="0.01"
                type="number"
                value={item.ticket_weight_lbs ?? ""}
              />
            </label>

            <label className="feed-ticket-editor-field">
              <span>Feedmill / Vendor</span>
              <input
                onChange={(event) => setItem({ ...item, vendor_name: event.target.value || null })}
                type="text"
                value={item.vendor_name ?? ""}
              />
            </label>

            <label className="feed-ticket-editor-field">
              <span>Feed Name</span>
              <input
                onChange={(event) => setItem({ ...item, feed_name: event.target.value || null })}
                type="text"
                value={item.feed_name ?? ""}
              />
            </label>

            <div className="feed-ticket-editor-field">
              <span>Load Type</span>
              <div className="feed-ticket-editor-choice-row" role="radiogroup" aria-label="Load Type">
                {LOAD_TYPE_OPTIONS.map((option) => {
                  const checked = (item.source_type ?? "") === option;
                  return (
                    <label className={`feed-ticket-editor-choice ${checked ? "is-selected" : ""}`} key={option}>
                      <input
                        checked={checked}
                        name="source_type"
                        onChange={() => setItem({ ...item, source_type: option })}
                        type="radio"
                        value={option}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="feed-ticket-editor-field feed-ticket-editor-field-wide">
              <span>Comment</span>
              <textarea
                onChange={(event) => setItem({ ...item, note: event.target.value || null })}
                rows={2}
                value={item.note ?? ""}
              />
            </label>
          </div>
        </div>

        <div className="feed-ticket-editor-rollup">
          <div>
            <span>Header Total</span>
            <strong>{formatWeight(item.ticket_weight_lbs)}</strong>
          </div>
          <div>
            <span>Drops Total</span>
            <strong>{formatWeight(totalDrops)}</strong>
          </div>
          <div>
            <span>Not Allocated</span>
            <strong className={Math.abs(balance) <= 0.01 ? "is-good" : "is-bad"}>{formatWeight(balance)}</strong>
          </div>
        </div>

        <div className="feed-ticket-editor-drop-header">
          <div>
            <p className="feed-ticket-editor-section-title">Drops</p>
            <p className="feed-ticket-editor-section-copy">Assign bin, flock, feed type, and weight for each line.</p>
          </div>
          <button
            className="button-secondary"
            onClick={() =>
              setItem({
                ...item,
                drops: [...item.drops, buildEmptyDrop(item.drops.length + 1)],
              })
            }
            type="button"
          >
            + Drop
          </button>
        </div>

        <div className="feed-ticket-editor-drop-frame">
          <div className="feed-ticket-editor-drop-table">
            <div className="feed-ticket-editor-drop-row feed-ticket-editor-drop-head">
              <span>#</span>
              <span>Bin</span>
              <span>Flock</span>
              <span>Feed Type</span>
              <span>Weight</span>
              <span>Disposition</span>
              <span>Note</span>
              <span />
            </div>
            {item.drops.map((drop, index) => {
              const isOffFarmRedirect = drop.off_farm_redirect === true;
              const isQueuedForReconciliation = drop.queued_for_reconciliation === true;
              const currentPlacement = resolvePlacementOption(placementOptions, drop);
              const currentBin = resolveBinOption(item.bins, drop);
              const systemRegPlacement =
                item.ticket_type === "Reg" && !isOffFarmRedirect && !isQueuedForReconciliation
                  ? resolveRegPlacement(item, placementOptions, drop)
                  : null;
              const canUseManualFlockCorrection =
                canManualFlockCorrection && item.ticket_type === "Reg" && !isOffFarmRedirect && !isQueuedForReconciliation;
              const rememberedDefaultPlacementId = drop.default_placement_id ?? systemRegPlacement?.placement_id ?? null;
              const rememberedDefaultPlacementCode = drop.default_placement_code ?? systemRegPlacement?.placement_code ?? null;
              const placementDiffersFromSystem =
                item.ticket_type === "Reg" &&
                !isOffFarmRedirect &&
                Boolean(drop.placement_id) &&
                Boolean(drop.default_placement_id) &&
                rememberedDefaultPlacementId !== drop.placement_id;
              const hasManualFlockOverride =
                canUseManualFlockCorrection && (drop.manual_flock_override === true || placementDiffersFromSystem);
              const regLockedPlacement =
                item.ticket_type === "Reg" && !isOffFarmRedirect && !isQueuedForReconciliation && !hasManualFlockOverride
                  ? systemRegPlacement
                  : null;
              const regCanManuallyPickHistorical = item.ticket_type === "Reg"
                ? isRegManualFallbackAllowed(item, placementOptions, drop, allowHistoricalEntry)
                : false;
              const canChooseRegPlacement =
                item.ticket_type === "Reg" && (regCanManuallyPickHistorical || canUseManualFlockCorrection);
              const canEditPlacement =
                !isOffFarmRedirect &&
                !isQueuedForReconciliation &&
                (item.ticket_type !== "Reg" || canChooseRegPlacement);
              const displayedPlacement = isOffFarmRedirect || isQueuedForReconciliation
                ? null
                : hasManualFlockOverride
                  ? currentPlacement
                  : regLockedPlacement ?? currentPlacement;
              const regManualPlacementOptions = item.ticket_type === "Reg" && canChooseRegPlacement
                ? resolveRegManualPlacementOptions(placementOptions, currentBin)
                : [];
              const placementOptionsForSelect =
                item.ticket_type === "Reg" && canChooseRegPlacement
                  ? regManualPlacementOptions
                  : placementOptions;

              return (
                <div className="feed-ticket-editor-drop-row" key={`${drop.id ?? "new"}-${index}`}>
                  <span className="feed-ticket-editor-ordinal">{index + 1}</span>
                  <select
                    className="feed-ticket-editor-bin-select"
                    disabled={isOffFarmRedirect || isQueuedForReconciliation}
                    onChange={(event) => {
                      const nextBin = item.bins.find((bin) => bin.feed_bin_id === event.target.value) ?? null;
                      const nextRegPlacement = item.ticket_type === "Reg" ? resolveRegPlacementForBin(item, placementOptions, nextBin) : null;
                      updateDrop(index, item, setItem, {
                        feed_bin_id: nextBin?.feed_bin_id ?? null,
                        bin_code: nextBin?.bin_code ?? null,
                        barn_id: nextBin?.barn_id ?? null,
                        barn_code: nextBin?.barn_code ?? null,
                        default_placement_id: item.ticket_type === "Reg" ? nextRegPlacement?.placement_id ?? null : drop.default_placement_id ?? null,
                        default_placement_code: item.ticket_type === "Reg" ? nextRegPlacement?.placement_code ?? null : drop.default_placement_code ?? null,
                        placement_id: item.ticket_type === "Reg" ? nextRegPlacement?.placement_id ?? null : drop.placement_id,
                        placement_code: item.ticket_type === "Reg" ? nextRegPlacement?.placement_code ?? null : drop.placement_code,
                        manual_flock_override: false,
                      });
                    }}
                    title={
                      isOffFarmRedirect
                        ? "Off Farm Redirect"
                        : isQueuedForReconciliation
                          ? buildQueuedBinLabel(drop) ?? "Queued"
                          : currentBin
                            ? formatBinLabel(currentBin)
                            : "Select Bin"
                    }
                    value={drop.feed_bin_id ?? ""}
                  >
                    <option value="">
                      {isOffFarmRedirect ? "Off Farm Redirect" : isQueuedForReconciliation ? buildQueuedBinLabel(drop) ?? "Queued" : "Select Bin"}
                    </option>
                    {currentBin ? (
                      <option value={currentBin.feed_bin_id}>{formatBinLabel(currentBin)}</option>
                    ) : null}
                    {item.bins
                      .filter((bin) => bin.feed_bin_id !== currentBin?.feed_bin_id)
                      .map((bin) => (
                        <option key={bin.feed_bin_id} value={bin.feed_bin_id}>
                          {formatBinLabel(bin)}
                        </option>
                      ))}
                  </select>
                  <div className="feed-ticket-editor-flock-cell">
                    <select
                      className={hasManualFlockOverride ? "feed-ticket-editor-flock-select is-overridden" : "feed-ticket-editor-flock-select"}
                      disabled={!canEditPlacement}
                      onChange={(event) => {
                        const nextPlacement = placementOptions.find((option) => option.placement_id === event.target.value) ?? null;
                        const nextPlacementId = nextPlacement?.placement_id ?? null;
                        const nextManualOverride =
                          item.ticket_type === "Reg" &&
                          canUseManualFlockCorrection &&
                          Boolean(nextPlacementId) &&
                          ((!rememberedDefaultPlacementId && Boolean(drop.feed_bin_id)) || rememberedDefaultPlacementId !== nextPlacementId);
                        updateDrop(index, item, setItem, {
                          placement_id: nextPlacementId,
                          placement_code: nextPlacement?.placement_code ?? null,
                          manual_flock_override: nextManualOverride,
                        });
                      }}
                      title={
                        !canEditPlacement
                          ? "Flock follows the system-selected active flock. Farm Manager or Super Admin access is required to change it."
                          : hasManualFlockOverride
                            ? "This flock assignment was manually overridden."
                            : "System-selected flock assignment."
                      }
                      value={
                        isOffFarmRedirect
                          ? OFF_FARM_PLACEMENT_CODE
                          : isQueuedForReconciliation
                            ? QUEUED_DROP_PLACEMENT_CODE
                            : displayedPlacement?.placement_id ?? ""
                      }
                    >
                      {isOffFarmRedirect ? (
                        <option value={OFF_FARM_PLACEMENT_CODE}>{OFF_FARM_PLACEMENT_CODE}</option>
                      ) : isQueuedForReconciliation ? (
                        <option value={QUEUED_DROP_PLACEMENT_CODE}>
                          {buildQueuedSourceLabel(drop) ?? QUEUED_DROP_PLACEMENT_CODE}
                        </option>
                      ) : item.ticket_type === "Reg" ? (
                        canChooseRegPlacement ? (
                          <>
                            <option value="">
                              {hasManualFlockOverride
                                ? (drop.feed_bin_id ? "Select corrected flock." : "Select Bin First")
                                : regCanManuallyPickHistorical
                                  ? (drop.feed_bin_id ? "No historical match. Select Flock." : "Select Bin First")
                                  : (drop.feed_bin_id ? "System flock selected. Change only if needed." : "Select Bin First")}
                            </option>
                            {displayedPlacement ? (
                              <option value={displayedPlacement.placement_id}>{formatPlacementLabel(displayedPlacement)}</option>
                            ) : null}
                            {placementOptionsForSelect
                              .filter((option) => option.placement_id !== displayedPlacement?.placement_id)
                              .map((option) => (
                                <option key={option.placement_id} value={option.placement_id}>
                                  {formatPlacementLabel(option)}
                                </option>
                              ))}
                          </>
                        ) : (
                          <>
                            <option value="">
                              {drop.feed_bin_id ? "No active flock for selected bin" : "Select Bin First"}
                            </option>
                            {displayedPlacement ? (
                              <option value={displayedPlacement.placement_id}>{formatPlacementLabel(displayedPlacement)}</option>
                            ) : null}
                          </>
                        )
                      ) : (
                        <>
                          <option value="">Select Flock</option>
                          {displayedPlacement ? (
                            <option value={displayedPlacement.placement_id}>{formatPlacementLabel(displayedPlacement)}</option>
                          ) : null}
                          {placementOptions
                            .filter((option) => option.placement_id !== displayedPlacement?.placement_id)
                            .map((option) => (
                              <option key={option.placement_id} value={option.placement_id}>
                                {formatPlacementLabel(option)}
                              </option>
                            ))}
                        </>
                      )}
                    </select>
                  </div>
                  <select
                    onChange={(event) => updateDrop(index, item, setItem, { feed_type: event.target.value || null })}
                    value={drop.feed_type ?? ""}
                  >
                    <option value="">Type</option>
                    {DROP_FEED_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <input
                    onChange={(event) => updateDrop(index, item, setItem, { drop_weight_lbs: toNullableNumber(event.target.value) })}
                    step="0.01"
                    type="number"
                    value={drop.drop_weight_lbs ?? ""}
                  />
                  <div className="feed-ticket-editor-disposition-cell">
                    <label className="feed-ticket-editor-redirect-toggle">
                      <input
                        checked={isOffFarmRedirect}
                        onChange={(event) =>
                          updateDrop(index, item, setItem, event.target.checked
                            ? {
                                off_farm_redirect: true,
                                queued_for_reconciliation: false,
                                feed_bin_id: null,
                                bin_code: null,
                                barn_id: null,
                                barn_code: null,
                                default_placement_id: null,
                                default_placement_code: OFF_FARM_PLACEMENT_CODE,
                                placement_id: null,
                                placement_code: OFF_FARM_PLACEMENT_CODE,
                                queued_from_feed_bin_id: null,
                                queued_from_bin_code: null,
                                queued_from_barn_id: null,
                                queued_from_barn_code: null,
                                queued_from_placement_id: null,
                                queued_from_placement_code: null,
                                queued_at: null,
                                manual_flock_override: false,
                              }
                            : {
                                off_farm_redirect: false,
                                default_placement_id: drop.default_placement_id ?? null,
                                default_placement_code: drop.default_placement_code ?? null,
                                placement_code: null,
                                manual_flock_override: false,
                              })}
                        type="checkbox"
                      />
                      <span>Off Farm</span>
                    </label>
                    <label className="feed-ticket-editor-redirect-toggle">
                      <input
                        checked={isQueuedForReconciliation}
                        onChange={(event) =>
                          updateDrop(index, item, setItem, event.target.checked
                            ? {
                                queued_for_reconciliation: true,
                                off_farm_redirect: false,
                                feed_bin_id: null,
                                bin_code: null,
                                barn_id: null,
                                barn_code: null,
                                default_placement_id: null,
                                default_placement_code: QUEUED_DROP_PLACEMENT_CODE,
                                placement_id: null,
                                placement_code: QUEUED_DROP_PLACEMENT_CODE,
                                queued_from_feed_bin_id: drop.queued_from_feed_bin_id ?? drop.feed_bin_id ?? null,
                                queued_from_bin_code: drop.queued_from_bin_code ?? drop.bin_code ?? currentBin?.bin_code ?? null,
                                queued_from_barn_id: drop.queued_from_barn_id ?? drop.barn_id ?? currentBin?.barn_id ?? null,
                                queued_from_barn_code: drop.queued_from_barn_code ?? drop.barn_code ?? currentBin?.barn_code ?? null,
                                queued_from_placement_id: drop.queued_from_placement_id ?? drop.placement_id ?? null,
                                queued_from_placement_code: drop.queued_from_placement_code ?? drop.placement_code ?? displayedPlacement?.placement_code ?? null,
                                queued_at: drop.queued_at ?? new Date().toISOString(),
                                manual_flock_override: false,
                              }
                            : {
                                queued_for_reconciliation: false,
                                feed_bin_id: drop.queued_from_feed_bin_id ?? null,
                                bin_code: drop.queued_from_bin_code ?? null,
                                barn_id: drop.queued_from_barn_id ?? null,
                                barn_code: drop.queued_from_barn_code ?? null,
                                default_placement_id: drop.queued_from_placement_id ?? drop.default_placement_id ?? null,
                                default_placement_code: drop.queued_from_placement_code ?? drop.default_placement_code ?? null,
                                placement_id: drop.queued_from_placement_id ?? null,
                                placement_code: drop.queued_from_placement_code ?? null,
                                manual_flock_override: false,
                              })}
                        type="checkbox"
                      />
                      <span>Queue</span>
                    </label>
                  </div>
                  <input
                    onChange={(event) => updateDrop(index, item, setItem, { note: event.target.value || null })}
                    placeholder={
                      isOffFarmRedirect
                        ? "Required: where was this feed redirected?"
                        : isQueuedForReconciliation
                          ? "Required: why is this drop being queued?"
                          : ""
                    }
                    title={
                      isQueuedForReconciliation
                        ? [buildQueuedSourceLabel(drop), drop.queued_at ? `Queued ${formatQueuedAt(drop.queued_at)}` : null].filter(Boolean).join("\n")
                        : undefined
                    }
                    type="text"
                    value={drop.note ?? ""}
                  />
                  <button
                    className="feed-ticket-editor-remove"
                    aria-label={`Remove drop ${index + 1}`}
                    onClick={() => setItem({ ...item, drops: item.drops.filter((_, currentIndex) => currentIndex !== index).map(reindexDrop) })}
                    type="button"
                  >
                    X
                  </button>
                </div>
              );
            })}
            {item.drops.length === 0 ? <div className="feed-ticket-editor-empty">No drops added yet.</div> : null}
          </div>
        </div>
      </div>
      {showDocumentUploader && item.id ? (
        <FeedTicketDocumentUploader
          onClose={() => setShowDocumentUploader(false)}
          onSaved={() => {
            setShowDocumentUploader(false);
            setMessageTone("success");
            setMessage("Original archived for this feed ticket.");
          }}
          ticketId={item.id}
          ticketNumber={item.ticket_number}
        />
      ) : null}
    </div>
  );
}

function buildDraftStorageKey(ticketId: string | null) {
  return `${DRAFT_STORAGE_PREFIX}:${ticketId ?? "new"}`;
}

function readDraft(ticketId: string | null) {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(buildDraftStorageKey(ticketId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { item?: EditorItem };
    return parsed.item ? normalizeItem(parsed.item) : null;
  } catch {
    return null;
  }
}

function writeDraft(ticketId: string | null, item: EditorItem) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    buildDraftStorageKey(ticketId ?? item.id ?? null),
    JSON.stringify({ item }),
  );
}

function clearDraft(ticketId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(buildDraftStorageKey(ticketId));
}

function normalizeItem(item: EditorItem): EditorItem {
  return {
    ...item,
    ticket_type: item.ticket_type ?? "Reg",
    drops: (item.drops ?? []).map((drop, index) => ({
      ...drop,
      barn_id: typeof drop.barn_id === "string" ? drop.barn_id : null,
      off_farm_redirect: drop.off_farm_redirect === true,
      queued_for_reconciliation: drop.queued_for_reconciliation === true,
      manual_flock_override: drop.manual_flock_override === true,
      default_placement_id: typeof drop.default_placement_id === "string" ? drop.default_placement_id : null,
      default_placement_code: typeof drop.default_placement_code === "string" ? drop.default_placement_code : null,
      queued_from_feed_bin_id: typeof drop.queued_from_feed_bin_id === "string" ? drop.queued_from_feed_bin_id : null,
      queued_from_bin_code: typeof drop.queued_from_bin_code === "string" ? drop.queued_from_bin_code : null,
      queued_from_barn_id: typeof drop.queued_from_barn_id === "string" ? drop.queued_from_barn_id : null,
      queued_from_barn_code: typeof drop.queued_from_barn_code === "string" ? drop.queued_from_barn_code : null,
      queued_from_placement_id: typeof drop.queued_from_placement_id === "string" ? drop.queued_from_placement_id : null,
      queued_from_placement_code: typeof drop.queued_from_placement_code === "string" ? drop.queued_from_placement_code : null,
      queued_at: typeof drop.queued_at === "string" ? drop.queued_at : null,
      drop_order: typeof drop.drop_order === "number" ? drop.drop_order : index + 1,
    })),
  };
}

function hydrateManualFlockOverrides(item: EditorItem, placementOptions: PlacementOption[]): EditorItem {
  if (item.ticket_type !== "Reg") {
    return item;
  }

  return {
    ...item,
    drops: item.drops.map((drop) => {
      if (drop.off_farm_redirect) {
        return {
          ...drop,
          default_placement_id: null,
          default_placement_code: OFF_FARM_PLACEMENT_CODE,
          manual_flock_override: false,
        };
      }

      if (drop.queued_for_reconciliation) {
        return {
          ...drop,
          default_placement_id: null,
          default_placement_code: QUEUED_DROP_PLACEMENT_CODE,
          manual_flock_override: false,
        };
      }

      const resolvedPlacement = resolveRegPlacement(item, placementOptions, drop);
      const defaultPlacementId = drop.default_placement_id ?? resolvedPlacement?.placement_id ?? null;
      const inferredOverride =
        drop.manual_flock_override === true ||
        (Boolean(defaultPlacementId) &&
          Boolean(drop.placement_id) &&
          defaultPlacementId !== drop.placement_id);

      return {
        ...drop,
        default_placement_id: defaultPlacementId,
        default_placement_code: drop.default_placement_code ?? resolvedPlacement?.placement_code ?? null,
        manual_flock_override: inferredOverride,
      };
    }),
  };
}

function prepareItemForSave(item: EditorItem): EditorItem {
  return {
    ...item,
    drops: item.drops.map((drop) => {
      if (!drop.queued_for_reconciliation) {
        return drop;
      }

      return {
        ...drop,
        queued_from_feed_bin_id: drop.queued_from_feed_bin_id ?? drop.feed_bin_id ?? null,
        queued_from_bin_code: drop.queued_from_bin_code ?? drop.bin_code ?? null,
        queued_from_barn_id: drop.queued_from_barn_id ?? drop.barn_id ?? null,
        queued_from_barn_code: drop.queued_from_barn_code ?? drop.barn_code ?? null,
        queued_from_placement_id:
          drop.queued_from_placement_id ?? drop.placement_id ?? drop.default_placement_id ?? null,
        queued_from_placement_code:
          drop.queued_from_placement_code ?? drop.placement_code ?? drop.default_placement_code ?? null,
      };
    }),
  };
}

function hasQueuedSourceAssignment(drop: EditorDrop) {
  return Boolean(
    (drop.queued_from_feed_bin_id && drop.queued_from_placement_id) ||
      (drop.feed_bin_id && drop.placement_id),
  );
}

function validateItem(item: EditorItem) {
  if (!item.ticket_number?.trim()) return "Ticket number is required.";
  if (!item.delivered_at) return "Date is required.";
  if (!item.vendor_name?.trim()) return "Feedmill / vendor is required.";
  if (item.ticket_weight_lbs === null || item.ticket_weight_lbs === undefined) return "Total weight is required.";
  if (item.drops.length === 0) return "At least one drop is required.";

  for (const [index, drop] of item.drops.entries()) {
    if (drop.off_farm_redirect) {
      if (!drop.note?.trim()) return `Drop ${index + 1} must include a note when marked Off Farm Redirect.`;
    } else if (drop.queued_for_reconciliation) {
      if (!drop.note?.trim()) return `Drop ${index + 1} must include a note when queued for reconciliation.`;
      if (!hasQueuedSourceAssignment(drop)) {
        return `Drop ${index + 1} must be assigned to a bin and flock before it can be queued.`;
      }
    } else {
      if (!drop.feed_bin_id) return `Drop ${index + 1} is missing a bin.`;
      if (!drop.placement_id) return `Drop ${index + 1} is missing a flock.`;
    }
    if (drop.drop_weight_lbs === null || drop.drop_weight_lbs === undefined || Math.abs(drop.drop_weight_lbs) <= 0.001) {
      return `Drop ${index + 1} must have a non-zero weight.`;
    }
  }

  return null;
}

function buildEmptyDrop(order: number): EditorDrop {
  return {
    id: null,
    feed_bin_id: null,
    barn_id: null,
    placement_id: null,
    default_placement_id: null,
    default_placement_code: null,
    queued_from_feed_bin_id: null,
    queued_from_bin_code: null,
    queued_from_barn_id: null,
    queued_from_barn_code: null,
    queued_from_placement_id: null,
    queued_from_placement_code: null,
    queued_at: null,
    feed_type: null,
    drop_weight_lbs: null,
    note: null,
    drop_order: order,
    off_farm_redirect: false,
    queued_for_reconciliation: false,
    manual_flock_override: false,
  };
}

function updateDrop(
  index: number,
  item: EditorItem,
  setItem: (value: EditorItem) => void,
  patch: Partial<EditorDrop>,
) {
  setItem({
    ...item,
    drops: item.drops.map((drop, currentIndex) =>
      currentIndex === index ? { ...drop, ...patch } : drop,
    ),
  });
}

function reindexDrop(drop: EditorDrop, index: number) {
  return { ...drop, drop_order: index + 1 };
}

function formatBinLabel(bin: EditorBinOption) {
  const barnCode = compactBarnCode(bin.barn_code);
  const binCode = compactBinCode(bin.bin_code);
  return [barnCode, binCode].filter(Boolean).join(" ");
}

function buildQueuedBinLabel(drop: EditorDrop) {
  const barnCode = compactBarnCode(drop.queued_from_barn_code);
  const binCode = compactBinCode(drop.queued_from_bin_code);
  const source = [barnCode, binCode].filter(Boolean).join(" ");
  return source ? `Queued from ${source}` : null;
}

function formatPlacementLabel(option: PlacementOption) {
  return [compactPlacementCode(option.placement_code), verbosePlacementState(option)].filter(Boolean).join(" - ");
}

function buildQueuedSourceLabel(drop: EditorDrop) {
  const placementCode = compactPlacementCode(drop.queued_from_placement_code);
  const barnCode = compactBarnCode(drop.queued_from_barn_code);
  const binCode = compactBinCode(drop.queued_from_bin_code);
  const source = [placementCode, [barnCode, binCode].filter(Boolean).join(" ")].filter(Boolean).join(" / ");
  return source ? `Queued from ${source}` : null;
}

function formatQueuedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function resolveRegPlacement(item: EditorItem, options: PlacementOption[], drop: EditorDrop) {
  const currentBin = resolveBinOption(item.bins, drop);
  return resolveRegPlacementForBin(item, options, currentBin);
}

function resolveRegPlacementForBin(
  item: EditorItem,
  options: PlacementOption[],
  bin: EditorBinOption | null,
) {
  if (!bin?.barn_id) {
    return null;
  }

  const deliveredDate = toCalendarDate(item.delivered_at);
  const matchingPlacement = options
    .filter((option) => option.barn_id === bin.barn_id)
    .filter((option) => placementMatchesDate(option, deliveredDate))
    .sort((left, right) => comparePlacementDatesDesc(left.active_start, right.active_start))[0];

  if (matchingPlacement) {
    return matchingPlacement;
  }

  if (deliveredDate) {
    const gapPlacement = resolveGapPlacementForDate(options, bin.barn_id, deliveredDate);
    if (gapPlacement) {
      return gapPlacement;
    }
    return null;
  }

  if (!bin.active_placement_id) {
    return null;
  }

  return (
    options.find((option) => option.placement_id === bin.active_placement_id) ?? {
      placement_id: bin.active_placement_id,
      placement_code: bin.active_placement_code ?? bin.active_placement_id,
      farm_name: bin.farm_name ?? null,
      barn_code: bin.barn_code ?? null,
      barn_id: bin.barn_id ?? null,
      active_start: null,
      active_end: null,
      date_removed: null,
      lifecycle_stage: null,
      is_active: item.ticket_type === "Reg",
      is_in_barn: item.ticket_type === "Reg",
      is_complete: false,
    }
  );
}

function isRegManualFallbackAllowed(
  item: EditorItem,
  options: PlacementOption[],
  drop: EditorDrop,
  allowHistoricalEntry: boolean,
) {
  if (!allowHistoricalEntry || item.ticket_type !== "Reg") {
    return false;
  }

  const currentBin = resolveBinOption(item.bins, drop);
  if (!currentBin?.barn_id || !drop.feed_bin_id) {
    return false;
  }

  return resolveRegPlacementForBin(item, options, currentBin) === null;
}

function resolveRegManualPlacementOptions(
  options: PlacementOption[],
  bin: EditorBinOption | null,
) {
  const barnOptions = bin?.barn_id
    ? options.filter((option) => option.barn_id === bin.barn_id)
    : [];

  return (barnOptions.length ? barnOptions : options).slice().sort((left, right) => {
    const byStart = comparePlacementDatesDesc(left.active_start, right.active_start);
    if (byStart !== 0) {
      return byStart;
    }
    return left.placement_code.localeCompare(right.placement_code);
  });
}

function resolvePlacementOption(options: PlacementOption[], drop: EditorDrop) {
  if (!drop.placement_id) return null;
  return (
    options.find((option) => option.placement_id === drop.placement_id) ?? {
      placement_id: drop.placement_id,
      placement_code: drop.placement_code ?? drop.placement_id,
      farm_name: null,
      barn_code: drop.barn_code ?? null,
      barn_id: null,
      active_start: null,
      active_end: null,
      date_removed: null,
      lifecycle_stage: null,
      is_active: false,
      is_in_barn: false,
      is_complete: false,
    }
  );
}

function resolveBinOption(options: EditorBinOption[], drop: EditorDrop) {
  if (!drop.feed_bin_id) return null;
  return (
    options.find((option) => option.feed_bin_id === drop.feed_bin_id) ?? {
      feed_bin_id: drop.feed_bin_id,
      farm_id: null,
      barn_id: null,
      barn_code: drop.barn_code ?? null,
      farm_name: null,
      bin_code: drop.bin_code ?? drop.feed_bin_id,
      capacity_lbs: null,
      active_placement_id: null,
      active_placement_code: null,
    }
  );
}

function toDateInput(value: string) {
  return value ? value.slice(0, 10) : "";
}

function toIsoDate(value: string) {
  return value ? `${value}T00:00:00.000Z` : new Date().toISOString();
}

function toCalendarDate(value: string | null | undefined) {
  return String(value ?? "").slice(0, 10);
}

function placementMatchesDate(option: PlacementOption, deliveredDate: string) {
  if (!deliveredDate) {
    return option.is_active;
  }

  const activeStart = toCalendarDate(option.active_start);
  const activeEnd = toCalendarDate(option.date_removed || option.active_end);

  if (activeStart && deliveredDate < activeStart) {
    return false;
  }

  if (activeEnd && deliveredDate > activeEnd) {
    return false;
  }

  return true;
}

function comparePlacementDatesDesc(left: string | null, right: string | null) {
  const leftDate = toCalendarDate(left);
  const rightDate = toCalendarDate(right);

  if (leftDate === rightDate) {
    return 0;
  }

  return leftDate > rightDate ? -1 : 1;
}

function resolveGapPlacementForDate(options: PlacementOption[], barnId: string, deliveredDate: string) {
  const barnPlacements = options
    .filter((option) => option.barn_id === barnId)
    .sort((left, right) => comparePlacementDatesAsc(left.active_start, right.active_start));

  for (let index = 0; index < barnPlacements.length; index += 1) {
    const nextPlacement = barnPlacements[index];
    const nextStart = toCalendarDate(nextPlacement.active_start);

    if (!nextStart || deliveredDate >= nextStart) {
      continue;
    }

    const previousPlacement = barnPlacements[index - 1];
    if (!previousPlacement) {
      return null;
    }

    const previousEnd = toCalendarDate(previousPlacement.date_removed || previousPlacement.active_end);
    if (!previousEnd) {
      return null;
    }

    if (deliveredDate >= previousEnd) {
      return nextPlacement;
    }

    return null;
  }

  return null;
}

function comparePlacementDatesAsc(left: string | null, right: string | null) {
  const leftDate = toCalendarDate(left);
  const rightDate = toCalendarDate(right);

  if (leftDate === rightDate) {
    return 0;
  }

  return leftDate < rightDate ? -1 : 1;
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} lbs`;
}

function compactBinCode(value: string | null | undefined) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return "B--";
  return cleaned.toUpperCase().startsWith("B") ? cleaned.toUpperCase() : `B${cleaned}`;
}

function compactBarnCode(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function compactPlacementCode(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function verbosePlacementState(option: PlacementOption) {
  if (option.is_complete) return "Completed";
  if (option.is_in_barn) return "In Barn";
  if (option.lifecycle_stage === "awaiting_arrival") return "Awaiting Arrival";
  if (option.lifecycle_stage === "scheduled") return "Scheduled";
  if (option.is_active) return "Active";
  return "Open";
}

function formatTicketTypeHelp(
  option: { value: string; description: string } | null,
) {
  return formatHostedFeedTicketTypeHelp(option);
}

function formatTicketTypeOptionLabel(
  option: { value: string; description: string },
) {
  return formatHostedFeedTicketTypeOptionLabel(option.value, option.description);
}

function PrintIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path
        d="M7 8V4h10v4M7 14H5.5A1.5 1.5 0 0 1 4 12.5v-3A1.5 1.5 0 0 1 5.5 8h13A1.5 1.5 0 0 1 20 9.5v3a1.5 1.5 0 0 1-1.5 1.5H17m-10 0v6h10v-6H7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8 17h8M8 11h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
