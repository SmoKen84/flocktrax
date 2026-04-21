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
    group?: string | null;
    farm?: string | null;
    barn?: string | null;
    error?: string;
    notice?: string;
  } = {},
) {
  const url = new URL(routeBase || "/admin/farm-groups", "http://localhost");

  url.searchParams.delete("group");
  url.searchParams.delete("farm");
  url.searchParams.delete("barn");
  url.searchParams.delete("error");
  url.searchParams.delete("notice");

  if (options.group) url.searchParams.set("group", options.group);
  if (options.farm) url.searchParams.set("farm", options.farm);
  if (options.barn) url.searchParams.set("barn", options.barn);
  if (options.error) url.searchParams.set("error", options.error);
  if (options.notice) url.searchParams.set("notice", options.notice);

  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function buildReturnLocation(formData: FormData, options: { error?: string; notice?: string } = {}) {
  const base = coerce(formData.get("return_to")) || "/admin/farm-groups";
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
    bounce(formData, { error: "Supabase admin access is not configured for farm structure maintenance." });
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

function canEditFarmStructure(role: ReturnType<typeof resolveRoleTemplate> | null) {
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
    return ["farm_groups", "farms", "barns", "placement_wizard"].includes(action) && (permissionRow.create || permissionRow.update);
  });
}

function revalidateFarmStructure(routeBase: string) {
  revalidatePath("/admin/farm-groups");
  revalidatePath("/admin/farms");
  revalidatePath(routeBase);
}

export async function createFarmGroupAction(formData: FormData) {
  const { admin, actorId, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can add farm groups." });
    unreachable("Actor cannot create farm structure");
  }

  const routeBase = coerce(formData.get("route_base")) || "/admin/farm-groups";
  const now = new Date().toISOString();
  const insertResult = await admin
    .from("farm_groups")
    .insert({
      group_name: "New Farm Group",
      is_active: true,
      created_by: actorId,
      updated_by: actorId,
      created_on: now,
      updated_on: now,
    })
    .select("id")
    .single();

  if (insertResult.error || !insertResult.data?.id) {
    redirect(
      buildSelectionLocation(routeBase, {
        error: insertResult.error?.message ?? "Unable to create a farm group.",
      }),
    );
  }

  revalidateFarmStructure(routeBase);
  redirect(
    buildSelectionLocation(routeBase, {
      group: insertResult.data.id,
      notice: "New farm group created.",
    }),
  );
}

export async function createFarmAction(formData: FormData) {
  const { actorId, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can add farms." });
    unreachable("Actor cannot create farm structure");
  }

  const routeBase = coerce(formData.get("route_base")) || "/admin/farm-groups";
  const farmGroupId = coerce(formData.get("selected_group_id"));
  if (!farmGroupId) {
    redirect(buildSelectionLocation(routeBase, { error: "Select a farm group before adding a farm." }));
  }
  const serverClient = await createSupabaseServerClient();
  if (!serverClient || !actorId) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId,
        error: "Farm creation requires an authenticated session. Refresh and sign in again.",
      }),
    );
  }

  const seed = Date.now().toString().slice(-6);
  const now = new Date().toISOString();
  const insertResult = await serverClient
    .from("farms")
    .insert({
      farm_group_id: farmGroupId,
      farm_code: `FARM-${seed}`,
      farm_name: "New Farm",
      is_active: true,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertResult.error || !insertResult.data?.id) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId,
        error: insertResult.error?.message ?? "Unable to create a farm.",
      }),
    );
  }

  revalidateFarmStructure(routeBase);
  redirect(
    buildSelectionLocation(routeBase, {
      group: farmGroupId,
      farm: insertResult.data.id,
      notice: "New farm created.",
    }),
  );
}

export async function createBarnAction(formData: FormData) {
  const { admin, actorId, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can add barns." });
    unreachable("Actor cannot create farm structure");
  }

  const routeBase = coerce(formData.get("route_base")) || "/admin/farm-groups";
  const farmId = coerce(formData.get("selected_farm_id"));
  const farmGroupId = coerce(formData.get("selected_group_id"));
  if (!farmId) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId || null,
        error: "Select a farm before adding a barn.",
      }),
    );
  }

  const seed = Date.now().toString().slice(-6);
  const now = new Date().toISOString();
  const insertResult = await admin
    .from("barns")
    .insert({
      farm_id: farmId,
      barn_code: `BARN-${seed}`,
      is_active: true,
      has_flock: false,
      is_empty: true,
      created_by: actorId,
      updated_by: actorId,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertResult.error || !insertResult.data?.id) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId || null,
        farm: farmId,
        error: insertResult.error?.message ?? "Unable to create a barn.",
      }),
    );
  }

  revalidateFarmStructure(routeBase);
  redirect(
    buildSelectionLocation(routeBase, {
      group: farmGroupId || null,
      farm: farmId,
      barn: insertResult.data.id,
      notice: "New barn created.",
    }),
  );
}

