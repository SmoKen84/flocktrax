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

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildLocation(
  options: {
    mode?: string | null;
    farm?: string | null;
    barn?: string | null;
    cleared?: boolean;
    date?: string | null;
    month?: string | null;
    error?: string;
    notice?: string;
  } = {},
) {
  const url = new URL("/admin/placements/new", "http://localhost");

  if (options.mode) url.searchParams.set("mode", options.mode);
  if (options.farm) url.searchParams.set("farm", options.farm);
  if (options.barn) url.searchParams.set("barn", options.barn);
  if (options.cleared) url.searchParams.set("cleared", "1");
  if (options.date) url.searchParams.set("date", options.date);
  if (options.month) url.searchParams.set("month", options.month);
  if (options.error) url.searchParams.set("error", options.error);
  if (options.notice) url.searchParams.set("notice", options.notice);

  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function unreachable(message: string): never {
  throw new Error(message);
}

async function writeActivityLog(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  options: {
    placementId?: string | null;
    entryType: string;
    actionKey: string;
    details: string;
    source: string;
    actorUserId?: string | null;
    actorName?: string | null;
    farmId?: string | null;
    barnId?: string | null;
    flockId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await admin.rpc("write_activity_log", {
    p_placement_id: options.placementId ?? null,
    p_entry_type: options.entryType,
    p_action_key: options.actionKey,
    p_details: options.details,
    p_source: options.source,
    p_actor_user_id: options.actorUserId ?? null,
    p_actor_name: options.actorName ?? null,
    p_farm_id: options.farmId ?? null,
    p_barn_id: options.barnId ?? null,
    p_flock_id: options.flockId ?? null,
    p_meta: options.meta ?? {},
  });

  if (error) {
    console.error("activity_log write failed", error);
  }
}

async function getAdminContext() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    redirect(buildLocation({ error: "Supabase admin access is not configured for placement scheduling." }));
  }

  const serverClient = await createSupabaseServerClient();
  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  const actorId = authResult?.data.user?.id ?? null;

  const bundle = await getUserAccessBundle();
  const actor = actorId ? bundle.users.find((user) => user.id === actorId) ?? null : null;
  const actorRole = actor ? resolveRoleTemplate(bundle.roles, actor.role) : null;

  const actorName = actor?.displayName ?? null;

  return { admin, actorId, actorName, actorRole };
}

function canSchedulePlacements(role: ReturnType<typeof resolveRoleTemplate> | null) {
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
    return ["placement_wizard", "placements", "flocks"].includes(action) && (permissionRow.create || permissionRow.update);
  });
}

