import { getAdminData } from "@/lib/admin-data";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type TodayAtAGlanceFilters = {
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  flockCode?: string | null;
  reportDate?: string | null;
};

type DailyRow = {
  placement_id: string;
  log_date: string;
  age_days: number | null;
  am_temp: number | null;
  set_temp: number | null;
  rel_humidity: number | null;
  water_meter_reading: number | null;
  comment: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  is_active: boolean | null;
};

type MortalityRow = {
  placement_id: string;
  log_date: string;
  dead_female: number | null;
  dead_male: number | null;
  cull_female: number | null;
  cull_male: number | null;
  dead_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  is_active: boolean | null;
};

type WeightRow = {
  placement_id: string;
  log_date: string;
  sex: string | null;
  cnt_weighed: number | null;
  avg_weight: number | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  is_active: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type AppUserRow = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type ReporterStamp = {
  userName: string | null;
  reportedAt: string | null;
};

export type TodayAtAGlanceRow = {
  placementId: string;
  placementCode: string;
  flockCode: string;
  farmGroupName: string;
  farmName: string;
  barnCode: string;
  ageDays: number | null;
  daily: {
    present: boolean;
    tempSummary: string | null;
    humidity: number | null;
    water: number | null;
    comment: string | null;
    reporter: ReporterStamp;
  };
  mortality: {
    present: boolean;
    deadFemale: number;
    deadMale: number;
    cullFemale: number;
    cullMale: number;
    deadReason: string | null;
    reporter: ReporterStamp;
  };
  weight: {
    present: boolean;
    maleAvg: number | null;
    maleCount: number | null;
    femaleAvg: number | null;
    femaleCount: number | null;
    reporter: ReporterStamp;
  };
};

export async function getTodayAtAGlanceReportData(filters: TodayAtAGlanceFilters = {}) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase admin access is required to build the At-a-Glance report.");
  }

  const adminData = await getAdminData();
  const farmGroupId = normalize(filters.farmGroupId);
  const farmId = normalize(filters.farmId);
  const barnId = normalize(filters.barnId);
  const flockCode = normalize(filters.flockCode).toLowerCase();
  const reportDate = normalize(filters.reportDate) || isoDate(new Date());

  const scopedPlacements = adminData.activePlacements.filter((placement) => {
    if (farmGroupId && placement.farmGroupId !== farmGroupId) return false;
    if (farmId && placement.farmId !== farmId) return false;
    if (barnId && placement.barnId !== barnId) return false;
    if (flockCode) {
      const haystack = `${placement.placementCode} ${placement.flockCode}`.toLowerCase();
      if (!haystack.includes(flockCode)) return false;
    }
    return true;
  });

  const placementIds = Array.from(
    new Set(scopedPlacements.map((placement) => placement.placementId).filter(Boolean)),
  );

  if (placementIds.length === 0) {
    return {
      reportDate,
      rows: [] as TodayAtAGlanceRow[],
      totals: {
        placementsWithAnyData: 0,
        dailyCount: 0,
        mortalityCount: 0,
        weightCount: 0,
      },
    };
  }

  const [dailyResult, mortalityResult, weightResult] = await Promise.all([
    admin
      .from("log_daily")
      .select(
        "placement_id,log_date,age_days,am_temp,set_temp,rel_humidity,water_meter_reading,comment,created_at,updated_at,created_by,updated_by,is_active",
      )
      .eq("log_date", reportDate)
      .eq("is_active", true)
      .in("placement_id", placementIds),
    admin
      .from("log_mortality")
      .select(
        "placement_id,log_date,dead_female,dead_male,cull_female,cull_male,dead_reason,created_at,updated_at,created_by,updated_by,is_active",
      )
      .eq("log_date", reportDate)
      .eq("is_active", true)
      .in("placement_id", placementIds),
    admin
      .from("log_weight")
      .select(
        "placement_id,log_date,sex,cnt_weighed,avg_weight,created_at,updated_at,created_by,updated_by,is_active",
      )
      .eq("log_date", reportDate)
      .eq("is_active", true)
      .in("placement_id", placementIds),
  ]);

  if (dailyResult.error || mortalityResult.error || weightResult.error) {
    throw new Error(
      dailyResult.error?.message ??
        mortalityResult.error?.message ??
        weightResult.error?.message ??
        "Today At-a-Glance inputs could not be loaded.",
        
    );
  }

  const dailyRows = (dailyResult.data ?? []) as DailyRow[];
  const mortalityRows = (mortalityResult.data ?? []) as MortalityRow[];
  const weightRows = (weightResult.data ?? []) as WeightRow[];

  const actorIds = Array.from(
    new Set(
      [
        ...dailyRows.flatMap((row) => [row.created_by, row.updated_by]),
        ...mortalityRows.flatMap((row) => [row.created_by, row.updated_by]),
        ...weightRows.flatMap((row) => [row.created_by, row.updated_by]),
      ].filter((value): value is string => Boolean(value && value.trim())),
    ),
  );

  const [profilesResult, appUsersResult] = await Promise.all([
    actorIds.length > 0
      ? admin.from("profiles").select("id,full_name,email").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length > 0
      ? admin.from("app_users").select("user_id,display_name,email").in("user_id", actorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error || appUsersResult.error) {
    throw new Error(
      profilesResult.error?.message ??
        appUsersResult.error?.message ??
        "Today At-a-Glance reporter names could not be loaded.",
    );
  }

  const userNameById = new Map<string, string>();
  for (const row of (profilesResult.data ?? []) as ProfileRow[]) {
    userNameById.set(row.id, normalize(row.full_name) || normalize(row.email) || row.id);
  }
  for (const row of (appUsersResult.data ?? []) as AppUserRow[]) {
    if (!userNameById.has(row.user_id)) {
      userNameById.set(row.user_id, normalize(row.display_name) || normalize(row.email) || row.user_id);
    }
  }

  const dailyByPlacementId = new Map(dailyRows.map((row) => [row.placement_id, row]));
  const mortalityByPlacementId = new Map(mortalityRows.map((row) => [row.placement_id, row]));
  const weightsByPlacementId = new Map<string, WeightRow[]>();
  for (const row of weightRows) {
    const bucket = weightsByPlacementId.get(row.placement_id) ?? [];
    bucket.push(row);
    weightsByPlacementId.set(row.placement_id, bucket);
  }

  const rows = scopedPlacements
    .map((placement) => {
      const daily = dailyByPlacementId.get(placement.placementId) ?? null;
      const mortality = mortalityByPlacementId.get(placement.placementId) ?? null;
      const weights = weightsByPlacementId.get(placement.placementId) ?? [];

      const maleWeight = weights.find((row) => normalize(row.sex).toLowerCase() === "male") ?? null;
      const femaleWeight = weights.find((row) => normalize(row.sex).toLowerCase() === "female") ?? null;
      const latestWeightActorRow = resolveLatestActorRow(weights);

      const row: TodayAtAGlanceRow = {
        placementId: placement.placementId,
        placementCode: placement.placementCode,
        flockCode: placement.flockCode,
        farmGroupName: placement.farmGroupName,
        farmName: placement.farmName,
        barnCode: placement.barnCode,
        ageDays: daily?.age_days ?? maleWeight?.cnt_weighed ?? femaleWeight?.cnt_weighed ? placement.ageDays : placement.ageDays,
        daily: {
          present: Boolean(daily),
          tempSummary: daily ? buildTempSummary(daily.am_temp, daily.set_temp) : null,
          humidity: daily?.rel_humidity ?? null,
          water: daily?.water_meter_reading ?? null,
          comment: normalize(daily?.comment) || null,
          reporter: buildReporterStamp(daily, userNameById),
        },
        mortality: {
          present: Boolean(mortality),
          deadFemale: mortality?.dead_female ?? 0,
          deadMale: mortality?.dead_male ?? 0,
          cullFemale: mortality?.cull_female ?? 0,
          cullMale: mortality?.cull_male ?? 0,
          deadReason: normalize(mortality?.dead_reason) || null,
          reporter: buildReporterStamp(mortality, userNameById),
        },
        weight: {
          present: weights.length > 0,
          maleAvg: maleWeight?.avg_weight ?? null,
          maleCount: maleWeight?.cnt_weighed ?? null,
          femaleAvg: femaleWeight?.avg_weight ?? null,
          femaleCount: femaleWeight?.cnt_weighed ?? null,
          reporter: buildReporterStamp(latestWeightActorRow, userNameById),
        },
      };

      return row;
    })
    .filter((row) => row.daily.present || row.mortality.present || row.weight.present)
    .sort((left, right) => {
      const groupCompare = left.farmGroupName.localeCompare(right.farmGroupName);
      if (groupCompare !== 0) return groupCompare;
      const farmCompare = left.farmName.localeCompare(right.farmName);
      if (farmCompare !== 0) return farmCompare;
      const barnCompare = left.barnCode.localeCompare(right.barnCode, undefined, { numeric: true });
      if (barnCompare !== 0) return barnCompare;
      return left.placementCode.localeCompare(right.placementCode, undefined, { numeric: true });
    });

  return {
    reportDate,
    rows,
    totals: {
      placementsWithAnyData: rows.length,
      dailyCount: rows.filter((row) => row.daily.present).length,
      mortalityCount: rows.filter((row) => row.mortality.present).length,
      weightCount: rows.filter((row) => row.weight.present).length,
    },
  };
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTempSummary(amTemp: number | null, setTemp: number | null) {
  if (amTemp === null && setTemp === null) return null;
  return `AM ${formatNumber(amTemp)} / Set ${formatNumber(setTemp)}`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function buildReporterStamp(
  row:
    | {
        created_at?: string | null;
        updated_at?: string | null;
        created_by?: string | null;
        updated_by?: string | null;
      }
    | null,
  userNameById: Map<string, string>,
): ReporterStamp {
  if (!row) {
    return { userName: null, reportedAt: null };
  }

  const actorId = normalize(row.updated_by) || normalize(row.created_by) || null;
  const reportedAt = normalize(row.updated_at) || normalize(row.created_at) || null;

  return {
    userName: actorId ? userNameById.get(actorId) ?? actorId : null,
    reportedAt,
  };
}

function resolveLatestActorRow<T extends { updated_at: string | null; created_at: string | null }>(rows: T[]) {
  return rows
    .slice()
    .sort((left, right) => {
      const leftStamp = normalize(left.updated_at) || normalize(left.created_at);
      const rightStamp = normalize(right.updated_at) || normalize(right.created_at);
      return rightStamp.localeCompare(leftStamp);
    })[0] ?? null;
}
