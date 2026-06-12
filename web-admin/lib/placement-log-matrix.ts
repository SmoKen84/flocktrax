import { unstable_noStore as noStore } from "next/cache";

import type { PlacementLifecycleStage } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  placement_key: string | null;
  lifecycle_stage: PlacementLifecycleStage;
  date_removed: string | null;
};

type FarmRow = {
  id: string;
  farm_name: string | null;
  farm_group_id: string | null;
  farm_group_name: string | null;
};

type BarnRow = {
  id: string;
  barn_code: string | null;
};

type FlockRow = {
  id: string;
  flock_number: number | null;
  date_placed: string | null;
};

type CloseoutRow = {
  placement_id: string;
  status: "draft" | "submitted" | "settlement_received" | "archived";
};

type DailyLogRow = {
  id: string;
  placement_id: string;
  log_date: string;
  age_days: number | null;
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

type MortalityLogRow = {
  id: string;
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

type WeightLogRow = {
  id: string;
  placement_id: string;
  log_date: string;
  age_days: number | null;
  sex: string | null;
  cnt_weighed: number | null;
  avg_weight: number | null;
  stddev_weight: number | null;
  procure: number | null;
  other_note: string | null;
};

export type PlacementLogMatrixDailyValues = {
  amTemp: number | null;
  setTemp: number | null;
  relHumidity: number | null;
  outsideTempCurrent: number | null;
  outsideTempLow: number | null;
  outsideTempHigh: number | null;
  waterMeterReading: number | null;
  minVent: string | null;
  isOdaOpen: boolean | null;
  odaException: string | null;
  naoh: string | null;
  comment: string | null;
};

export type PlacementLogMatrixMortalityValues = {
  deadFemale: number | null;
  deadMale: number | null;
  cullFemale: number | null;
  cullMale: number | null;
  cullFemaleNote: string | null;
  cullMaleNote: string | null;
  deadReason: string | null;
  gradeLitter: number | null;
  gradeFootpad: number | null;
  gradeFeathers: number | null;
  gradeLame: number | null;
  gradePecking: number | null;
};

export type PlacementLogMatrixWeightValues = {
  cntWeighed: number | null;
  avgWeight: number | null;
  stddevWeight: number | null;
  procure: number | null;
  otherNote: string | null;
};

export type PlacementLogMatrixRow = {
  logDate: string;
  ageDays: number | null;
  hasDaily: boolean;
  hasMortality: boolean;
  hasMaleWeight: boolean;
  hasFemaleWeight: boolean;
  daily: PlacementLogMatrixDailyValues;
  mortality: PlacementLogMatrixMortalityValues;
  weight: {
    male: PlacementLogMatrixWeightValues;
    female: PlacementLogMatrixWeightValues;
  };
};

export type PlacementLogMatrixBundle = {
  placementId: string;
  placementCode: string;
  flockId: string;
  flockCode: string;
  lifecycleStage: PlacementLifecycleStage;
  closeoutStatus: "draft" | "submitted" | "settlement_received" | "archived" | null;
  farmId: string;
  farmGroupId: string | null;
  farmName: string;
  farmGroupName: string;
  barnId: string;
  barnCode: string;
  placedDate: string;
  removedDate: string | null;
  rangeEndDate: string;
  rows: PlacementLogMatrixRow[];
};

export async function getPlacementLogMatrixBundle(placementId: string): Promise<PlacementLogMatrixBundle | null> {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Placement log matrix could not connect to Supabase.");
  }

  const { data: placementRows, error: placementError } = await admin
    .from("placements")
    .select("id,farm_id,barn_id,flock_id,placement_key,lifecycle_stage,date_removed")
    .eq("id", placementId)
    .limit(1);

  if (placementError) {
    throw new Error(`Placement log matrix failed to load placement: ${placementError.message}`);
  }

  const placement = ((placementRows ?? []) as PlacementRow[])[0] ?? null;
  if (!placement) {
    return null;
  }

  const [farmResult, barnResult, flockResult, closeoutResult, dailyResult, mortalityResult, weightResult] = await Promise.all([
    admin.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").eq("id", placement.farm_id).limit(1),
    admin.from("barns").select("id,barn_code").eq("id", placement.barn_id).limit(1),
    admin.from("flocks").select("id,flock_number,date_placed").eq("id", placement.flock_id).limit(1),
    admin.from("placement_closeouts").select("placement_id,status").eq("placement_id", placement.id).limit(1),
    admin
      .from("log_daily")
      .select(
        "id,placement_id,log_date,age_days,am_temp,set_temp,rel_humidity,outside_temp_current,outside_temp_low,outside_temp_high,water_meter_reading,min_vent,is_oda_open,oda_exception,naoh,comment",
      )
      .eq("placement_id", placement.id)
      .order("log_date", { ascending: true }),
    admin
      .from("log_mortality")
      .select(
        "id,placement_id,log_date,dead_female,dead_male,cull_female,cull_male,cull_female_note,cull_male_note,dead_reason,grade_litter,grade_footpad,grade_feathers,grade_lame,grade_pecking",
      )
      .eq("placement_id", placement.id)
      .order("log_date", { ascending: true }),
    admin
      .from("log_weight")
      .select("id,placement_id,log_date,age_days,sex,cnt_weighed,avg_weight,stddev_weight,procure,other_note")
      .eq("placement_id", placement.id)
      .order("log_date", { ascending: true }),
  ]);

  if (farmResult.error) throw new Error(`Placement log matrix failed to load farm: ${farmResult.error.message}`);
  if (barnResult.error) throw new Error(`Placement log matrix failed to load barn: ${barnResult.error.message}`);
  if (flockResult.error) throw new Error(`Placement log matrix failed to load flock: ${flockResult.error.message}`);
  if (closeoutResult.error) throw new Error(`Placement log matrix failed to load closeout: ${closeoutResult.error.message}`);
  if (dailyResult.error) throw new Error(`Placement log matrix failed to load daily logs: ${dailyResult.error.message}`);
  if (mortalityResult.error) throw new Error(`Placement log matrix failed to load mortality logs: ${mortalityResult.error.message}`);
  if (weightResult.error) throw new Error(`Placement log matrix failed to load weight logs: ${weightResult.error.message}`);

  const farm = ((farmResult.data ?? []) as FarmRow[])[0] ?? null;
  const barn = ((barnResult.data ?? []) as BarnRow[])[0] ?? null;
  const flock = ((flockResult.data ?? []) as FlockRow[])[0] ?? null;
  const closeout = ((closeoutResult.data ?? []) as CloseoutRow[])[0] ?? null;

  const placedDate = flock?.date_placed ?? null;
  if (!placedDate) {
    throw new Error("Placement log matrix requires the flock placed date.");
  }

  const rangeEndDate = placement.date_removed ?? new Date().toISOString().slice(0, 10);
  const rowMap = new Map<string, PlacementLogMatrixRow>();

  for (const row of (dailyResult.data ?? []) as DailyLogRow[]) {
    const entry = ensureRow(rowMap, row.log_date, placedDate);
    entry.hasDaily = true;
    entry.ageDays = row.age_days ?? entry.ageDays;
    entry.daily = {
      amTemp: row.am_temp,
      setTemp: row.set_temp,
      relHumidity: row.rel_humidity,
      outsideTempCurrent: row.outside_temp_current,
      outsideTempLow: row.outside_temp_low,
      outsideTempHigh: row.outside_temp_high,
      waterMeterReading: row.water_meter_reading,
      minVent: row.min_vent,
      isOdaOpen: row.is_oda_open,
      odaException: row.oda_exception,
      naoh: row.naoh,
      comment: row.comment,
    };
  }

  for (const row of (mortalityResult.data ?? []) as MortalityLogRow[]) {
    const entry = ensureRow(rowMap, row.log_date, placedDate);
    entry.hasMortality = true;
    entry.mortality = {
      deadFemale: row.dead_female,
      deadMale: row.dead_male,
      cullFemale: row.cull_female,
      cullMale: row.cull_male,
      cullFemaleNote: row.cull_female_note,
      cullMaleNote: row.cull_male_note,
      deadReason: row.dead_reason,
      gradeLitter: row.grade_litter,
      gradeFootpad: row.grade_footpad,
      gradeFeathers: row.grade_feathers,
      gradeLame: row.grade_lame,
      gradePecking: row.grade_pecking,
    };
  }

  for (const row of (weightResult.data ?? []) as WeightLogRow[]) {
    const entry = ensureRow(rowMap, row.log_date, placedDate);
    const normalizedSex = String(row.sex ?? "").trim().toLowerCase();
    const weightValues: PlacementLogMatrixWeightValues = {
      cntWeighed: row.cnt_weighed,
      avgWeight: row.avg_weight,
      stddevWeight: row.stddev_weight,
      procure: row.procure,
      otherNote: row.other_note,
    };

    entry.ageDays = row.age_days ?? entry.ageDays;

    if (normalizedSex === "male") {
      entry.hasMaleWeight = true;
      entry.weight.male = weightValues;
    } else if (normalizedSex === "female") {
      entry.hasFemaleWeight = true;
      entry.weight.female = weightValues;
    }
  }

  const rows = Array.from(rowMap.values()).sort((left, right) => left.logDate.localeCompare(right.logDate));

  return {
    placementId: placement.id,
    placementCode: placement.placement_key ?? "Unlabeled Placement",
    flockId: placement.flock_id,
    flockCode: flock?.flock_number !== null && flock?.flock_number !== undefined ? String(flock.flock_number) : "Unknown Flock",
    lifecycleStage: placement.lifecycle_stage,
    closeoutStatus: closeout?.status ?? null,
    farmId: placement.farm_id,
    farmGroupId: farm?.farm_group_id ?? null,
    farmName: farm?.farm_name ?? "Unknown Farm",
    farmGroupName: farm?.farm_group_name ?? "Unknown Group",
    barnId: placement.barn_id,
    barnCode: barn?.barn_code ?? "Barn",
    placedDate,
    removedDate: placement.date_removed,
    rangeEndDate,
    rows,
  };
}

function ensureRow(rowMap: Map<string, PlacementLogMatrixRow>, logDate: string, placedDate: string) {
  const existing = rowMap.get(logDate);
  if (existing) {
    return existing;
  }

  const row: PlacementLogMatrixRow = {
    logDate,
    ageDays: deriveAgeDays(logDate, placedDate),
    hasDaily: false,
    hasMortality: false,
    hasMaleWeight: false,
    hasFemaleWeight: false,
    daily: emptyDailyValues(),
    mortality: emptyMortalityValues(),
    weight: {
      male: emptyWeightValues(),
      female: emptyWeightValues(),
    },
  };

  rowMap.set(logDate, row);
  return row;
}

function deriveAgeDays(logDate: string, placedDate: string) {
  const log = new Date(`${logDate}T00:00:00Z`);
  const placed = new Date(`${placedDate}T00:00:00Z`);
  if (Number.isNaN(log.getTime()) || Number.isNaN(placed.getTime())) {
    return null;
  }

  return Math.round((log.getTime() - placed.getTime()) / 86400000);
}

function emptyDailyValues(): PlacementLogMatrixDailyValues {
  return {
    amTemp: null,
    setTemp: null,
    relHumidity: null,
    outsideTempCurrent: null,
    outsideTempLow: null,
    outsideTempHigh: null,
    waterMeterReading: null,
    minVent: null,
    isOdaOpen: null,
    odaException: null,
    naoh: null,
    comment: null,
  };
}

function emptyMortalityValues(): PlacementLogMatrixMortalityValues {
  return {
    deadFemale: null,
    deadMale: null,
    cullFemale: null,
    cullMale: null,
    cullFemaleNote: null,
    cullMaleNote: null,
    deadReason: null,
    gradeLitter: null,
    gradeFootpad: null,
    gradeFeathers: null,
    gradeLame: null,
    gradePecking: null,
  };
}

function emptyWeightValues(): PlacementLogMatrixWeightValues {
  return {
    cntWeighed: null,
    avgWeight: null,
    stddevWeight: null,
    procure: null,
    otherNote: null,
  };
}
