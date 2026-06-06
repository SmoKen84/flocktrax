import { unstable_noStore as noStore } from "next/cache";

import type {
  ActivePlacementRecord,
  ActivityLogRecord,
  AdminDataBundle,
  BreedOptionRecord,
  FarmGroupRecord,
  FarmRecord,
  FlockRecord,
  PlacementLifecycleStage,
} from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

class AdminDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDataError";
  }
}

const CONSOLE_TIME_ZONE = "America/Chicago";
const CONSOLE_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: CONSOLE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const CONSOLE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CONSOLE_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

type FarmGroupRow = {
  id: string;
  group_name: string | null;
  group_contact_name: string | null;
  city: string | null;
  st: string | null;
  is_active: boolean | null;
};

type FarmRow = {
  id: string;
  farm_name: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean | null;
  farm_group_id: string | null;
  farm_group_name: string | null;
};

type BarnRow = {
  id: string;
  farm_id: string;
  barn_code: string | null;
  sort_code: string | null;
  sqft: number | null;
  stdroc_head: string | null;
  is_active: boolean | null;
  active_flock_id: string | null;
  is_empty: boolean | null;
};

type FlockRow = {
  id: string;
  farm_id: string;
  flock_number: number | null;
  date_placed: string | null;
  max_date: string | null;
  start_cnt_females: number | null;
  start_cnt_males: number | null;
  is_active: boolean | null;
  is_complete: boolean | null;
  is_in_barn: boolean | null;
  is_settled: boolean | null;
  breed_males: string | null;
  breed_females: string | null;
};

type BreedRow = {
  id: string;
  code: string | null;
  breed_name: string | null;
  sex: string | null;
  is_active: boolean | null;
};

type BreedSpecRow = {
  geneticname: string | null;
  breedid: string | null;
  age: number | null;
  dayfeedperbird: number | null;
  targetweight: number | null;
  is_active: boolean | null;
};

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  lifecycle_stage: PlacementLifecycleStage | null;
  date_removed: string | null;
  is_active: boolean | null;
  placement_key: string;
  lh1_date: string | null;
  lh2_date: string | null;
  lh3_date: string | null;
  active_start?: string | null;
  active_end?: string | null;
  created_at?: string | null;
};

type PlacementLogRow = {
  placement_id: string;
  log_date: string;
};

type LivehaulScheduleDashboardRow = {
  placement_id: string;
  lh_date: string;
  head_target: number | null;
  head_actual: number | null;
};

type DailyFlagRow = {
  placement_id: string;
  log_date: string | null;
  updated_at: string | null;
  created_at: string | null;
  maintenance_flag: boolean | null;
  feedlines_flag: boolean | null;
  nipple_lines_flag: boolean | null;
  bird_health_alert: boolean | null;
  is_active: boolean | null;
};

type IssueRow = {
  entity_type: string | null;
  entity_id: string | null;
  status: string | null;
};

type MortalityRow = {
  placement_id: string;
  log_date: string;
  dead_female: number | null;
  dead_male: number | null;
  cull_female: number | null;
  cull_male: number | null;
  is_active: boolean | null;
};

type WeightRow = {
  placement_id: string;
  log_date: string;
  sex: string | null;
  cnt_weighed: number | null;
  avg_weight: number | null;
  is_active: boolean | null;
};

type AppSettingRow = {
  group: string | null;
  name: string | null;
  value: string | null;
  updated_at?: string | null;
};

type WeightSummary = {
  female: { avgWeight: number | null; count: number | null; logDate: string | null };
  male: { avgWeight: number | null; count: number | null; logDate: string | null };
};

type WeightEntryGetResponse = {
  ok?: boolean;
  item?: {
    male_sample?: {
      avg_weight?: number | null;
      cnt_weighed?: number | null;
    };
    female_sample?: {
      avg_weight?: number | null;
      cnt_weighed?: number | null;
    };
  };
};

type ActivityLogRow = {
  id: string;
  occurred_at: string | null;
  entry_type: string | null;
  action_key: string | null;
  details: string | null;
  source: string | null;
  placement_code: string | null;
  farm_name: string | null;
  barn_code: string | null;
  user_name: string | null;
};

function emptyWeightSummary(): WeightSummary {
  return {
    female: { avgWeight: null, count: null, logDate: null },
    male: { avgWeight: null, count: null, logDate: null },
  };
}

async function fetchDashboardWeightSummary(
  placementId: string,
  logDate: string,
): Promise<WeightSummary | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return null;
  }

  const endpoint = new URL("/functions/v1/weight-entry-get", supabaseUrl);
  endpoint.searchParams.set("placement_id", placementId);
  endpoint.searchParams.set("log_date", logDate);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: anonKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as WeightEntryGetResponse;
    if (!payload.ok || !payload.item) {
      return null;
    }

    return {
      female: {
        avgWeight: payload.item.female_sample?.avg_weight ?? null,
        count: payload.item.female_sample?.cnt_weighed ?? null,
        logDate,
      },
      male: {
        avgWeight: payload.item.male_sample?.avg_weight ?? null,
        count: payload.item.male_sample?.cnt_weighed ?? null,
        logDate,
      },
    };
  } catch {
    return null;
  }
}

