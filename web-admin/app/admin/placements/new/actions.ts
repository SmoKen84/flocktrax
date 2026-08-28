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

function minDate(values: Array<string | null | undefined>) {
  const filtered = values.filter((value): value is string => Boolean(value)).sort();
  return filtered[0] ?? null;
}

function buildSexPlacementDates(options: {
  primaryDate: string;
  femaleCount: number | null;
  maleCount: number | null;
  femaleDate: string | null;
  maleDate: string | null;
}) {
  const femalePlacedDate =
    options.femaleDate ?? (options.femaleCount !== null && options.femaleCount > 0 ? options.primaryDate : null);
  const malePlacedDate =
    options.maleDate ?? (options.maleCount !== null && options.maleCount > 0 ? options.primaryDate : null);
  const canonicalPrimaryDate = minDate([options.primaryDate, femalePlacedDate, malePlacedDate]) ?? options.primaryDate;

  return {
    canonicalPrimaryDate,
    femalePlacedDate,
    malePlacedDate,
  };
}

function resolveSubmittedSexPlacementDate(options: {
  submittedDate: string | null;
  originalPrimaryDate: string | null;
  originalSexDate: string | null;
  nextPrimaryDate: string;
}) {
  if (!options.submittedDate || !options.originalPrimaryDate) {
    return options.submittedDate;
  }

  const originalEffectiveSexDate = options.originalSexDate ?? options.originalPrimaryDate;
  const primaryDateChanged = options.nextPrimaryDate !== options.originalPrimaryDate;
  const wasFollowingPrimaryDate = originalEffectiveSexDate === options.originalPrimaryDate;
  const stillMatchesOriginalPrimaryDate = options.submittedDate === options.originalPrimaryDate;

  if (primaryDateChanged && wasFollowingPrimaryDate && stillMatchesOriginalPrimaryDate) {
    return options.nextPrimaryDate;
  }

  return options.submittedDate;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDays(nextDate: string, previousDate: string) {
  const next = new Date(`${nextDate}T00:00:00Z`);
  const previous = new Date(`${previousDate}T00:00:00Z`);
  return Math.round((next.getTime() - previous.getTime()) / 86400000);
}

function buildPlacementOverlapMessage(options: {
  barnCode: string;
  siblingStart: string;
  siblingEnd: string;
  flockNumber?: number | null;
  placementKey?: string | null;
}) {
  const placementLabel = options.placementKey?.trim()
    ? options.placementKey.trim()
    : options.flockNumber
      ? `flock ${options.flockNumber}`
      : "another placement";

  return `This change overlaps ${placementLabel} in barn ${options.barnCode} from ${options.siblingStart} to ${options.siblingEnd}.`;
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
  const submittedFemalePlacedDate = coerceNullableDate(formData.get("female_date_placed"));
  const submittedMalePlacedDate = coerceNullableDate(formData.get("male_date_placed"));

  if (!farmId || !barnId || !selectedDate) {
    redirect(buildLocation({ farm: farmId || null, barn: barnId || null, month: month || null, error: "Select a farm, barn, and calendar date before scheduling." }));
  }

  if (!requestedFlockNumber) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: "Enter the integrator flock number before scheduling this placement." }));
  }

  if (submittedFemalePlacedDate && submittedFemalePlacedDate < selectedDate) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: "Female placement date cannot be earlier than the barn possession date." }));
  }

  if (submittedMalePlacedDate && submittedMalePlacedDate < selectedDate) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: "Male placement date cannot be earlier than the barn possession date." }));
  }

  const [barnResult, placementsResult, schedulerGrowOutDays] = await Promise.all([
    admin.from("barns").select("id,farm_id,barn_code").eq("id", barnId).maybeSingle(),
    admin
      .from("placements")
      .select("id,flock_id,date_removed,placement_key,active_start,active_end")
      .eq("barn_id", barnId)
      .not("lifecycle_stage", "in", "(canceled,unassigned)"),
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

  const { canonicalPrimaryDate, femalePlacedDate, malePlacedDate } = buildSexPlacementDates({
    primaryDate: selectedDate,
    femaleCount,
    maleCount,
    femaleDate: submittedFemalePlacedDate,
    maleDate: submittedMalePlacedDate,
  });

  const projectedEndDate = addDays(canonicalPrimaryDate, growOutDays);

  const overlap = (placementsResult.data ?? []).find((row) => {
    const flock = flockById.get(row.flock_id);
    const siblingStart =
      coerce(row.active_start as unknown as FormDataEntryValue | null) ||
      coerce(flock?.date_placed as unknown as FormDataEntryValue | null);
    if (!siblingStart) {
      return false;
    }
    const siblingEnd =
      coerce(row.date_removed as unknown as FormDataEntryValue | null) ||
      coerce(row.active_end as unknown as FormDataEntryValue | null) ||
      coerce(flock?.max_date as unknown as FormDataEntryValue | null) ||
      addDays(siblingStart, growOutDays);
    return canonicalPrimaryDate <= siblingEnd && projectedEndDate >= siblingStart;
  });

  if (overlap) {
    const blockingFlock = flockById.get(overlap.flock_id);
    const siblingStart =
      coerce(overlap.active_start as unknown as FormDataEntryValue | null) ||
      coerce(blockingFlock?.date_placed as unknown as FormDataEntryValue | null) ||
      selectedDate;
    const siblingEnd =
      coerce(overlap.date_removed as unknown as FormDataEntryValue | null) ||
      coerce(overlap.active_end as unknown as FormDataEntryValue | null) ||
      coerce(blockingFlock?.max_date as unknown as FormDataEntryValue | null) ||
      addDays(siblingStart, growOutDays);

    redirect(
      buildLocation({
        farm: farmId,
        barn: barnId,
        date: canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
        error: buildPlacementOverlapMessage({
          barnCode: barnResult.data.barn_code,
          siblingStart,
          siblingEnd,
          flockNumber: blockingFlock?.flock_number ?? null,
          placementKey: overlap.placement_key ?? null,
        }),
      }),
    );
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

  const flockInsertResult = await admin
    .from("flocks")
    .insert({
      farm_id: farmId,
      flock_number: flockNumber,
      date_placed: canonicalPrimaryDate,
      female_date_placed: femalePlacedDate,
      male_date_placed: malePlacedDate,
      max_date: projectedEndDate,
      start_cnt_females: femaleCount,
      start_cnt_males: maleCount,
      created_by: actorId,
      is_active: false,
      is_complete: false,
      is_in_barn: false,
      is_settled: false,
    })
    .select("id,date_placed,max_date")
    .single();

  if (flockInsertResult.error || !flockInsertResult.data?.id) {
    redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: flockInsertResult.error?.message ?? "Flock could not be created." }));
  }

  const flockDatesNeedCorrection =
    flockInsertResult.data.date_placed !== canonicalPrimaryDate || flockInsertResult.data.max_date !== projectedEndDate;

  if (flockDatesNeedCorrection) {
    const flockCorrectionResult = await admin
      .from("flocks")
      .update({
        date_placed: canonicalPrimaryDate,
        female_date_placed: femalePlacedDate,
        male_date_placed: malePlacedDate,
        max_date: projectedEndDate,
        updated_by: actorId,
      })
      .eq("id", flockInsertResult.data.id);

    if (flockCorrectionResult.error) {
      await admin.from("flocks").delete().eq("id", flockInsertResult.data.id);
      redirect(buildLocation({ farm: farmId, barn: barnId, date: selectedDate, month: month || selectedDate.slice(0, 7), error: flockCorrectionResult.error.message }));
    }
  }

  const placementInsertResult = await admin
    .from("placements")
    .insert({
      barn_id: barnId,
      flock_id: flockInsertResult.data.id,
      active_start: canonicalPrimaryDate,
      active_end: projectedEndDate,
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
      selected_date: canonicalPrimaryDate,
      female_date_placed: femalePlacedDate,
      male_date_placed: malePlacedDate,
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
      month: month || canonicalPrimaryDate.slice(0, 7),
      cleared: true,
      notice: `Scheduled flock ${flockNumber} in barn ${barnResult.data.barn_code} starting ${canonicalPrimaryDate}.`,
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
  const submittedMaxDate = coerceNullableDate(formData.get("max_date"));
  const femaleCount = coerceNullableNumber(formData.get("start_cnt_females"));
  const maleCount = coerceNullableNumber(formData.get("start_cnt_males"));
  const submittedFemalePlacedDate = coerceNullableDate(formData.get("female_date_placed"));
  const submittedMalePlacedDate = coerceNullableDate(formData.get("male_date_placed"));
  const breedFemales = coerceNullableDate(formData.get("breed_females"));
  const breedMales = coerceNullableDate(formData.get("breed_males"));
  const submittedLh1Date = coerceNullableDate(formData.get("lh1_date"));
  const submittedLh2Date = coerceNullableDate(formData.get("lh2_date"));
  const submittedLh3Date = coerceNullableDate(formData.get("lh3_date"));
  const dateRemoved = coerceNullableDate(formData.get("date_removed"));
  const requestedLifecycleStage = coerceNullableDate(formData.get("placement_lifecycle_stage")) as
    | "scheduled"
    | "awaiting_arrival"
    | "in_barn_growing"
    | "waiting_closeout"
    | "closeout_submitted"
    | "archived"
    | "canceled"
    | null;

  if (requestedLifecycleStage === "archived") {
    redirect(
      buildLocation({
        mode,
        farm: farmId || null,
        barn: barnId || null,
        placement: placementId || null,
        month: month || null,
        error: "Only Archive Flock can place a flock into the final Closed state.",
      }),
    );
  }

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

  const [currentPlacementResult, currentFlockResult] = await Promise.all([
    admin
      .from("placements")
      .select("id,active_start,active_end,date_removed,lifecycle_stage,lh1_date,lh2_date,lh3_date")
      .eq("id", placementId)
      .maybeSingle(),
    admin
      .from("flocks")
      .select("id,date_placed,female_date_placed,male_date_placed,max_date,is_in_barn,is_complete")
      .eq("id", flockId)
      .maybeSingle(),
  ]);

  const currentPlacement = currentPlacementResult.data;
  const currentFlock = currentFlockResult.data;

  if (currentPlacementResult.error || !currentPlacement || currentFlockResult.error || !currentFlock) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || datePlaced,
        month: month || datePlaced.slice(0, 7),
        error:
          currentPlacementResult.error?.message ??
          currentFlockResult.error?.message ??
          "The current placement could not be loaded for update.",
      }),
    );
  }

  if (currentPlacement.lifecycle_stage === "canceled") {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || currentFlock.date_placed || currentPlacement.active_start || null,
        month: month || currentFlock.date_placed?.slice(0, 7) || currentPlacement.active_start?.slice(0, 7) || null,
        error: "Canceled placements are retained for audit history and cannot be edited.",
      }),
    );
  }

  if (currentPlacement.lifecycle_stage === "archived" || currentFlock.is_complete === true) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || currentFlock.date_placed || currentPlacement.active_start || null,
        month: month || currentFlock.date_placed?.slice(0, 7) || currentPlacement.active_start?.slice(0, 7) || null,
        error: "Closed flocks are final, read-only records. Archive Flock is the only action that creates this state.",
      }),
    );
  }

  const originalPlacedDate = currentFlock.date_placed ?? currentPlacement.active_start;
  const effectiveFemalePlacedDate = resolveSubmittedSexPlacementDate({
    submittedDate: submittedFemalePlacedDate,
    originalPrimaryDate: originalPlacedDate,
    originalSexDate: currentFlock.female_date_placed,
    nextPrimaryDate: datePlaced,
  });
  const effectiveMalePlacedDate = resolveSubmittedSexPlacementDate({
    submittedDate: submittedMalePlacedDate,
    originalPrimaryDate: originalPlacedDate,
    originalSexDate: currentFlock.male_date_placed,
    nextPrimaryDate: datePlaced,
  });
  const { canonicalPrimaryDate, femalePlacedDate, malePlacedDate } = buildSexPlacementDates({
    primaryDate: datePlaced,
    femaleCount,
    maleCount,
    femaleDate: effectiveFemalePlacedDate,
    maleDate: effectiveMalePlacedDate,
  });
  const originalMaxDate = currentFlock.max_date ?? currentPlacement.active_end;
  const normalizedRole = String(actorRole?.key ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const canOverridePlacementLifecycleStage =
    normalizedRole === "super_admin" || normalizedRole === "superadmin" || normalizedRole.includes("super");
  const canShiftAwaitingArrivalDates =
    currentPlacement.lifecycle_stage === "awaiting_arrival" &&
    currentFlock.is_in_barn !== true &&
    currentPlacement.date_removed == null &&
    currentFlock.is_complete !== true;

  let maxDate = submittedMaxDate;
  let lh1Date = submittedLh1Date;
  let lh2Date = submittedLh2Date;
  let lh3Date = submittedLh3Date;

  if (canShiftAwaitingArrivalDates && originalPlacedDate && canonicalPrimaryDate !== originalPlacedDate) {
    const dateDelta = diffDays(canonicalPrimaryDate, originalPlacedDate);

    if (originalMaxDate && (!submittedMaxDate || submittedMaxDate === originalMaxDate)) {
      maxDate = addDays(originalMaxDate, dateDelta);
    }

    if (currentPlacement.lh1_date && (!submittedLh1Date || submittedLh1Date === currentPlacement.lh1_date)) {
      lh1Date = addDays(currentPlacement.lh1_date, dateDelta);
    }

    if (currentPlacement.lh2_date && (!submittedLh2Date || submittedLh2Date === currentPlacement.lh2_date)) {
      lh2Date = addDays(currentPlacement.lh2_date, dateDelta);
    }

    if (currentPlacement.lh3_date && (!submittedLh3Date || submittedLh3Date === currentPlacement.lh3_date)) {
      lh3Date = addDays(currentPlacement.lh3_date, dateDelta);
    }
  }

  if (femalePlacedDate && femalePlacedDate < canonicalPrimaryDate) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
        error: "Female placement date cannot be earlier than the primary placed date.",
      }),
    );
  }

  if (malePlacedDate && malePlacedDate < canonicalPrimaryDate) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
        error: "Male placement date cannot be earlier than the primary placed date.",
      }),
    );
  }

  if (maxDate && maxDate < canonicalPrimaryDate) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
        error: "Projected end date cannot be earlier than the placed date.",
      }),
    );
  }

  if (dateRemoved && dateRemoved < canonicalPrimaryDate) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
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
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
        error: "Breed fields currently expect a breed UUID, not a free-text value like Ross308.",
      }),
    );
  }

  const [duplicateFlockResult, placementsResult] = await Promise.all([
    admin.from("flocks").select("id", { head: true, count: "exact" }).eq("farm_id", farmId).eq("flock_number", flockNumber).neq("id", flockId),
    admin
      .from("placements")
      .select("id,flock_id,date_removed,placement_key,active_start,active_end")
      .eq("barn_id", barnId)
      .neq("id", placementId)
      .not("lifecycle_stage", "in", "(canceled,unassigned)"),
  ]);

  if (duplicateFlockResult.error || placementsResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
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
    ? await admin.from("flocks").select("id,date_placed,max_date,flock_number").in("id", siblingFlockIds)
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
    ((siblingFlocksResult.data ?? []) as Array<{ id: string; date_placed: string | null; max_date: string | null; flock_number: number | null }>).map((row) => [row.id, row]),
  );
  const desiredEnd = dateRemoved || maxDate || canonicalPrimaryDate;
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

    return canonicalPrimaryDate <= siblingEnd && desiredEnd >= siblingStart;
  });

  if (overlap) {
    const siblingFlock = siblingFlockById.get(overlap.flock_id);
    const siblingStart =
      coerceNullableDate(siblingFlock?.date_placed as unknown as FormDataEntryValue | null) ||
      coerceNullableDate(overlap.active_start as unknown as FormDataEntryValue | null) ||
      canonicalPrimaryDate;
    const siblingEnd =
      coerceNullableDate(overlap.date_removed as unknown as FormDataEntryValue | null) ||
      coerceNullableDate(siblingFlock?.max_date as unknown as FormDataEntryValue | null) ||
      coerceNullableDate(overlap.active_end as unknown as FormDataEntryValue | null) ||
      siblingStart;
    const barnCodeResult = await admin.from("barns").select("barn_code").eq("id", barnId).maybeSingle();

    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
        error: buildPlacementOverlapMessage({
          barnCode: barnCodeResult.data?.barn_code ?? "this barn",
          siblingStart,
          siblingEnd,
          flockNumber: siblingFlock?.flock_number ?? null,
          placementKey: overlap.placement_key ?? null,
        }),
      }),
    );
  }

  const flockUpdateResult = await admin
    .from("flocks")
    .update({
      flock_number: flockNumber,
      date_placed: canonicalPrimaryDate,
      female_date_placed: femalePlacedDate,
      male_date_placed: malePlacedDate,
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
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
        error: flockUpdateResult.error.message,
      }),
    );
  }

  const placementUpdateResult = await admin
    .from("placements")
    .update({
      lifecycle_stage:
        canOverridePlacementLifecycleStage && requestedLifecycleStage
          ? requestedLifecycleStage
          : currentPlacement.lifecycle_stage,
      date_removed: dateRemoved,
      lh1_date: lh1Date,
      lh2_date: lh2Date,
      lh3_date: lh3Date,
      active_start: canonicalPrimaryDate,
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
        date: selectedDate || canonicalPrimaryDate,
        month: month || canonicalPrimaryDate.slice(0, 7),
        error: placementUpdateResult.error.message,
      }),
    );
  }

  const nextLifecycleStage =
    canOverridePlacementLifecycleStage && requestedLifecycleStage
      ? requestedLifecycleStage
      : currentPlacement.lifecycle_stage;

  if (nextLifecycleStage === "awaiting_arrival") {
    const { error: makeCurrentError } = await admin.rpc("make_placement_current", {
      p_placement_id: placementId,
    });

    if (makeCurrentError) {
      redirect(
        buildLocation({
          mode,
          farm: farmId,
          barn: barnId,
          date: selectedDate || canonicalPrimaryDate,
          month: month || canonicalPrimaryDate.slice(0, 7),
          error: makeCurrentError.message,
        }),
      );
    }
  } else if (nextLifecycleStage === "in_barn_growing") {
    const { error: arrivalError } = await admin.rpc("mark_chicks_arrived", {
      p_placement_id: placementId,
      p_arrival_date: canonicalPrimaryDate,
    });

    if (arrivalError) {
      redirect(
        buildLocation({
          mode,
          farm: farmId,
          barn: barnId,
          date: selectedDate || canonicalPrimaryDate,
          month: month || canonicalPrimaryDate.slice(0, 7),
          error: arrivalError.message,
        }),
      );
    }
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
      date_placed: canonicalPrimaryDate,
      female_date_placed: femalePlacedDate,
      male_date_placed: malePlacedDate,
      max_date: maxDate,
      date_removed: dateRemoved,
      lifecycle_stage:
        canOverridePlacementLifecycleStage && requestedLifecycleStage
          ? requestedLifecycleStage
          : currentPlacement.lifecycle_stage,
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
      month: month || canonicalPrimaryDate.slice(0, 7),
      cleared: true,
      notice: `Updated placement details for flock ${flockNumber}.`,
    }),
  );
}