export async function schedulePlacementAction(formData: FormData) {
  const { admin, actorId, actorName, actorRole } = await getAdminContext();
  if (!canSchedulePlacements(actorRole)) {
    redirect(buildLocation({ error: "Only authorized admin accounts can schedule placements." }));
  }

  if (!actorId) {
    redirect(buildLocation({ error: "A signed-in user is required to schedule placements." }));
  }

  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const selectedDate = coerce(formData.get("selected_date"));
  const month = coerce(formData.get("month"));
  const requestedFlockNumber = coerceNullableNumber(formData.get("flock_number"));
  const growOutDays = coerceNullableNumber(formData.get("grow_out_days")) ?? 63;
  const femaleCount = coerceNullableNumber(formData.get("start_cnt_females"));
  const maleCount = coerceNullableNumber(formData.get("start_cnt_males"));

  if (!farmId || !barnId || !selectedDate) {
    redirect(buildLocation({ farm: farmId || null, barn: barnId || null, month: month || null, error: "Select a farm, barn, and calendar date before scheduling." }));
  }

  if (!requestedFlockNumber) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: "Enter the integrator flock number before scheduling this placement." }));
  }

  const [barnResult, placementsResult] = await Promise.all([
    admin.from("barns").select("id,farm_id,barn_code").eq("id", barnId).maybeSingle(),
    admin
      .from("placements")
      .select("id,flock_id,date_removed,placement_key")
      .eq("barn_id", barnId),
  ]);

  if (barnResult.error || !barnResult.data) {
    redirect(buildLocation({ farm: farmId, month: month || selectedDate.slice(0, 7), error: barnResult.error?.message ?? "Selected barn could not be loaded." }));
  }

  if (barnResult.data.farm_id !== farmId) {
    redirect(buildLocation({ farm: farmId, barn: barnId, month: month || selectedDate.slice(0, 7), error: "The selected barn does not belong to the selected farm." }));
  }

  const flockIds = Array.from(new Set((placementsResult.data ?? []).map((row) => row.flock_id).filter(Boolean)));
  const flocksResult = flockIds.length
    ? await admin.from("flocks").select("id,date_placed,max_date,flock_number").in("id", flockIds)
    : { data: [], error: null };

  if (placementsResult.error || flocksResult.error) {
    redirect(buildLocation({ farm: farmId, barn: barnId, month: month || selectedDate.slice(0, 7), error: placementsResult.error?.message ?? flocksResult.error?.message ?? "Existing placements could not be checked." }));
  }

  const flockById = new Map(((flocksResult.data ?? []) as Array<{ id: string; date_placed: string | null; max_date: string | null; flock_number: number | null }>).map((row) => [row.id, row]));

  const overlap = (placementsResult.data ?? []).find((row) => {
    const flock = flockById.get(row.flock_id);
    const start = coerce(flock?.date_placed as unknown as FormDataEntryValue | null);
    if (!start) {
      return false;
    }
    const end = coerce(row.date_removed as unknown as FormDataEntryValue | null) || coerce(flock?.max_date as unknown as FormDataEntryValue | null) || addDays(start, growOutDays);
    return selectedDate >= start && selectedDate <= end;
  });

  if (overlap) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: `Barn ${barnResult.data.barn_code} is already occupied on ${selectedDate}.` }));
  }

  const flockNumber = requestedFlockNumber;

  const duplicateFlockResult = await admin
    .from("flocks")
    .select("id", { head: true, count: "exact" })
    .eq("farm_id", farmId)
    .eq("flock_number", flockNumber);

  if ((duplicateFlockResult.count ?? 0) > 0) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: `Flock number ${flockNumber} is already in use on this farm.` }));
  }

  const projectedEndDate = addDays(selectedDate, growOutDays);

  const flockInsertResult = await admin
    .from("flocks")
    .insert({
      farm_id: farmId,
      flock_number: flockNumber,
      date_placed: selectedDate,
      max_date: projectedEndDate,
      start_cnt_females: femaleCount,
      start_cnt_males: maleCount,
      created_by: actorId,
      is_active: false,
      is_complete: false,
      is_in_barn: false,
      is_settled: false,
    })
    .select("id")
    .single();

  if (flockInsertResult.error || !flockInsertResult.data?.id) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: flockInsertResult.error?.message ?? "Flock could not be created." }));
  }

  const placementInsertResult = await admin
    .from("placements")
    .insert({
      barn_id: barnId,
      flock_id: flockInsertResult.data.id,
      created_by: actorId,
      is_active: false,
    })
    .select("id,placement_key")
    .single();

  if (placementInsertResult.error) {
    await admin.from("flocks").delete().eq("id", flockInsertResult.data.id);
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: placementInsertResult.error.message }));
  }

  await writeActivityLog(admin, {
    placementId: placementInsertResult.data.id,
    entryType: "functCall",
    actionKey: "schedulePlacementAction",
    details: `Placement ${placementInsertResult.data.placement_key ?? flockNumber} scheduled from placement wizard.`,
    source: "web-admin.placement_wizard",
    actorUserId: actorId,
    actorName,
    farmId,
    barnId,
    flockId: flockInsertResult.data.id,
    meta: {
      selected_date: selectedDate,
      projected_end_date: projectedEndDate,
      flock_number: flockNumber,
    },
  });

  revalidatePath("/admin/placements/new");
  revalidatePath("/admin/flocks");
  revalidatePath("/admin/overview");
  redirect(
    buildLocation({
      farm: farmId,
      barn: barnId,
      date: selectedDate,
      month: month || selectedDate.slice(0, 7),
      notice: `Scheduled flock ${flockNumber} in barn ${barnResult.data.barn_code} starting ${selectedDate}.`,
    }),
  );
}

