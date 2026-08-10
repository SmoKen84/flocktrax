"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CLOSEOUT_SHEET_SNAPSHOT_DOCUMENT_ROLE,
  DOCUMENT_ARCHIVE_BUCKET,
  MISC_DOCUMENT_ROLE,
} from "@/lib/document-archive";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type CloseoutFormState = {
  status: "idle" | "success" | "error";
  message: string;
  readyToArchive?: boolean;
};

export type CloseoutLivehaulStatusFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type CloseoutDocumentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

type ActivePlacementRecalcRow = {
  id: string;
  placement_key: string | null;
  lifecycle_stage: string | null;
};

type CloseoutRecalcRow = {
  placement_id: string;
  processed_head_final: number | null;
  live_weight_final: number | null;
  feed_remaining_credit_lbs: number | null;
  submitted_at: string | null;
  settlement_received_at: string | null;
};

type FeedDropRecalcRow = {
  placement_code: string | null;
  drop_weight: number | null;
  type: string | null;
};

type PlacementArchiveRow = {
  id: string;
  placement_key: string | null;
};

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

function coerce(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function coerceNullableNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceNullableText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function coerceCheckbox(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase() === "on";
}

async function getActor() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return user;
}

function sanitizePathPart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extensionForUpload(file: File) {
  const fileName = file.name.trim();
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex > -1 && dotIndex < fileName.length - 1) {
    return sanitizePathPart(fileName.slice(dotIndex + 1)).toLowerCase();
  }

  switch (file.type) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

function buildCloseoutStoragePath(placement: PlacementArchiveRow, file: File) {
  const placementLabel = sanitizePathPart(placement.placement_key?.trim() || placement.id);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = extensionForUpload(file);

  return `closeout-summaries/${placement.id}/${timestamp}-${placementLabel}.${extension}`;
}

function deriveProcessedHeadCountFromLivehaul(
  scheduleRows: Array<{ livehaul_id: string; head_actual: number | null }>,
  loadRows: Array<{ livehaul_id: string; head_count: number | null }>,
  persistedValue: number | null,
) {
  const loadHeadByLivehaulId = new Map<string, number>();
  for (const row of loadRows) {
    loadHeadByLivehaulId.set(row.livehaul_id, (loadHeadByLivehaulId.get(row.livehaul_id) ?? 0) + (row.head_count ?? 0));
  }

  const loadTotal = Array.from(loadHeadByLivehaulId.values()).reduce((sum, value) => sum + value, 0);
  if (loadTotal > 0) {
    return loadTotal;
  }

  const actualTotal = scheduleRows.reduce((sum, row) => sum + (row.head_actual ?? 0), 0);
  if (actualTotal > 0) {
    return actualTotal;
  }

  return persistedValue;
}

function deriveLiveWeightFromLivehaul(
  loadRows: Array<{ live_weight: number | null }>,
  persistedValue: number | null,
) {
  if (persistedValue !== null && Number.isFinite(persistedValue)) {
    return persistedValue;
  }

  const total = loadRows.reduce((sum, row) => sum + (row.live_weight ?? 0), 0);
  return total > 0 ? total : null;
}

