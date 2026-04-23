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

async function getSchedulerGrowOutDaysDefault(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const [platformSettingsResult, appSettingsResult] = await Promise.all([
    admin.schema("platform").from("settings").select("name,value,is_active").limit(50),
    admin.from("app_settings").select("name,value"),
  ]);

  let explicitGrowOutDays: number | null = null;
  let explicitNextPlaceOffsetDays: number | null = null;

  const applySetting = (nameValue: string | null | undefined, rawValue: string | number | null | undefined, isActive = true) => {
    if (!isActive) {
      return;
    }

    const normalizedName = String(nameValue ?? "").trim().toLowerCase();
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return;
    }

    if (["growout_days", "grow_out_days", "growoutdays", "max_days"].includes(normalizedName)) {
      explicitGrowOutDays = parsedValue;
      return;
    }

    if (["next_place_date", "nextplacedate", "next_place_days"].includes(normalizedName)) {
      explicitNextPlaceOffsetDays = parsedValue;
    }
  };

  for (const row of (platformSettingsResult.data ?? []) as Array<{ name: string | null; value: string | number | null; is_active: boolean | null }>) {
    applySetting(row.name, row.value, row.is_active !== false);
  }

  for (const row of (appSettingsResult.data ?? []) as Array<{ name: string | null; value: string | number | null }>) {
    applySetting(row.name, row.value, true);
  }

  return explicitGrowOutDays ?? explicitNextPlaceOffsetDays ?? 63;
}

function buildLocation(
  options: {
    mode?: string | null;
    farm?: string | null;
    barn?: string | null;
    placement?: string | null;
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
  if (options.placement) url.searchParams.set("placement", options.placement);
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
  const submittedGrowOutDays = coerceNullableNumber(formData.get("grow_out_days"));
  const femaleCount = coerceNullableNumber(formData.get("start_cnt_females"));
  const maleCount = coerceNullableNumber(formData.get("start_cnt_males"));

  if (!farmId || !barnId || !selectedDate) {
    redirect(buildLocation({ farm: farmId || null, barn: barnId || null, month: month || null, error: "Select a farm, barn, and calendar date before scheduling." }));
  }

  if (!requestedFlockNumber) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: "Enter the integrator flock number before scheduling this placement." }));
  }

  const [barnResult, placementsResult, schedulerGrowOutDays] = await Promise.all([
    admin.from("barns").select("id,farm_id,barn_code").eq("id", barnId).maybeSingle(),
    admin
      .from("placements")
      .select("id,flock_id,date_removed,placement_key")
      .eq("barn_id", barnId),
    submittedGrowOutDays ? Promise.resolve(submittedGrowOutDays) : getSchedulerGrowOutDaysDefault(admin),
  ]);

  const growOutDays = submittedGrowOutDays ?? schedulerGrowOutDays;

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
      month: month || selectedDate.slice(0, 7),
      cleared: true,
      notice: `Scheduled flock ${flockNumber} in barn ${barnResult.data.barn_code} starting ${selectedDate}.`,
    }),
  );
}

