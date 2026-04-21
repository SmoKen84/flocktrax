import { unstable_noStore as noStore } from "next/cache";

import type {
  ActivePlacementRecord,
  ActivityLogRecord,
  AdminDataBundle,
  FarmGroupRecord,
  FarmRecord,
  FlockRecord,
} from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

class AdminDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDataError";
  }
}

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

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  date_removed: string | null;
  is_active: boolean | null;
  placement_key: string;
  lh1_date: string | null;
  lh3_date: string | null;
  active_start?: string | null;
  active_end?: string | null;
  created_at?: string | null;
};

type PlacementLogRow = {
  placement_id: string;
  log_date: string;
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
    const today = new Date().toISOString().slice(0, 10);

    const [
      farmGroupsResult,
      farmsResult,
      barnsResult,
      flocksResult,
      placementsResult,
      placementLogsResult,
      dailyFlagsResult,
      mortalityLogsResult,
      weightLogsResult,
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
        .select("id,farm_id,barn_id,flock_id,date_removed,is_active,placement_key,lh1_date,lh3_date,active_start,active_end,created_at")
        .order("placement_key"),
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
    ]);

    if (
      farmGroupsResult.error ||
      farmsResult.error ||
      barnsResult.error ||
      flocksResult.error ||
      placementsResult.error ||
      placementLogsResult.error ||
      dailyFlagsResult.error ||
      mortalityLogsResult.error ||
      weightLogsResult.error
    ) {
      const firstError =
        farmGroupsResult.error ||
        farmsResult.error ||
        barnsResult.error ||
        flocksResult.error ||
        placementsResult.error ||
        placementLogsResult.error ||
        dailyFlagsResult.error ||
        mortalityLogsResult.error ||
        weightLogsResult.error;

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
    const placementLogRows = (placementLogsResult.data ?? []) as PlacementLogRow[];
    const dailyFlagRows = (dailyFlagsResult.data ?? []) as DailyFlagRow[];
    const mortalityRows = (mortalityLogsResult.data ?? []) as MortalityRow[];
    const weightRows = (weightLogsResult.data ?? []) as WeightRow[];

    const activePlacementsRaw = placementRows.filter((row) => row.is_active === true);
    const activePlacementIds = new Set(activePlacementsRaw.map((row) => row.id));

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

    const flockById = new Map(flockRows.map((row) => [row.id, row]));
    const farmById = new Map(farmRows.map((row) => [row.id, row]));
    const groupById = new Map(farmGroups.map((row) => [row.id, row]));
    const barnById = new Map(barnRows.map((row) => [row.id, row]));

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

      const ageOnLogDate = placedDate ? daysBetween(row.log_date, placedDate) : null;
      const daysFromToday = daysSince(row.log_date);

      if (ageOnLogDate !== null && ageOnLogDate <= 7) {
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
      const activeRow = rowsForBarn.find((row) => row.is_active === true && row.date_removed === null) ?? null;
      const scheduledRow =
        rowsForBarn.find((row) => row.is_active !== true && row.date_removed === null) ?? null;
      const row = activeRow ?? scheduledRow ?? null;
      const farm = farmById.get(barn.farm_id);
      const farmGroup = farm?.farm_group_id ? groupById.get(farm.farm_group_id) : null;
      const flock = row ? flockById.get(row.flock_id) : null;
      const placedDate = flock?.date_placed ?? row?.active_start ?? "";
      const latestLogDate = row ? latestLogByPlacement.get(row.id) ?? null : null;
      const submissionStatus =
        row && row.is_active === true ? deriveSubmissionStatus(latestLogDate, today) : "attention";
      const completionPercent =
        row && row.is_active === true
          ? submissionStatus === "submitted"
            ? 100
            : submissionStatus === "pending"
              ? 80
              : 55
          : 0;
      const mortalityTotals =
        row && row.is_active === true
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
        row && row.is_active === true
          ? latestWeightByPlacement.get(row.id) ?? emptyWeightSummary()
          : emptyWeightSummary();
      const dailyFlags =
        row && row.is_active === true
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
      const startedFemaleCount = flock?.start_cnt_females ?? 0;
      const startedMaleCount = flock?.start_cnt_males ?? 0;
      const currentFemaleCount = Math.max(0, startedFemaleCount - mortalityTotals.femaleTotal);
      const currentMaleCount = Math.max(0, startedMaleCount - mortalityTotals.maleTotal);
      const flockIsInBarn = Boolean(
        row &&
          (flock?.is_in_barn === true ||
            (barn.is_empty === false && barn.active_flock_id === row.flock_id && row.is_active === true)),
      );
      const tileState = deriveTileState({
        hasPlacement: !!row,
        placementIsActive: row?.is_active === true,
        flockIsInBarn,
      });
      const dashboardStatus =
        tileState === "live"
          ? deriveDashboardStatus({
              isActive: row?.is_active === true,
              maintenance: dailyFlags.maintenance,
              feedlines: dailyFlags.feedlines,
              nippleLines: dailyFlags.nippleLines,
              birdHealthAlert: dailyFlags.birdHealthAlert,
              completedTodayLabel: dailyFlags.completedTodayLabel,
            })
          : deriveNonLiveDashboardStatus(tileState);

      return {
        id: row?.id ?? `barn-${barn.id}`,
        placementCode:
          row?.placement_key ??
          (tileState === "empty" ? `Open ${barn.barn_code ?? "Barn"}` : `${flock?.flock_number ?? "TBD"}-${barn.barn_code ?? "Barn"}`),
        placementId: row?.id ?? "",
        farmGroupId: farm?.farm_group_id ?? "ungrouped",
        farmGroupName: farmGroup?.groupName ?? farm?.farm_group_name ?? "Ungrouped",
        farmId: barn.farm_id,
        farmName: farm?.farm_name ?? "Unnamed Farm",
        barnId: barn.id,
        barnCode: barn.barn_code ?? "Barn",
        flockCode: flock?.flock_number?.toString() ?? "None",
        integrator: farmGroup?.integrator ?? "Not set",
        placedDate,
        estimatedFirstCatch: flock?.max_date ?? (placedDate ? addDays(placedDate, 38) : ""),
        ageDays: daysRelativeToToday(placedDate),
        headCount: currentFemaleCount + currentMaleCount,
        completionPercent,
        submissionStatus,
        dashboardStatusLabel: dashboardStatus.label,
        dashboardStatusTone: dashboardStatus.tone,
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
        latestFemaleWeight: weightSummary.female.avgWeight,
        latestMaleWeight: weightSummary.male.avgWeight,
        latestFemaleWeightCount: weightSummary.female.count,
        latestMaleWeightCount: weightSummary.male.count,
        latestFemaleWeightDate: weightSummary.female.logDate,
        latestMaleWeightDate: weightSummary.male.logDate,
        lh1Date: row?.lh1_date ?? null,
        lh3Date: row?.lh3_date ?? null,
        tileState,
        placementIsActive: row?.is_active === true,
        flockIsInBarn,
        barnIsEmpty: barn.is_empty === true,
        canMarkBarnEmpty: flockIsInBarn && isOnOrAfter(flock?.max_date ?? null, today),
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
  maintenance: boolean;
  feedlines: boolean;
  nippleLines: boolean;
  birdHealthAlert: boolean;
  completedTodayLabel: string | null;
}) {
  if (!flags.isActive) {
    return { label: "Inactive", tone: "neutral" as const };
  }

  if (flags.birdHealthAlert) {
    return { label: "Health Alert", tone: "danger" as const };
  }

  if (flags.maintenance || flags.feedlines || flags.nippleLines) {
    return { label: "Needs R&M", tone: "warn" as const };
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

function deriveTileState({
  hasPlacement,
  placementIsActive,
  flockIsInBarn,
}: {
  hasPlacement: boolean;
  placementIsActive: boolean;
  flockIsInBarn: boolean;
}): ActivePlacementRecord["tileState"] {
  if (placementIsActive && flockIsInBarn) {
    return "live";
  }

  if (placementIsActive) {
    return "awaiting";
  }

  if (hasPlacement) {
    return "scheduled";
  }

  return "empty";
}

function formatCompletionBadgeLabel(timestamp: string | null, today: string) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (date.toISOString().slice(0, 10) !== today) {
    return null;
  }

  return `Done ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
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
