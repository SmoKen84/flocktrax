import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type PlacementSchedulerFarm = {
  id: string;
  farmName: string;
  farmGroupName: string;
  farmGroupId: string | null;
};

export type PlacementSchedulerBarn = {
  id: string;
  farmId: string;
  barnCode: string;
  isActive: boolean;
};

export type PlacementSchedulerWindow = {
  id: string;
  barnId: string;
  flockId: string;
  placementCode: string;
  flockNumber: number | null;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  farmId: string;
  isFuture: boolean;
  isActive: boolean;
  isComplete: boolean;
  headCount: number | null;
  femaleCount: number | null;
  maleCount: number | null;
  breedMales: string | null;
  breedFemales: string | null;
  lh1Date: string | null;
  lh2Date: string | null;
  lh3Date: string | null;
};

export type PlacementSchedulerSettings = {
  growOutDays: number;
  nextPlaceOffsetDays: number;
  allowHistoricalEntry: boolean;
};

export type PlacementSchedulerBreed = {
  id: string;
  code: string;
  breedName: string;
  sex: string | null;
  label: string;
  isActive: boolean;
};

export type PlacementSchedulerBundle = {
  farms: PlacementSchedulerFarm[];
  barnsByFarmId: Record<string, PlacementSchedulerBarn[]>;
  windowsByBarnId: Record<string, PlacementSchedulerWindow[]>;
  recommendedStartByBarnId: Record<string, string>;
  settings: PlacementSchedulerSettings;
  breeds: PlacementSchedulerBreed[];
};

type FarmRow = {
  id: string;
  farm_name: string | null;
  farm_group_name: string | null;
  farm_group_id: string | null;
};

type BarnRow = {
  id: string;
  farm_id: string;
  barn_code: string | null;
  sort_code: string | null;
  is_active: boolean | null;
};

type FlockRow = {
  id: string;
  farm_id: string;
  flock_number: number | null;
  date_placed: string | null;
  max_date: string | null;
  is_active: boolean | null;
  is_complete: boolean | null;
  start_cnt_females: number | null;
  start_cnt_males: number | null;
  breed_males: string | null;
  breed_females: string | null;
};

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  date_removed: string | null;
  is_active: boolean | null;
  placement_key: string | null;
  lh1_date: string | null;
  lh2_date: string | null;
  lh3_date: string | null;
  active_start: string | null;
  active_end: string | null;
};

type PlatformSettingRow = {
  name: string | null;
  value: string | number | null;
  is_active: boolean | null;
};

type AppSettingRow = {
  group: string | null;
  name: string | null;
  value: string | number | null;
};