export async function recalculateQueueCloseoutTotalsAction(formData: FormData) {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin || !actor) {
    throw new Error("A signed-in admin user is required to recalculate closeout totals.");
  }

  const page = coerce(formData.get("page"));

  const { data: placementRows, error: placementError } = await admin
    .from("placements")
    .select("id,placement_key,lifecycle_stage")
    .in("lifecycle_stage", ["waiting_closeout", "closeout_submitted"]);

  if (placementError) {
    throw new Error(placementError.message);
  }

  const activePlacements = (placementRows ?? []) as ActivePlacementRecalcRow[];
  const placementIds = activePlacements.map((row) => row.id).filter(Boolean);
  const placementCodes = activePlacements.map((row) => coerce(row.placement_key)).filter(Boolean);

  if (placementIds.length === 0) {
    revalidatePath("/admin/flock-closeout");
    redirect(page ? `/admin/flock-closeout?page=${page}` : "/admin/flock-closeout");
  }

  const [closeoutResult, feedDropResult, livehaulScheduleResult, livehaulLoadResult] = await Promise.all([
    admin
      .from("placement_closeouts")
      .select("placement_id,processed_head_final,live_weight_final,feed_remaining_credit_lbs,submitted_at,settlement_received_at")
      .in("placement_id", placementIds),
    admin.from("feed_drops").select("placement_code,drop_weight,type").in("placement_code", placementCodes),
    admin.from("livehaul_schedule").select("livehaul_id,placement_id,head_actual").in("placement_id", placementIds),
    admin.from("livehaul_loads").select("livehaul_id,head_count,live_weight"),
  ]);

  if (closeoutResult.error) throw new Error(closeoutResult.error.message);
  if (feedDropResult.error) throw new Error(feedDropResult.error.message);
  if (livehaulScheduleResult.error) throw new Error(livehaulScheduleResult.error.message);
  if (livehaulLoadResult.error) throw new Error(livehaulLoadResult.error.message);

  const closeoutByPlacementId = new Map(
    ((closeoutResult.data ?? []) as CloseoutRecalcRow[]).map((row) => [row.placement_id, row]),
  );

  const feedTotalsByPlacementCode = new Map<string, { delivered: number; starter: number; grower: number }>();
  for (const row of ((feedDropResult.data ?? []) as FeedDropRecalcRow[])) {
    const placementCode = coerce(row.placement_code);
    if (!placementCode) continue;
    const bucket = feedTotalsByPlacementCode.get(placementCode) ?? { delivered: 0, starter: 0, grower: 0 };
    const pounds = Number(row.drop_weight) || 0;
    bucket.delivered += pounds;
    const type = coerce(row.type).toLowerCase();
    if (type === "starter") bucket.starter += pounds;
    if (type === "grower") bucket.grower += pounds;
    feedTotalsByPlacementCode.set(placementCode, bucket);
  }

  const livehaulRows = ((livehaulScheduleResult.data ?? []) as Array<{ livehaul_id: string; placement_id: string; head_actual: number | null }>);
  const activeLivehaulIds = new Set(livehaulRows.map((row) => row.livehaul_id));
  const livehaulLoadsById = new Map<string, Array<{ livehaul_id: string; head_count: number | null; live_weight: number | null }>>();
  for (const row of ((livehaulLoadResult.data ?? []) as Array<{ livehaul_id: string; head_count: number | null; live_weight: number | null }>)) {
    if (!activeLivehaulIds.has(row.livehaul_id)) continue;
    const bucket = livehaulLoadsById.get(row.livehaul_id) ?? [];
    bucket.push(row);
    livehaulLoadsById.set(row.livehaul_id, bucket);
  }

  for (const placement of activePlacements) {
    const placementCode = coerce(placement.placement_key);
    const closeout = closeoutByPlacementId.get(placement.id);
    if (!closeout || !placementCode) continue;

    const feedTotals = feedTotalsByPlacementCode.get(placementCode) ?? { delivered: 0, starter: 0, grower: 0 };
    const scheduleRows = livehaulRows.filter((row) => row.placement_id === placement.id);
    const loadRows = scheduleRows.flatMap((row) => livehaulLoadsById.get(row.livehaul_id) ?? []);
    const processedHeadFinal = deriveProcessedHeadCountFromLivehaul(scheduleRows, loadRows, closeout.processed_head_final);
    const liveWeightFinal = deriveLiveWeightFromLivehaul(loadRows, closeout.live_weight_final);
    const remainingCredit = closeout.feed_remaining_credit_lbs ?? 0;
    const feedConsumedTotalLbs = Math.max(0, feedTotals.delivered - remainingCredit);

    const { error: updateError } = await admin
      .from("placement_closeouts")
      .update({
        feed_delivered_total_lbs: feedTotals.delivered,
        feed_consumed_total_lbs: feedConsumedTotalLbs,
        starter_consumed_lbs: feedTotals.starter,
        grower_consumed_lbs: feedTotals.grower,
        feed_per_head_lbs:
          processedHeadFinal !== null && processedHeadFinal > 0 ? feedConsumedTotalLbs / processedHeadFinal : null,
        starter_per_head_lbs:
          processedHeadFinal !== null && processedHeadFinal > 0 ? feedTotals.starter / processedHeadFinal : null,
        grower_per_head_lbs:
          processedHeadFinal !== null && processedHeadFinal > 0 ? feedTotals.grower / processedHeadFinal : null,
        feed_conversion:
          liveWeightFinal !== null && liveWeightFinal > 0 ? feedConsumedTotalLbs / liveWeightFinal : null,
        updated_by: actor.id,
      })
      .eq("placement_id", placement.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  revalidatePath("/admin/flock-closeout");
  for (const placementId of placementIds) {
    revalidatePath(`/admin/flock-closeout/${placementId}`);
  }
  redirect(page ? `/admin/flock-closeout?page=${page}` : "/admin/flock-closeout");
}

export async function uploadCloseoutSummarySnapshotAction(
  _prevState: CloseoutDocumentActionState,
  formData: FormData,
): Promise<CloseoutDocumentActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin || !actor) {
    return {
      status: "error",
      message: "A signed-in admin user is required to archive closeout summaries.",
    };
  }

  const placementId = coerce(formData.get("placement_id"));
  const sourceKind = coerce(formData.get("source_kind")) || "manual_upload";
  const notes = coerceNullableText(formData.get("notes"));
  const fileValue = formData.get("document");

  if (!placementId) {
    return { status: "error", message: "Placement id is required." };
  }

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return { status: "error", message: "Choose a PDF or image file to archive." };
  }

  if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
    return { status: "error", message: "Only PDF, JPG, PNG, HEIC, and HEIF originals are allowed." };
  }

  if (fileValue.size > MAX_UPLOAD_BYTES) {
    return { status: "error", message: "The selected file is larger than the 20 MB archive limit." };
  }

  const { data: placementRow, error: placementError } = await admin
    .from("placements")
    .select("id,placement_key")
    .eq("id", placementId)
    .maybeSingle();

  if (placementError || !placementRow) {
    return { status: "error", message: placementError?.message ?? "The selected placement could not be found." };
  }

  const { data: closeoutRow, error: closeoutError } = await admin
    .from("placement_closeouts")
    .select("placement_id")
    .eq("placement_id", placementId)
    .maybeSingle();

  if (closeoutError) {
    return { status: "error", message: closeoutError.message };
  }

  const closeoutPlacementId = coerce(closeoutRow?.placement_id ?? null);
  if (!closeoutPlacementId) {
    return { status: "error", message: "Create the placement closeout worksheet before archiving the summary snapshot." };
  }

  const storagePath = buildCloseoutStoragePath(placementRow, fileValue);
  const bytes = new Uint8Array(await fileValue.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_ARCHIVE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: fileValue.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { status: "error", message: uploadError.message };
  }

  const timestamp = new Date().toISOString();

  const { error: retireError } = await admin
    .from("document_archives")
    .update({
      is_current: false,
      replaced_at: timestamp,
      replaced_by: actor.id,
    })
    .eq("placement_closeout_id", closeoutPlacementId)
    .eq("document_role", CLOSEOUT_SHEET_SNAPSHOT_DOCUMENT_ROLE)
    .eq("is_current", true);

  if (retireError) {
    await admin.storage.from(DOCUMENT_ARCHIVE_BUCKET).remove([storagePath]);
    return { status: "error", message: retireError.message };
  }

  const { error: insertError } = await admin.from("document_archives").insert({
    document_role: CLOSEOUT_SHEET_SNAPSHOT_DOCUMENT_ROLE,
    placement_closeout_id: closeoutPlacementId,
    storage_bucket: DOCUMENT_ARCHIVE_BUCKET,
    storage_path: storagePath,
    original_filename: fileValue.name.trim() || "closeout-summary",
    mime_type: fileValue.type || null,
    byte_size: fileValue.size,
    sha256,
    source_kind: sourceKind,
    notes,
    is_current: true,
    created_by: actor.id,
  });

  if (insertError) {
    await admin.storage.from(DOCUMENT_ARCHIVE_BUCKET).remove([storagePath]);
    return { status: "error", message: insertError.message };
  }

  revalidatePath("/admin/flock-closeout");
  revalidatePath(`/admin/flock-closeout/${placementId}`);
  return { status: "success", message: "Closeout summary archived." };
}