export async function getAdminData(): Promise<AdminDataBundle> {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new AdminDataError(
      "Admin data could not connect to Supabase. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web-admin/.env.",
    );
  }

  try {
    const today = formatConsoleDateKey(new Date());

    const [
      farmGroupsResult,
      farmsResult,
      barnsResult,
      flocksResult,
      placementsResult,
      livehaulScheduleResult,
      placementLogsResult,
      dailyFlagsResult,
      mortalityLogsResult,
      weightLogsResult,
      appSettingsResult,
      breedsResult,
      breedSpecsResult,
    ] = await Promise.all([
      supabase
        .from("farm_groups")
        .select("id,group_name,group_contact_name,city,st,is_active")
        .order("group_name"),
      supabase
        .from("farms_ui")
        .select("id,farm_name,city,state,is_active,farm_group_id,farm_group_name")
        .order("farm_name"),
      supabase
        .from("barns")
        .select("id,farm_id,barn_code,sort_code,sqft,stdroc_head,is_active,active_flock_id,is_empty"),
      supabase
        .from("flocks")
        .select(
          "id,farm_id,flock_number,date_placed,max_date,start_cnt_females,start_cnt_males,is_active,is_complete,is_in_barn,is_settled,breed_males,breed_females",
        )
        .order("date_placed", { ascending: false }),
      supabase
        .from("placements")
        .select("id,farm_id,barn_id,flock_id,lifecycle_stage,date_removed,is_active,placement_key,lh1_date,lh2_date,lh3_date,active_start,active_end,created_at")
        .order("placement_key"),
      supabase
        .from("livehaul_schedule")
        .select("placement_id,lh_date,head_target,head_actual")
        .order("lh_date"),
      supabase
        .from("v_placement_daily")
        .select("placement_id,log_date")
        .order("log_date", { ascending: false }),
      supabase
        .from("log_daily")
        .select("placement_id,log_date,updated_at,created_at,maintenance_flag,feedlines_flag,nipple_lines_flag,bird_health_alert,is_active"),
      supabase
        .from("log_mortality")
        .select("placement_id,log_date,dead_female,dead_male,cull_female,cull_male,is_active"),
      supabase
        .from("log_weight")
        .select("placement_id,log_date,sex,cnt_weighed,avg_weight,is_active")
        .order("log_date", { ascending: false }),
      supabase
        .from("app_settings")
        .select('group,name,value,updated_at')
        .in("name", ["age_checkout_avail", "First_LH", "first_lh", "First-LH", "first-lh"]),
      supabase
        .from("breeds")
        .select("id,code,breed_name,sex,is_active")
        .eq("is_active", true)
        .order("breed_name"),
      supabase
        .from("stdbreedspec")
        .select("geneticname,breedid,age,dayfeedperbird,targetweight,is_active")
        .eq("is_active", true),
    ]);

    if (
      farmGroupsResult.error ||
      farmsResult.error ||
      barnsResult.error ||
      flocksResult.error ||
      placementsResult.error ||
      livehaulScheduleResult.error ||
      placementLogsResult.error ||
      dailyFlagsResult.error ||
      mortalityLogsResult.error ||
      weightLogsResult.error ||
      appSettingsResult.error ||
      breedsResult.error ||
      breedSpecsResult.error
    ) {
      const firstError =
        farmGroupsResult.error ||
        farmsResult.error ||
        barnsResult.error ||
        flocksResult.error ||
        placementsResult.error ||
        livehaulScheduleResult.error ||
        placementLogsResult.error ||
        dailyFlagsResult.error ||
        mortalityLogsResult.error ||
        weightLogsResult.error ||
        appSettingsResult.error ||
        breedsResult.error ||
        breedSpecsResult.error;

      throw new AdminDataError(
        `Admin data failed to load from Supabase: ${firstError?.message ?? "Unknown query error"}`,
      );
    }

    const farmGroupsRows = (farmGroupsResult.data ?? []) as FarmGroupRow[];
    const farmRows = (farmsResult.data ?? []) as FarmRow[];
    const barnRows = ((barnsResult.data ?? []) as BarnRow[]).sort((left, right) => {
      const farmCompare = String(left.farm_id).localeCompare(String(right.farm_id));
      return farmCompare !== 0 ? farmCompare : compareBarnRows(left, right);
    });
    const flockRows = (flocksResult.data ?? []) as FlockRow[];
    const placementRows = (placementsResult.data ?? []) as PlacementRow[];
    const livehaulScheduleRows = (livehaulScheduleResult.data ?? []) as LivehaulScheduleDashboardRow[];
    const placementLogRows = (placementLogsResult.data ?? []) as PlacementLogRow[];
    const dailyFlagRows = (dailyFlagsResult.data ?? []) as DailyFlagRow[];
    const mortalityRows = (mortalityLogsResult.data ?? []) as MortalityRow[];
    const weightRows = (weightLogsResult.data ?? []) as WeightRow[];
    const appSettingRows = (appSettingsResult.data ?? []) as AppSettingRow[];
    const breedRows = (breedsResult.data ?? []) as BreedRow[];
    const breedSpecRows = (breedSpecsResult.data ?? []) as BreedSpecRow[];
    const checkoutAgeAvailability = appSettingRows
      .filter((row) => row.name === "age_checkout_avail")
      .sort((left, right) => {
        const leftRank = left.group === "Placements" ? 0 : left.group === null ? 1 : 2;
        const rightRank = right.group === "Placements" ? 0 : right.group === null ? 1 : 2;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
      })
      .map((row) => Number.parseInt(String(row.value ?? "").trim(), 10))
      .find((value) => Number.isFinite(value) && value >= 0) ?? 0;
    const firstLivehaulOffsetDays = appSettingRows
      .filter((row) => ["first_lh", "first-lh"].includes(String(row.name ?? "").toLowerCase()))
      .sort((left, right) => {
        const leftRank = left.group === "Placements" ? 0 : left.group === null ? 1 : 2;
        const rightRank = right.group === "Placements" ? 0 : right.group === null ? 1 : 2;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
      })
      .map((row) => Number.parseInt(String(row.value ?? "").trim(), 10))
      .find((value) => Number.isFinite(value) && value >= 0) ?? 0;

    const activePlacementsRaw = placementRows.filter((row) =>
      row.lifecycle_stage === "awaiting_arrival" || row.lifecycle_stage === "in_barn_growing"
    );
    const activePlacementIds = new Set(activePlacementsRaw.map((row) => row.id));

    const { error: derivedIssueSyncError } = await supabase.rpc("sync_derived_placement_issues", {
      p_placement_ids: Array.from(activePlacementIds),
    });

    if (derivedIssueSyncError) {
      throw new AdminDataError(
        `Admin data failed to sync derived placement issues: ${derivedIssueSyncError.message}`,
      );
    }

    const issuesResult = await supabase.from("issues").select("entity_type,entity_id,status");

    if (issuesResult.error) {
      throw new AdminDataError(`Admin data failed to load issue rows: ${issuesResult.error.message}`);
    }

    const issueRows = (issuesResult.data ?? []) as IssueRow[];

    const placementsByFarmId = countBy(activePlacementsRaw, (row) => row.farm_id);
    const activePlacementsByGroupId = countBy(activePlacementsRaw, (row) => {
      const farm = farmRows.find((item) => item.id === row.farm_id);
      return farm?.farm_group_id ?? "ungrouped";
    });

    const barnsByFarmId = barnRows.reduce<Record<string, AdminDataBundle["barnsByFarmId"][string]>>((acc, barn) => {
      const capacity = parseCapacity(barn.stdroc_head, barn.sqft);
      const placement = activePlacementsRaw.find((item) => item.barn_id === barn.id);

      acc[barn.farm_id] ??= [];
      acc[barn.farm_id].push({
        id: barn.id,
        barnCode: barn.barn_code ?? "Barn",
        capacity,
        currentPlacementCode: placement?.placement_key ?? null,
        nextAvailableDate: placement?.date_removed ?? "",
      });

      return acc;
    }, {});

    const farmGroups: FarmGroupRecord[] = farmGroupsRows.map((row) => ({
      id: row.id,
      groupName: row.group_name ?? "Unnamed Group",
      legalName: row.group_name ?? "Unnamed Group",
      integrator: inferGroupIntegrator(row.id, farmRows, flockRows),
      homeBase: formatCityState(row.city, row.st),
      farmCount: farmRows.filter((farm) => farm.farm_group_id === row.id).length,
      activePlacements: activePlacementsByGroupId.get(row.id) ?? 0,
      primaryContact: row.group_contact_name ?? "Not set",
      status: row.is_active === false ? "inactive" : "active",
    }));

    const farms: FarmRecord[] = farmRows.map((row) => ({
      id: row.id,
      farmGroupId: row.farm_group_id ?? "ungrouped",
      farmGroupName: row.farm_group_name ?? "Ungrouped",
      farmName: row.farm_name ?? "Unnamed Farm",
      city: row.city ?? "",
      state: row.state ?? "",
      barnCount: barnRows.filter((barn) => barn.farm_id === row.id).length,
      activePlacements: placementsByFarmId.get(row.id) ?? 0,
      managerName: findGroupContact(row.farm_group_id, farmGroupsRows),
      status: row.is_active === false ? "inactive" : (placementsByFarmId.get(row.id) ?? 0) > 0 ? "active" : "seasonal",
    }));

    const flocks: FlockRecord[] = flockRows.map((row) => {
      const linkedPlacements = placementRows.filter((placement) => placement.flock_id === row.id);
      const primaryPlacement =
        linkedPlacements.find((placement) => placement.is_active) ??
        linkedPlacements.find((placement) => placement.date_removed === null) ??
        linkedPlacements[0] ??
        null;

      return {
        id: row.id,
        flockCode: row.flock_number?.toString() ?? "Unknown",
        placementCode: primaryPlacement?.placement_key ?? null,
        integrator: inferFlockIntegrator(row.farm_id, farmRows, farmGroups),
        placedDate: row.date_placed ?? "",
        estimatedFirstCatch: row.max_date ?? addDays(row.date_placed, 38),
        femaleCount: row.start_cnt_females ?? 0,
        maleCount: row.start_cnt_males ?? 0,
        status: row.is_complete ? "complete" : row.is_active ? "active" : "scheduled",
      };
    });

    const breedOptions: BreedOptionRecord[] = breedRows.map((row) => ({
      id: row.id,
      label: row.breed_name ?? row.code ?? row.id,
      sex: row.sex ?? null,
    }));

    const latestLogByPlacement = new Map<string, string>();
    for (const row of placementLogRows) {
      if (!latestLogByPlacement.has(row.placement_id)) {
        latestLogByPlacement.set(row.placement_id, row.log_date);
      }
    }

    const mortalityTotalsByPlacement = new Map<
      string,
      {
        femaleTotal: number;
        maleTotal: number;
        femaleFirst7Days: number;
        maleFirst7Days: number;
        femaleLast7Days: number;
        maleLast7Days: number;
      }
    >();
    const mortalityByPlacementAndDate = new Map<
      string,
      Map<string, { male: number; female: number }>
    >();

    const latestWeightByPlacement = new Map<string, WeightSummary>();
    const dailyFlagsByPlacement = new Map<
      string,
      {
        maintenance: boolean;
        feedlines: boolean;
        nippleLines: boolean;
        birdHealthAlert: boolean;
        latestLogDate: string | null;
        completedTodayLabel: string | null;
      }
    >();
    const openBarnIssueCountByBarnId = new Map<string, number>();
    const openPlacementIssueCountByPlacementId = new Map<string, number>();
    const resolvedBarnIssueCountByBarnId = new Map<string, number>();
    const resolvedPlacementIssueCountByPlacementId = new Map<string, number>();

    const flockById = new Map(flockRows.map((row) => [row.id, row]));
    const breedById = new Map(breedRows.map((row) => [row.id, row]));
    const farmById = new Map(farmRows.map((row) => [row.id, row]));
    const groupById = new Map(farmGroups.map((row) => [row.id, row]));
    const barnById = new Map(barnRows.map((row) => [row.id, row]));
    const liveHaulEventsByPlacementId = new Map<string, FeedProjectionLiveHaulEvent[]>();

    for (const row of livehaulScheduleRows) {
      const bucket = liveHaulEventsByPlacementId.get(row.placement_id) ?? [];
      if (!bucket.some((event) => event.date === row.lh_date)) {
        bucket.push({
          date: row.lh_date,
          targetHead: row.head_target,
          actualHead: row.head_actual,
        });
      }
      liveHaulEventsByPlacementId.set(row.placement_id, bucket);
    }

    for (const [placementId, events] of liveHaulEventsByPlacementId.entries()) {
      events.sort((left, right) => left.date.localeCompare(right.date));
      liveHaulEventsByPlacementId.set(placementId, events);
    }

    for (const row of mortalityRows) {
      if (!activePlacementIds.has(row.placement_id) || row.is_active === false) {
        continue;
      }

      const placement = activePlacementsRaw.find((item) => item.id === row.placement_id);
      const flock = placement ? flockById.get(placement.flock_id) : null;
      const placedDate = flock?.date_placed ?? null;
      const bucket = mortalityTotalsByPlacement.get(row.placement_id) ?? {
        femaleTotal: 0,
        maleTotal: 0,
        femaleFirst7Days: 0,
        maleFirst7Days: 0,
        femaleLast7Days: 0,
        maleLast7Days: 0,
      };

      const femaleLoss = (row.dead_female ?? 0) + (row.cull_female ?? 0);
      const maleLoss = (row.dead_male ?? 0) + (row.cull_male ?? 0);
      bucket.femaleTotal += femaleLoss;
      bucket.maleTotal += maleLoss;
      const dailyBucket = mortalityByPlacementAndDate.get(row.placement_id) ?? new Map<string, { male: number; female: number }>();
      const existingDay = dailyBucket.get(row.log_date) ?? { male: 0, female: 0 };
      existingDay.female += femaleLoss;
      existingDay.male += maleLoss;
      dailyBucket.set(row.log_date, existingDay);
      mortalityByPlacementAndDate.set(row.placement_id, dailyBucket);

      const ageOnLogDate = placedDate ? daysBetween(row.log_date, placedDate) : null;
      const daysFromToday = daysSince(row.log_date);

      if (ageOnLogDate !== null && ageOnLogDate >= 0 && ageOnLogDate < 7) {
        bucket.femaleFirst7Days += femaleLoss;
        bucket.maleFirst7Days += maleLoss;
      }

      if (daysFromToday <= 7) {
        bucket.femaleLast7Days += femaleLoss;
        bucket.maleLast7Days += maleLoss;
      }

      mortalityTotalsByPlacement.set(row.placement_id, bucket);
    }

    for (const row of weightRows) {
      if (!activePlacementIds.has(row.placement_id) || row.is_active === false) {
        continue;
      }

      const normalizedSex = row.sex?.trim().toLowerCase();
      const sexKey =
        normalizedSex === "female" || normalizedSex === "females" || normalizedSex === "f"
          ? "female"
          : normalizedSex === "male" || normalizedSex === "males" || normalizedSex === "m"
            ? "male"
            : null;

      if (!sexKey) {
        continue;
      }

      const bucket = latestWeightByPlacement.get(row.placement_id) ?? emptyWeightSummary();

      if (!bucket[sexKey].logDate) {
        bucket[sexKey] = {
          avgWeight: row.avg_weight ?? null,
          count: row.cnt_weighed ?? null,
          logDate: row.log_date,
        };
      }

      latestWeightByPlacement.set(row.placement_id, bucket);
    }

    const missingWeightDates = activePlacementsRaw.reduce<Array<{ placementId: string; logDate: string }>>((acc, row) => {
      const bucket = latestWeightByPlacement.get(row.id);
      if (!bucket) {
        return acc;
      }

      const candidateDates = new Set<string>();
      if (bucket.male.logDate && bucket.male.avgWeight === null) {
        candidateDates.add(bucket.male.logDate);
      }
      if (bucket.female.logDate && bucket.female.avgWeight === null) {
        candidateDates.add(bucket.female.logDate);
      }

      for (const logDate of candidateDates) {
        acc.push({ placementId: row.id, logDate });
      }

      return acc;
    }, []);

    if (missingWeightDates.length > 0) {
      const hydratedWeights = await Promise.all(
        missingWeightDates.map(async ({ placementId, logDate }) => ({
          placementId,
          logDate,
          summary: await fetchDashboardWeightSummary(placementId, logDate),
        })),
      );

      for (const { placementId, logDate, summary } of hydratedWeights) {
        if (!summary) {
          continue;
        }

        const bucket = latestWeightByPlacement.get(placementId) ?? emptyWeightSummary();

        if (
          (bucket.male.logDate === logDate || !bucket.male.logDate) &&
          summary.male.avgWeight !== null
        ) {
          bucket.male = {
            avgWeight: summary.male.avgWeight,
            count: summary.male.count,
            logDate,
          };
        }

        if (
          (bucket.female.logDate === logDate || !bucket.female.logDate) &&
          summary.female.avgWeight !== null
        ) {
          bucket.female = {
            avgWeight: summary.female.avgWeight,
            count: summary.female.count,
            logDate,
          };
        }

        latestWeightByPlacement.set(placementId, bucket);
      }
    }

    for (const row of dailyFlagRows) {
      if (!activePlacementIds.has(row.placement_id) || row.is_active === false) {
        continue;
      }

      const bucket = dailyFlagsByPlacement.get(row.placement_id) ?? {
        maintenance: false,
        feedlines: false,
        nippleLines: false,
        birdHealthAlert: false,
        latestLogDate: null,
        completedTodayLabel: null,
      };

      bucket.maintenance = bucket.maintenance || row.maintenance_flag === true;
      bucket.feedlines = bucket.feedlines || row.feedlines_flag === true;
      bucket.nippleLines = bucket.nippleLines || row.nipple_lines_flag === true;
      bucket.birdHealthAlert = bucket.birdHealthAlert || row.bird_health_alert === true;
      if (row.log_date && (!bucket.latestLogDate || row.log_date > bucket.latestLogDate)) {
        bucket.latestLogDate = row.log_date;
      }
      const completionLabel = formatCompletionBadgeLabel(row.updated_at ?? row.created_at, today);
      if (completionLabel && row.log_date === today) {
        bucket.completedTodayLabel = completionLabel;
      }

      dailyFlagsByPlacement.set(row.placement_id, bucket);
    }

    for (const row of issueRows) {
      if (typeof row.entity_id !== "string") {
        continue;
      }

      const isOpen = row.status === "open";
      const isResolved = row.status === "resolved";
      if (!isOpen && !isResolved) {
        continue;
      }

      if (row.entity_type === "barn") {
        if (isOpen) {
          openBarnIssueCountByBarnId.set(
            row.entity_id,
            (openBarnIssueCountByBarnId.get(row.entity_id) ?? 0) + 1,
          );
        } else {
          resolvedBarnIssueCountByBarnId.set(
            row.entity_id,
            (resolvedBarnIssueCountByBarnId.get(row.entity_id) ?? 0) + 1,
          );
        }
        continue;
      }

      if (row.entity_type === "placement") {
        if (isOpen) {
          openPlacementIssueCountByPlacementId.set(
            row.entity_id,
            (openPlacementIssueCountByPlacementId.get(row.entity_id) ?? 0) + 1,
          );
        } else {
          resolvedPlacementIssueCountByPlacementId.set(
            row.entity_id,
            (resolvedPlacementIssueCountByPlacementId.get(row.entity_id) ?? 0) + 1,
          );
        }
      }
    }

    const placementsByBarnId = placementRows.reduce<Map<string, PlacementRow[]>>((acc, row) => {
      const bucket = acc.get(row.barn_id) ?? [];
      bucket.push(row);
      acc.set(row.barn_id, bucket);
      return acc;
    }, new Map());

    const activePlacements: ActivePlacementRecord[] = barnRows.map((barn) => {
      const rowsForBarn = (placementsByBarnId.get(barn.id) ?? []).slice().sort((left, right) =>
        comparePlacementRows(left, right, flockById),
      );
      const activeRow =
        rowsForBarn.find(
          (row) =>
            row.lifecycle_stage === "awaiting_arrival" || row.lifecycle_stage === "in_barn_growing",
        ) ?? null;
      const scheduledRow = rowsForBarn.find((row) => row.lifecycle_stage === "scheduled") ?? null;
      const row = activeRow ?? scheduledRow ?? null;
      const nextPlacementRow =
        row && activeRow
          ? rowsForBarn.find(
              (candidate) =>
                candidate.id !== row.id &&
                candidate.lifecycle_stage === "scheduled" &&
                comparePlacementRows(candidate, row, flockById) > 0,
            ) ??
            null
          : null;
      const farm = farmById.get(barn.farm_id);
      const farmGroup = farm?.farm_group_id ? groupById.get(farm.farm_group_id) : null;
      const flock = row ? flockById.get(row.flock_id) : null;
      const nextPlacementFlock = nextPlacementRow ? flockById.get(nextPlacementRow.flock_id) : null;
      const placedDate = flock?.date_placed ?? row?.active_start ?? "";
      const latestLogDate = row ? latestLogByPlacement.get(row.id) ?? null : null;
      const submissionStatus =
        row && isPlacementOperational(row.lifecycle_stage) ? deriveSubmissionStatus(latestLogDate, today) : "attention";
      const baseCompletionPercent =
        row && isPlacementOperational(row.lifecycle_stage)
          ? submissionStatus === "submitted"
            ? 100
            : submissionStatus === "pending"
              ? 80
              : 55
          : 0;
      const mortalityTotals =
        row && isPlacementOperational(row.lifecycle_stage)
          ? mortalityTotalsByPlacement.get(row.id) ?? {
              femaleTotal: 0,
              maleTotal: 0,
              femaleFirst7Days: 0,
              maleFirst7Days: 0,
              femaleLast7Days: 0,
              maleLast7Days: 0,
            }
          : {
              femaleTotal: 0,
              maleTotal: 0,
              femaleFirst7Days: 0,
              maleFirst7Days: 0,
              femaleLast7Days: 0,
              maleLast7Days: 0,
            };
      const weightSummary =
        row && isPlacementOperational(row.lifecycle_stage)
          ? latestWeightByPlacement.get(row.id) ?? emptyWeightSummary()
          : emptyWeightSummary();
      const latestFemaleWeightPercentExpected = calculateBenchmarkPercent(
        weightSummary.female.avgWeight,
        resolveBreedTargetWeight(
          flock?.breed_females ?? null,
          ageDaysOnSampleDate(placedDate, weightSummary.female.logDate),
          breedById,
          breedSpecRows,
        ),
      );
      const latestMaleWeightPercentExpected = calculateBenchmarkPercent(
        weightSummary.male.avgWeight,
        resolveBreedTargetWeight(
          flock?.breed_males ?? null,
          ageDaysOnSampleDate(placedDate, weightSummary.male.logDate),
          breedById,
          breedSpecRows,
        ),
      );
      const dailyFlags =
        row && isPlacementOperational(row.lifecycle_stage)
          ? dailyFlagsByPlacement.get(row.id) ?? {
              maintenance: false,
              feedlines: false,
              nippleLines: false,
              birdHealthAlert: false,
              latestLogDate: null,
              completedTodayLabel: null,
            }
          : {
              maintenance: false,
              feedlines: false,
              nippleLines: false,
              birdHealthAlert: false,
              latestLogDate: null,
              completedTodayLabel: null,
            };
      const openBarnIssueCount = openBarnIssueCountByBarnId.get(barn.id) ?? 0;
      const openPlacementIssueCount = row ? (openPlacementIssueCountByPlacementId.get(row.id) ?? 0) : 0;
      const resolvedBarnIssueCount = resolvedBarnIssueCountByBarnId.get(barn.id) ?? 0;
      const resolvedPlacementIssueCount = row ? (resolvedPlacementIssueCountByPlacementId.get(row.id) ?? 0) : 0;
      const startedFemaleCount = flock?.start_cnt_females ?? 0;
      const startedMaleCount = flock?.start_cnt_males ?? 0;
      const currentFemaleCount = Math.max(0, startedFemaleCount - mortalityTotals.femaleTotal);
      const currentMaleCount = Math.max(0, startedMaleCount - mortalityTotals.maleTotal);
      const mortalityBreakdownByDate = row ? mortalityByPlacementAndDate.get(row.id) ?? new Map<string, { male: number; female: number }>() : new Map<string, { male: number; female: number }>();
      const mortalityFirst7DayBreakdown = buildMortalityWindowBreakdown({
        mode: "first7",
        placedDate,
        today,
        dayMap: mortalityBreakdownByDate,
      });
      const mortalityLast7DayBreakdown = buildMortalityWindowBreakdown({
        mode: "last7",
        placedDate,
        today,
        dayMap: mortalityBreakdownByDate,
      });
      const flockIsInBarn = Boolean(
        row &&
          (flock?.is_in_barn === true ||
            (barn.is_empty === false && barn.active_flock_id === row.flock_id && isPlacementOperational(row.lifecycle_stage))),
      );
      const lifecycleStage = row?.lifecycle_stage ?? deriveLifecycleStageFallback(row, flockIsInBarn);
      const tileState = deriveTileState(row ? lifecycleStage : null);
      const dashboardStatus =
        tileState === "live"
          ? deriveDashboardStatus({
              isActive: lifecycleStage === "in_barn_growing" || lifecycleStage === "awaiting_arrival",
              openBarnIssueCount,
              openPlacementIssueCount,
              completedTodayLabel: dailyFlags.completedTodayLabel,
            })
          : deriveNonLiveDashboardStatus(tileState);
      const completionPercent = tileState === "awaiting" ? 100 : baseCompletionPercent;
      const ageDays = daysRelativeToToday(placedDate);
      const canCheckoutByAge = ageDays >= checkoutAgeAvailability;
      const scheduledLiveHaulEvents = row ? liveHaulEventsByPlacementId.get(row.id) ?? [] : [];
      const feedProjection = row
        ? buildTenDayFeedProjection({
            today,
            ageDays,
            currentFemaleCount,
            currentMaleCount,
            projectedFemaleMortalityPerDay: resolveProjectedMortalityPerDay(
              mortalityTotals.femaleLast7Days,
              mortalityTotals.femaleFirst7Days,
              ageDays,
            ),
            projectedMaleMortalityPerDay: resolveProjectedMortalityPerDay(
              mortalityTotals.maleLast7Days,
              mortalityTotals.maleFirst7Days,
              ageDays,
            ),
            breedFemales: flock?.breed_females ?? null,
            breedMales: flock?.breed_males ?? null,
            breedById,
            breedSpecRows,
            liveHaulEvents: scheduledLiveHaulEvents,
          })
        : {
            total: null,
            average: null,
            range: { first: null, last: null },
            liveHaulDates: [],
            daily: [],
          };

      return {
        id: row?.id ?? `barn-${barn.id}`,
        placementCode:
          row?.placement_key ??
          (tileState === "empty" ? `Open ${barn.barn_code ?? "Barn"}` : `${flock?.flock_number ?? "TBD"}-${barn.barn_code ?? "Barn"}`),
        placementId: row?.id ?? "",
        flockId: row?.flock_id ?? "",
        lifecycleStage,
        flockNumber: flock?.flock_number ?? null,
        farmGroupId: farm?.farm_group_id ?? "ungrouped",
        farmGroupName: farmGroup?.groupName ?? farm?.farm_group_name ?? "Ungrouped",
        farmId: barn.farm_id,
        farmName: farm?.farm_name ?? "Unnamed Farm",
        barnId: barn.id,
        barnCode: barn.barn_code ?? "Barn",
        flockCode: flock?.flock_number?.toString() ?? "None",
        integrator: farmGroup?.integrator ?? "Not set",
        placedDate,
        projectedEndDate: flock?.max_date ?? row?.active_end ?? "",
        dateRemoved: row?.date_removed ?? null,
        estimatedFirstCatch: flock?.max_date ?? (placedDate ? addDays(placedDate, 38) : ""),
        ageDays,
        headCount: currentFemaleCount + currentMaleCount,
        completionPercent,
        submissionStatus,
        dashboardStatusLabel: dashboardStatus.label,
        dashboardStatusTone: dashboardStatus.tone,
        completedTodayLabel: dailyFlags.completedTodayLabel,
        openBarnIssueCount,
        openPlacementIssueCount,
        resolvedBarnIssueCount,
        resolvedPlacementIssueCount,
        startedFemaleCount,
        startedMaleCount,
        mortalityFemaleTotal: mortalityTotals.femaleTotal,
        mortalityMaleTotal: mortalityTotals.maleTotal,
        currentFemaleCount,
        currentMaleCount,
        mortalityFemaleLast7Days: mortalityTotals.femaleLast7Days,
        mortalityMaleLast7Days: mortalityTotals.maleLast7Days,
        mortalityFemaleFirst7Days: mortalityTotals.femaleFirst7Days,
        mortalityMaleFirst7Days: mortalityTotals.maleFirst7Days,
        mortalityFirst7DayBreakdown,
        mortalityLast7DayBreakdown,
        feedProjectionTenDayTotal: feedProjection.total,
        feedProjectionTenDayAverage: feedProjection.average,
        feedProjectionTenDayRange: feedProjection.range,
        feedProjectionLiveHaulDates: feedProjection.liveHaulDates,
        feedProjectionTenDayDaily: feedProjection.daily,
        latestFemaleWeight: weightSummary.female.avgWeight,
        latestMaleWeight: weightSummary.male.avgWeight,
        latestFemaleWeightPercentExpected,
        latestMaleWeightPercentExpected,
        latestFemaleWeightCount: weightSummary.female.count,
        latestMaleWeightCount: weightSummary.male.count,
        latestFemaleWeightDate: weightSummary.female.logDate,
        latestMaleWeightDate: weightSummary.male.logDate,
        breedFemales: flock?.breed_females ?? null,
        breedMales: flock?.breed_males ?? null,
        liveHaulDates: scheduledLiveHaulEvents.map((event) => event.date),
        liveHaulSchedulerDate:
          scheduledLiveHaulEvents[0]?.date ??
          (placedDate ? addDays(placedDate, firstLivehaulOffsetDays) : null) ??
          null,
        lh1Date: scheduledLiveHaulEvents[0]?.date ?? row?.lh1_date ?? null,
        lh2Date: scheduledLiveHaulEvents[1]?.date ?? row?.lh2_date ?? null,
        lh3Date: scheduledLiveHaulEvents[2]?.date ?? row?.lh3_date ?? null,
        tileState,
        placementEditorAccess: {
          canOpen: false,
          canView: false,
          canEditFlockFields: false,
          canEditPlacementFields: false,
          message: null,
        },
        nextPlacement: nextPlacementRow
          ? {
              placementCode: nextPlacementRow.placement_key,
              flockCode: nextPlacementFlock?.flock_number?.toString() ?? "TBD",
              placedDate: nextPlacementFlock?.date_placed ?? nextPlacementRow.active_start ?? "",
            }
          : null,
        placementIsActive: row?.is_active === true,
        flockIsActive: flock?.is_active === true,
        flockIsInBarn,
        flockIsComplete: flock?.is_complete === true,
        flockIsSettled: flock?.is_settled === true,
        barnIsEmpty: barn.is_empty === true,
        canMarkBarnEmpty: lifecycleStage === "in_barn_growing" && flockIsInBarn && canCheckoutByAge,
        hasWeightData: !!(weightSummary.female.logDate || weightSummary.male.logDate),
      };
    }).sort((left, right) => {
      const groupCompare = left.farmGroupName.localeCompare(right.farmGroupName);
      if (groupCompare !== 0) return groupCompare;

      const farmCompare = left.farmName.localeCompare(right.farmName);
      if (farmCompare !== 0) return farmCompare;

      const leftBarn = barnById.get(left.barnId);
      const rightBarn = barnById.get(right.barnId);

      return compareBarnRows(
        { sort_code: leftBarn?.sort_code ?? null, barn_code: leftBarn?.barn_code ?? left.barnCode },
        { sort_code: rightBarn?.sort_code ?? null, barn_code: rightBarn?.barn_code ?? right.barnCode },
      );
    });

    const operationalPlacements = activePlacements.filter(
      (placement) => placement.tileState === "live" || placement.tileState === "awaiting",
    );

    return {
      stats: {
        activePlacements: operationalPlacements.length,
        farmsOnline: farms.filter((farm) => farm.status !== "inactive").length,
        barnsReady: barnRows.filter((barn) => barn.is_active !== false).length,
        flocksInCycle: flocks.filter((flock) => flock.status === "active").length,
      },
      alerts: buildAlerts(operationalPlacements),
      farmGroups,
      farms,
      barnsByFarmId,
      flocks,
      breedOptions,
      placementHints: [],
      activePlacements,
    };
  } catch (error) {
    if (error instanceof AdminDataError) {
      throw error;
    }

    throw new AdminDataError(
      `Admin data hit an unexpected error while reading Supabase: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export type ActivityLogFilters = {
  when?: string | null;
  farm?: string | null;
  barn?: string | null;
  flock?: string | null;
  user?: string | null;
};

export type ActivityLogPageBundle = {
  entries: ActivityLogRecord[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export async function getActivityLogEntries(
  filters: ActivityLogFilters = {},
  page = 1,
  pageSize = 50,
): Promise<ActivityLogPageBundle> {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new AdminDataError(
      "Activity log could not connect to Supabase. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web-admin/.env.",
    );
  }

  const normalizedPageSize = Math.max(1, Math.min(100, Math.trunc(pageSize) || 50));
  const normalizedPage = Math.max(1, Math.trunc(page) || 1);
  const rangeFrom = (normalizedPage - 1) * normalizedPageSize;
  const rangeTo = rangeFrom + normalizedPageSize - 1;

  let query = supabase
    .from("activity_log")
    .select("id,occurred_at,entry_type,action_key,details,source,placement_code,farm_name,barn_code,user_name", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  const when = String(filters.when ?? "").trim();
  const farm = String(filters.farm ?? "").trim();
  const barn = String(filters.barn ?? "").trim();
  const flock = String(filters.flock ?? "").trim();
  const user = String(filters.user ?? "").trim();

  if (when) {
    const start = `${when}T00:00:00.000Z`;
    const nextDate = new Date(`${when}T00:00:00.000Z`);
    if (!Number.isNaN(nextDate.getTime())) {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      query = query.gte("occurred_at", start).lt("occurred_at", nextDate.toISOString());
    }
  }

  if (farm) {
    query = query.ilike("farm_name", `%${farm}%`);
  }

  if (barn) {
    query = query.ilike("barn_code", `%${barn}%`);
  }

  if (flock) {
    query = query.ilike("placement_code", `%${flock}%`);
  }

  if (user) {
    query = query.ilike("user_name", `%${user}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new AdminDataError(`Activity log failed to load from Supabase: ${error.message}`);
  }

  const entries = ((data ?? []) as ActivityLogRow[]).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at ?? "",
    entryType: row.entry_type ?? "event",
    actionKey: row.action_key ?? "activity",
    details: row.details ?? "",
    source: row.source ?? null,
    placementCode: row.placement_code ?? null,
    farmName: row.farm_name ?? null,
    barnCode: row.barn_code ?? null,
    userName: row.user_name ?? null,
  }));

  const totalCount = count ?? entries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / normalizedPageSize));

  return {
    entries,
    page: Math.min(normalizedPage, totalPages),
    pageSize: normalizedPageSize,
    totalCount,
    totalPages,
    hasPreviousPage: normalizedPage > 1,
    hasNextPage: normalizedPage < totalPages,
  };
}

