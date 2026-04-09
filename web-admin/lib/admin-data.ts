import { unstable_noStore as noStore } from "next/cache";

import type {
  ActivePlacementRecord,
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
        .select("id,farm_id,barn_code,sqft,stdroc_head,is_active,active_flock_id,is_empty")
        .order("barn_code"),
      supabase
        .from("flocks")
        .select(
          "id,farm_id,flock_number,date_placed,max_date,start_cnt_females,start_cnt_males,is_active,is_complete,is_in_barn,is_settled,breed_males,breed_females",
        )
        .order("date_placed", { ascending: false }),
      supabase
        .from("placements")
        .select("id,farm_id,barn_id,flock_id,date_removed,is_active,placement_key")
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
    const barnRows = (barnsResult.data ?? []) as BarnRow[];
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

    const flocks: FlockRecord[] = flockRows.map((row) => ({
      id: row.id,
      flockCode: row.flock_number?.toString() ?? "Unknown",
      integrator: inferFlockIntegrator(row.farm_id, farmRows, farmGroups),
      placedDate: row.date_placed ?? "",
      estimatedFirstCatch: row.max_date ?? addDays(row.date_placed, 38),
      femaleCount: row.start_cnt_females ?? 0,
      maleCount: row.start_cnt_males ?? 0,
      status: row.is_complete ? "complete" : row.is_active ? "active" : "scheduled",
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

    const latestWeightByPlacement = new Map<
      string,
      {
        female: { avgWeight: number | null; count: number | null; logDate: string | null };
        male: { avgWeight: number | null; count: number | null; logDate: string | null };
      }
    >();
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

      const bucket = latestWeightByPlacement.get(row.placement_id) ?? {
        female: { avgWeight: null, count: null, logDate: null },
        male: { avgWeight: null, count: null, logDate: null },
      };

      if (!bucket[sexKey].logDate) {
        bucket[sexKey] = {
          avgWeight: row.avg_weight ?? null,
          count: row.cnt_weighed ?? null,
          logDate: row.log_date,
        };
      }

      latestWeightByPlacement.set(row.placement_id, bucket);
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

    const activePlacements: ActivePlacementRecord[] = activePlacementsRaw.map((row) => {
      const farm = farmById.get(row.farm_id);
      const barn = barnById.get(row.barn_id);
      const flock = flockById.get(row.flock_id);
      const farmGroup = farm?.farm_group_id ? groupById.get(farm.farm_group_id) : null;
      const latestLogDate = latestLogByPlacement.get(row.id) ?? null;
      const submissionStatus = deriveSubmissionStatus(latestLogDate, today);
      const completionPercent =
        submissionStatus === "submitted" ? 100 : submissionStatus === "pending" ? 80 : 55;
      const placedDate = flock?.date_placed ?? "";
      const mortalityTotals = mortalityTotalsByPlacement.get(row.id) ?? {
        femaleTotal: 0,
        maleTotal: 0,
        femaleFirst7Days: 0,
        maleFirst7Days: 0,
        femaleLast7Days: 0,
        maleLast7Days: 0,
      };
      const weightSummary = latestWeightByPlacement.get(row.id) ?? {
        female: { avgWeight: null, count: null, logDate: null },
        male: { avgWeight: null, count: null, logDate: null },
      };
      const dailyFlags = dailyFlagsByPlacement.get(row.id) ?? {
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
      const dashboardStatus = deriveDashboardStatus({
        isActive: row.is_active === true,
        maintenance: dailyFlags.maintenance,
        feedlines: dailyFlags.feedlines,
        nippleLines: dailyFlags.nippleLines,
        birdHealthAlert: dailyFlags.birdHealthAlert,
        completedTodayLabel: dailyFlags.completedTodayLabel,
      });

      return {
        id: row.id,
        placementCode: row.placement_key,
        placementId: row.id,
        farmGroupId: farm?.farm_group_id ?? "ungrouped",
        farmGroupName: farmGroup?.groupName ?? farm?.farm_group_name ?? "Ungrouped",
        farmId: row.farm_id,
        farmName: farm?.farm_name ?? "Unnamed Farm",
        barnId: row.barn_id,
        barnCode: barn?.barn_code ?? "Barn",
        flockCode: flock?.flock_number?.toString() ?? "Unknown",
        integrator: farmGroup?.integrator ?? "Not set",
        placedDate,
        estimatedFirstCatch: flock?.max_date ?? addDays(placedDate, 38),
        ageDays: daysSince(placedDate),
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
        hasWeightData: !!(weightSummary.female.logDate || weightSummary.male.logDate),
      };
    });

    return {
      stats: {
        activePlacements: activePlacements.length,
        farmsOnline: farms.filter((farm) => farm.status !== "inactive").length,
        barnsReady: barnRows.filter((barn) => barn.is_active !== false).length,
        flocksInCycle: flocks.filter((flock) => flock.status === "active").length,
      },
      alerts: buildAlerts(activePlacements),
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