function coerceNullableDate(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function isUuidLike(value: string | null) {
  if (!value) {
    return true;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  if (!isUuidLike(breedMales) || !isUuidLike(breedFemales)) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error: "Breed fields currently expect a breed UUID, not a free-text value like Ross308.",
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

export async function deleteScheduledPlacementAction(formData: FormData) {
  const { admin, actorId, actorName, actorRole } = await getAdminContext();
  if (!canSchedulePlacements(actorRole)) {
    redirect(buildLocation({ error: "Only authorized admin accounts can delete scheduled placements." }));
  }

  if (!actorId) {
    redirect(buildLocation({ error: "A signed-in user is required to delete a scheduled placement." }));
  }

  const mode = coerce(formData.get("mode")) || "blocked";
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const selectedDate = coerce(formData.get("selected_date"));
  const month = coerce(formData.get("month"));

  if (!farmId || !barnId || !placementId || !flockId) {
    redirect(
      buildLocation({
        mode,
        farm: farmId || null,
        barn: barnId || null,
        date: selectedDate || null,
        month: month || null,
        error: "Placement delete is missing its placement or flock reference.",
      }),
    );
  }

  const [placementResult, flockResult, siblingPlacementsResult, dailyCountResult, mortalityCountResult, weightCountResult, feedDropCountResult] =
    await Promise.all([
      admin
        .from("placements")
        .select("id,farm_id,barn_id,flock_id,is_active,date_removed,active_start,active_end,placement_key")
        .eq("id", placementId)
        .maybeSingle(),
      admin.from("flocks").select("id,farm_id,flock_number,date_placed,max_date,is_active,is_in_barn").eq("id", flockId).maybeSingle(),
      admin.from("placements").select("id", { head: true, count: "exact" }).eq("flock_id", flockId),
      admin.from("log_daily").select("id", { head: true, count: "exact" }).eq("placement_id", placementId),
      admin.from("log_mortality").select("id", { head: true, count: "exact" }).eq("placement_id", placementId),
      admin.from("log_weight").select("id", { head: true, count: "exact" }).eq("placement_id", placementId),
      admin.from("feed_drops").select("id", { head: true, count: "exact" }).eq("placement_id", placementId),
    ]);

  const placement = placementResult.data;
  const flock = flockResult.data;

  if (placementResult.error || !placement || flockResult.error || !flock) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || null,
        month: month || null,
        error: placementResult.error?.message ?? flockResult.error?.message ?? "Scheduled placement could not be loaded for delete.",
      }),
    );
  }

  if (placement.farm_id !== farmId || placement.barn_id !== barnId || placement.flock_id !== flockId || flock.farm_id !== farmId) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || flock.date_placed || null,
        month: month || flock.date_placed?.slice(0, 7) || null,
        error: "Delete request no longer matches the selected placement.",
      }),
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const startDate = coerceNullableDate(placement.active_start as unknown as FormDataEntryValue | null) || flock.date_placed;

  if (!startDate || startDate <= todayIso || placement.is_active || flock.is_active || flock.is_in_barn || placement.date_removed) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || startDate || null,
        month: month || startDate?.slice(0, 7) || null,
        error: "Only future scheduled placements that have not gone live can be deleted here.",
      }),
    );
  }

  const siblingPlacementCount = siblingPlacementsResult.count ?? 0;
  if (siblingPlacementsResult.error || siblingPlacementCount !== 1) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || startDate,
        month: month || startDate.slice(0, 7),
        error:
          siblingPlacementsResult.error?.message ??
          "This flock is linked to more than one placement, so it cannot be deleted from the scheduler.",
      }),
    );
  }

  const childCounts = {
    daily: dailyCountResult.count ?? 0,
    mortality: mortalityCountResult.count ?? 0,
    weight: weightCountResult.count ?? 0,
    feedDrops: feedDropCountResult.count ?? 0,
  };

  if (dailyCountResult.error || mortalityCountResult.error || weightCountResult.error || feedDropCountResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || startDate,
        month: month || startDate.slice(0, 7),
        error:
          dailyCountResult.error?.message ??
          mortalityCountResult.error?.message ??
          weightCountResult.error?.message ??
          feedDropCountResult.error?.message ??
          "Child record checks failed before delete.",
      }),
    );
  }

  const totalChildCount = Object.values(childCounts).reduce((sum, value) => sum + value, 0);
  if (totalChildCount > 0) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || startDate,
        month: month || startDate.slice(0, 7),
        error: `This scheduled flock cannot be deleted because it already has child records (${childCounts.daily} daily, ${childCounts.mortality} mortality, ${childCounts.weight} weight, ${childCounts.feedDrops} feed drops).`,
      }),
    );
  }

  await Promise.all([
    admin.from("activity_log").delete().eq("placement_id", placementId),
    admin.from("activity_log").delete().eq("flock_id", flockId),
    admin.schema("platform").from("sync_outbox").delete().eq("placement_id", placementId),
  ]);

  const placementDeleteResult = await admin.from("placements").delete().eq("id", placementId);
  if (placementDeleteResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || startDate,
        month: month || startDate.slice(0, 7),
        error: placementDeleteResult.error.message,
      }),
    );
  }

  const flockDeleteResult = await admin.from("flocks").delete().eq("id", flockId);
  if (flockDeleteResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || startDate,
        month: month || startDate.slice(0, 7),
        error: flockDeleteResult.error.message,
      }),
    );
  }

  revalidatePath("/admin/placements/new");
  revalidatePath("/admin/flocks");
  revalidatePath("/admin/overview");
  redirect(
    buildLocation({
      mode,
      farm: farmId,
      barn: barnId,
      month: month || startDate.slice(0, 7),
      cleared: true,
      notice: `Deleted scheduled flock ${flock.flock_number ?? placement.placement_key ?? "placement"} so you can reschedule it cleanly.`,
    }),
  );
}