export async function uploadPlacementMiscDocumentAction(
  _prevState: CloseoutDocumentActionState,
  formData: FormData,
): Promise<CloseoutDocumentActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin || !actor) {
    return {
      status: "error",
      message: "A signed-in admin user is required to archive supporting documents.",
    };
  }

  const placementId = coerce(formData.get("placement_id"));
  const sourceKind = coerce(formData.get("source_kind")) || "manual_upload";
  const title = coerce(formData.get("title"));
  const notes = coerceNullableText(formData.get("notes"));
  const fileValue = formData.get("document");

  if (!placementId) {
    return { status: "error", message: "Placement id is required." };
  }

  if (!title) {
    return { status: "error", message: "Document title is required." };
  }

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return { status: "error", message: "Choose a PDF or image file to archive." };
  }

  if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
    return { status: "error", message: "Only PDF, JPG, PNG, HEIC, and HEIF originals are allowed." };
  }

  if (fileValue.size > MAX_UPLOAD_BYTES) {
    return { status: "error", message: "The selected file is larger than the 20 MB archive limit." };
  }

  const { data: placementRow, error: placementError } = await admin
    .from("placements")
    .select("id,placement_key")
    .eq("id", placementId)
    .maybeSingle();

  if (placementError || !placementRow) {
    return { status: "error", message: placementError?.message ?? "The selected placement could not be found." };
  }

  const storagePath = `placements/misc/${placementId}/${new Date().toISOString().replace(/[:.]/g, "-")}-${sanitizePathPart(title)}.${extensionForUpload(fileValue)}`;
  const bytes = new Uint8Array(await fileValue.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_ARCHIVE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: fileValue.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return { status: "error", message: uploadError.message };
  }

  const storedNotes = [title, notes].filter(Boolean).join("\n");

  const { error: insertError } = await admin.from("document_archives").insert({
    document_role: MISC_DOCUMENT_ROLE,
    placement_id: placementId,
    storage_bucket: DOCUMENT_ARCHIVE_BUCKET,
    storage_path: storagePath,
    original_filename: fileValue.name.trim() || "supporting-document",
    mime_type: fileValue.type || null,
    byte_size: fileValue.size,
    sha256,
    source_kind: sourceKind,
    notes: storedNotes,
    is_current: true,
    created_by: actor.id,
  });

  if (insertError) {
    await admin.storage.from(DOCUMENT_ARCHIVE_BUCKET).remove([storagePath]);
    return { status: "error", message: insertError.message };
  }

  revalidatePath("/admin/flock-closeout");
  revalidatePath(`/admin/flock-closeout/${placementId}`);
  return { status: "success", message: "Supporting document archived." };
}