function deriveDashboardStatus(flags: {
  isActive: boolean;
  openBarnIssueCount: number;
  openPlacementIssueCount: number;
  completedTodayLabel: string | null;
}) {
  if (!flags.isActive) {
    return { label: "Inactive", tone: "neutral" as const };
  }

  const totalOpenIssues = flags.openBarnIssueCount + flags.openPlacementIssueCount;
  if (totalOpenIssues > 0) {
    return {
      label: `${totalOpenIssues} Open Issue${totalOpenIssues === 1 ? "" : "s"}`,
      tone: flags.openPlacementIssueCount > 0 ? ("danger" as const) : ("warn" as const),
    };
  }

  if (flags.completedTodayLabel) {
    return { label: flags.completedTodayLabel, tone: "good" as const };
  }

  return { label: "Pending", tone: "neutral" as const };
}

function deriveNonLiveDashboardStatus(tileState: ActivePlacementRecord["tileState"]) {
  if (tileState === "awaiting") {
    return { label: "Awaiting Arrival", tone: "warn" as const };
  }

  if (tileState === "scheduled") {
    return { label: "Scheduled", tone: "neutral" as const };
  }

  return { label: "OFFLINE", tone: "neutral" as const };
}

function deriveTileState(lifecycleStage: PlacementLifecycleStage | null): ActivePlacementRecord["tileState"] {
  if (lifecycleStage === "in_barn_growing") {
    return "live";
  }

  if (lifecycleStage === "awaiting_arrival") {
    return "awaiting";
  }

  if (lifecycleStage === "scheduled") {
    return "scheduled";
  }

  return "empty";
}

