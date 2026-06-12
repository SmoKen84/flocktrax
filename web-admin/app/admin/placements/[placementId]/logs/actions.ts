"use server";

import { revalidatePath } from "next/cache";

import type { PlacementLogMatrixFormState } from "@/app/admin/placements/[placementId]/logs/form-state";
import { getPlacementEditorActorAccess } from "@/lib/placement-editor-access";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlacementLogMatrixRow } from "@/lib/placement-log-matrix";

type PlacementContextRow = {
  id: string;
  farm_id: string;
  flock_id: string;
  lifecycle_stage: string;
  date_removed: string | null;
};

type CloseoutContextRow = {
  placement_id: string;
  status: "draft" | "submitted" | "settlement_received" | "archived";
};

type FarmContextRow = {
  id: string;
  farm_group_id: string | null;
};

type FlockContextRow = {
  id: string;
  date_placed: string | null;
};

type DailyRow = {
  placement_id: string;
  log_date: string;
  am_temp: number | null;
  set_temp: number | null;
  rel_humidity: number | null;
  outside_temp_current: number | null;
  outside_temp_low: number | null;
  outside_temp_high: number | null;
  water_meter_reading: number | null;
  min_vent: string | null;
  is_oda_open: boolean | null;
  oda_exception: string | null;
  naoh: string | null;
  comment: string | null;
};

type MortalityRow = {
  placement_id: string;
  log_date: string;
  dead_female: number | null;
  dead_male: number | null;
  cull_female: number | null;
  cull_male: number | null;
  cull_female_note: string | null;
  cull_male_note: string | null;
  dead_reason: string | null;
  grade_litter: number | null;
  grade_footpad: number | null;
  grade_feathers: number | null;
  grade_lame: number | null;
  grade_pecking: number | null;
};

type WeightRow = {
  placement_id: string;
  log_date: string;
  sex: string | null;
  cnt_weighed: number | null;
  avg_weight: number | null;
  stddev_weight: number | null;
  procure: number | null;
  other_note: string | null;
};

const DAILY_FIELDS = [
  ["amTemp", "am_temp"],
  ["setTemp", "set_temp"],
  ["relHumidity", "rel_humidity"],
  ["outsideTempCurrent", "outside_temp_current"],
  ["outsideTempLow", "outside_temp_low"],
  ["outsideTempHigh", "outside_temp_high"],
  ["waterMeterReading", "water_meter_reading"],
  ["minVent", "min_vent"],
  ["isOdaOpen", "is_oda_open"],
  ["odaException", "oda_exception"],
  ["naoh", "naoh"],
  ["comment", "comment"],
] as const;

const MORTALITY_FIELDS = [
  ["deadFemale", "dead_female"],
  ["deadMale", "dead_male"],
  ["cullFemale", "cull_female"],
  ["cullMale", "cull_male"],
  ["cullFemaleNote", "cull_female_note"],
  ["cullMaleNote", "cull_male_note"],
  ["deadReason", "dead_reason"],
  ["gradeLitter", "grade_litter"],
  ["gradeFootpad", "grade_footpad"],
  ["gradeFeathers", "grade_feathers"],
  ["gradeLame", "grade_lame"],
  ["gradePecking", "grade_pecking"],
] as const;

const WEIGHT_FIELDS = [
  ["cntWeighed", "cnt_weighed"],
  ["avgWeight", "avg_weight"],
  ["stddevWeight", "stddev_weight"],
  ["procure", "procure"],
  ["otherNote", "other_note"],
] as const;

