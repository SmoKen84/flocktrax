import { unstable_noStore as noStore } from "next/cache";

import { clampDateRange, collectMonthKeys, type CalendarBadge } from "@/lib/report-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type LivehaulReportVariant = "quick" | "detailed";

type LivehaulScheduleRow = {
  livehaul_id: string;
  placement_id: string;
  flock_id: string;
  farm_id: string;
  barn_id: string;
  lh_date: string;
  sequence_num: number | null;
  actual_date: string | null;
  actual_at: string | null;
  target_sex: "male" | "female" | null;
  head_target: number | null;
  head_actual: number | null;
  status: "scheduled" | "completed" | "cancelled" | "legacy_migrated";
  comment: string | null;
};

type LivehaulLoadRow = {
  load_id: string;
  livehaul_id: string;
  truck_num: string | null;
  trailer_num: string | null;
  scale_location: string | null;
  scale_empty: number | null;
  scale_loaded: number | null;
  live_weight: number | null;
  head_count: number | null;
  doa_count: number | null;
  comment: string | null;
};

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  placement_key: string | null;
  active_start: string | null;
};

type FlockRow = {
  id: string;
  flock_number: number | null;
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

export type LivehaulCalendarReportLoad = {
  loadId: string;
  truckNum: string | null;
  trailerNum: string | null;
  scaleLocation: string | null;
  scaleEmpty: number | null;
  scaleLoaded: number | null;
  liveWeight: number | null;
  headCount: number | null;
  doaCount: number | null;
  comment: string | null;
};

export type LivehaulCalendarReportRow = {
  livehaulId: string;
  placementId: string;
  flockId: string;
  monthKey: string;
  livehaulDate: string;
  sequenceNum: number | null;
  actualDate: string | null;
  actualAt: string | null;
  targetSex: "male" | "female" | null;
  headTarget: number | null;
  headActual: number | null;
  status: "scheduled" | "completed" | "cancelled" | "legacy_migrated";
  comment: string | null;
  farmGroupId: string | null;
  farmGroupName: string;
  farmId: string;
  farmName: string;
  barnId: string;
  barnCode: string;
  placementCode: string;
  flockCode: string;
  startDate: string | null;
  loadCount: number;
  loadHeadCountTotal: number;
  loadDoaCountTotal: number;
  loads: LivehaulCalendarReportLoad[];
};

export type LivehaulCalendarReportMonth = {
  monthKey: string;
  rows: LivehaulCalendarReportRow[];
  badgesByDate: Map<string, CalendarBadge[]>;
};

export type LivehaulCalendarReportData = {
  variant: LivehaulReportVariant;
  reportTitle: string;
  reportDateLabel: string;
  scopeLabel: string;
  startDate: string;
  endDate: string;
  months: LivehaulCalendarReportMonth[];
  monthKeys: string[];
  totals: {
    livehauls: number;
    loadCount: number;
    plannedHead: number;
    actualHead: number;
  };
};

export async function getLivehaulCalendarReportData(options: {
  variant: LivehaulReportVariant;
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  flockCode?: string | null;
  startDate: string;
  endDate: string;
}) {
  noStore();

  const supabase = createSupabaseAdminClient();
  const { startDate, endDate } = clampDateRange(options.startDate, options.endDate);
  const monthKeys = startDate && endDate ? collectMonthKeys(startDate, endDate) : [];

  if (!supabase || !startDate || !endDate) {
    return {
      variant: options.variant,
      reportTitle: buildTitle(options.variant),
      reportDateLabel: `${startDate || "--"} to ${endDate || "--"}`,
      scopeLabel: buildScopeLabel(options),
      startDate,
      endDate,
      months: [],
      monthKeys,
      totals: {
        livehauls: 0,
        loadCount: 0,
        plannedHead: 0,
        actualHead: 0,
      },
    } satisfies LivehaulCalendarReportData;
  }

  let scheduleQuery = supabase
    .from("livehaul_schedule")
    .select("livehaul_id,placement_id,flock_id,farm_id,barn_id,lh_date,sequence_num,actual_date,actual_at,target_sex,head_target,head_actual,status,comment")
    .gte("lh_date", startDate)
    .lte("lh_date", endDate)
    .order("lh_date", { ascending: true })
    .order("sequence_num", { ascending: true, nullsFirst: false });

  if (options.farmId) {
    scheduleQuery = scheduleQuery.eq("farm_id", options.farmId);
  }
  if (options.barnId) {
    scheduleQuery = scheduleQuery.eq("barn_id", options.barnId);
  }

  const scheduleResult = await scheduleQuery;
  const scheduleRows = (scheduleResult.data ?? []) as LivehaulScheduleRow[];

  const placementIds = Array.from(new Set(scheduleRows.map((row) => row.placement_id).filter(Boolean)));
  const flockIds = Array.from(new Set(scheduleRows.map((row) => row.flock_id).filter(Boolean)));
  const farmIds = Array.from(new Set(scheduleRows.map((row) => row.farm_id).filter(Boolean)));
  const barnIds = Array.from(new Set(scheduleRows.map((row) => row.barn_id).filter(Boolean)));
  const livehaulIds = Array.from(new Set(scheduleRows.map((row) => row.livehaul_id).filter(Boolean)));

  const [placementsResult, flocksResult, farmsResult, barnsResult, loadsResult] = await Promise.all([
    placementIds.length > 0
      ? supabase.from("placements").select("id,farm_id,barn_id,flock_id,placement_key,active_start").in("id", placementIds)
      : Promise.resolve({ data: [], error: null }),
    flockIds.length > 0
      ? supabase.from("flocks").select("id,flock_number").in("id", flockIds)
      : Promise.resolve({ data: [], error: null }),
    farmIds.length > 0
      ? supabase.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").in("id", farmIds)
      : Promise.resolve({ data: [], error: null }),
    barnIds.length > 0
      ? supabase.from("barns").select("id,barn_code").in("id", barnIds)
      : Promise.resolve({ data: [], error: null }),
    options.variant === "detailed" && livehaulIds.length > 0
      ? supabase
          .from("livehaul_loads")
          .select("load_id,livehaul_id,truck_num,trailer_num,scale_location,scale_empty,scale_loaded,live_weight,head_count,doa_count,comment")
          .in("livehaul_id", livehaulIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const placements = (placementsResult.data ?? []) as PlacementRow[];
  const flocks = (flocksResult.data ?? []) as FlockRow[];
  const farms = (farmsResult.data ?? []) as FarmRow[];
  const barns = (barnsResult.data ?? []) as BarnRow[];
  const loads = (loadsResult.data ?? []) as LivehaulLoadRow[];

  const placementById = new Map(placements.map((row) => [row.id, row]));
  const flockById = new Map(flocks.map((row) => [row.id, row]));
  const farmById = new Map(farms.map((row) => [row.id, row]));
  const barnById = new Map(barns.map((row) => [row.id, row]));
  const loadsByLivehaulId = new Map<string, LivehaulCalendarReportLoad[]>();
  const loadTotalsByLivehaulId = new Map<string, { count: number; head: number; doa: number }>();

  for (const row of loads) {
    const bucket = loadsByLivehaulId.get(row.livehaul_id) ?? [];
    bucket.push({
      loadId: row.load_id,
      truckNum: row.truck_num,
      trailerNum: row.trailer_num,
      scaleLocation: row.scale_location,
      scaleEmpty: row.scale_empty,
      scaleLoaded: row.scale_loaded,
      liveWeight: row.live_weight,
      headCount: row.head_count,
      doaCount: row.doa_count,
      comment: row.comment,
    });
    loadsByLivehaulId.set(row.livehaul_id, bucket);

    const totals = loadTotalsByLivehaulId.get(row.livehaul_id) ?? { count: 0, head: 0, doa: 0 };
    totals.count += 1;
    totals.head += row.head_count ?? 0;
    totals.doa += row.doa_count ?? 0;
    loadTotalsByLivehaulId.set(row.livehaul_id, totals);
  }

  const rows = scheduleRows
    .map((row) => {
      const placement = placementById.get(row.placement_id);
      const flock = flockById.get(row.flock_id);
      const farm = farmById.get(row.farm_id);
      const barn = barnById.get(row.barn_id);
      const loadTotals = loadTotalsByLivehaulId.get(row.livehaul_id) ?? { count: 0, head: 0, doa: 0 };
      const flockCode = flock?.flock_number?.toString() ?? "";

      return {
        livehaulId: row.livehaul_id,
        placementId: row.placement_id,
        flockId: row.flock_id,
        monthKey: row.lh_date.slice(0, 7),
        livehaulDate: row.lh_date,
        sequenceNum: row.sequence_num,
        actualDate: row.actual_date,
        actualAt: row.actual_at,
        targetSex: row.target_sex,
        headTarget: row.head_target,
        headActual: row.head_actual,
        status: row.status,
        comment: row.comment,
        farmGroupId: farm?.farm_group_id ?? null,
        farmGroupName: farm?.farm_group_name ?? "Ungrouped",
        farmId: row.farm_id,
        farmName: farm?.farm_name ?? "Unnamed Farm",
        barnId: row.barn_id,
        barnCode: barn?.barn_code ?? "Barn",
        placementCode: placement?.placement_key ?? "Placement",
        flockCode: flockCode ? `${flockCode}-${barn?.barn_code ?? ""}` : `--${barn?.barn_code ?? ""}`,
        startDate: placement?.active_start ?? null,
        loadCount: loadTotals.count,
        loadHeadCountTotal: loadTotals.head,
        loadDoaCountTotal: loadTotals.doa,
        loads: loadsByLivehaulId.get(row.livehaul_id) ?? [],
      } satisfies LivehaulCalendarReportRow;
    })
    .filter((row) => {
      if (options.farmGroupId && row.farmGroupId !== options.farmGroupId) return false;
      if (options.flockCode && row.flockCode !== options.flockCode) return false;
      return true;
    });

  const months = monthKeys.map((monthKey) => {
    const monthRows = rows.filter((row) => row.monthKey === monthKey);
    const badgesByDate = new Map<string, CalendarBadge[]>();

    for (const row of monthRows) {
      const badges = badgesByDate.get(row.livehaulDate) ?? [];
      badges.push({
        label: `${row.barnCode}-${row.sequenceNum ?? "?"}`,
        tone: row.status === "completed" ? "good" : row.status === "cancelled" ? "danger" : "neutral",
      });
      badgesByDate.set(row.livehaulDate, badges.slice(0, 3));
    }

    return {
      monthKey,
      rows: monthRows,
      badgesByDate,
    } satisfies LivehaulCalendarReportMonth;
  });

  return {
    variant: options.variant,
    reportTitle: buildTitle(options.variant),
    reportDateLabel: `${startDate} to ${endDate}`,
    scopeLabel: buildScopeLabel(options),
    startDate,
    endDate,
    months,
    monthKeys,
    totals: {
      livehauls: rows.length,
      loadCount: rows.reduce((sum, row) => sum + row.loadCount, 0),
      plannedHead: rows.reduce((sum, row) => sum + (row.headTarget ?? 0), 0),
      actualHead: rows.reduce((sum, row) => sum + (row.headActual ?? 0), 0),
    },
  } satisfies LivehaulCalendarReportData;
}

function buildTitle(variant: LivehaulReportVariant) {
  return variant === "quick" ? "Livehaul Report" : "Livehaul Report";
}

function buildScopeLabel(options: {
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  flockCode?: string | null;
}) {
  if (options.flockCode) return `Flock ${options.flockCode}`;
  if (options.barnId) return "Single Barn";
  if (options.farmId) return "Single Farm";
  if (options.farmGroupId) return "Farm Group";
  return "All Farms";
}