function isPlacementOperational(lifecycleStage: PlacementLifecycleStage | null | undefined) {
  return lifecycleStage === "awaiting_arrival" || lifecycleStage === "in_barn_growing";
}

function deriveLifecycleStageFallback(
  placement: PlacementRow | null,
  flockIsInBarn: boolean,
): PlacementLifecycleStage {
  if (!placement) {
    return "scheduled";
  }

  if (placement.date_removed) {
    return "waiting_closeout";
  }

  if (placement.is_active === true && flockIsInBarn) {
    return "in_barn_growing";
  }

  if (placement.is_active === true) {
    return "awaiting_arrival";
  }

  return "scheduled";
}

function formatCompletionBadgeLabel(timestamp: string | null, today: string) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (formatConsoleDateKey(date) !== today) {
    return null;
  }

  return `Done ${CONSOLE_TIME_FORMATTER.format(date)}`;
}

function formatConsoleDateKey(value: Date) {
  return CONSOLE_DATE_KEY_FORMATTER.format(value);
}

export async function getFarmById(
  farmId: string,
): Promise<{ farm: FarmRecord; barns: AdminDataBundle["barnsByFarmId"][string] } | null> {
  const data = await getAdminData();
  const farm = data.farms.find((item) => item.id === farmId);

  if (!farm) {
    return null;
  }

  return {
    farm,
    barns: data.barnsByFarmId[farmId] ?? [],
  };
}

