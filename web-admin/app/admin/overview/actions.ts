"use server";

import { revalidatePath } from "next/cache";

import { buildPlacementEditorAccess, getPlacementEditorActorAccess } from "@/lib/placement-editor-access";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export type LhDateActionResult = {
  status: "idle" | "success" | "error";
  message: string;
};

function coerceNullableDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function coerceNullableNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function savePlacementLhDatesAction(formData: FormData): Promise<LhDateActionResult> {
  const placementId = String(formData.get("placement_id") ?? "").trim();
  const lh1Date = coerceNullableDate(formData.get("lh1_date"));
  const lh3Date = coerceNullableDate(formData.get("lh3_date"));

  if (!placementId) {
    return { status: "error", message: "Placement is missing." };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase is not configured." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You must be signed in to save LH dates." };
  }

  const { error } = await supabase
    .from("placements")
    .update({
      lh1_date: lh1Date,
      lh3_date: lh3Date,
      updated_by: user.id,
    })
    .eq("id", placementId);

  if (error) {
    return { status: "error", message: error.message };
  }

  const { error: activityError } = await supabase.rpc("write_activity_log", {
    p_placement_id: placementId,
    p_entry_type: "functCall",
    p_action_key: "savePlacementLhDatesAction",
    p_details: "LH dates saved from live dashboard.",
    p_source: "web-admin.overview",
    p_actor_user_id: user.id,
    p_meta: {
      lh1_date: lh1Date,
      lh3_date: lh3Date,
    },
  });

  if (activityError) {
    console.error("activity_log write failed", activityError);
  }

  revalidatePath("/admin/overview");

  return {
    status: "success",
    message: "LH dates saved.",
  };
}