export async function recalculatePlacementCloseoutTotalsAction(formData: FormData) {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin || !actor) {
    throw new Error("A signed-in admin user is required to recalculate closeout totals.");
  }

  const placementId = coerce(formData.get("placement_id"));
  if (!placementId) {
    throw new Error("Placement context was incomplete for closeout recalculation.");
  }

  const { data: lockRow, error: lockError } = await admin
    .from("placement_closeouts")
    .select("status,archived_at")
    .eq("placement_id", placementId)
    .maybeSingle();

  if (lockError) throw new Error(lockError.message);
  if (lockRow?.status === "archived" || lockRow?.archived_at) {
    throw new Error("Archived closeout totals are locked.");
  }

  const { data: placementRow, error: placementError } = await admin
    .from("placements")
    .select("id,placement_key")
    .eq("id", placementId)
    .maybeSingle();

  if (placementError) {
    throw new Error(placementError.message);
  }

  const placementCode = coerce(placementRow?.placement_key ?? null);
  if (!placementRow || !placementCode) {
    throw new Error("Placement could not be resolved for closeout recalculation.");
  }

  const [closeoutResult, feedDropResult, livehaulScheduleResult, livehaulLoadResult] = await Promise.all([
    admin
      .from("placement_closeouts")
      .select("placement_id,processed_head_final,live_weight_final,feed_remaining_credit_lbs")
      .eq("placement_id", placementId)
      .maybeSingle(),
    admin.from("feed_drops").select("placement_code,drop_weight,type").eq("placement_code", placementCode),
    admin.from("livehaul_schedule").select("livehaul_id,placement_id,head_actual").eq("placement_id", placementId),
    admin.from("livehaul_loads").select("livehaul_id,head_count,live_weight"),
  ]);

  if (closeoutResult.error) throw new Error(closeoutResult.error.message);
  if (feedDropResult.error) throw new Error(feedDropResult.error.message);
  if (livehaulScheduleResult.error) throw new Error(livehaulScheduleResult.error.message);
  if (livehaulLoadResult.error) throw new Error(livehaulLoadResult.error.message);

  const closeout = closeoutResult.data as CloseoutRecalcRow | null;
  if (!closeout) {
    throw new Error("No closeout row exists yet for this placement.");
  }

  const feedDrops = (feedDropResult.data ?? []) as FeedDropRecalcRow[];
  const feedTotals = feedDrops.reduce(
    (sum, row) => {
      const pounds = Number(row.drop_weight) || 0;
      sum.delivered += pounds;
      const type = coerce(row.type).toLowerCase();
      if (type === "starter") sum.starter += pounds;
      if (type === "grower") sum.grower += pounds;
      return sum;
    },
    { delivered: 0, starter: 0, grower: 0 },
  );

  const scheduleRows = (livehaulScheduleResult.data ?? []) as Array<{ livehaul_id: string; placement_id: string; head_actual: number | null }>;
  const activeLivehaulIds = new Set(scheduleRows.map((row) => row.livehaul_id));
  const loadRows = ((livehaulLoadResult.data ?? []) as Array<{ livehaul_id: string; head_count: number | null; live_weight: number | null }>)
    .filter((row) => activeLivehaulIds.has(row.livehaul_id));

  const processedHeadFinal = deriveProcessedHeadCountFromLivehaul(scheduleRows, loadRows, closeout.processed_head_final);
  const liveWeightFinal = deriveLiveWeightFromLivehaul(loadRows, closeout.live_weight_final);
  const remainingCredit = closeout.feed_remaining_credit_lbs ?? 0;
  const feedConsumedTotalLbs = Math.max(0, feedTotals.delivered - remainingCredit);

  const { error: updateError } = await admin
    .from("placement_closeouts")
    .update({
      feed_delivered_total_lbs: feedTotals.delivered,
      feed_consumed_total_lbs: feedConsumedTotalLbs,
      starter_consumed_lbs: feedTotals.starter,
      grower_consumed_lbs: feedTotals.grower,
      feed_per_head_lbs:
        processedHeadFinal !== null && processedHeadFinal > 0 ? feedConsumedTotalLbs / processedHeadFinal : null,
      starter_per_head_lbs:
        processedHeadFinal !== null && processedHeadFinal > 0 ? feedTotals.starter / processedHeadFinal : null,
      grower_per_head_lbs:
        processedHeadFinal !== null && processedHeadFinal > 0 ? feedTotals.grower / processedHeadFinal : null,
      feed_conversion:
        liveWeightFinal !== null && liveWeightFinal > 0 ? feedConsumedTotalLbs / liveWeightFinal : null,
      updated_by: actor.id,
    })
    .eq("placement_id", placementId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/admin/flock-closeout");
  revalidatePath(`/admin/flock-closeout/${placementId}`);
  redirect(`/admin/flock-closeout/${placementId}`);
}

