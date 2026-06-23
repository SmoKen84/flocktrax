import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const DOCUMENT_ARCHIVE_BUCKET = "flocktrax-document-archive";
export const FEED_TICKET_DOCUMENT_ROLE = "feed_ticket_original";
export const HATCH_TICKET_DOCUMENT_ROLE = "hatch_ticket";
export const BILL_OF_LADING_DOCUMENT_ROLE = "bill_of_lading";
export const CLOSEOUT_SHEET_SNAPSHOT_DOCUMENT_ROLE = "closeout_sheet_snapshot";
export const MISC_DOCUMENT_ROLE = "misc_document";

export type DocumentArchiveSummary = {
  documentId: string | null;
  originalFilename: string | null;
  uploadedAt: string | null;
  sourceKind: string | null;
  isOnFile: boolean;
};

export type FeedTicketDocumentSummary = DocumentArchiveSummary;
export type PlacementDocumentSummary = DocumentArchiveSummary;

export type DocumentArchiveListItem = {
  documentId: string;
  originalFilename: string | null;
  uploadedAt: string | null;
  sourceKind: string | null;
  title: string | null;
};

type DocumentArchiveRow = {
  id: string;
  placement_id: string | null;
  feed_ticket_id: string | null;
  livehaul_schedule_id: string | null;
  placement_closeout_id: string | null;
  original_filename: string | null;
  created_at: string | null;
  source_kind: string | null;
  notes: string | null;
};

export async function getFeedTicketDocumentSummaryMap(ticketIds: string[]) {
  noStore();

  const normalizedIds = Array.from(new Set(ticketIds.map((value) => value.trim()).filter(Boolean)));
  const summaryByTicketId = new Map<string, FeedTicketDocumentSummary>();

  if (normalizedIds.length === 0) {
    return summaryByTicketId;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Document archive could not connect to Supabase.");
  }

  const { data, error } = await admin
    .from("document_archives")
    .select("id,feed_ticket_id,original_filename,created_at,source_kind")
    .eq("document_role", FEED_TICKET_DOCUMENT_ROLE)
    .eq("is_current", true)
    .in("feed_ticket_id", normalizedIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as DocumentArchiveRow[]) {
    const ticketId = row.feed_ticket_id?.trim();
    if (!ticketId || summaryByTicketId.has(ticketId)) {
      continue;
    }

    summaryByTicketId.set(ticketId, {
      documentId: row.id,
      originalFilename: row.original_filename?.trim() || null,
      uploadedAt: row.created_at ?? null,
      sourceKind: row.source_kind?.trim() || null,
      isOnFile: true,
    });
  }

  return summaryByTicketId;
}

export async function getPlacementDocumentSummaryMap(placementIds: string[], documentRole: string) {
  noStore();

  const normalizedIds = Array.from(new Set(placementIds.map((value) => value.trim()).filter(Boolean)));
  const summaryByPlacementId = new Map<string, PlacementDocumentSummary>();

  if (normalizedIds.length === 0) {
    return summaryByPlacementId;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Document archive could not connect to Supabase.");
  }

  const { data, error } = await admin
    .from("document_archives")
    .select("id,placement_id,original_filename,created_at,source_kind")
    .eq("document_role", documentRole)
    .eq("is_current", true)
    .in("placement_id", normalizedIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as DocumentArchiveRow[]) {
    const placementId = row.placement_id?.trim();
    if (!placementId || summaryByPlacementId.has(placementId)) {
      continue;
    }

    summaryByPlacementId.set(placementId, {
      documentId: row.id,
      originalFilename: row.original_filename?.trim() || null,
      uploadedAt: row.created_at ?? null,
      sourceKind: row.source_kind?.trim() || null,
      isOnFile: true,
    });
  }

  return summaryByPlacementId;
}

export async function getLivehaulScheduleDocumentSummaryMap(livehaulIds: string[], documentRole: string) {
  noStore();

  const normalizedIds = Array.from(new Set(livehaulIds.map((value) => value.trim()).filter(Boolean)));
  const summaryByLivehaulId = new Map<string, DocumentArchiveSummary>();

  if (normalizedIds.length === 0) {
    return summaryByLivehaulId;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Document archive could not connect to Supabase.");
  }

  const { data, error } = await admin
    .from("document_archives")
    .select("id,livehaul_schedule_id,original_filename,created_at,source_kind")
    .eq("document_role", documentRole)
    .eq("is_current", true)
    .in("livehaul_schedule_id", normalizedIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as DocumentArchiveRow[]) {
    const livehaulId = row.livehaul_schedule_id?.trim();
    if (!livehaulId || summaryByLivehaulId.has(livehaulId)) {
      continue;
    }

    summaryByLivehaulId.set(livehaulId, {
      documentId: row.id,
      originalFilename: row.original_filename?.trim() || null,
      uploadedAt: row.created_at ?? null,
      sourceKind: row.source_kind?.trim() || null,
      isOnFile: true,
    });
  }

  return summaryByLivehaulId;
}

export async function getPlacementCloseoutDocumentSummaryMap(placementIds: string[], documentRole: string) {
  noStore();

  const normalizedIds = Array.from(new Set(placementIds.map((value) => value.trim()).filter(Boolean)));
  const summaryByPlacementId = new Map<string, DocumentArchiveSummary>();

  if (normalizedIds.length === 0) {
    return summaryByPlacementId;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Document archive could not connect to Supabase.");
  }

  const { data, error } = await admin
    .from("document_archives")
    .select("id,placement_closeout_id,original_filename,created_at,source_kind")
    .eq("document_role", documentRole)
    .eq("is_current", true)
    .in("placement_closeout_id", normalizedIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as DocumentArchiveRow[]) {
    const placementId = row.placement_closeout_id?.trim();
    if (!placementId || summaryByPlacementId.has(placementId)) {
      continue;
    }

    summaryByPlacementId.set(placementId, {
      documentId: row.id,
      originalFilename: row.original_filename?.trim() || null,
      uploadedAt: row.created_at ?? null,
      sourceKind: row.source_kind?.trim() || null,
      isOnFile: true,
    });
  }

  return summaryByPlacementId;
}

export async function getPlacementDocumentListMap(placementIds: string[], documentRole: string) {
  noStore();

  const normalizedIds = Array.from(new Set(placementIds.map((value) => value.trim()).filter(Boolean)));
  const listByPlacementId = new Map<string, DocumentArchiveListItem[]>();

  if (normalizedIds.length === 0) {
    return listByPlacementId;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Document archive could not connect to Supabase.");
  }

  const { data, error } = await admin
    .from("document_archives")
    .select("id,placement_id,original_filename,created_at,source_kind,notes")
    .eq("document_role", documentRole)
    .eq("is_current", true)
    .in("placement_id", normalizedIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as DocumentArchiveRow[]) {
    const placementId = row.placement_id?.trim();
    if (!placementId) {
      continue;
    }

    const bucket = listByPlacementId.get(placementId) ?? [];
    bucket.push({
      documentId: row.id,
      originalFilename: row.original_filename?.trim() || null,
      uploadedAt: row.created_at ?? null,
      sourceKind: row.source_kind?.trim() || null,
      title: row.notes?.trim() || row.original_filename?.trim() || null,
    });
    listByPlacementId.set(placementId, bucket);
  }

  return listByPlacementId;
}