export async function saveDashboardPlacementEditorAction(formData: FormData): Promise<LhDateActionResult> {
  const placementId = String(formData.get("placement_id") ?? "").trim();
  const projectedEndDate = coerceNullableDate(formData.get("projected_end_date"));
  const dateRemoved = coerceNullableDate(formData.get("date_removed"));
  const startCntMales = coerceNullableNumber(formData.get("start_cnt_males"));
  const startCntFemales = coerceNullableNumber(formData.get("start_cnt_females"));
  const breedMales = coerceNullableDate(formData.get("breed_males"));
  const breedFemales = coerceNullableDate(formData.get("breed_females"));
  const lh1Date = coerceNullableDate(formData.get("lh1_date"));
  const lh2Date = coerceNullableDate(formData.get("lh2_date"));
  const lh3Date = coerceNullableDate(formData.get("lh3_date"));

  if (!placementId) {
    return { status: "error", message: "Placement is missing." };
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return { status: "error", message: "Supabase is not configured." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You must be signed in to update this placement." };
  }

  const [placementResult, actorAccess] = await Promise.all([
    admin
      .from("placements")
      .select("id,farm_id,barn_id,flock_id,placement_key,active_start,active_end,date_removed")
      .eq("id", placementId)
      .maybeSingle(),
    getPlacementEditorActorAccess(),
  ]);

  if (placementResult.error || !placementResult.data) {
    return { status: "error", message: placementResult.error?.message ?? "Placement could not be loaded." };
  }

  const placement = placementResult.data;

  const farmResult = await admin
    .from("farms_ui")
    .select("id,farm_group_id")
    .eq("id", placement.farm_id)
    .maybeSingle();

  if (farmResult.error || !farmResult.data) {
    return { status: "error", message: farmResult.error?.message ?? "Farm context could not be loaded." };
  }

  const access = buildPlacementEditorAccess(actorAccess, {
    placementId: placement.id,
    tileState: "live",
    farmGroupId: farmResult.data.farm_group_id ?? "ungrouped",
    farmId: placement.farm_id,
  });

  if (!access.canView) {
    return { status: "error", message: access.message ?? "You do not have permission to view this placement." };
  }

  const flockResult = await admin
    .from("flocks")
    .select("id,flock_number,date_placed,max_date,start_cnt_females,start_cnt_males,breed_females,breed_males")
    .eq("id", placement.flock_id)
    .maybeSingle();

  if (flockResult.error || !flockResult.data) {
    return { status: "error", message: flockResult.error?.message ?? "Linked flock could not be loaded." };
  }

  if (
    projectedEndDate &&
    placement.active_start &&
    projectedEndDate < placement.active_start
  ) {
    return { status: "error", message: "Projected end date cannot be earlier than the placed date." };
  }

  if (
    dateRemoved &&
    placement.active_start &&
    dateRemoved < placement.active_start
  ) {
    return { status: "error", message: "Removed date cannot be earlier than the placed date." };
  }

  const placementPatch =
    access.canEditPlacementFields
      ? {
          date_removed: dateRemoved,
          lh1_date: lh1Date,
          lh2_date: lh2Date,
          lh3_date: lh3Date,
          updated_by: user.id,
        }
      : null;

  const flockPatch =
    access.canEditFlockFields
      ? {
          max_date: projectedEndDate,
          start_cnt_males: startCntMales,
          start_cnt_females: startCntFemales,
          breed_males: breedMales,
          breed_females: breedFemales,
          updated_by: user.id,
        }
      : null;

  if (!placementPatch && !flockPatch) {
    return { status: "error", message: access.message ?? "This placement is read-only for your account." };
  }

  if (flockPatch) {
    const { error } = await admin.from("flocks").update(flockPatch).eq("id", placement.flock_id);
    if (error) {
      return { status: "error", message: error.message };
    }
  }

  if (placementPatch) {
    const { error } = await admin.from("placements").update(placementPatch).eq("id", placementId);
    if (error) {
      return { status: "error", message: error.message };
    }
  }

  const changedMeta = {
    projected_end_date: flockPatch ? projectedEndDate : flockResult.data.max_date ?? null,
    date_removed: placementPatch ? dateRemoved : placement.date_removed ?? null,
    start_cnt_males: flockPatch ? startCntMales : flockResult.data.start_cnt_males ?? null,
    start_cnt_females: flockPatch ? startCntFemales : flockResult.data.start_cnt_females ?? null,
    breed_males: flockPatch ? breedMales : flockResult.data.breed_males ?? null,
    breed_females: flockPatch ? breedFemales : flockResult.data.breed_females ?? null,
    lh1_date: placementPatch ? lh1Date : null,
    lh2_date: placementPatch ? lh2Date : null,
    lh3_date: placementPatch ? lh3Date : null,
  };

  const { error: activityError } = await admin.rpc("write_activity_log", {
    p_placement_id: placementId,
    p_entry_type: "functCall",
    p_action_key: "saveDashboardPlacementEditorAction",
    p_details: `Placement ${placement.placement_key ?? placement.id} updated from the live dashboard editor.`,
    p_source: "web-admin.overview.editor",
    p_actor_user_id: user.id,
    p_meta: changedMeta,
  });

  if (activityError) {
    console.error("activity_log write failed", activityError);
  }

  revalidatePath("/admin/overview");
  revalidatePath("/admin/placements/new");

  return {
    status: "success",
    message: "Placement updated.",
  };
}

export async function markChicksArrivedAction(placementId: string): Promise<LhDateActionResult> {
  if (!placementId) {
    return { status: "error", message: "Placement is missing." };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase is not configured." };
  }

  const { error } = await supabase.rpc("mark_chicks_arrived", {
    p_placement_id: placementId,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/admin/overview");

  return { status: "success", message: "Chicks marked as arrived." };
}

export async function makePlacementCurrentAction(placementId: string): Promise<LhDateActionResult> {
  if (!placementId) {
    return { status: "error", message: "Placement is missing." };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase is not configured." };
  }

  const { error } = await supabase.rpc("make_placement_current", {
    p_placement_id: placementId,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/admin/overview");

  return { status: "success", message: "Placement promoted to get-ready status." };
}

export async function markBarnEmptyAction(
  barnId: string,
  removedDate?: string,
): Promise<LhDateActionResult> {
  if (!barnId) {
    return { status: "error", message: "Barn is missing." };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "error", message: "Supabase is not configured." };
  }

  const { data, error } = await supabase.rpc("mark_barn_empty", {
    p_barn_id: barnId,
    p_removed_date: removedDate?.trim() ? removedDate : undefined,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/admin/overview");

  const promotedPlacement = Array.isArray(data) ? data[0] : null;
  const hasNextPlacement = Boolean(promotedPlacement?.placement_id);

  return {
    status: "success",
    message: hasNextPlacement
      ? "Current flock moved to closeout. Next flock is now in get-ready status."
      : "Current flock moved to closeout. Barn is now empty.",
  };
}