export async function unassignScheduledPlacementAction(formData: FormData) {
  const { admin, actorId, actorRole } = await getAdminContext();
  if (!canSchedulePlacements(actorRole)) {
    redirect(buildLocation({ error: "Only authorized admin accounts can unassign scheduled flocks." }));
  }
  if (!actorId) {
    redirect(buildLocation({ error: "A signed-in user is required to unassign a flock." }));
  }

  const placementId = coerce(formData.get("placement_id"));
  const placementCode = coerce(formData.get("placement_code")) || "flock";
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const month = coerce(formData.get("month"));
  const mode = coerce(formData.get("mode")) || "placements";

  if (!placementId) {
    redirect(buildLocation({ mode, month: month || null, error: "Placement context was incomplete for unassignment." }));
  }

  const { error } = await admin.rpc("unassign_scheduled_placement", {
    p_placement_id: placementId,
    p_actor_id: actorId,
  });

  if (error) {
    redirect(buildLocation({ mode, farm: farmId || null, barn: barnId || null, placement: placementId, month: month || null, error: error.message }));
  }

  revalidatePath("/admin/placements/new");
  revalidatePath("/admin/overview");
  revalidatePath("/admin/feed-tickets");
  redirect(buildLocation({ mode: "placements", farm: farmId || null, month: month || null, cleared: true, notice: `${placementCode} is waiting in the Unassigned Flocks queue.` }));
}