export async function savePlacementLogMatrixAction(
  _prevState: PlacementLogMatrixFormState,
  formData: FormData,
): Promise<PlacementLogMatrixFormState> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const actor = supabase ? await supabase.auth.getUser() : null;

  if (!supabase || !admin) {
    return { status: "error", message: "Supabase access is not configured for the placement log editor." };
  }

  if (!actor?.data.user) {
    return { status: "error", message: "A signed-in user is required to save placement log corrections." };
  }

  const placementId = String(formData.get("placement_id") ?? "").trim();
  const rowsJson = String(formData.get("rows_json") ?? "").trim();

  if (!placementId || !rowsJson) {
    return { status: "error", message: "Placement log editor context was incomplete." };
  }

  let submittedRows: PlacementLogMatrixRow[];
  try {
    const parsed = JSON.parse(rowsJson);
    if (!Array.isArray(parsed)) {
      throw new Error("Rows payload was invalid.");
    }
    submittedRows = parsed as PlacementLogMatrixRow[];
  } catch {
    return { status: "error", message: "The edited matrix payload could not be read." };
  }

  const { data: placementRows, error: placementError } = await admin
    .from("placements")
    .select("id,farm_id,flock_id,lifecycle_stage,date_removed")
    .eq("id", placementId)
    .limit(1);

  if (placementError) {
    return { status: "error", message: placementError.message };
  }

  const placement = ((placementRows ?? []) as PlacementContextRow[])[0] ?? null;
  if (!placement) {
    return { status: "error", message: "Placement not found." };
  }

  const [farmResult, flockResult, closeoutResult] = await Promise.all([
    admin.from("farms_ui").select("id,farm_group_id").eq("id", placement.farm_id).limit(1),
    admin.from("flocks").select("id,date_placed").eq("id", placement.flock_id).limit(1),
    admin.from("placement_closeouts").select("placement_id,status").eq("placement_id", placementId).limit(1),
  ]);

  if (farmResult.error) {
    return { status: "error", message: farmResult.error.message };
  }
  if (flockResult.error) {
    return { status: "error", message: flockResult.error.message };
  }
  if (closeoutResult.error) {
    return { status: "error", message: closeoutResult.error.message };
  }

  const farm = ((farmResult.data ?? []) as FarmContextRow[])[0] ?? null;
  const flock = ((flockResult.data ?? []) as FlockContextRow[])[0] ?? null;
  const closeout = ((closeoutResult.data ?? []) as CloseoutContextRow[])[0] ?? null;

  if (!flock?.date_placed) {
    return { status: "error", message: "The flock placed date is required before logs can be corrected." };
  }

  const access = await getPlacementEditorActorAccess();
  if (!canUsePlacementLogEditor(access)) {
    return { status: "error", message: "Only Farm Manager or higher roles can use the placement log editor." };
  }

  if (!hasScopeAccess(access, placement.farm_id, farm?.farm_group_id ?? null)) {
    return { status: "error", message: "Your account does not have access to edit this placement's log matrix." };
  }

  if (placement.lifecycle_stage === "archived") {
    return { status: "error", message: "Archived placements are locked and can no longer be corrected." };
  }

  if (placement.lifecycle_stage === "scheduled") {
    return { status: "error", message: "The placement log editor opens only after the placement has entered active operations." };
  }

  if (closeout?.status === "archived") {
    return { status: "error", message: "This placement has already been archived and is locked against further log corrections." };
  }

  const maxDate = placement.date_removed ?? new Date().toISOString().slice(0, 10);
  const currentDailyResult = await admin
    .from("log_daily")
    .select(
      "placement_id,log_date,am_temp,set_temp,rel_humidity,outside_temp_current,outside_temp_low,outside_temp_high,water_meter_reading,min_vent,is_oda_open,oda_exception,naoh,comment",
    )
    .eq("placement_id", placementId);
  const currentMortalityResult = await admin
    .from("log_mortality")
    .select(
      "placement_id,log_date,dead_female,dead_male,cull_female,cull_male,cull_female_note,cull_male_note,dead_reason,grade_litter,grade_footpad,grade_feathers,grade_lame,grade_pecking",
    )
    .eq("placement_id", placementId);
  const currentWeightResult = await admin
    .from("log_weight")
    .select("placement_id,log_date,sex,cnt_weighed,avg_weight,stddev_weight,procure,other_note")
    .eq("placement_id", placementId);

  if (currentDailyResult.error) return { status: "error", message: currentDailyResult.error.message };
  if (currentMortalityResult.error) return { status: "error", message: currentMortalityResult.error.message };
  if (currentWeightResult.error) return { status: "error", message: currentWeightResult.error.message };

  const dailyByDate = new Map(((currentDailyResult.data ?? []) as DailyRow[]).map((row) => [row.log_date, row]));
  const mortalityByDate = new Map(((currentMortalityResult.data ?? []) as MortalityRow[]).map((row) => [row.log_date, row]));
  const weightByKey = new Map(
    ((currentWeightResult.data ?? []) as WeightRow[]).map((row) => [`${row.log_date}:${normalizeSex(row.sex)}`, row]),
  );

  let savedDates = 0;
  let savedTables = 0;

  for (const row of submittedRows) {
    const logDate = String(row?.logDate ?? "").trim();
    if (!isIsoDate(logDate)) {
      return { status: "error", message: `One of the edited rows has an invalid date: ${logDate || "blank"}.` };
    }

    if (logDate < flock.date_placed || logDate > maxDate) {
      return {
        status: "error",
        message: `Edited date ${logDate} falls outside the allowed placement range of ${flock.date_placed} through ${maxDate}.`,
      };
    }

    const ageDays = deriveAgeDays(logDate, flock.date_placed);
    const dailyPayload = buildDailyPayload(row, dailyByDate.get(logDate) ?? null);
    const mortalityPayload = buildMortalityPayload(row, mortalityByDate.get(logDate) ?? null);
    const maleWeightPayload = buildWeightPayload(row.weight?.male, weightByKey.get(`${logDate}:male`) ?? null);
    const femaleWeightPayload = buildWeightPayload(row.weight?.female, weightByKey.get(`${logDate}:female`) ?? null);

    let touchedDate = false;

    if (dailyPayload) {
      dailyPayload.age_days = ageDays;
      const { error } = await supabase.rpc("save_log_daily_mobile", {
        p_placement_id: placementId,
        p_log_date: logDate,
        p_payload: dailyPayload,
      });
      if (error) {
        return { status: "error", message: `Daily save failed for ${logDate}: ${error.message}` };
      }
      touchedDate = true;
      savedTables += 1;
    }

    if (mortalityPayload) {
      const { error } = await supabase.rpc("save_log_mortality_mobile", {
        p_placement_id: placementId,
        p_log_date: logDate,
        p_payload: mortalityPayload,
      });
      if (error) {
        return { status: "error", message: `Mortality save failed for ${logDate}: ${error.message}` };
      }
      touchedDate = true;
      savedTables += 1;
    }

    if (maleWeightPayload) {
      maleWeightPayload.age_days = ageDays;
      const { error } = await supabase.rpc("save_log_weight_mobile", {
        p_placement_id: placementId,
        p_log_date: logDate,
        p_sex: "male",
        p_payload: maleWeightPayload,
      });
      if (error) {
        return { status: "error", message: `Male weight save failed for ${logDate}: ${error.message}` };
      }
      touchedDate = true;
      savedTables += 1;
    }

    if (femaleWeightPayload) {
      femaleWeightPayload.age_days = ageDays;
      const { error } = await supabase.rpc("save_log_weight_mobile", {
        p_placement_id: placementId,
        p_log_date: logDate,
        p_sex: "female",
        p_payload: femaleWeightPayload,
      });
      if (error) {
        return { status: "error", message: `Female weight save failed for ${logDate}: ${error.message}` };
      }
      touchedDate = true;
      savedTables += 1;
    }

    if (touchedDate) {
      savedDates += 1;
    }
  }

  revalidatePath(`/admin/placements/${placementId}/logs`);
  revalidatePath("/admin/overview");
  revalidatePath(`/admin/flock-closeout/${placementId}`);
  revalidatePath("/admin/flock-closeout");

  if (savedTables === 0) {
    return { status: "success", message: "No changes were detected in the placement log matrix.", savedDates: 0, savedTables: 0 };
  }

  return {
    status: "success",
    message: `Saved ${savedTables} log update${savedTables === 1 ? "" : "s"} across ${savedDates} date${savedDates === 1 ? "" : "s"}.`,
    savedDates,
    savedTables,
  };
}