function coerceNullableDate(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export async function updatePlacementAction(formData: FormData) {
  const { admin, actorId, actorName, actorRole } = await getAdminContext();
  if (!canSchedulePlacements(actorRole)) {
    redirect(buildLocation({ error: "Only authorized admin accounts can update placements." }));
  }

  if (!actorId) {
    redirect(buildLocation({ error: "A signed-in user is required to update placements." }));
  }

  const mode = coerce(formData.get("mode")) || "blocked";
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const selectedDate = coerce(formData.get("selected_date"));
  const month = coerce(formData.get("month"));

  const flockNumber = coerceNullableNumber(formData.get("flock_number"));
  const datePlaced = coerceNullableDate(formData.get("date_placed"));
  const maxDate = coerceNullableDate(formData.get("max_date"));
  const femaleCount = coerceNullableNumber(formData.get("start_cnt_females"));
  const maleCount = coerceNullableNumber(formData.get("start_cnt_males"));
  const breedFemales = coerceNullableDate(formData.get("breed_females"));
  const breedMales = coerceNullableDate(formData.get("breed_males"));
  const lh1Date = coerceNullableDate(formData.get("lh1_date"));
  const lh2Date = coerceNullableDate(formData.get("lh2_date"));
  const lh3Date = coerceNullableDate(formData.get("lh3_date"));
  const dateRemoved = coerceNullableDate(formData.get("date_removed"));

  if (!farmId || !barnId || !placementId || !flockId || !datePlaced || !flockNumber) {
    redirect(
      buildLocation({
        mode,
        farm: farmId || null,
        barn: barnId || null,
        date: selectedDate || datePlaced || null,
        month: month || datePlaced || null,
        error: "Placement editor is missing its flock, placement, or required flock fields.",
      }),
    );
  }

  if (maxDate && maxDate < datePlaced) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: "Projected end date cannot be earlier than the placed date.",
      }),
    );
  }

  if (dateRemoved && dateRemoved < datePlaced) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: "Removed date cannot be earlier than the placed date.",
      }),
    );
  }

  const [duplicateFlockResult, placementsResult] = await Promise.all([
    admin.from("flocks").select("id", { head: true, count: "exact" }).eq("farm_id", farmId).eq("flock_number", flockNumber).neq("id", flockId),
    admin.from("placements").select("id,flock_id,date_removed,active_start,active_end").eq("barn_id", barnId).neq("id", placementId),
  ]);

  if (duplicateFlockResult.error || placementsResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: duplicateFlockResult.error?.message ?? placementsResult.error?.message ?? "Placement validation failed.",
      }),
    );
  }

  if ((duplicateFlockResult.count ?? 0) > 0) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: `Flock number ${flockNumber} is already in use on this farm.`,
      }),
    );
  }

  const siblingFlockIds = Array.from(new Set((placementsResult.data ?? []).map((row) => row.flock_id).filter(Boolean)));
  const siblingFlocksResult = siblingFlockIds.length
    ? await admin.from("flocks").select("id,date_placed,max_date").in("id", siblingFlockIds)
    : { data: [], error: null };

  if (siblingFlocksResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: siblingFlocksResult.error.message,
      }),
    );
  }

  const siblingFlockById = new Map(
    ((siblingFlocksResult.data ?? []) as Array<{ id: string; date_placed: string | null; max_date: string | null }>).map((row) => [row.id, row]),
  );
  const desiredEnd = dateRemoved || maxDate || datePlaced;
  const overlap = (placementsResult.data ?? []).find((row) => {
    const siblingFlock = siblingFlockById.get(row.flock_id);
    const siblingStart = coerceNullableDate(siblingFlock?.date_placed as unknown as FormDataEntryValue | null) || coerceNullableDate(row.active_start as unknown as FormDataEntryValue | null);
    const siblingEnd =
      coerceNullableDate(row.date_removed as unknown as FormDataEntryValue | null) ||
      coerceNullableDate(siblingFlock?.max_date as unknown as FormDataEntryValue | null) ||
      coerceNullableDate(row.active_end as unknown as FormDataEntryValue | null);

    if (!siblingStart || !siblingEnd) {
      return false;
    }

    return datePlaced <= siblingEnd && desiredEnd >= siblingStart;
  });

  if (overlap) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: "This edit overlaps another placement already scheduled for the same barn.",
      }),
    );
  }

  const flockUpdateResult = await admin
    .from("flocks")
    .update({
      flock_number: flockNumber,
      date_placed: datePlaced,
      max_date: maxDate,
      start_cnt_females: femaleCount,
      start_cnt_males: maleCount,
      breed_females: breedFemales,
      breed_males: breedMales,
      updated_by: actorId,
    })
    .eq("id", flockId);

  if (flockUpdateResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: flockUpdateResult.error.message,
      }),
    );
  }

  const placementUpdateResult = await admin
    .from("placements")
    .update({
      date_removed: dateRemoved,
      lh1_date: lh1Date,
      lh2_date: lh2Date,
      lh3_date: lh3Date,
      active_start: datePlaced,
      active_end: maxDate,
      updated_by: actorId,
    })
    .eq("id", placementId);

  if (placementUpdateResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: placementUpdateResult.error.message,
      }),
    );
  }

  await writeActivityLog(admin, {
    placementId,
    entryType: "functCall",
    actionKey: "updatePlacementAction",
    details: `Placement ${flockNumber} updated from placement wizard.`,
    source: "web-admin.placement_wizard",
    actorUserId: actorId,
    actorName,
    farmId,
    barnId,
    flockId,
    meta: {
      date_placed: datePlaced,
      max_date: maxDate,
      date_removed: dateRemoved,
      lh1_date: lh1Date,
      lh2_date: lh2Date,
      lh3_date: lh3Date,
    },
  });

  revalidatePath("/admin/placements/new");
  revalidatePath("/admin/flocks");
  revalidatePath("/admin/overview");
  redirect(
    buildLocation({
      mode,
      farm: farmId,
      barn: barnId,
      month: month || datePlaced.slice(0, 7),
      cleared: true,
      notice: `Updated placement details for flock ${flockNumber}.`,
    }),
  );
}