export async function reassignUnassignedPlacementAction(formData: FormData) {
  const { admin, actorId, actorRole } = await getAdminContext();
  if (!canSchedulePlacements(actorRole)) {
    redirect(buildLocation({ error: "Only authorized admin accounts can assign queued flocks." }));
  }
  if (!actorId) {
    redirect(buildLocation({ error: "A signed-in user is required to assign a queued flock." }));
  }

  const placementId = coerce(formData.get("placement_id"));
  const placementCode = coerce(formData.get("placement_code")) || "Flock";
  const destination = coerce(formData.get("destination"));
  const [farmId, barnId] = destination.split("|");
  const startDate = coerce(formData.get("start_date"));

  if (!placementId || !farmId || !barnId || !startDate) {
    redirect(buildLocation({ mode: "placements", error: "Choose a destination barn and placement date before assigning the flock." }));
  }

  const { error } = await admin.rpc("reassign_unassigned_placement", {
    p_placement_id: placementId,
    p_farm_id: farmId,
    p_barn_id: barnId,
    p_start_date: startDate,
    p_actor_id: actorId,
  });

  if (error) {
    redirect(buildLocation({ mode: "placements", error: error.message }));
  }

  revalidatePath("/admin/placements/new");
  revalidatePath("/admin/overview");
  revalidatePath("/admin/feed-tickets");
  redirect(buildLocation({
    mode: "placements",
    farm: farmId,
    barn: barnId,
    placement: placementId,
    date: startDate,
    month: startDate.slice(0, 7),
    notice: `${placementCode} was assigned to its new barn and date block. Feed remained with its physical barn, and any queued feed already at the destination barn was attached automatically.`,
  }));
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
        .select("id,farm_id,barn_id,flock_id,is_active,lifecycle_stage,date_removed,active_start,active_end,placement_key")
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

  if (
    !startDate ||
    flock.is_in_barn ||
    placement.date_removed ||
    !["scheduled", "awaiting_arrival"].includes(placement.lifecycle_stage)
  ) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || startDate || null,
        month: month || startDate?.slice(0, 7) || null,
        error: "Only placements that have not gone in-barn and have not already been removed can be deleted here.",
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

export async function cancelScheduledPlacementAction(formData: FormData) {
  const { admin, actorId, actorName, actorRole } = await getAdminContext();
  if (!canSchedulePlacements(actorRole)) {
    redirect(buildLocation({ error: "Only authorized admin accounts can cancel scheduled placements." }));
  }

  if (!actorId) {
    redirect(buildLocation({ error: "A signed-in user is required to cancel a scheduled placement." }));
  }

  const mode = coerce(formData.get("mode")) || "blocked";
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const selectedDate = coerce(formData.get("selected_date"));
  const month = coerce(formData.get("month"));
  const targetPlacementId = coerce(formData.get("cancel_target_placement_id")) || null;

  if (!farmId || !barnId || !placementId || !flockId) {
    redirect(
      buildLocation({
        mode,
        farm: farmId || null,
        barn: barnId || null,
        placement: placementId || null,
        date: selectedDate || null,
        month: month || null,
        error: "Placement cancellation is missing its placement or flock reference.",
      }),
    );
  }

  const cancellationResult = await admin.rpc("cancel_scheduled_placement", {
    p_source_placement_id: placementId,
    p_target_placement_id: targetPlacementId,
    p_actor_id: actorId,
  });

  if (cancellationResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || null,
        month: month || selectedDate?.slice(0, 7) || null,
        error: cancellationResult.error.message,
      }),
    );
  }

  const result = (cancellationResult.data ?? {}) as {
    source_placement_key?: string | null;
    source_flock_id?: string | null;
    target_placement_id?: string | null;
    target_placement_key?: string | null;
    feed_drop_count?: number | null;
    feed_drop_lbs?: number | null;
    queued_feed_drop_count?: number | null;
    queued_feed_drop_lbs?: number | null;
    feed_order_count?: number | null;
    feed_order_lbs?: number | null;
  };
  const feedDropCount = (result.feed_drop_count ?? 0) + (result.queued_feed_drop_count ?? 0);
  const feedDropLbs = (result.feed_drop_lbs ?? 0) + (result.queued_feed_drop_lbs ?? 0);
  const feedOrderCount = result.feed_order_count ?? 0;
  const feedOrderLbs = result.feed_order_lbs ?? 0;
  const sourcePlacementKey = result.source_placement_key ?? placementId;

  await writeActivityLog(admin, {
    placementId,
    entryType: "functCall",
    actionKey: "cancelScheduledPlacementAction",
    details: result.target_placement_key
      ? `Canceled scheduled flock ${sourcePlacementKey} and reassigned its feed to ${result.target_placement_key}.`
      : `Canceled scheduled flock ${sourcePlacementKey} with no feed reassignment required.`,
    source: "web-admin.placement_wizard",
    actorUserId: actorId,
    actorName,
    farmId,
    barnId,
    flockId,
    meta: {
      target_placement_id: result.target_placement_id ?? null,
      target_placement_key: result.target_placement_key ?? null,
      transferred_feed_drop_count: feedDropCount,
      transferred_feed_drop_lbs: feedDropLbs,
      transferred_feed_order_count: feedOrderCount,
      transferred_feed_order_lbs: feedOrderLbs,
    },
  });

  revalidatePath("/admin/placements/new");
  revalidatePath("/admin/overview");
  revalidatePath("/admin/feed-tickets");
  revalidatePath("/admin/reports/feed-projection");
  revalidatePath("/admin/reports/feed-projection-custom");
  redirect(
    buildLocation({
      mode,
      farm: farmId,
      barn: barnId,
      placement: placementId,
      date: selectedDate || null,
      month: month || selectedDate?.slice(0, 7) || null,
      notice: result.target_placement_key
        ? `Canceled ${sourcePlacementKey}. Associated feed was moved to ${result.target_placement_key}.`
        : `Canceled ${sourcePlacementKey}. No associated feed required reassignment.`,
    }),
  );
}

