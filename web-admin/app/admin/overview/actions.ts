"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  return { status: "success", message: "Placement promoted to current." };
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

  const { error } = await supabase.rpc("mark_barn_empty", {
    p_barn_id: barnId,
    p_removed_date: removedDate?.trim() ? removedDate : undefined,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/admin/overview");

  return { status: "success", message: "Barn marked empty." };
}