export async function saveCloseoutLivehaulStatusAction(
  _prevState: CloseoutLivehaulStatusFormState,
  formData: FormData,
): Promise<CloseoutLivehaulStatusFormState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin) {
    return { status: "error", message: "Supabase admin access is not configured for livehaul status updates." };
  }

  if (!actor) {
    return { status: "error", message: "A signed-in user is required to update livehaul status." };
  }

  const livehaulId = coerce(formData.get("livehaul_id"));
  const placementId = coerce(formData.get("placement_id"));
  const nextStatus = coerce(formData.get("status"));

  if (!livehaulId || !placementId || !nextStatus) {
    return { status: "error", message: "Livehaul status details were incomplete." };
  }

  const { data: placement, error: placementError } = await admin
    .from("placements")
    .select("lifecycle_stage")
    .eq("id", placementId)
    .maybeSingle();

  if (placementError) {
    return { status: "error", message: placementError.message };
  }
  if (placement?.lifecycle_stage === "archived") {
    return { status: "error", message: "Archived livehaul detail is locked." };
  }

  const allowedStatuses = new Set(["scheduled", "completed", "cancelled"]);
  if (!allowedStatuses.has(nextStatus)) {
    return { status: "error", message: "Livehaul status selection was invalid." };
  }

  const { error } = await admin
    .from("livehaul_schedule")
    .update({
      status: nextStatus,
      updated_by: actor.id,
    })
    .eq("livehaul_id", livehaulId);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath(`/admin/flock-closeout/${placementId}`);
  revalidatePath("/admin/flock-closeout");
  revalidatePath("/admin/placements/livehaul");

  return { status: "success", message: "Livehaul status updated." };
}