export async function getFlockById(flockId: string): Promise<FlockRecord | null> {
  const data = await getAdminData();
  return data.flocks.find((item) => item.id === flockId) ?? null;
}

export async function getFarmGroupById(
  farmGroupId: string,
): Promise<{ farmGroup: FarmGroupRecord; farms: FarmRecord[] } | null> {
  const data = await getAdminData();
  const farmGroup = data.farmGroups.find((item) => item.id === farmGroupId);

  if (!farmGroup) {
    return null;
  }

  return {
    farmGroup,
    farms: data.farms.filter((farm) => farm.farmGroupId === farmGroupId),
  };
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = getKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function parseCapacity(stdrocHead: string | null, sqft: number | null) {
  const parsed = stdrocHead ? Number.parseInt(stdrocHead, 10) : NaN;
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  if (typeof sqft === "number" && Number.isFinite(sqft)) {
    return Math.round(sqft / 0.85);
  }

  return 0;
}

function compareBarnRows(left: Pick<BarnRow, "sort_code" | "barn_code">, right: Pick<BarnRow, "sort_code" | "barn_code">) {
  const leftSort = String(left.sort_code ?? "").trim().toLowerCase();
  const rightSort = String(right.sort_code ?? "").trim().toLowerCase();

  if (leftSort && rightSort && leftSort !== rightSort) {
    return leftSort.localeCompare(rightSort, undefined, { numeric: true });
  }

  if (leftSort || rightSort) {
    return leftSort ? -1 : 1;
  }

  return String(left.barn_code ?? "").localeCompare(String(right.barn_code ?? ""), undefined, { numeric: true });
}

function formatCityState(city: string | null, state: string | null) {
  const parts = [city, state].filter((value): value is string => Boolean(value && value.trim().length > 0));
  return parts.length > 0 ? parts.join(", ") : "Not set";
}

function addDays(date: string | null, days: number) {
  if (!date) {
    return "";
  }

  const dt = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) {
    return "";
  }

  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function formatMortalityWindowLabel(date: string) {
  const dt = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) {
    return date;
  }

  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

function buildMortalityWindowBreakdown({
  mode,
  placedDate,
  today,
  dayMap,
}: {
  mode: "first7" | "last7";
  placedDate: string | null;
  today: string;
  dayMap: Map<string, { male: number; female: number }>;
}) {
  const dates: string[] = [];

  if (mode === "first7" && placedDate) {
    for (let index = 0; index < 7; index += 1) {
      const candidate = addDays(placedDate, index);
      if (candidate) {
        dates.push(candidate);
      }
    }
  } else {
    for (let offset = 0; offset <= 6; offset += 1) {
      dates.push(addDays(today, -offset));
    }
  }

  const items = dates.map((date) => {
    const bucket = dayMap.get(date) ?? { male: 0, female: 0 };
    return {
      date,
      label: formatMortalityWindowLabel(date),
      male: bucket.male,
      female: bucket.female,
    };
  });

  items.sort((left, right) => left.date.localeCompare(right.date));

  return items;
}

function daysSince(date: string | null) {
  if (!date) {
    return 0;
  }

  const start = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.max(0, Math.ceil((todayUtc - startUtc) / 86400000));
}

function daysRelativeToToday(date: string | null) {
  if (!date) {
    return 0;
  }

  const start = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.round((todayUtc - startUtc) / 86400000);
}

function ageDaysOnSampleDate(placedDate: string | null, sampleDate: string | null) {
  if (!placedDate || !sampleDate) {
    return null;
  }

  const placed = new Date(`${placedDate}T00:00:00Z`);
  const sample = new Date(`${sampleDate}T00:00:00Z`);
  if (Number.isNaN(placed.getTime()) || Number.isNaN(sample.getTime())) {
    return null;
  }

  const placedUtc = Date.UTC(placed.getUTCFullYear(), placed.getUTCMonth(), placed.getUTCDate());
  const sampleUtc = Date.UTC(sample.getUTCFullYear(), sample.getUTCMonth(), sample.getUTCDate());
  return Math.round((sampleUtc - placedUtc) / 86400000);
}

function normalizeBreedText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeBreedSex(value: string | null | undefined) {
  const normalized = normalizeBreedText(value);
  if (normalized.startsWith("m")) {
    return "male";
  }
  if (normalized.startsWith("f")) {
    return "female";
  }
  return normalized || null;
}

function resolveBreedSpecMetric(
  breedId: string | null,
  ageDays: number | null,
  breedById: Map<string, BreedRow>,
  breedSpecRows: BreedSpecRow[],
  metric: "targetweight" | "dayfeedperbird",
) {
  if (!breedId || ageDays === null) {
    return null;
  }

  const breed = breedById.get(breedId);
  if (!breed) {
    return null;
  }

  const breedName = normalizeBreedText(breed.breed_name);
  const sex = normalizeBreedSex(breed.sex);
  if (!breedName) {
    return null;
  }

  const exactMatch = breedSpecRows.find((row) => {
    return (
      row.age === ageDays &&
      normalizeBreedText(row.geneticname) === breedName &&
      (!sex || normalizeBreedSex(row.breedid) === sex)
    );
  });

  const exactMetric = exactMatch?.[metric];
  if (typeof exactMetric === "number" && Number.isFinite(exactMetric)) {
    return exactMetric;
  }

  const fallbackMatch = breedSpecRows.find((row) => {
    return row.age === ageDays && normalizeBreedText(row.geneticname) === breedName;
  });

  const fallbackMetric = fallbackMatch?.[metric];
  return typeof fallbackMetric === "number" && Number.isFinite(fallbackMetric) ? fallbackMetric : null;
}

function resolveBreedTargetWeight(
  breedId: string | null,
  ageDays: number | null,
  breedById: Map<string, BreedRow>,
  breedSpecRows: BreedSpecRow[],
) {
  return resolveBreedSpecMetric(breedId, ageDays, breedById, breedSpecRows, "targetweight");
}

function resolveBreedDayFeedPerBird(
  breedId: string | null,
  ageDays: number | null,
  breedById: Map<string, BreedRow>,
  breedSpecRows: BreedSpecRow[],
) {
  return resolveBreedSpecMetric(breedId, ageDays, breedById, breedSpecRows, "dayfeedperbird");
}

function calculateBenchmarkPercent(actualWeight: number | null, expectedWeight: number | null) {
  if (
    actualWeight === null ||
    expectedWeight === null ||
    Number.isNaN(actualWeight) ||
    Number.isNaN(expectedWeight) ||
    expectedWeight <= 0
  ) {
    return null;
  }

  return (actualWeight / expectedWeight) * 100;
}

function resolveProjectedMortalityPerDay(last7Days: number, first7Days: number, ageDays: number) {
  if (last7Days > 0) {
    return last7Days / 7;
  }

  if (first7Days > 0) {
    return first7Days / Math.min(7, Math.max(ageDays, 1));
  }

  return 0;
}

function applyLiveHaulReduction({
  femalePopulation,
  malePopulation,
  femaleRemoval,
  maleRemoval,
}: {
  femalePopulation: number;
  malePopulation: number;
  femaleRemoval: number;
  maleRemoval: number;
}) {
  return {
    femalePopulation: Math.max(0, femalePopulation - femaleRemoval),
    malePopulation: Math.max(0, malePopulation - maleRemoval),
  };
}

type FeedProjectionLiveHaulEvent = {
  date: string;
  targetHead: number | null;
  actualHead: number | null;
};

function buildTenDayFeedProjection({
  today,
  ageDays,
  currentFemaleCount,
  currentMaleCount,
  projectedFemaleMortalityPerDay,
  projectedMaleMortalityPerDay,
  breedFemales,
  breedMales,
  breedById,
  breedSpecRows,
  liveHaulEvents,
}: {
  today: string;
  ageDays: number;
  currentFemaleCount: number;
  currentMaleCount: number;
  projectedFemaleMortalityPerDay: number;
  projectedMaleMortalityPerDay: number;
  breedFemales: string | null;
  breedMales: string | null;
  breedById: Map<string, BreedRow>;
  breedSpecRows: BreedSpecRow[];
  liveHaulEvents: FeedProjectionLiveHaulEvent[];
}) {
  const scheduledLiveHaulEvents = liveHaulEvents
    .filter((value) => Boolean(value.date))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));
  const scheduledLiveHaulDates = scheduledLiveHaulEvents.map((event) => event.date);
  const liveHaulDatesInWindow = scheduledLiveHaulDates.filter((date) => {
    return date > today && date <= addDays(today, 10);
  });
  const liveHaulEventByDate = new Map(scheduledLiveHaulEvents.map((event) => [event.date, event]));
  const liveHaulIndexByDate = new Map(scheduledLiveHaulDates.map((date, index) => [date, index]));

  let femalePopulation = currentFemaleCount;
  let malePopulation = currentMaleCount;
  let firstLiveHaulFemaleRemoval: number | null = null;
  let firstLiveHaulMaleRemoval: number | null = null;
  const daily: Array<{
    date: string;
    ageDays: number;
    totalBirds: number;
    totalFeed: number | null;
    liveHaulFraction: number | null;
    liveHaulLabel: string | null;
  }> = [];

  for (const [liveHaulIndex, liveHaulEvent] of scheduledLiveHaulEvents.entries()) {
    if (liveHaulEvent.date > today) {
      break;
    }

    const isFinalLiveHaul = liveHaulIndex === scheduledLiveHaulDates.length - 1;
    const explicitHeadRemoval = liveHaulEvent.targetHead ?? liveHaulEvent.actualHead ?? null;

    if (explicitHeadRemoval !== null) {
      const totalPopulation = femalePopulation + malePopulation;
      const boundedRemoval = Math.min(totalPopulation, Math.max(0, explicitHeadRemoval));
      const femaleShare = totalPopulation > 0 ? femalePopulation / totalPopulation : 0.5;
      const maleShare = totalPopulation > 0 ? malePopulation / totalPopulation : 0.5;
      const femaleRemoval = boundedRemoval * femaleShare;
      const maleRemoval = boundedRemoval * maleShare;

      if (firstLiveHaulFemaleRemoval === null && firstLiveHaulMaleRemoval === null) {
        firstLiveHaulFemaleRemoval = femaleRemoval;
        firstLiveHaulMaleRemoval = maleRemoval;
      }

      const reducedPopulation = applyLiveHaulReduction({
        femalePopulation,
        malePopulation,
        femaleRemoval,
        maleRemoval,
      });
      femalePopulation = reducedPopulation.femalePopulation;
      malePopulation = reducedPopulation.malePopulation;
    } else if (isFinalLiveHaul) {
      femalePopulation = 0;
      malePopulation = 0;
    } else if (liveHaulIndex === 0) {
      firstLiveHaulFemaleRemoval = femalePopulation / 3;
      firstLiveHaulMaleRemoval = malePopulation / 3;
      const reducedPopulation = applyLiveHaulReduction({
        femalePopulation,
        malePopulation,
        femaleRemoval: firstLiveHaulFemaleRemoval,
        maleRemoval: firstLiveHaulMaleRemoval,
      });
      femalePopulation = reducedPopulation.femalePopulation;
      malePopulation = reducedPopulation.malePopulation;
    } else {
      const reducedPopulation = applyLiveHaulReduction({
        femalePopulation,
        malePopulation,
        femaleRemoval: Math.min(femalePopulation, firstLiveHaulFemaleRemoval ?? 0),
        maleRemoval: Math.min(malePopulation, firstLiveHaulMaleRemoval ?? 0),
      });
      femalePopulation = reducedPopulation.femalePopulation;
      malePopulation = reducedPopulation.malePopulation;
    }
  }

  for (let dayOffset = 1; dayOffset <= 10; dayOffset += 1) {
    femalePopulation = Math.max(0, femalePopulation - projectedFemaleMortalityPerDay);
    malePopulation = Math.max(0, malePopulation - projectedMaleMortalityPerDay);

    const date = addDays(today, dayOffset);
    const projectedAgeDays = ageDays + dayOffset;
    const femaleFeedPerBird = resolveBreedDayFeedPerBird(
      breedFemales,
      projectedAgeDays,
      breedById,
      breedSpecRows,
    );
    const maleFeedPerBird = resolveBreedDayFeedPerBird(
      breedMales,
      projectedAgeDays,
      breedById,
      breedSpecRows,
    );
    const totalFeed =
      femaleFeedPerBird === null && maleFeedPerBird === null
        ? null
        : (femaleFeedPerBird ?? 0) * femalePopulation + (maleFeedPerBird ?? 0) * malePopulation;
    const liveHaulIndex = liveHaulIndexByDate.get(date);
    const appliesLiveHaul = liveHaulIndex !== undefined;
    const isFinalLiveHaul = appliesLiveHaul && liveHaulIndex === scheduledLiveHaulDates.length - 1;
    const liveHaulEvent = liveHaulEventByDate.get(date) ?? null;
    const explicitHeadRemoval = liveHaulEvent?.targetHead ?? liveHaulEvent?.actualHead ?? null;
    let liveHaulFraction: number | null = null;
    let liveHaulLabel: string | null = null;

    if (appliesLiveHaul) {
      if (explicitHeadRemoval !== null) {
        const totalPopulation = femalePopulation + malePopulation;
        const boundedRemoval = Math.min(totalPopulation, Math.max(0, explicitHeadRemoval));
        liveHaulFraction = totalPopulation > 0 ? boundedRemoval / totalPopulation : null;
        liveHaulLabel = `Planned live haul removes ${Math.round(boundedRemoval).toLocaleString()} birds before the next day.`;
      } else if (isFinalLiveHaul) {
        liveHaulFraction = femalePopulation + malePopulation > 0 ? 1 : null;
        liveHaulLabel = "Final live haul clears remaining birds for the next day.";
      } else if (liveHaulIndex === 0) {
        liveHaulFraction = 1 / 3;
        liveHaulLabel = "Next day uses a one-third live-haul reduction from this day's population.";
      } else {
        const totalPopulation = femalePopulation + malePopulation;
        const fixedRemoval =
          (firstLiveHaulFemaleRemoval ?? 0) + (firstLiveHaulMaleRemoval ?? 0);
        liveHaulFraction = totalPopulation > 0 ? Math.min(1, fixedRemoval / totalPopulation) : null;
        liveHaulLabel = "Next day uses the same bird reduction as the first live haul.";
      }
    }

    daily.push({
      date,
      ageDays: projectedAgeDays,
      totalBirds: Math.round(femalePopulation + malePopulation),
      totalFeed,
      liveHaulFraction,
      liveHaulLabel,
    });

    if (appliesLiveHaul) {
      if (explicitHeadRemoval !== null) {
        const totalPopulation = femalePopulation + malePopulation;
        const boundedRemoval = Math.min(totalPopulation, Math.max(0, explicitHeadRemoval));
        const femaleShare = totalPopulation > 0 ? femalePopulation / totalPopulation : 0.5;
        const maleShare = totalPopulation > 0 ? malePopulation / totalPopulation : 0.5;
        const femaleRemoval = boundedRemoval * femaleShare;
        const maleRemoval = boundedRemoval * maleShare;

        if (firstLiveHaulFemaleRemoval === null && firstLiveHaulMaleRemoval === null) {
          firstLiveHaulFemaleRemoval = femaleRemoval;
          firstLiveHaulMaleRemoval = maleRemoval;
        }

        const reducedPopulation = applyLiveHaulReduction({
          femalePopulation,
          malePopulation,
          femaleRemoval,
          maleRemoval,
        });
        femalePopulation = reducedPopulation.femalePopulation;
        malePopulation = reducedPopulation.malePopulation;
      } else if (isFinalLiveHaul) {
        femalePopulation = 0;
        malePopulation = 0;
      } else if (liveHaulIndex === 0) {
        firstLiveHaulFemaleRemoval = femalePopulation / 3;
        firstLiveHaulMaleRemoval = malePopulation / 3;
        const reducedPopulation = applyLiveHaulReduction({
          femalePopulation,
          malePopulation,
          femaleRemoval: firstLiveHaulFemaleRemoval,
          maleRemoval: firstLiveHaulMaleRemoval,
        });
        femalePopulation = reducedPopulation.femalePopulation;
        malePopulation = reducedPopulation.malePopulation;
      } else {
        const reducedPopulation = applyLiveHaulReduction({
          femalePopulation,
          malePopulation,
          femaleRemoval: Math.min(femalePopulation, firstLiveHaulFemaleRemoval ?? 0),
          maleRemoval: Math.min(malePopulation, firstLiveHaulMaleRemoval ?? 0),
        });
        femalePopulation = reducedPopulation.femalePopulation;
        malePopulation = reducedPopulation.malePopulation;
      }
    }
  }

  const feedValues = daily
    .map((entry) => entry.totalFeed)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const total = feedValues.length > 0 ? feedValues.reduce((sum, value) => sum + value, 0) : null;
  const average = total !== null ? total / daily.length : null;

  return {
    total,
    average,
    range: {
      first: daily[0]?.totalFeed ?? null,
      last: daily[daily.length - 1]?.totalFeed ?? null,
    },
    liveHaulDates: liveHaulDatesInWindow,
    daily,
  };
}

