"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

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

function buildSelectionLocation(
  routeBase: string,
  options: {
    farm?: string | null;
    barn?: string | null;
    error?: string;
    notice?: string;
  } = {},
) {
  const url = new URL(routeBase || "/admin/feed-bins", "http://localhost");

  url.searchParams.delete("farm");
  url.searchParams.delete("barn");
  url.searchParams.delete("error");
  url.searchParams.delete("notice");

  if (options.farm) url.searchParams.set("farm", options.farm);
  if (options.barn) url.searchParams.set("barn", options.barn);
  if (options.error) url.searchParams.set("error", options.error);
  if (options.notice) url.searchParams.set("notice", options.notice);

  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function buildReturnLocation(formData: FormData, options: { error?: string; notice?: string } = {}) {
  const base = coerce(formData.get("return_to")) || "/admin/feed-bins";
  const url = new URL(base, "http://localhost");

  url.searchParams.delete("error");
  url.searchParams.delete("notice");

  if (options.error) url.searchParams.set("error", options.error);
  if (options.notice) url.searchParams.set("notice", options.notice);

  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function bounce(formData: FormData, options: Parameters<typeof buildReturnLocation>[1]) {
  redirect(buildReturnLocation(formData, options));
}

function unreachable(message: string): never {
  throw new Error(message);
}

async function getAdminContext(formData: FormData) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    bounce(formData, { error: "Supabase admin access is not configured for feed-bin maintenance." });
    unreachable("Missing Supabase admin client");
  }

  const serverClient = await createSupabaseServerClient();
  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  const actorId = authResult?.data.user?.id ?? null;

  const bundle = await getUserAccessBundle();
  const actor = actorId ? bundle.users.find((user) => user.id === actorId) ?? null : null;
  const actorRole = actor ? resolveRoleTemplate(bundle.roles, actor.role) : null;

  return { admin, actorId, actorRole };
}

function canEditFeedBins(role: ReturnType<typeof resolveRoleTemplate> | null) {
  if (!role) {
    return false;
  }

  const normalizedRole = role.key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedRole === "super_admin" || normalizedRole === "superadmin" || normalizedRole.includes("super")) {
    return true;
  }

  if (normalizedRole === "admin" || normalizedRole.includes("integrator")) {
    return true;
  }

  return role.permissionRows.some((permissionRow) => {
    const action = permissionRow.action.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return ["farm_groups", "farms", "barns", "feed_bins", "placement_wizard"].includes(action) &&
      (permissionRow.create || permissionRow.update || permissionRow.delete);
  });
}

function revalidateFeedBins(routeBase: string) {
  revalidatePath("/admin/feed-bins");
  revalidatePath(routeBase);
}

export async function createFeedBinAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  if (!canEditFeedBins(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can add feed bins." });
    unreachable("Actor cannot create feed bins");
  }

  const routeBase = coerce(formData.get("route_base")) || "/admin/feed-bins";
  const farmId = coerce(formData.get("selected_farm_id"));
  const barnId = coerce(formData.get("selected_barn_id"));

  if (!farmId || !barnId) {
    redirect(
      buildSelectionLocation(routeBase, {
        farm: farmId || null,
        error: "Select a barn before adding a feed bin.",
      }),
    );
  }

  const latestBinResult = await admin
    .from("feedbins")
    .select("bin_num")
    .eq("barn_id", barnId)
    .order("bin_num", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestBinResult.error) {
    redirect(
      buildSelectionLocation(routeBase, {
        farm: farmId,
        barn: barnId,
        error: latestBinResult.error.message,
      }),
    );
  }

  const nextBinNumber = typeof latestBinResult.data?.bin_num === "number" ? latestBinResult.data.bin_num + 1 : 1;
  const insertResult = await admin
    .from("feedbins")
    .insert({
      farm_id: farmId,
      barn_id: barnId,
      bin_num: nextBinNumber,
      capacity: null,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    redirect(
      buildSelectionLocation(routeBase, {
        farm: farmId,
        barn: barnId,
        error: insertResult.error.message,
      }),
    );
  }

  revalidateFeedBins(routeBase);
  redirect(
    buildSelectionLocation(routeBase, {
      farm: farmId,
      barn: barnId,
      notice: "New feed bin created.",
    }),
  );
}

export async function updateFeedBinAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  if (!canEditFeedBins(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can edit feed bins." });
    unreachable("Actor cannot edit feed bins");
  }

  const feedBinId = coerce(formData.get("feed_bin_id"));
  if (!feedBinId) {
    bounce(formData, { error: "Select a feed bin before saving." });
    unreachable("Missing feed bin id");
  }

  const updateResult = await admin
    .from("feedbins")
    .update({
      bin_num: coerceNullableNumber(formData.get("bin_num")),
      capacity: coerceNullableNumber(formData.get("capacity")),
    })
    .eq("id", feedBinId);

  if (updateResult.error) {
    bounce(formData, { error: updateResult.error.message });
  }

  revalidateFeedBins(coerce(formData.get("route_base")) || "/admin/feed-bins");
  bounce(formData, { notice: "Feed bin updated." });
}

export async function deleteFeedBinAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  if (!canEditFeedBins(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can delete feed bins." });
    unreachable("Actor cannot delete feed bins");
  }

  const routeBase = coerce(formData.get("route_base")) || "/admin/feed-bins";
  const feedBinId = coerce(formData.get("feed_bin_id"));
  const farmId = coerce(formData.get("selected_farm_id"));
  const barnId = coerce(formData.get("selected_barn_id"));

  if (!feedBinId) {
    redirect(
      buildSelectionLocation(routeBase, {
        farm: farmId || null,
        barn: barnId || null,
        error: "Select a feed bin before deleting.",
      }),
    );
  }

  const dropsResult = await admin
    .from("feed_drops")
    .select("id", { head: true, count: "exact" })
    .eq("feed_bin_id", feedBinId);

  if ((dropsResult.count ?? 0) > 0) {
    redirect(
      buildSelectionLocation(routeBase, {
        farm: farmId || null,
        barn: barnId || null,
        error: "This feed bin already has delivery history and cannot be deleted.",
      }),
    );
  }

  const deleteResult = await admin.from("feedbins").delete().eq("id", feedBinId);
  if (deleteResult.error) {
    redirect(
      buildSelectionLocation(routeBase, {
        farm: farmId || null,
        barn: barnId || null,
        error: deleteResult.error.message,
      }),
    );
  }

  revalidateFeedBins(routeBase);
  redirect(
    buildSelectionLocation(routeBase, {
      farm: farmId || null,
      barn: barnId || null,
      notice: "Feed bin deleted.",
    }),
  );
}
