import type { ActorPlacementAccess } from "@/lib/placement-editor-access";
import { canAccessFarmManagerReport, hasActorFarmScope } from "@/lib/placement-editor-access";
import { getCloseoutQueueData, type CloseoutQueueItem } from "@/lib/closeout-data";

export type CloseoutQueueReportSort = "date" | "placement" | "state";

export type CloseoutQueueReportFilters = {
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  flockCode?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sortOrder?: string | null;
};

export type CloseoutQueueReportRow = CloseoutQueueItem & {
  workflowState: string;
  completedMilestones: number;
  totalMilestones: number;
};

export type CloseoutQueueReportData = {
  rows: CloseoutQueueReportRow[];
  filters: {
    farmGroupId: string;
    farmId: string;
    barnId: string;
    flockCode: string;
    startDate: string;
    endDate: string;
    sortOrder: CloseoutQueueReportSort;
  };
  totals: {
    all: number;
    waiting: number;
    submitted: number;
    settlementReceived: number;
  };
};

export type CloseoutQueueReportFilterOptions = {
  farmGroups: Array<{ id: string; name: string }>;
  farms: Array<{ id: string; farmGroupId: string; name: string }>;
  barns: Array<{ id: string; farmGroupId: string; farmId: string; label: string }>;
  flocks: Array<{ id: string; farmGroupId: string; farmId: string; barnId: string; value: string; label: string }>;
};

export async function getScopedCloseoutQueueItems(actor: ActorPlacementAccess) {
  if (!canAccessFarmManagerReport(actor)) return [];
  const queue = await getCloseoutQueueData();
  return queue.items.filter((item) => hasActorFarmScope(actor, item));
}

export async function getCloseoutQueueReportData(
  actor: ActorPlacementAccess,
  filters: CloseoutQueueReportFilters = {},
): Promise<CloseoutQueueReportData> {
  const normalizedFilters = {
    farmGroupId: normalize(filters.farmGroupId),
    farmId: normalize(filters.farmId),
    barnId: normalize(filters.barnId),
    flockCode: normalize(filters.flockCode),
    startDate: normalize(filters.startDate),
    endDate: normalize(filters.endDate),
    sortOrder: normalizeSort(filters.sortOrder),
  };
  const scopedItems = await getScopedCloseoutQueueItems(actor);
  const rows = scopedItems
    .filter((item) => {
      if (normalizedFilters.farmGroupId && item.farmGroupId !== normalizedFilters.farmGroupId) return false;
      if (normalizedFilters.farmId && item.farmId !== normalizedFilters.farmId) return false;
      if (normalizedFilters.barnId && item.barnId !== normalizedFilters.barnId) return false;
      if (normalizedFilters.flockCode && item.placementCode !== normalizedFilters.flockCode) return false;
      if (normalizedFilters.startDate && (!item.removedDate || item.removedDate < normalizedFilters.startDate)) return false;
      if (normalizedFilters.endDate && (!item.removedDate || item.removedDate > normalizedFilters.endDate)) return false;
      return true;
    })
    .map((item) => ({
      ...item,
      workflowState: deriveWorkflowState(item),
      completedMilestones: countCompletedMilestones(item),
      totalMilestones: 5,
    }))
    .sort((left, right) => compareRows(left, right, normalizedFilters.sortOrder));

  return {
    rows,
    filters: normalizedFilters,
    totals: {
      all: rows.length,
      waiting: rows.filter((item) => item.lifecycleStage === "waiting_closeout").length,
      submitted: rows.filter((item) => item.lifecycleStage === "closeout_submitted").length,
      settlementReceived: rows.filter((item) => item.queueTasks.settlementReceived).length,
    },
  };
}

export function buildCloseoutQueueReportFilterOptions(
  items: CloseoutQueueItem[],
): CloseoutQueueReportFilterOptions {
  return {
    farmGroups: dedupe(
      items.filter((item) => item.farmGroupId).map((item) => ({ id: item.farmGroupId, name: item.farmGroupName })),
    ).sort((left, right) => left.name.localeCompare(right.name)),
    farms: dedupe(
      items.map((item) => ({ id: item.farmId, farmGroupId: item.farmGroupId, name: item.farmName })),
    ).sort((left, right) => left.name.localeCompare(right.name)),
    barns: dedupe(
      items.map((item) => ({
        id: item.barnId,
        farmGroupId: item.farmGroupId,
        farmId: item.farmId,
        label: `${item.barnCode} · ${item.farmName}`,
      })),
    ).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true })),
    flocks: dedupe(
      items.map((item) => ({
        id: item.placementId,
        farmGroupId: item.farmGroupId,
        farmId: item.farmId,
        barnId: item.barnId,
        value: item.placementCode,
        label: `${item.placementCode} · ${item.barnCode} · ${item.farmName}`,
      })),
    ).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true })),
  };
}

export function formatQueueStage(item: Pick<CloseoutQueueItem, "lifecycleStage">) {
  return item.lifecycleStage === "closeout_submitted" ? "Submitted" : "Waiting";
}

function deriveWorkflowState(item: CloseoutQueueItem) {
  if (item.queueTasks.settlementReceived) return "Settlement Received";
  if (item.queueTasks.submitted) return "Awaiting Settlement";
  if (item.queueTasks.invoiceCreated) return "Invoice Created";
  if (item.queueTasks.feedVerified) return "Feed Verified";
  if (item.queueTasks.livehaulComplete) return "Livehaul Complete";
  if (item.closeout?.closeoutId) return "Draft Started";
  return "Not Started";
}

function countCompletedMilestones(item: CloseoutQueueItem) {
  return [
    item.queueTasks.livehaulComplete,
    item.queueTasks.feedVerified,
    item.queueTasks.invoiceCreated,
    item.queueTasks.submitted,
    item.queueTasks.settlementReceived,
  ].filter(Boolean).length;
}

function compareRows(left: CloseoutQueueReportRow, right: CloseoutQueueReportRow, sortOrder: CloseoutQueueReportSort) {
  if (sortOrder === "placement") {
    return left.placementCode.localeCompare(right.placementCode, undefined, { numeric: true });
  }
  if (sortOrder === "state") {
    const stateCompare = stateRank(left) - stateRank(right);
    if (stateCompare !== 0) return stateCompare;
    return compareDateDescending(left, right);
  }
  return compareDateDescending(left, right);
}

function compareDateDescending(left: CloseoutQueueReportRow, right: CloseoutQueueReportRow) {
  const dateCompare = String(right.removedDate ?? "").localeCompare(String(left.removedDate ?? ""));
  if (dateCompare !== 0) return dateCompare;
  return left.placementCode.localeCompare(right.placementCode, undefined, { numeric: true });
}

function stateRank(item: CloseoutQueueReportRow) {
  if (item.lifecycleStage === "waiting_closeout") return item.completedMilestones;
  return 10 + item.completedMilestones;
}

function normalizeSort(value: string | null | undefined): CloseoutQueueReportSort {
  return value === "placement" || value === "state" ? value : "date";
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function dedupe<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}