type BreedRow = {
  id: string;
  code: string | null;
  breed_name: string | null;
  sex: string | null;
  is_active: boolean | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function parsePositiveNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function maxDate(a: string, b: string) {
  return a > b ? a : b;
}

function compareBarnRows(left: Pick<BarnRow, "sort_code" | "barn_code">, right: Pick<BarnRow, "sort_code" | "barn_code">) {
  const leftSort = normalize(left.sort_code).toLowerCase();
  const rightSort = normalize(right.sort_code).toLowerCase();

  if (leftSort && rightSort && leftSort !== rightSort) {
    return leftSort.localeCompare(rightSort, undefined, { numeric: true });
  }

  if (leftSort || rightSort) {
    return leftSort ? -1 : 1;
  }

  return normalize(left.barn_code).localeCompare(normalize(right.barn_code), undefined, { numeric: true });
}

export async function getPlacementSchedulerBundle(): Promise<PlacementSchedulerBundle> {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      farms: [],
      barnsByFarmId: {},
      windowsByBarnId: {},
      recommendedStartByBarnId: {},
      settings: {
        growOutDays: 63,
        nextPlaceOffsetDays: 14,
        allowHistoricalEntry: false,
      },
      breeds: [],
    };
  }

  const [farmsResult, barnsResult, flocksResult, placementsResult, platformSettingsResult, appSettingsResult, breedsResult] = await Promise.all([
    supabase.from("farms_ui").select("id,farm_name,farm_group_name,farm_group_id").order("farm_name"),
    supabase.from("barns").select("id,farm_id,barn_code,sort_code,is_active"),
    supabase
      .from("flocks")
      .select("id,farm_id,flock_number,date_placed,max_date,is_active,is_complete,start_cnt_females,start_cnt_males,breed_males,breed_females")
      .order("date_placed", { ascending: false }),
    supabase
      .from("placements")
      .select("id,farm_id,barn_id,flock_id,date_removed,is_active,placement_key,lh1_date,lh2_date,lh3_date,active_start,active_end")
      .order("created_at", { ascending: false }),
    supabase.schema("platform").from("settings").select("name,value,is_active").limit(50),
    supabase.from("app_settings").select("group,name,value"),
    supabase.from("breeds").select("id,code,breed_name,sex,is_active").order("breed_name"),
  ]);

  const farmRows = (farmsResult.data ?? []) as FarmRow[];
  const barnRows = ((barnsResult.data ?? []) as BarnRow[]).sort((left, right) => {
    const farmCompare = String(left.farm_id).localeCompare(String(right.farm_id));
    return farmCompare !== 0 ? farmCompare : compareBarnRows(left, right);
  });
  const flockRows = (flocksResult.data ?? []) as FlockRow[];
  const placementRows = (placementsResult.data ?? []) as PlacementRow[];
  const platformSettingRows = (platformSettingsResult.data ?? []) as PlatformSettingRow[];
  const appSettingRows = (appSettingsResult.data ?? []) as AppSettingRow[];
  const breedRows = (breedsResult.data ?? []) as BreedRow[];

  let growOutDays = 63;
  let nextPlaceOffsetDays = 14;
  let allowHistoricalEntry = false;
  let explicitGrowOutDays: number | null = null;
  let explicitNextPlaceOffsetDays: number | null = null;

  const applySetting = (rowName: string | null | undefined, rowValue: string | number | null | undefined) => {
    const name = normalize(rowName).toLowerCase();
    const rawValue = String(rowValue ?? "").trim().toLowerCase();

    if (["growout_days", "grow_out_days", "growoutdays", "max_days"].includes(name)) {
      const parsedValue = parsePositiveNumber(rowValue);
      if (parsedValue) {
        growOutDays = parsedValue;
        explicitGrowOutDays = parsedValue;
      }
    }

    if (["next_place_date", "nextplacedate", "next_place_days"].includes(name)) {
      const parsedValue = parsePositiveNumber(rowValue);
      if (parsedValue) {
        nextPlaceOffsetDays = parsedValue;
        explicitNextPlaceOffsetDays = parsedValue;
      }
    }

    if (["allow_historical_entry", "historical_entry", "historical_mode", "history_backfill"].includes(name)) {
      allowHistoricalEntry = ["1", "true", "yes", "on"].includes(rawValue);
    }
  };

  for (const row of platformSettingRows) {
    if (row.is_active === false) {
      continue;
    }
    applySetting(row.name, row.value);
  }

  // Preserve compatibility with the long-lived general settings table.
  // If the same setting exists in both places, app_settings wins because
  // that is where operators have historically maintained these values.
  for (const row of appSettingRows) {
    applySetting(row.name, row.value);
  }

  if (explicitGrowOutDays === null && explicitNextPlaceOffsetDays !== null) {
    growOutDays = explicitNextPlaceOffsetDays;
  }

  const flockById = new Map(flockRows.map((row) => [row.id, row]));
  const today = new Date().toISOString().slice(0, 10);

  const windowsByBarnId = placementRows.reduce<Record<string, PlacementSchedulerWindow[]>>((acc, row) => {
    const flock = flockById.get(row.flock_id);
    const startDate = normalize(flock?.date_placed) || normalize(row.active_start);
    if (!startDate) {
      return acc;
    }

    const projectedEnd = normalize(row.date_removed) || normalize(flock?.max_date) || normalize(row.active_end) || addDays(startDate, growOutDays);
    const isFuture = startDate > today;
    const isActive = row.is_active !== false && !row.date_removed && startDate <= today;
    const isComplete = !!row.date_removed || flock?.is_complete === true || (!isActive && projectedEnd < today);
    const window: PlacementSchedulerWindow = {
      id: row.id,
      barnId: row.barn_id,
      flockId: row.flock_id,
      placementCode: normalize(row.placement_key) || `${flock?.flock_number ?? "?"}`,
      flockNumber: flock?.flock_number ?? null,
      startDate,
      endDate: projectedEnd,
      actualEndDate: normalize(row.date_removed) || null,
      farmId: row.farm_id || flock?.farm_id || "",
      isFuture,
      isActive,
      isComplete,
      headCount:
        typeof flock?.start_cnt_females === "number" || typeof flock?.start_cnt_males === "number"
          ? (flock?.start_cnt_females ?? 0) + (flock?.start_cnt_males ?? 0)
          : null,
      femaleCount: flock?.start_cnt_females ?? null,
      maleCount: flock?.start_cnt_males ?? null,
      breedMales: normalize(flock?.breed_males) || null,
      breedFemales: normalize(flock?.breed_females) || null,
      lh1Date: normalize(row.lh1_date) || null,
      lh2Date: normalize(row.lh2_date) || null,
      lh3Date: normalize(row.lh3_date) || null,
    };

    acc[row.barn_id] ??= [];
    acc[row.barn_id].push(window);
    return acc;
  }, {});

  const recommendedStartByBarnId = Object.fromEntries(
    Object.entries(windowsByBarnId).map(([barnId, windows]) => {
      const latestPredictedStart = windows.reduce((latest, window) => maxDate(latest, addDays(window.startDate, nextPlaceOffsetDays)), today);
      return [barnId, latestPredictedStart];
    }),
  );

  return {
    farms: farmRows.map((row) => ({
      id: row.id,
      farmName: normalize(row.farm_name) || "Unnamed Farm",
      farmGroupName: normalize(row.farm_group_name) || "Ungrouped",
      farmGroupId: row.farm_group_id,
    })),
    barnsByFarmId: barnRows.reduce<Record<string, PlacementSchedulerBarn[]>>((acc, row) => {
      const barn: PlacementSchedulerBarn = {
        id: row.id,
        farmId: row.farm_id,
        barnCode: normalize(row.barn_code) || "Barn",
        isActive: row.is_active !== false,
      };

      acc[row.farm_id] ??= [];
      acc[row.farm_id].push(barn);
      return acc;
    }, {}),
    windowsByBarnId,
    recommendedStartByBarnId,
    settings: {
      growOutDays,
      nextPlaceOffsetDays,
      allowHistoricalEntry,
    },
    breeds: breedRows
      .filter((row) => row.is_active !== false)
      .map((row) => {
        const breedName = normalize(row.breed_name) || "Breed";
        const sex = normalize(row.sex).toLowerCase() || null;
        return {
          id: row.id,
          code: normalize(row.code),
          breedName,
          sex,
          label: sex ? `${breedName} (${sex[0].toUpperCase()}${sex.slice(1)})` : breedName,
          isActive: row.is_active !== false,
        };
      }),
  };
}