function canUsePlacementLogEditor(actor: Awaited<ReturnType<typeof getPlacementEditorActorAccess>>) {
  return actor.roleCodes.some((roleCode) => {
    const normalized = normalizeRole(roleCode);
    return (
      normalized.includes("super") ||
      normalized === "admin" ||
      normalized.includes("integrator") ||
      normalized.includes("grower") ||
      normalized.includes("manager")
    );
  });
}

function hasScopeAccess(
  actor: Awaited<ReturnType<typeof getPlacementEditorActorAccess>>,
  farmId: string,
  farmGroupId: string | null,
) {
  if (actor.bypassScope || actor.isSuperUser) {
    return true;
  }

  return actor.farmIds.has(farmId) || (farmGroupId ? actor.farmGroupIds.has(farmGroupId) : false);
}

function buildDailyPayload(row: PlacementLogMatrixRow, current: DailyRow | null) {
  const payload: Record<string, unknown> = {};

  for (const [clientKey, dbKey] of DAILY_FIELDS) {
    const submitted = normalizeValue(row.daily?.[clientKey]);
    const existing = normalizeValue(current?.[dbKey]);
    if (submitted !== existing) {
      payload[dbKey] = submitted;
    }
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function buildMortalityPayload(row: PlacementLogMatrixRow, current: MortalityRow | null) {
  const payload: Record<string, unknown> = {};

  for (const [clientKey, dbKey] of MORTALITY_FIELDS) {
    const submitted = normalizeValue(row.mortality?.[clientKey]);
    const existing = normalizeValue(current?.[dbKey]);
    if (submitted !== existing) {
      payload[dbKey] = submitted;
    }
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function buildWeightPayload(
  row: PlacementLogMatrixRow["weight"]["male"] | PlacementLogMatrixRow["weight"]["female"] | undefined,
  current: WeightRow | null,
) {
  const payload: Record<string, unknown> = {};

  for (const [clientKey, dbKey] of WEIGHT_FIELDS) {
    const submitted = normalizeValue(row?.[clientKey]);
    const existing = normalizeValue(current?.[dbKey]);
    if (submitted !== existing) {
      payload[dbKey] = submitted;
    }
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function normalizeValue(value: unknown) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function normalizeSex(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRole(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function deriveAgeDays(logDate: string, placedDate: string) {
  const log = new Date(`${logDate}T00:00:00Z`);
  const placed = new Date(`${placedDate}T00:00:00Z`);
  if (Number.isNaN(log.getTime()) || Number.isNaN(placed.getTime())) {
    return null;
  }

  return Math.round((log.getTime() - placed.getTime()) / 86400000);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