function comparePlacementRows(
  left: PlacementRow,
  right: PlacementRow,
  flockById: Map<string, FlockRow>,
) {
  const leftDate = left.active_start ?? flockById.get(left.flock_id)?.date_placed ?? "9999-12-31";
  const rightDate = right.active_start ?? flockById.get(right.flock_id)?.date_placed ?? "9999-12-31";
  const dateCompare = leftDate.localeCompare(rightDate);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
}

function isOnOrAfter(date: string | null, compareTo: string) {
  if (!date) {
    return false;
  }

  return date <= compareTo;
}

function daysBetween(dateA: string | null, dateB: string | null) {
  if (!dateA || !dateB) {
    return null;
  }

  const a = new Date(`${dateA}T00:00:00Z`);
  const b = new Date(`${dateB}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return null;
  }

  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function deriveSubmissionStatus(latestLogDate: string | null, today: string): ActivePlacementRecord["submissionStatus"] {
  if (!latestLogDate) {
    return "attention";
  }

  if (latestLogDate === today) {
    return "submitted";
  }

  const diff = daysSince(latestLogDate);
  return diff <= 1 ? "pending" : "attention";
}

function inferGroupIntegrator(farmGroupId: string, farms: FarmRow[], flocks: FlockRow[]) {
  const relatedFarmIds = new Set(
    farms.filter((farm) => farm.farm_group_id === farmGroupId).map((farm) => farm.id),
  );

  const hasFlocks = flocks.some((flock) => relatedFarmIds.has(flock.farm_id));
  return hasFlocks ? "Active Grower Group" : "Not set";
}

function inferFlockIntegrator(farmId: string, farms: FarmRow[], farmGroups: FarmGroupRecord[]) {
  const farm = farms.find((row) => row.id === farmId);
  const group = farmGroups.find((row) => row.id === farm?.farm_group_id);
  return group?.integrator ?? "Not set";
}

function findGroupContact(farmGroupId: string | null, farmGroups: FarmGroupRow[]) {
  if (!farmGroupId) {
    return "Not set";
  }

  const group = farmGroups.find((row) => row.id === farmGroupId);
  return group?.group_contact_name ?? "Not set";
}

function buildAlerts(activePlacements: ActivePlacementRecord[]) {
  const pendingCount = activePlacements.filter((item) => item.submissionStatus === "pending").length;
  const attentionCount = activePlacements.filter((item) => item.submissionStatus === "attention").length;
  const submittedCount = activePlacements.filter((item) => item.submissionStatus === "submitted").length;

  return [
    {
      id: "alert-pending",
      title: `${pendingCount} placements still need today's packet finished.`,
      body: "These barns have recent activity but have not yet reached a fully submitted status for today.",
      tone: pendingCount > 0 ? ("warn" as const) : ("good" as const),
    },
    {
      id: "alert-attention",
      title: `${attentionCount} placements need attention.`,
      body: "These placements do not have a current daily submission on record and should be reviewed first.",
      tone: attentionCount > 0 ? ("danger" as const) : ("good" as const),
    },
    {
      id: "alert-submitted",
      title: `${submittedCount} placements are fully current.`,
      body: "These barns already show a current daily submission in the live data feed.",
      tone: "good" as const,
    },
  ];
}
