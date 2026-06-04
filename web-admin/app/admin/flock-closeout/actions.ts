"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  const { data: dropRows, error: feedError } = await admin
    .from("feed_drops")
    .select("drop_weight,type")
    .eq("placement_code", placementCode);

  if (feedError) {
    return { status: "error", message: feedError.message };
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