export async function savePlacementCloseoutDraftAction(
  _prevState: CloseoutFormState,
  formData: FormData,
): Promise<CloseoutFormState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin) {
    return { status: "error", message: "Supabase admin access is not configured for placement closeout." };
  }

  if (!actor) {
    return { status: "error", message: "A signed-in user is required to save closeout changes." };
  }

  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const placementCode = coerce(formData.get("placement_code"));

  if (!placementId || !flockId || !farmId || !barnId || !placementCode) {
    return { status: "error", message: "Closeout placement context was incomplete." };
  }

  const { data: archiveLock, error: archiveLockError } = await admin
    .from("placement_closeouts")
    .select("status,archived_at")
    .eq("placement_id", placementId)
    .maybeSingle();

  if (archiveLockError) {
    return { status: "error", message: archiveLockError.message };
  }
  if (archiveLock?.status === "archived" || archiveLock?.archived_at) {
    return { status: "error", message: "Archived closeout totals are locked. Only closeout notes may be updated." };
  }

  const processedHeadFinal = coerceNullableNumber(formData.get("processed_head_final"));
  const liveWeightFinal = coerceNullableNumber(formData.get("live_weight_final"));
  const notes = coerceNullableText(formData.get("notes"));
  const manualOverrideReason = coerceNullableText(formData.get("manual_override_reason"));
  const livehaulComplete = coerceCheckbox(formData.get("livehaul_complete"));
  const feedVerified = coerceCheckbox(formData.get("feed_verified"));
  const invoiceCreated = coerceCheckbox(formData.get("invoice_created"));
  const submitted = coerceCheckbox(formData.get("submitted"));
  const settlementReceived = coerceCheckbox(formData.get("settlement_received"));
  const closeoutCompleted = coerceCheckbox(formData.get("closeout_completed"));
  const breedExpectedAvgWeight = coerceNullableNumber(formData.get("breed_expected_avg_weight"));
  const breedActualAvgWeight = coerceNullableNumber(formData.get("breed_actual_avg_weight"));
  const breedWeightPercent = coerceNullableNumber(formData.get("breed_weight_percent"));
  const removedAgeDays = coerceNullableNumber(formData.get("removed_age_days"));

  const [feedResult, livehaulResult] = await Promise.all([
    admin.from("feed_drops").select("drop_weight,type").eq("placement_code", placementCode),
    admin.from("livehaul_schedule").select("livehaul_id").eq("placement_id", placementId),
  ]);

  if (feedResult.error) {
    return { status: "error", message: feedResult.error.message };
  }
  if (livehaulResult.error) {
    return { status: "error", message: livehaulResult.error.message };
  }

  const dropRows = feedResult.data ?? [];
  const livehaulIds = (livehaulResult.data ?? []).map((row) => row.livehaul_id).filter(Boolean);
  const loadResult = livehaulIds.length > 0
    ? await admin.from("livehaul_loads").select("live_weight").in("livehaul_id", livehaulIds)
    : { data: [], error: null };

  if (loadResult.error) {
    return { status: "error", message: loadResult.error.message };
  }

  const loadLiveWeightTotal = (loadResult.data ?? []).reduce(
    (sum, row) => sum + (Number(row.live_weight) || 0),
    0,
  );
  const hasLiveWeightDiscrepancy =
    liveWeightFinal !== null &&
    loadLiveWeightTotal > 0 &&
    Math.abs(liveWeightFinal - loadLiveWeightTotal) > 0.01;

  if (
    hasLiveWeightDiscrepancy &&
    (invoiceCreated || submitted) &&
    !manualOverrideReason
  ) {
    return {
      status: "error",
      message: `Live Weight ${liveWeightFinal.toLocaleString()} lb does not match the current livehaul load total of ${loadLiveWeightTotal.toLocaleString()} lb. Clear or correct the field, or document a Manual Override Reason before marking the invoice created or submitted.`,
    };
  }

  const feedDeliveredTotalLbs = (dropRows ?? []).reduce((sum, row) => sum + (Number(row.drop_weight) || 0), 0);
  const starterDeliveredLbs = (dropRows ?? []).reduce((sum, row) => {
    return String(row.type ?? "").trim().toLowerCase() === "starter" ? sum + (Number(row.drop_weight) || 0) : sum;
  }, 0);
  const growerDeliveredLbs = (dropRows ?? []).reduce((sum, row) => {
    return String(row.type ?? "").trim().toLowerCase() === "grower" ? sum + (Number(row.drop_weight) || 0) : sum;
  }, 0);

  const starterConsumedLbs = starterDeliveredLbs;
  const growerConsumedLbs = growerDeliveredLbs;
  const feedConsumedTotalLbs = feedDeliveredTotalLbs;
  const feedPerHeadLbs =
    processedHeadFinal !== null && processedHeadFinal > 0 ? feedConsumedTotalLbs / processedHeadFinal : null;
  const starterPerHeadLbs =
    processedHeadFinal !== null && processedHeadFinal > 0 ? starterConsumedLbs / processedHeadFinal : null;
  const growerPerHeadLbs =
    processedHeadFinal !== null && processedHeadFinal > 0 ? growerConsumedLbs / processedHeadFinal : null;
  const feedConversion =
    liveWeightFinal !== null && liveWeightFinal > 0 ? feedConsumedTotalLbs / liveWeightFinal : null;

  const { data: existingRow, error: existingError } = await admin
    .from("placement_closeouts")
    .select("closeout_id,status,livehaul_complete_at,livehaul_complete_by,feed_verified_at,feed_verified_by,invoice_created_at,invoice_created_by,closeout_completed_at,closeout_completed_by,submitted_at,submitted_by,settlement_received_at,settlement_received_by,archived_at,archived_by")
    .eq("placement_id", placementId)
    .maybeSingle();

  if (existingError) {
    return { status: "error", message: existingError.message };
  }

  const now = new Date().toISOString();
  const actorId = actor.id;
  const livehaulCompleteAt = livehaulComplete ? existingRow?.livehaul_complete_at ?? now : null;
  const livehaulCompleteBy = livehaulComplete ? existingRow?.livehaul_complete_by ?? actorId : null;
  const feedVerifiedAt = feedVerified ? existingRow?.feed_verified_at ?? now : null;
  const feedVerifiedBy = feedVerified ? existingRow?.feed_verified_by ?? actorId : null;
  const invoiceCreatedAt = invoiceCreated ? existingRow?.invoice_created_at ?? now : null;
  const invoiceCreatedBy = invoiceCreated ? existingRow?.invoice_created_by ?? actorId : null;
  const submittedAt = submitted ? existingRow?.submitted_at ?? now : null;
  const submittedBy = submitted ? existingRow?.submitted_by ?? actorId : null;
  const settlementReceivedAt = settlementReceived ? existingRow?.settlement_received_at ?? now : null;
  const settlementReceivedBy = settlementReceived ? existingRow?.settlement_received_by ?? actorId : null;
  const closeoutCompletedAt = closeoutCompleted ? existingRow?.closeout_completed_at ?? now : null;
  const closeoutCompletedBy = closeoutCompleted ? existingRow?.closeout_completed_by ?? actorId : null;

  const derivedStatus = settlementReceived ? "settlement_received" : submitted ? "submitted" : "draft";

  const payload = {
    placement_id: placementId,
    flock_id: flockId,
    farm_id: farmId,
    barn_id: barnId,
    status: derivedStatus,
    processed_head_final: processedHeadFinal,
    live_weight_final: liveWeightFinal,
    feed_delivered_total_lbs: feedDeliveredTotalLbs,
    feed_remaining_credit_lbs: null,
    feed_consumed_total_lbs: feedConsumedTotalLbs,
    starter_consumed_lbs: starterConsumedLbs,
    grower_consumed_lbs: growerConsumedLbs,
    feed_per_head_lbs: feedPerHeadLbs,
    starter_per_head_lbs: starterPerHeadLbs,
    grower_per_head_lbs: growerPerHeadLbs,
    feed_conversion: feedConversion,
    breed_stat_snapshot:
      removedAgeDays !== null || breedExpectedAvgWeight !== null
        ? {
            removed_age_days: removedAgeDays,
            expected_avg_weight: breedExpectedAvgWeight,
          }
        : null,
    breed_stat_comparison:
      breedActualAvgWeight !== null || breedWeightPercent !== null
        ? {
            actual_avg_weight: breedActualAvgWeight,
            percent_of_target: breedWeightPercent,
          }
        : null,
    notes,
    manual_override_reason: manualOverrideReason,
    livehaul_complete_at: livehaulCompleteAt,
    livehaul_complete_by: livehaulCompleteBy,
    feed_verified_at: feedVerifiedAt,
    feed_verified_by: feedVerifiedBy,
    invoice_created_at: invoiceCreatedAt,
    invoice_created_by: invoiceCreatedBy,
    closeout_completed_at: closeoutCompletedAt,
    closeout_completed_by: closeoutCompletedBy,
    submitted_at: submittedAt,
    submitted_by: submittedBy,
    settlement_received_at: settlementReceivedAt,
    settlement_received_by: settlementReceivedBy,
    archived_at: existingRow?.archived_at ?? null,
    archived_by: existingRow?.archived_by ?? null,
    updated_by: actor.id,
  };

  const query = existingRow
    ? admin.from("placement_closeouts").update(payload).eq("placement_id", placementId)
    : admin.from("placement_closeouts").insert(payload);

  const { error: saveError } = await query;
  if (saveError) {
    return { status: "error", message: saveError.message };
  }

  const placementLifecycleStage = submitted ? "closeout_submitted" : "waiting_closeout";
  const placementUpdatePayload = {
    lifecycle_stage: placementLifecycleStage,
    closeout_submitted_at: submittedAt,
    closeout_submitted_by: submittedBy,
    updated_by: actor.id,
  };

  const { error: placementUpdateError } = await admin.from("placements").update(placementUpdatePayload).eq("id", placementId);
  if (placementUpdateError) {
    return { status: "error", message: placementUpdateError.message };
  }

  revalidatePath(`/admin/flock-closeout/${placementId}`);
  revalidatePath("/admin/flock-closeout");

  const readyToArchive =
    livehaulComplete &&
    feedVerified &&
    invoiceCreated &&
    submitted &&
    settlementReceived &&
    closeoutCompleted;

  return {
    status: "success",
    message: readyToArchive
      ? "Closeout worksheet saved. All steps are complete. Archive this flock when you are ready."
      : "Closeout worksheet saved.",
    readyToArchive,
  };
}

