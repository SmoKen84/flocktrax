"use server";

import { revalidatePath } from "next/cache";

import {
  buildPlacementEditorAccess,
  canAccessFarmManagerReport,
  getPlacementEditorActorAccess,
  hasActorFarmScope,
} from "@/lib/placement-editor-access";
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

async function getLifecycleMutationClient(target: { placementId?: string; barnId?: string }) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return { error: "Supabase is not configured.", admin: null };
  }

  const [{ data: authData, error: authError }, actorAccess] = await Promise.all([
    supabase.auth.getUser(),
    getPlacementEditorActorAccess(),
  ]);

  if (authError || !authData.user || actorAccess.actorId !== authData.user.id) {
    return { error: "You must be signed in to update placement lifecycle state.", admin: null };
  }

  let farmId: string | null = null;

  if (target.placementId) {
    const placementResult = await admin
      .from("placements")
      .select("farm_id")
      .eq("id", target.placementId)
      .maybeSingle();

    if (placementResult.error || !placementResult.data?.farm_id) {
      return { error: placementResult.error?.message ?? "Placement could not be loaded.", admin: null };
    }
    farmId = placementResult.data.farm_id;
  } else if (target.barnId) {
    const barnResult = await admin
      .from("barns")
      .select("farm_id")
      .eq("id", target.barnId)
      .maybeSingle();

    if (barnResult.error || !barnResult.data?.farm_id) {
      return { error: barnResult.error?.message ?? "Barn could not be loaded.", admin: null };
    }
    farmId = barnResult.data.farm_id;
  }

  if (!farmId) {
    return { error: "Farm context could not be resolved.", admin: null };
  }

  const farmResult = await admin
    .from("farms")
    .select("farm_group_id")
    .eq("id", farmId)
    .maybeSingle();

  if (farmResult.error || !farmResult.data) {
    return { error: farmResult.error?.message ?? "Farm context could not be loaded.", admin: null };
  }

  const hasFarmScope = hasActorFarmScope(actorAccess, {
    farmId,
    farmGroupId: farmResult.data.farm_group_id ?? "ungrouped",
  });

  if (!canAccessFarmManagerReport(actorAccess) || !hasFarmScope) {
    return { error: "Only Farm Manager or higher roles assigned to this farm can change lifecycle state.", admin: null };
  }

  return { error: null, admin };
}

export async function saveDashboardPlacementEditorAction(formData: FormData): Promise<LhDateActionResult> {
  const placementId = String(formData.get("placement_id") ?? "").trim();
  const projectedEndDate = coerceNullableDate(formData.get("projected_end_date"));
  const dateRemoved = coerceNullableDate(formData.get("date_removed"));
  const startCntMales = coerceNullableNumber(formData.get("start_cnt_males"));
  const startCntFemales = coerceNullableNumber(formData.get("start_cnt_females"));
  const breedMales = coerceNullableDate(formData.get("breed_males"));
  const breedFemales = coerceNullableDate(formData.get("breed_females"));

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

  const lifecycleContext = await getLifecycleMutationClient({ placementId });

  if (!lifecycleContext.admin) {
    return { status: "error", message: lifecycleContext.error ?? "Lifecycle authorization failed." };
  }

  const { error } = await lifecycleContext.admin.rpc("mark_chicks_arrived", {
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

  const lifecycleContext = await getLifecycleMutationClient({ placementId });

  if (!lifecycleContext.admin) {
    return { status: "error", message: lifecycleContext.error ?? "Lifecycle authorization failed." };
  }

  const { error } = await lifecycleContext.admin.rpc("make_placement_current", {
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

  const lifecycleContext = await getLifecycleMutationClient({ barnId });

  if (!lifecycleContext.admin) {
    return { status: "error", message: lifecycleContext.error ?? "Lifecycle authorization failed." };
  }

  const { data, error } = await lifecycleContext.admin.rpc("mark_barn_empty", {
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
