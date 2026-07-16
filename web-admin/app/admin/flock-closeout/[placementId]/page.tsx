import Link from "next/link";
import { notFound } from "next/navigation";

import { CloseoutDocumentChecklist } from "@/app/admin/flock-closeout/closeout-document-panels";
import { CloseoutLivehaulLoadsPanel } from "@/app/admin/flock-closeout/closeout-livehaul-load-forms";
import { CloseoutWorksheetForm } from "@/app/admin/flock-closeout/closeout-worksheet-form";
import { PageHeader } from "@/components/page-header";
import { getCloseoutQueueData } from "@/lib/closeout-data";
import {
  BILL_OF_LADING_DOCUMENT_ROLE,
  CLOSEOUT_SHEET_SNAPSHOT_DOCUMENT_ROLE,
  getPlacementDocumentSummaryMap,
  getPlacementDocumentListMap,
  getPlacementCloseoutDocumentSummaryMap,
  HATCH_TICKET_DOCUMENT_ROLE,
  MISC_DOCUMENT_ROLE,
  type DocumentArchiveListItem,
  type DocumentArchiveSummary,
} from "@/lib/document-archive";

type CloseoutPlacementPageProps = {
  params: Promise<{
    placementId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CloseoutPlacementPage({ params, searchParams }: CloseoutPlacementPageProps) {
  const { placementId } = await params;
  const query = (await searchParams) ?? {};
  const openedFromFlocks = firstParam(query.source) === "flocks";
  const queue = await getCloseoutQueueData({ placement: placementId });
  const item = queue.items.find((entry) => entry.placementId === placementId) ?? null;

  if (!item) {
    notFound();
  }

  let archiveWarning: string | null = null;
  let hatchTicketSummaryMap = new Map<string, DocumentArchiveSummary>();
  let closeoutSummaryMap = new Map<string, DocumentArchiveSummary>();
  let livehaulPacketSummaryMap = new Map<string, DocumentArchiveSummary>();
  let miscDocumentMap = new Map<string, DocumentArchiveListItem[]>();

  try {
    [hatchTicketSummaryMap, closeoutSummaryMap, livehaulPacketSummaryMap, miscDocumentMap] = await Promise.all([
      getPlacementDocumentSummaryMap([placementId], HATCH_TICKET_DOCUMENT_ROLE),
      item.closeout
        ? getPlacementCloseoutDocumentSummaryMap([placementId], CLOSEOUT_SHEET_SNAPSHOT_DOCUMENT_ROLE)
        : Promise.resolve(new Map()),
      getPlacementDocumentSummaryMap([placementId], BILL_OF_LADING_DOCUMENT_ROLE),
      getPlacementDocumentListMap([placementId], MISC_DOCUMENT_ROLE),
    ]);
  } catch (error) {
    archiveWarning =
      error instanceof Error
        ? `Document archive is temporarily unavailable: ${error.message}`
        : "Document archive is temporarily unavailable.";
  }

  const forceOpenLivehaulHref = buildForceLivehaulHref(item);
  const hatchTicketSummary = hatchTicketSummaryMap.get(placementId) ?? null;
  const closeoutSummary = item.closeout ? closeoutSummaryMap.get(placementId) ?? null : null;
  const livehaulPacketSummary = livehaulPacketSummaryMap.get(placementId) ?? null;
  const miscDocuments = miscDocumentMap.get(placementId) ?? [];
  const isArchived = item.lifecycleStage === "archived" || item.closeout?.status === "archived";

  return (
    <>
      <PageHeader
        eyebrow={isArchived ? "Flock Archive" : "Closeout"}
        title={item.placementCode}
        body={
          isArchived
            ? `Complete historical flock record for ${item.farmName}, Barn ${item.barnCode}. Closeout totals and livehaul detail are locked; archived documents remain available and closeout notes may still be updated.`
            : `Focused closeout workspace for ${item.farmName}, Barn ${item.barnCode}. Enter actual livehaul detail, reconcile what has been done, and then return to the queue when this placement is ready for final submission.`
        }
        actions={
          <>
            <Link
              className="button"
              href={`/admin/flock-closeout/${item.placementId}/report`}
              rel="noreferrer"
              target="_blank"
            >
              Closeout Report
            </Link>
            <Link
              className="button"
              href={`/admin/flock-closeout/${item.placementId}/archive-summary`}
              rel="noreferrer"
              target="_blank"
            >
              Flock Detail Report
            </Link>
            {!isArchived ? (
              <Link className="button-secondary" href={`/admin/placements/${item.placementId}/logs`}>
                Log Matrix Editor
              </Link>
            ) : null}
            {!isArchived ? (
              <Link className="button-secondary" href={forceOpenLivehaulHref}>
                Force Open Livehaul Scheduler
              </Link>
            ) : null}
            <Link className="button-secondary" href={openedFromFlocks ? `/admin/flocks/${item.flockId}` : "/admin/flock-closeout"}>
              {openedFromFlocks ? "Return To Flock" : "Return To Queue"}
            </Link>
          </>
        }
      />

      <section className="closeout-summary-grid">
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">State</p>
          <strong>{formatStage(item.lifecycleStage)}</strong>
          <p className="table-subtitle">Current placement closeout state</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Placed / Removed</p>
          <strong>{`${formatDate(item.placedDate)} | ${formatDate(item.removedDate)}`}</strong>
          <p className="table-subtitle">Placement lifecycle dates</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Birds Started</p>
          <strong>{item.headCount.toLocaleString()}</strong>
          <p className="table-subtitle">Starting head count</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Final / Oldest Age</p>
          <strong>{`${item.finalHeadCount.toLocaleString()} | ${formatAge(item.placedDate, item.removedDate)}`}</strong>
          <p className="table-subtitle">Final actual population and age</p>
        </article>
        <article className="panel card closeout-summary-card">
          <p className="eyebrow">Issues: Barn / Placement</p>
          <strong>{`${item.openBarnIssueCount.toLocaleString()} | ${item.openPlacementIssueCount.toLocaleString()}`}</strong>
          <p className="table-subtitle">Open issue counts</p>
        </article>
      </section>

      <section className="closeout-detail-stack">
        {isArchived ? (
          <section className="panel card">
            <div className="placement-scheduler-projection">
              <span>Archived Flock Record</span>
              <strong>This placement is preserved as a read-only production record.</strong>
              <p>Reports and filed documents remain available. Only the closeout notes field below can be updated.</p>
            </div>
          </section>
        ) : null}
        <CloseoutDocumentChecklist
          archiveWarning={archiveWarning}
          closeoutSummary={closeoutSummary}
          hatchTicket={hatchTicketSummary}
          livehaulPacket={livehaulPacketSummary}
          miscDocuments={miscDocuments}
          placementCode={item.placementCode}
          placementId={item.placementId}
        />

        <CloseoutWorksheetForm item={item} readOnly={isArchived} />

        {item.livehauls.length > 0 ? (
          item.livehauls.map((livehaul) => (
            <CloseoutLivehaulLoadsPanel item={item} key={livehaul.livehaulId} livehaul={livehaul} readOnly={isArchived} />
          ))
        ) : (
          <section className="panel card">
            <div className="placement-scheduler-projection">
              <span>No scheduled livehauls</span>
              <strong>This placement does not yet have livehaul schedule rows available for closeout work.</strong>
              <p>Schedule the livehaul dates first in Placements &gt; Livehaul, then return here to complete the actual closeout detail.</p>
              {!isArchived ? (
                <div className="closeout-action-links">
                  <Link className="button" href={forceOpenLivehaulHref}>
                    Force Open Livehaul Scheduler
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </section>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatStage(value: string) {
  if (value === "waiting_closeout") return "Waiting Closeout";
  if (value === "closeout_submitted") return "Closeout Submitted";
  if (value === "archived") return "Archived";
  return "Closeout";
}

function formatDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

function formatAge(placedDate: string | null, removedDate: string | null) {
  if (!placedDate || !removedDate) return "--";
  const placed = new Date(`${placedDate}T00:00:00`);
  const removed = new Date(`${removedDate}T00:00:00`);
  if (Number.isNaN(placed.getTime()) || Number.isNaN(removed.getTime())) return "--";
  const days = Math.max(0, Math.round((removed.getTime() - placed.getTime()) / 86400000));
  return `${days}d`;
}

function buildForceLivehaulHref(item: {
  farmId: string;
  barnId: string;
  placementId: string;
  removedDate: string | null;
  projectedEndDate: string | null;
  placedDate: string | null;
}) {
  const anchorDate = item.removedDate ?? item.projectedEndDate ?? item.placedDate;
  const month = anchorDate ? anchorDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const query = new URLSearchParams();
  query.set("farm", item.farmId);
  query.set("barn", item.barnId);
  query.set("placement", item.placementId);
  query.set("month", month);
  if (anchorDate) {
    query.set("date", anchorDate);
  }
  return `/admin/placements/livehaul?${query.toString()}`;
}