export async function saveArchivedCloseoutNotesAction(
  _prevState: CloseoutFormState,
  formData: FormData,
): Promise<CloseoutFormState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin || !actor) {
    return { status: "error", message: "A signed-in admin user is required to update archived notes." };
  }

  const placementId = coerce(formData.get("placement_id"));
  const notes = coerceNullableText(formData.get("notes"));
  if (!placementId) {
    return { status: "error", message: "Archived placement context was incomplete." };
  }

  const { data: closeout, error: closeoutError } = await admin
    .from("placement_closeouts")
    .select("status,archived_at")
    .eq("placement_id", placementId)
    .maybeSingle();

  if (closeoutError) {
    return { status: "error", message: closeoutError.message };
  }
  if (!closeout || (closeout.status !== "archived" && !closeout.archived_at)) {
    return { status: "error", message: "This notes-only action is limited to archived closeouts." };
  }

  const { error } = await admin
    .from("placement_closeouts")
    .update({ notes, updated_by: actor.id })
    .eq("placement_id", placementId);

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath(`/admin/flock-closeout/${placementId}`);
  revalidatePath("/admin/flocks");
  return { status: "success", message: "Archived closeout notes updated." };
}

export async function archivePlacementCloseoutAction(formData: FormData) {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin || !actor) {
    throw new Error("A signed-in admin user is required to archive this flock closeout.");
  }

  const placementId = coerce(formData.get("placement_id"));
  if (!placementId) {
    throw new Error("Placement context was incomplete for archive.");
  }

  const { error } = await admin.rpc("archive_flock_closeout", {
    p_placement_id: placementId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/flock-closeout/${placementId}`);
  revalidatePath("/admin/flock-closeout");
  redirect("/admin/flock-closeout");
}
