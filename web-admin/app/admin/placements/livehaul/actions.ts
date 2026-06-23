"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";

import {
  BILL_OF_LADING_DOCUMENT_ROLE,
  DOCUMENT_ARCHIVE_BUCKET,
} from "@/lib/document-archive";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type LivehaulActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type LivehaulDocumentActionState = {
  status: "idle" | "success" | "error";
  message: string;
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

function normalizeTargetSex(value: string | null) {
  if (value === "male" || value === "female") {
    return value;
  }
  return null;
}

function resolveLivehaulStatus(options: {
  actualDate: string | null;
  headActual: number | null;
  requestedStatus: string;
}) {
  if (options.requestedStatus !== "scheduled" && options.requestedStatus !== "legacy_migrated") {
    return options.requestedStatus;
  }

  return options.actualDate || options.headActual !== null ? "completed" : "scheduled";
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

function buildLivehaulStoragePath(placement: {
  id: string;
  placement_key: string | null;
  active_start: string | null;
}, file: File) {
  const anchorDate = placement.active_start?.trim() || "undated";
  const placementLabel = sanitizePathPart(placement.placement_key?.trim() || placement.id);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = extensionForUpload(file);

  return `placements/livehaul/${anchorDate}/${placement.id}/${timestamp}-${placementLabel}.${extension}`;
}

async function inferCreateTargetSex(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  placementId: string,
  sequenceNum: number | null,
) {
  const { data, error } = await admin
    .from("livehaul_schedule")
    .select("livehaul_id")
    .eq("placement_id", placementId)
    .limit(1);

  if (error) {
    return null;
  }

  if ((data ?? []).length === 0 || sequenceNum === 1) {
    return "male";
  }

  return null;
}

async function inferUpdateTargetSex(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  options: {
    placementId: string;
    livehaulId: string;
    sequenceNum: number | null;
  },
) {
  const { data, error } = await admin
    .from("livehaul_schedule")
    .select("livehaul_id,sequence_num")
    .eq("placement_id", options.placementId);

  if (error) {
    return null;
  }

  const otherRows = (data ?? []).filter((row) => row.livehaul_id !== options.livehaulId);
  if (otherRows.length === 0 || options.sequenceNum === 1) {
    return "male";
  }

  if (options.sequenceNum !== null) {
    const maxOtherSequence = otherRows.reduce<number | null>((max, row) => {
      const value = typeof row.sequence_num === "number" ? row.sequence_num : null;
      if (value === null) return max;
      return max === null ? value : Math.max(max, value);
    }, null);

    if (maxOtherSequence !== null && options.sequenceNum > maxOtherSequence) {
      return "female";
    }
  }

  return null;
}

async function writeActivityLog(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  options: {
    placementId: string;
    actionKey: string;
    details: string;
    source: string;
    actorUserId?: string | null;
    farmId?: string | null;
    barnId?: string | null;
    flockId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await admin.rpc("write_activity_log", {
    p_placement_id: options.placementId,
    p_entry_type: "state_change",
    p_action_key: options.actionKey,
    p_details: options.details,
    p_source: options.source,
    p_actor_user_id: options.actorUserId ?? null,
    p_farm_id: options.farmId ?? null,
    p_barn_id: options.barnId ?? null,
    p_flock_id: options.flockId ?? null,
    p_meta: options.meta ?? {},
  });

  if (error) {
    console.error("activity_log write failed", error);
  }
}

export async function createLivehaulScheduleAction(
  _prevState: LivehaulActionState,
  formData: FormData,
): Promise<LivehaulActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin) {
    return { status: "error", message: "Supabase admin access is not configured for livehaul scheduling." };
  }

  if (!actor) {
    return { status: "error", message: "A signed-in user is required to create a livehaul schedule row." };
  }

  const placementId = coerce(formData.get("placement_id"));
  const lhDate = coerce(formData.get("lh_date"));
  const sequenceNum = coerceNullableNumber(formData.get("sequence_num"));
  const requestedTargetSex = normalizeTargetSex(coerceNullableText(formData.get("target_sex")));
  const headTarget = coerceNullableNumber(formData.get("head_target"));
  const status = coerce(formData.get("status")) || "scheduled";
  const comment = coerce(formData.get("comment")) || null;

  if (!placementId || !lhDate) {
    return { status: "error", message: "Choose a placement and livehaul date before saving." };
  }

  const { data: placementRow, error: placementError } = await admin
    .from("placements")
    .select("id,farm_id,barn_id,flock_id")
    .eq("id", placementId)
    .single();

  if (placementError || !placementRow) {
    return { status: "error", message: "The selected placement could not be resolved." };
  }

  const farmId = String(placementRow.farm_id ?? "").trim();
  const barnId = String(placementRow.barn_id ?? "").trim();
  const flockId = String(placementRow.flock_id ?? "").trim();

  if (!farmId || !barnId || !flockId) {
    return { status: "error", message: "The selected placement is missing farm, barn, or flock context." };
  }

  const targetSex = requestedTargetSex ?? (await inferCreateTargetSex(admin, placementId, sequenceNum));

  const { error } = await admin.from("livehaul_schedule").insert({
    farm_id: farmId,
    barn_id: barnId,
    placement_id: placementId,
    flock_id: flockId,
    lh_date: lhDate,
    sequence_num: sequenceNum,
    target_sex: targetSex,
    head_target: headTarget,
    status,
    comment,
    updated_by: actor.id,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeActivityLog(admin, {
    placementId,
    actionKey: "create_livehaul_schedule",
    details: `Livehaul schedule row created for ${lhDate}.`,
    source: "placements.livehaul",
    actorUserId: actor.id,
    farmId,
    barnId,
    flockId,
    meta: { lh_date: lhDate, sequence_num: sequenceNum, target_sex: targetSex, head_target: headTarget, status },
  });

  revalidatePath("/admin/placements/livehaul");
  return { status: "success", message: "Livehaul schedule saved." };
}

export async function uploadLivehaulBillOfLadingAction(
  _prevState: LivehaulDocumentActionState,
  formData: FormData,
): Promise<LivehaulDocumentActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin || !actor) {
    return {
      status: "error",
      message: "A signed-in admin user is required to archive livehaul packets.",
    };
  }

  const placementId = coerce(formData.get("placement_id"));
  const sourceKind = coerce(formData.get("source_kind")) || "manual_upload";
  const notes = coerceNullableText(formData.get("notes"));
  const fileValue = formData.get("document");

  if (!placementId) {
    return { status: "error", message: "Placement context was incomplete." };
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
    .select("id,placement_key,active_start")
    .eq("id", placementId)
    .maybeSingle();

  if (placementError || !placementRow) {
    return { status: "error", message: placementError?.message ?? "The selected placement could not be found." };
  }

  const storagePath = buildLivehaulStoragePath(placementRow, fileValue);
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
    .eq("placement_id", placementId)
    .eq("document_role", BILL_OF_LADING_DOCUMENT_ROLE)
    .eq("is_current", true);

  if (retireError) {
    await admin.storage.from(DOCUMENT_ARCHIVE_BUCKET).remove([storagePath]);
    return { status: "error", message: retireError.message };
  }

  const { error: insertError } = await admin.from("document_archives").insert({
    document_role: BILL_OF_LADING_DOCUMENT_ROLE,
    placement_id: placementId,
    storage_bucket: DOCUMENT_ARCHIVE_BUCKET,
    storage_path: storagePath,
    original_filename: fileValue.name.trim() || "livehaul-packet",
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

  revalidatePath("/admin/placements/livehaul");
  revalidatePath(`/admin/flock-closeout/${placementId}`);
  return { status: "success", message: "Livehaul packet archived." };
}

export async function updateLivehaulScheduleAction(
  _prevState: LivehaulActionState,
  formData: FormData,
): Promise<LivehaulActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin) {
    return { status: "error", message: "Supabase admin access is not configured for livehaul scheduling." };
  }

  if (!actor) {
    return { status: "error", message: "A signed-in user is required to update a livehaul schedule row." };
  }

  const livehaulId = coerce(formData.get("livehaul_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const lhDate = coerce(formData.get("lh_date"));
  const sequenceNum = coerceNullableNumber(formData.get("sequence_num"));
  const actualDate = coerce(formData.get("actual_date")) || null;
  const requestedTargetSex = normalizeTargetSex(coerceNullableText(formData.get("target_sex")));
  const headTarget = coerceNullableNumber(formData.get("head_target"));
  const headActual = coerceNullableNumber(formData.get("head_actual"));
  const requestedStatus = coerce(formData.get("status")) || "scheduled";
  const status = resolveLivehaulStatus({
    actualDate,
    headActual,
    requestedStatus,
  });
  const comment = coerce(formData.get("comment")) || null;

  if (!livehaulId || !placementId || !flockId || !farmId || !barnId || !lhDate) {
    return { status: "error", message: "Livehaul row details were incomplete." };
  }

  const targetSex =
    requestedTargetSex ??
    (await inferUpdateTargetSex(admin, {
      placementId,
      livehaulId,
      sequenceNum,
    }));

  const { error } = await admin
    .from("livehaul_schedule")
    .update({
      lh_date: lhDate,
      sequence_num: sequenceNum,
      actual_date: actualDate,
      target_sex: targetSex,
      head_target: headTarget,
      head_actual: headActual,
      status,
      comment,
      updated_by: actor.id,
    })
    .eq("livehaul_id", livehaulId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeActivityLog(admin, {
    placementId,
    actionKey: "update_livehaul_schedule",
    details: `Livehaul schedule row updated for ${lhDate}.`,
    source: "placements.livehaul",
    actorUserId: actor.id,
    farmId,
    barnId,
    flockId,
    meta: { lh_date: lhDate, sequence_num: sequenceNum, target_sex: targetSex, status, head_target: headTarget, head_actual: headActual },
  });

  revalidatePath("/admin/placements/livehaul");
  return { status: "success", message: "Livehaul schedule updated." };
}

export async function deleteLivehaulScheduleAction(
  _prevState: LivehaulActionState,
  formData: FormData,
): Promise<LivehaulActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin) {
    return { status: "error", message: "Supabase admin access is not configured for livehaul scheduling." };
  }

  if (!actor) {
    return { status: "error", message: "A signed-in user is required to delete a livehaul schedule row." };
  }

  const livehaulId = coerce(formData.get("livehaul_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const lhDate = coerce(formData.get("lh_date"));

  if (!livehaulId || !placementId || !flockId || !farmId || !barnId) {
    return { status: "error", message: "Livehaul row details were incomplete." };
  }

  const { error } = await admin.from("livehaul_schedule").delete().eq("livehaul_id", livehaulId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeActivityLog(admin, {
    placementId,
    actionKey: "delete_livehaul_schedule",
    details: `Livehaul schedule row deleted${lhDate ? ` for ${lhDate}` : ""}.`,
    source: "placements.livehaul",
    actorUserId: actor.id,
    farmId,
    barnId,
    flockId,
    meta: { lh_date: lhDate || null },
  });

  revalidatePath("/admin/placements/livehaul");
  return { status: "success", message: "Livehaul schedule removed." };
}

export async function createLivehaulLoadAction(
  _prevState: LivehaulActionState,
  formData: FormData,
): Promise<LivehaulActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin) {
    return { status: "error", message: "Supabase admin access is not configured for livehaul loads." };
  }

  if (!actor) {
    return { status: "error", message: "A signed-in user is required to add a livehaul load." };
  }

  const livehaulId = coerce(formData.get("livehaul_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const lhDate = coerce(formData.get("lh_date"));

  if (!livehaulId || !placementId || !flockId || !farmId || !barnId) {
    return { status: "error", message: "Livehaul load details were incomplete." };
  }

  const insertPayload = {
    livehaul_id: livehaulId,
    truck_num: coerceNullableText(formData.get("truck_num")),
    trailer_num: coerceNullableText(formData.get("trailer_num")),
    scale_location: coerceNullableText(formData.get("scale_location")),
    scale_empty: coerceNullableNumber(formData.get("scale_empty")),
    scale_loaded: coerceNullableNumber(formData.get("scale_loaded")),
    live_weight: coerceNullableNumber(formData.get("live_weight")),
    head_count: coerceNullableNumber(formData.get("head_count")),
    doa_count: coerceNullableNumber(formData.get("doa_count")),
    comment: coerceNullableText(formData.get("comment")),
    updated_by: actor.id,
  };

  const { error } = await admin.from("livehaul_loads").insert(insertPayload);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeActivityLog(admin, {
    placementId,
    actionKey: "create_livehaul_load",
    details: `Livehaul load added${lhDate ? ` for ${lhDate}` : ""}.`,
    source: "placements.livehaul",
    actorUserId: actor.id,
    farmId,
    barnId,
    flockId,
    meta: {
      lh_date: lhDate || null,
      head_count: insertPayload.head_count,
      doa_count: insertPayload.doa_count,
      truck_num: insertPayload.truck_num,
      trailer_num: insertPayload.trailer_num,
    },
  });

  revalidatePath("/admin/placements/livehaul");
  return { status: "success", message: "Livehaul load saved." };
}

export async function updateLivehaulLoadAction(
  _prevState: LivehaulActionState,
  formData: FormData,
): Promise<LivehaulActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin) {
    return { status: "error", message: "Supabase admin access is not configured for livehaul loads." };
  }

  if (!actor) {
    return { status: "error", message: "A signed-in user is required to update a livehaul load." };
  }

  const loadId = coerce(formData.get("load_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const lhDate = coerce(formData.get("lh_date"));

  if (!loadId || !placementId || !flockId || !farmId || !barnId) {
    return { status: "error", message: "Livehaul load details were incomplete." };
  }

  const updatePayload = {
    truck_num: coerceNullableText(formData.get("truck_num")),
    trailer_num: coerceNullableText(formData.get("trailer_num")),
    scale_location: coerceNullableText(formData.get("scale_location")),
    scale_empty: coerceNullableNumber(formData.get("scale_empty")),
    scale_loaded: coerceNullableNumber(formData.get("scale_loaded")),
    live_weight: coerceNullableNumber(formData.get("live_weight")),
    head_count: coerceNullableNumber(formData.get("head_count")),
    doa_count: coerceNullableNumber(formData.get("doa_count")),
    comment: coerceNullableText(formData.get("comment")),
    updated_by: actor.id,
  };

  const { error } = await admin.from("livehaul_loads").update(updatePayload).eq("load_id", loadId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeActivityLog(admin, {
    placementId,
    actionKey: "update_livehaul_load",
    details: `Livehaul load updated${lhDate ? ` for ${lhDate}` : ""}.`,
    source: "placements.livehaul",
    actorUserId: actor.id,
    farmId,
    barnId,
    flockId,
    meta: {
      lh_date: lhDate || null,
      head_count: updatePayload.head_count,
      doa_count: updatePayload.doa_count,
      truck_num: updatePayload.truck_num,
      trailer_num: updatePayload.trailer_num,
    },
  });

  revalidatePath("/admin/placements/livehaul");
  return { status: "success", message: "Livehaul load updated." };
}

export async function deleteLivehaulLoadAction(
  _prevState: LivehaulActionState,
  formData: FormData,
): Promise<LivehaulActionState> {
  const admin = createSupabaseAdminClient();
  const actor = await getActor();

  if (!admin) {
    return { status: "error", message: "Supabase admin access is not configured for livehaul loads." };
  }

  if (!actor) {
    return { status: "error", message: "A signed-in user is required to delete a livehaul load." };
  }

  const loadId = coerce(formData.get("load_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const lhDate = coerce(formData.get("lh_date"));

  if (!loadId || !placementId || !flockId || !farmId || !barnId) {
    return { status: "error", message: "Livehaul load details were incomplete." };
  }

  const { error } = await admin.from("livehaul_loads").delete().eq("load_id", loadId);

  if (error) {
    return { status: "error", message: error.message };
  }

  await writeActivityLog(admin, {
    placementId,
    actionKey: "delete_livehaul_load",
    details: `Livehaul load deleted${lhDate ? ` for ${lhDate}` : ""}.`,
    source: "placements.livehaul",
    actorUserId: actor.id,
    farmId,
    barnId,
    flockId,
    meta: { lh_date: lhDate || null },
  });

  revalidatePath("/admin/placements/livehaul");
  return { status: "success", message: "Livehaul load removed." };
}