export async function updateFarmGroupAction(formData: FormData) {
  const { admin, actorId, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can edit farm-group details." });
    unreachable("Actor cannot edit farm structure");
  }

  const farmGroupId = coerce(formData.get("farm_group_id"));
  if (!farmGroupId) {
    bounce(formData, { error: "Select a farm group before saving." });
    unreachable("Missing farm group id");
  }

  const updateResult = await admin
    .from("farm_groups")
    .update({
      group_name: coerce(formData.get("group_name")),
      group_contact_name: coerce(formData.get("group_contact_name")),
      contact_title: coerce(formData.get("contact_title")),
      phone: coerce(formData.get("phone")),
      addr1: coerce(formData.get("addr1")),
      addr2: coerce(formData.get("addr2")),
      city: coerce(formData.get("city")),
      st: coerce(formData.get("st")),
      zip: coerce(formData.get("zip")),
      is_active: coerce(formData.get("is_active")) === "on",
      updated_on: new Date().toISOString(),
      updated_by: actorId,
    })
    .eq("id", farmGroupId);

  if (updateResult.error) {
    bounce(formData, { error: updateResult.error.message });
  }

  revalidateFarmStructure(coerce(formData.get("route_base")) || "/admin/farm-groups");
  bounce(formData, { notice: "Farm group updated." });
}

export async function updateFarmAction(formData: FormData) {
  const { actorId, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can edit farm details." });
    unreachable("Actor cannot edit farm structure");
  }

  const farmId = coerce(formData.get("farm_id"));
  if (!farmId) {
    bounce(formData, { error: "Select a farm before saving." });
    unreachable("Missing farm id");
  }
  const serverClient = await createSupabaseServerClient();
  if (!serverClient || !actorId) {
    bounce(formData, { error: "Farm save requires an authenticated session. Refresh and sign in again." });
    unreachable("Missing authenticated server client");
  }

  const updateResult = await serverClient
    .from("farms")
    .update({
      farm_code: coerce(formData.get("farm_code")),
      farm_name: coerce(formData.get("farm_name")),
      addr: coerce(formData.get("addr")),
      city: coerce(formData.get("city")),
      state: coerce(formData.get("state")),
      zip: coerce(formData.get("zip")),
      map_url: coerce(formData.get("map_url")),
      is_active: coerce(formData.get("is_active")) === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", farmId);

  if (updateResult.error) {
    bounce(formData, { error: updateResult.error.message });
  }

  revalidateFarmStructure(coerce(formData.get("route_base")) || "/admin/farm-groups");
  bounce(formData, { notice: "Farm updated." });
}

export async function updateBarnAction(formData: FormData) {
  const { admin, actorId, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can edit barn details." });
    unreachable("Actor cannot edit farm structure");
  }

  const barnId = coerce(formData.get("barn_id"));
  if (!barnId) {
    bounce(formData, { error: "Select a barn before saving." });
    unreachable("Missing barn id");
  }

  const updateResult = await admin
    .from("barns")
    .update({
      barn_code: coerce(formData.get("barn_code")),
      sort_code: coerce(formData.get("sort_code")),
      length_ft: coerceNullableNumber(formData.get("length_ft")),
      width_ft: coerceNullableNumber(formData.get("width_ft")),
      sqft: coerceNullableNumber(formData.get("sqft")),
      stdroc_head: coerce(formData.get("stdroc_head")),
      is_active: coerce(formData.get("is_active")) === "on",
      updated_at: new Date().toISOString(),
      updated_by: actorId,
    })
    .eq("id", barnId);

  if (updateResult.error) {
    bounce(formData, { error: updateResult.error.message });
  }

  revalidateFarmStructure(coerce(formData.get("route_base")) || "/admin/farm-groups");
  bounce(formData, { notice: "Barn updated." });
}

export async function deleteFarmGroupAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can delete farm groups." });
    unreachable("Actor cannot delete farm structure");
  }

  const routeBase = coerce(formData.get("route_base")) || "/admin/farm-groups";
  const farmGroupId = coerce(formData.get("farm_group_id"));
  if (!farmGroupId) {
    redirect(buildSelectionLocation(routeBase, { error: "Select a farm group before deleting." }));
  }

  const [farmsResult, membershipsResult] = await Promise.all([
    admin.from("farms").select("id", { head: true, count: "exact" }).eq("farm_group_id", farmGroupId),
    admin.from("farm_group_memberships").select("user_id", { head: true, count: "exact" }).eq("farm_group_id", farmGroupId),
  ]);

  if ((farmsResult.count ?? 0) > 0 || (membershipsResult.count ?? 0) > 0) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId,
        error: "This farm group still has linked farms or user memberships and cannot be deleted.",
      }),
    );
  }

  const deleteResult = await admin.from("farm_groups").delete().eq("id", farmGroupId);
  if (deleteResult.error) {
    redirect(buildSelectionLocation(routeBase, { group: farmGroupId, error: deleteResult.error.message }));
  }

  revalidateFarmStructure(routeBase);
  redirect(buildSelectionLocation(routeBase, { notice: "Farm group deleted." }));
}