export async function juggleScheduledPlacementAction(formData: FormData) {
  const { admin, actorId, actorName, actorRole } = await getAdminContext();
  if (!canSchedulePlacements(actorRole)) {
    redirect(buildLocation({ error: "Only authorized admin accounts can juggle scheduled placements." }));
  }

  if (!actorId) {
    redirect(buildLocation({ error: "A signed-in user is required to juggle a scheduled placement." }));
  }

  const mode = coerce(formData.get("mode")) || "blocked";
  const farmId = coerce(formData.get("farm_id"));
  const barnId = coerce(formData.get("barn_id"));
  const placementId = coerce(formData.get("placement_id"));
  const flockId = coerce(formData.get("flock_id"));
  const selectedDate = coerce(formData.get("selected_date"));
  const month = coerce(formData.get("month"));
  const targetPlacementId = coerce(formData.get("target_placement_id"));

  if (!farmId || !barnId || !placementId || !flockId || !targetPlacementId) {
    redirect(
      buildLocation({
        mode,
        farm: farmId || null,
        barn: barnId || null,
        placement: placementId || null,
        date: selectedDate || null,
        month: month || null,
        error: "Juggle requires both the canceled flock and the replacement flock selection.",
      }),
    );
  }

  const [
    sourcePlacementResult,
    sourceFlockResult,
    targetPlacementResult,
    sourceFeedDropCountResult,
    sourceDailyCountResult,
    sourceMortalityCountResult,
    sourceWeightCountResult,
  ] = await Promise.all([
    admin
      .from("placements")
      .select("id,farm_id,barn_id,flock_id,is_active,lifecycle_stage,date_removed,active_start,active_end,placement_key")
      .eq("id", placementId)
      .maybeSingle(),
    admin
      .from("flocks")
      .select("id,farm_id,flock_number,date_placed,max_date,is_active,is_in_barn,is_complete,is_settled")
      .eq("id", flockId)
      .maybeSingle(),
    admin
      .from("placements")
      .select("id,farm_id,barn_id,flock_id,is_active,lifecycle_stage,date_removed,active_start,active_end,placement_key")
      .eq("id", targetPlacementId)
      .maybeSingle(),
    admin.from("feed_drops").select("id", { head: true, count: "exact" }).eq("placement_id", placementId),
    admin.from("log_daily").select("id", { head: true, count: "exact" }).eq("placement_id", placementId),
    admin.from("log_mortality").select("id", { head: true, count: "exact" }).eq("placement_id", placementId),
    admin.from("log_weight").select("id", { head: true, count: "exact" }).eq("placement_id", placementId),
  ]);

  const sourcePlacement = sourcePlacementResult.data;
  const sourceFlock = sourceFlockResult.data;
  const targetPlacement = targetPlacementResult.data;

  if (sourcePlacementResult.error || !sourcePlacement || sourceFlockResult.error || !sourceFlock || targetPlacementResult.error || !targetPlacement) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || null,
        month: month || null,
        error:
          sourcePlacementResult.error?.message ??
          sourceFlockResult.error?.message ??
          targetPlacementResult.error?.message ??
          "The source or target placement could not be loaded for juggle.",
      }),
    );
  }

  if (sourcePlacement.farm_id !== farmId || sourcePlacement.barn_id !== barnId || sourcePlacement.flock_id !== flockId || targetPlacement.id === sourcePlacement.id) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error: "The source or replacement flock selection is no longer valid.",
      }),
    );
  }

  if (
    sourceFlock.is_in_barn ||
    sourcePlacement.date_removed ||
    !["scheduled", "awaiting_arrival"].includes(sourcePlacement.lifecycle_stage)
  ) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error: "Only not-in-barn scheduled flocks can be juggled to a replacement flock.",
      }),
    );
  }

  const sourceOperationalChildCount =
    (sourceDailyCountResult.count ?? 0) + (sourceMortalityCountResult.count ?? 0) + (sourceWeightCountResult.count ?? 0);
  if (sourceDailyCountResult.error || sourceMortalityCountResult.error || sourceWeightCountResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error:
          sourceDailyCountResult.error?.message ??
          sourceMortalityCountResult.error?.message ??
          sourceWeightCountResult.error?.message ??
          "Source child record checks failed before juggle.",
      }),
    );
  }

  if (sourceOperationalChildCount > 0) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error: "This flock cannot be juggled because it already has daily, mortality, or weight records.",
      }),
    );
  }

  const targetFlockId = targetPlacement.flock_id;
  if (!targetFlockId) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error: "The replacement flock is missing its flock reference.",
      }),
    );
  }

  const [
    targetFlockResult,
    targetBarnResult,
    sourceBarnResult,
    targetDailyCountResult,
    targetMortalityCountResult,
    targetWeightCountResult,
    targetFeedDropCountResult,
    targetSiblingPlacementsResult,
    duplicateTargetFlockResult,
  ] = await Promise.all([
    admin
      .from("flocks")
      .select("id,farm_id,flock_number,date_placed,max_date,is_active,is_in_barn,is_complete,is_settled")
      .eq("id", targetFlockId)
      .maybeSingle(),
    targetPlacement.barn_id
      ? admin.from("barns").select("id,barn_code,farm_id").eq("id", targetPlacement.barn_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.from("barns").select("id,barn_code,farm_id").eq("id", barnId).maybeSingle(),
    admin.from("log_daily").select("id", { head: true, count: "exact" }).eq("placement_id", targetPlacementId),
    admin.from("log_mortality").select("id", { head: true, count: "exact" }).eq("placement_id", targetPlacementId),
    admin.from("log_weight").select("id", { head: true, count: "exact" }).eq("placement_id", targetPlacementId),
    admin.from("feed_drops").select("id", { head: true, count: "exact" }).eq("placement_id", targetPlacementId),
    admin
      .from("placements")
      .select("id,flock_id,date_removed,active_start,active_end")
      .eq("barn_id", barnId)
      .neq("id", placementId)
      .not("lifecycle_stage", "in", "(canceled,unassigned)"),
    admin.from("flocks").select("id", { head: true, count: "exact" }).eq("farm_id", farmId).eq("flock_number", sourceFlock.flock_number ?? -1).neq("id", targetFlockId),
  ]);

  const targetFlock = targetFlockResult.data;
  const sourceBarn = sourceBarnResult.data;

  if (targetFlockResult.error || !targetFlock || sourceBarnResult.error || !sourceBarn) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error:
          targetFlockResult.error?.message ??
          sourceBarnResult.error?.message ??
          "The replacement flock context could not be loaded.",
      }),
    );
  }

  if (targetFlock.is_in_barn || targetFlock.is_complete || targetPlacement.date_removed) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error: "The replacement flock must still be a scheduled or awaiting-arrival flock.",
      }),
    );
  }

  const targetOperationalChildCount =
    (targetDailyCountResult.count ?? 0) + (targetMortalityCountResult.count ?? 0) + (targetWeightCountResult.count ?? 0);
  if (
    targetDailyCountResult.error ||
    targetMortalityCountResult.error ||
    targetWeightCountResult.error ||
    targetFeedDropCountResult.error
  ) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error:
          targetDailyCountResult.error?.message ??
          targetMortalityCountResult.error?.message ??
          targetWeightCountResult.error?.message ??
          targetFeedDropCountResult.error?.message ??
          "Replacement flock checks failed before juggle.",
      }),
    );
  }

  if (targetOperationalChildCount > 0 || (targetFeedDropCountResult.count ?? 0) > 0) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error: "The replacement flock already has operational records, so it cannot safely take over this slot.",
      }),
    );
  }

  if ((duplicateTargetFlockResult.count ?? 0) > 0) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourcePlacement.active_start || sourceFlock.date_placed || null,
        month: month || sourcePlacement.active_start?.slice(0, 7) || sourceFlock.date_placed?.slice(0, 7) || null,
        error: `Replacement flock number ${targetFlock.flock_number ?? "unknown"} is already in use on the destination farm.`,
      }),
    );
  }

  const sourceStart = coerceNullableDate(sourcePlacement.active_start as unknown as FormDataEntryValue | null) || sourceFlock.date_placed;
  const sourceEnd =
    coerceNullableDate(sourcePlacement.active_end as unknown as FormDataEntryValue | null) ||
    coerceNullableDate(sourceFlock.max_date as unknown as FormDataEntryValue | null) ||
    sourceStart;
  if (!sourceStart || !sourceEnd) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || null,
        month: month || null,
        error: "The canceled flock is missing its planned date range, so the slot cannot be transferred.",
      }),
    );
  }

  const siblingFlockIds = Array.from(
    new Set(((targetSiblingPlacementsResult.data ?? []) as Array<{ flock_id: string }>).map((row) => row.flock_id).filter(Boolean)),
  );
  const siblingFlocksResult = siblingFlockIds.length
    ? await admin.from("flocks").select("id,date_placed,max_date").in("id", siblingFlockIds)
    : { data: [], error: null };

  if (targetSiblingPlacementsResult.error || siblingFlocksResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourceStart,
        month: month || sourceStart.slice(0, 7),
        error: targetSiblingPlacementsResult.error?.message ?? siblingFlocksResult.error?.message ?? "Destination overlap checks failed.",
      }),
    );
  }

  const siblingFlockById = new Map(
    ((siblingFlocksResult.data ?? []) as Array<{ id: string; date_placed: string | null; max_date: string | null }>).map((row) => [row.id, row]),
  );
  const overlap = ((targetSiblingPlacementsResult.data ?? []) as Array<{
    id: string;
    flock_id: string;
    date_removed: string | null;
    active_start: string | null;
    active_end: string | null;
  }>).find((row) => {
    if (row.id === targetPlacementId) {
      return false;
    }

    const siblingFlock = siblingFlockById.get(row.flock_id);
    const siblingStart =
      coerceNullableDate(siblingFlock?.date_placed as unknown as FormDataEntryValue | null) ||
      coerceNullableDate(row.active_start as unknown as FormDataEntryValue | null);
    const siblingEnd =
      coerceNullableDate(row.date_removed as unknown as FormDataEntryValue | null) ||
      coerceNullableDate(siblingFlock?.max_date as unknown as FormDataEntryValue | null) ||
      coerceNullableDate(row.active_end as unknown as FormDataEntryValue | null);

    if (!siblingStart || !siblingEnd) {
      return false;
    }

    return sourceStart <= siblingEnd && sourceEnd >= siblingStart;
  });

  if (overlap) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourceStart,
        month: month || sourceStart.slice(0, 7),
        error: "The replacement flock cannot take over this barn slot because it would overlap another placement in the destination barn.",
      }),
    );
  }

  const targetPlacementKey = `${targetFlock.flock_number ?? targetPlacement.placement_key ?? "TBD"}-${sourceBarn.barn_code ?? "Barn"}`;
  const sourceFeedDropCount = sourceFeedDropCountResult.count ?? 0;

  const [
    transferFeedDropsResult,
    transferFeedOrdersResult,
    targetPlacementUpdateResult,
    targetFlockUpdateResult,
  ] = await Promise.all([
    admin
      .from("feed_drops")
      .update({
        placement_id: targetPlacementId,
        placement_code: targetPlacementKey,
        updated_at: new Date().toISOString(),
      })
      .eq("placement_id", placementId),
    admin
      .from("feed_order_commitments")
      .update({
        placement_id: targetPlacementId,
        barn_id: barnId,
      })
      .eq("placement_id", placementId),
    admin
      .from("placements")
      .update({
        farm_id: farmId,
        barn_id: barnId,
        active_start: sourceStart,
        active_end: sourceEnd,
        date_removed: null,
        placement_key: targetPlacementKey,
        is_active: true,
        lifecycle_stage: "awaiting_arrival",
        updated_by: actorId,
      })
      .eq("id", targetPlacementId),
    admin
      .from("flocks")
      .update({
        farm_id: farmId,
        date_placed: sourceStart,
        max_date: sourceEnd,
        is_active: true,
        is_in_barn: false,
        is_complete: false,
        is_settled: false,
        updated_by: actorId,
      })
      .eq("id", targetFlockId),
  ]);

  if (transferFeedDropsResult.error || transferFeedOrdersResult.error || targetPlacementUpdateResult.error || targetFlockUpdateResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: placementId,
        date: selectedDate || sourceStart,
        month: month || sourceStart.slice(0, 7),
        error:
          transferFeedDropsResult.error?.message ??
          transferFeedOrdersResult.error?.message ??
          targetPlacementUpdateResult.error?.message ??
          targetFlockUpdateResult.error?.message ??
          "The replacement flock could not take over the canceled slot.",
      }),
    );
  }

  await Promise.all([
    admin.from("activity_log").delete().eq("placement_id", placementId),
    admin.from("activity_log").delete().eq("flock_id", flockId),
    admin.schema("platform").from("sync_outbox").delete().eq("placement_id", placementId),
  ]);

  const sourcePlacementDeleteResult = await admin.from("placements").delete().eq("id", placementId);
  if (sourcePlacementDeleteResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: targetPlacementId,
        date: sourceStart,
        month: month || sourceStart.slice(0, 7),
        error: sourcePlacementDeleteResult.error.message,
      }),
    );
  }

  const sourceFlockDeleteResult = await admin.from("flocks").delete().eq("id", flockId);
  if (sourceFlockDeleteResult.error) {
    redirect(
      buildLocation({
        mode,
        farm: farmId,
        barn: barnId,
        placement: targetPlacementId,
        date: sourceStart,
        month: month || sourceStart.slice(0, 7),
        error: sourceFlockDeleteResult.error.message,
      }),
    );
  }

  await writeActivityLog(admin, {
    placementId: targetPlacementId,
    entryType: "functCall",
    actionKey: "juggleScheduledPlacementAction",
    details: `Replacement flock ${targetFlock.flock_number ?? targetPlacementKey} took over canceled slot ${sourcePlacement.placement_key ?? placementId}.`,
    source: "web-admin.placement_wizard",
    actorUserId: actorId,
    actorName,
    farmId,
    barnId,
    flockId: targetFlockId,
    meta: {
      source_placement_id: placementId,
      source_placement_key: sourcePlacement.placement_key,
      source_flock_id: flockId,
      target_placement_id: targetPlacementId,
      target_flock_id: targetFlockId,
      transferred_feed_drop_count: sourceFeedDropCount,
      adopted_start_date: sourceStart,
      adopted_end_date: sourceEnd,
    },
  });

  revalidatePath("/admin/placements/new");
  revalidatePath("/admin/flocks");
  revalidatePath("/admin/overview");
  revalidatePath("/admin/feed-tickets");
  redirect(
    buildLocation({
      mode,
      farm: farmId,
      barn: barnId,
      placement: targetPlacementId,
      date: sourceStart,
      month: month || sourceStart.slice(0, 7),
      notice: `Moved replacement flock ${targetFlock.flock_number ?? targetPlacementKey} into barn ${sourceBarn.barn_code} and transferred ${sourceFeedDropCount} delivered feed drop${sourceFeedDropCount === 1 ? "" : "s"}.`,
    }),
  );
}