export async function deleteFarmAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can delete farms." });
    unreachable("Actor cannot delete farm structure");
  }

  const routeBase = coerce(formData.get("route_base")) || "/admin/farm-groups";
  const farmId = coerce(formData.get("farm_id"));
  const farmGroupId = coerce(formData.get("selected_group_id"));
  if (!farmId) {
    redirect(buildSelectionLocation(routeBase, { group: farmGroupId || null, error: "Select a farm before deleting." }));
  }

  const [barnsResult, flocksResult, placementsResult, membershipsResult] = await Promise.all([
    admin.from("barns").select("id", { head: true, count: "exact" }).eq("farm_id", farmId),
    admin.from("flocks").select("id", { head: true, count: "exact" }).eq("farm_id", farmId),
    admin.from("placements").select("id", { head: true, count: "exact" }).eq("farm_id", farmId),
    admin.from("farm_memberships").select("user_id", { head: true, count: "exact" }).eq("farm_id", farmId),
  ]);

  if (
    (barnsResult.count ?? 0) > 0 ||
    (flocksResult.count ?? 0) > 0 ||
    (placementsResult.count ?? 0) > 0 ||
    (membershipsResult.count ?? 0) > 0
  ) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId || null,
        farm: farmId,
        error: "This farm has linked barns, flocks, placements, or memberships and cannot be deleted.",
      }),
    );
  }

  const deleteResult = await admin.from("farms").delete().eq("id", farmId);
  if (deleteResult.error) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId || null,
        farm: farmId,
        error: deleteResult.error.message,
      }),
    );
  }

  revalidateFarmStructure(routeBase);
  redirect(
    buildSelectionLocation(routeBase, {
      group: farmGroupId || null,
      notice: "Farm deleted.",
    }),
  );
}

export async function deleteBarnAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  if (!canEditFarmStructure(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can delete barns." });
    unreachable("Actor cannot delete farm structure");
  }

  const routeBase = coerce(formData.get("route_base")) || "/admin/farm-groups";
  const barnId = coerce(formData.get("barn_id"));
  const farmId = coerce(formData.get("selected_farm_id"));
  const farmGroupId = coerce(formData.get("selected_group_id"));
  if (!barnId) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId || null,
        farm: farmId || null,
        error: "Select a barn before deleting.",
      }),
    );
  }

  const [placementsResult, barnResult] = await Promise.all([
    admin.from("placements").select("id", { head: true, count: "exact" }).eq("barn_id", barnId),
    admin.from("barns").select("active_flock_id,has_flock").eq("id", barnId).maybeSingle(),
  ]);

  if (
    (placementsResult.count ?? 0) > 0 ||
    barnResult.data?.active_flock_id ||
    barnResult.data?.has_flock
  ) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId || null,
        farm: farmId || null,
        barn: barnId,
        error: "This barn has linked placements or flock activity and cannot be deleted.",
      }),
    );
  }

  const deleteResult = await admin.from("barns").delete().eq("id", barnId);
  if (deleteResult.error) {
    redirect(
      buildSelectionLocation(routeBase, {
        group: farmGroupId || null,
        farm: farmId || null,
        barn: barnId,
        error: deleteResult.error.message,
      }),
    );
  }

  revalidateFarmStructure(routeBase);
  redirect(
    buildSelectionLocation(routeBase, {
      group: farmGroupId || null,
      farm: farmId || null,
      notice: "Barn deleted.",
    }),
  );
}
