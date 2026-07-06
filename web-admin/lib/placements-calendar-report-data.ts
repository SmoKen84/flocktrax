import { unstable_noStore as noStore } from "next/cache";

import { clampDateRange, collectMonthKeys, type CalendarBadge } from "@/lib/report-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { PlacementLifecycleStage } from "@/lib/types";

type PlacementReportVariant = "quick" | "detailed";

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  placement_key: string | null;
  lifecycle_stage: PlacementLifecycleStage | null;
  date_removed: string | null;
  active_start: string | null;
  active_end: string | null;
  lh1_date: string | null;
  lh2_date: string | null;
  lh3_date: string | null;
};

type FlockRow = {
  id: string;
  flock_number: number | null;
  date_placed: string | null;
  female_date_placed: string | null;
  male_date_placed: string | null;
  max_date: string | null;
  start_cnt_females: number | null;
  start_cnt_males: number | null;
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

type CloseoutRow = {
  placement_id: string;
  status: "draft" | "submitted" | "settlement_received" | "archived";
  processed_head_final: number | null;
  live_weight_final: number | null;
  feed_consumed_total_lbs: number | null;
  feed_conversion: number | null;
  breed_stat_comparison: Record<string, unknown> | null;
};

type LivehaulRow = {
  placement_id: string;
  lh_date: string;
};

export type PlacementCalendarReportRow = {
  placementId: string;
  flockId: string;
  monthKey: string;
  reportDate: string;
  placedDate: string;
  lifecycleStage: PlacementLifecycleStage;
  farmGroupId: string | null;
  farmGroupName: string;
  farmId: string;
  farmName: string;
  barnId: string;
  barnCode: string;
  placementCode: string;
  flockCode: string;
  projectedEndDate: string | null;
  dateRemoved: string | null;
  headPlaced: number | null;
  femalePlacedDate: string | null;
  malePlacedDate: string | null;
  femaleHeadPlaced: number | null;
  maleHeadPlaced: number | null;
  estFirstLivehaul: string | null;
  closeoutStatus: string | null;
  processedHeadFinal: number | null;
  averageHeadWeight: number | null;
  feedConsumedTotalLbs: number | null;
  feedConversion: number | null;
};

export type PlacementCalendarReportMonth = {
  monthKey: string;
  rows: PlacementCalendarReportRow[];
  badgesByDate: Map<string, CalendarBadge[]>;
};

export type PlacementCalendarReportData = {
  variant: PlacementReportVariant;
  reportTitle: string;
  reportDateLabel: string;
  scopeLabel: string;
  startDate: string;
  endDate: string;
  months: PlacementCalendarReportMonth[];
  monthKeys: string[];
  totals: {
    placements: number;
    headPlaced: number;
    processedHead: number;
    feedConsumed: number;
  };
};

export async function getPlacementsCalendarReportData(options: {
  variant: PlacementReportVariant;
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
      reportTitle: "Placements Report",
      reportDateLabel: `${startDate || "--"} to ${endDate || "--"}`,
      scopeLabel: buildScopeLabel(options),
      startDate,
      endDate,
      months: [],
      monthKeys,
      totals: { placements: 0, headPlaced: 0, processedHead: 0, feedConsumed: 0 },
    } satisfies PlacementCalendarReportData;
  }

  let placementsQuery = supabase
    .from("placements")
    .select("id,farm_id,barn_id,flock_id,placement_key,lifecycle_stage,date_removed,active_start,active_end,lh1_date,lh2_date,lh3_date")
    .order("active_start", { ascending: true });

  if (options.farmId) {
    placementsQuery = placementsQuery.eq("farm_id", options.farmId);
  }
  if (options.barnId) {
    placementsQuery = placementsQuery.eq("barn_id", options.barnId);
  }

  const placementsResult = await placementsQuery;
  const placements = (placementsResult.data ?? []) as PlacementRow[];
  const placementIds = Array.from(new Set(placements.map((row) => row.id).filter(Boolean)));
  const flockIds = Array.from(new Set(placements.map((row) => row.flock_id).filter(Boolean)));
  const farmIds = Array.from(new Set(placements.map((row) => row.farm_id).filter(Boolean)));
  const barnIds = Array.from(new Set(placements.map((row) => row.barn_id).filter(Boolean)));

  const [flocksResult, farmsResult, barnsResult, closeoutsResult, livehaulResult] = await Promise.all([
    flockIds.length > 0
      ? supabase
          .from("flocks")
          .select("id,flock_number,date_placed,female_date_placed,male_date_placed,max_date,start_cnt_females,start_cnt_males")
          .in("id", flockIds)
      : Promise.resolve({ data: [], error: null }),
    farmIds.length > 0
      ? supabase.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").in("id", farmIds)
      : Promise.resolve({ data: [], error: null }),
    barnIds.length > 0
      ? supabase.from("barns").select("id,barn_code").in("id", barnIds)
      : Promise.resolve({ data: [], error: null }),
    options.variant === "detailed" && placementIds.length > 0
      ? supabase
          .from("placement_closeouts")
          .select("placement_id,status,processed_head_final,live_weight_final,feed_consumed_total_lbs,feed_conversion,breed_stat_comparison")
          .in("placement_id", placementIds)
      : Promise.resolve({ data: [], error: null }),
    placementIds.length > 0
      ? supabase
          .from("livehaul_schedule")
          .select("placement_id,lh_date")
          .in("placement_id", placementIds)
          .order("lh_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const flocks = (flocksResult.data ?? []) as FlockRow[];
  const farms = (farmsResult.data ?? []) as FarmRow[];
  const barns = (barnsResult.data ?? []) as BarnRow[];
  const closeouts = (closeoutsResult.data ?? []) as CloseoutRow[];
  const livehaulRows = (livehaulResult.data ?? []) as LivehaulRow[];

  const flockById = new Map(flocks.map((row) => [row.id, row]));
  const farmById = new Map(farms.map((row) => [row.id, row]));
  const barnById = new Map(barns.map((row) => [row.id, row]));
  const closeoutByPlacementId = new Map(closeouts.map((row) => [row.placement_id, row]));
  const firstLivehaulByPlacementId = new Map<string, string>();

  for (const row of livehaulRows) {
    if (!firstLivehaulByPlacementId.has(row.placement_id)) {
      firstLivehaulByPlacementId.set(row.placement_id, row.lh_date);
    }
  }

  const rows = placements
    .map((row) => {
      const flock = flockById.get(row.flock_id);
      const farm = farmById.get(row.farm_id);
      const barn = barnById.get(row.barn_id);
      const closeout = closeoutByPlacementId.get(row.id);
      const placedDate = row.active_start ?? flock?.date_placed ?? "";
      const reportDate =
        options.variant === "detailed"
          ? row.date_removed ?? placedDate
          : placedDate;
      const flockNumber = flock?.flock_number?.toString() ?? "";
      const flockCode = flockNumber ? `${flockNumber}-${barn?.barn_code ?? ""}` : `--${barn?.barn_code ?? ""}`;
      const headPlaced = (flock?.start_cnt_females ?? 0) + (flock?.start_cnt_males ?? 0) || null;
      const actualAvgFromComparison = readBreedActualAverage(closeout?.breed_stat_comparison ?? null);
      const derivedAverageHeadWeight =
        actualAvgFromComparison ??
        deriveAverageHeadWeight(closeout?.live_weight_final ?? null, closeout?.processed_head_final ?? null);

      return {
        placementId: row.id,
        flockId: row.flock_id,
        monthKey: reportDate.slice(0, 7),
        reportDate,
        placedDate,
        lifecycleStage: row.lifecycle_stage ?? "scheduled",
        farmGroupId: farm?.farm_group_id ?? null,
        farmGroupName: farm?.farm_group_name ?? "Ungrouped",
        farmId: row.farm_id,
        farmName: farm?.farm_name ?? "Unnamed Farm",
        barnId: row.barn_id,
        barnCode: barn?.barn_code ?? "Barn",
        placementCode: row.placement_key ?? "Placement",
        flockCode,
        projectedEndDate: row.active_end ?? flock?.max_date ?? null,
        dateRemoved: row.date_removed ?? null,
        headPlaced,
        femalePlacedDate: flock?.female_date_placed ?? flock?.date_placed ?? null,
        malePlacedDate: flock?.male_date_placed ?? flock?.date_placed ?? null,
        femaleHeadPlaced: flock?.start_cnt_females ?? null,
        maleHeadPlaced: flock?.start_cnt_males ?? null,
        estFirstLivehaul:
          firstLivehaulByPlacementId.get(row.id) ?? row.lh1_date ?? row.lh2_date ?? row.lh3_date ?? null,
        closeoutStatus: closeout?.status ?? null,
        processedHeadFinal: closeout?.processed_head_final ?? null,
        averageHeadWeight: derivedAverageHeadWeight,
        feedConsumedTotalLbs: closeout?.feed_consumed_total_lbs ?? null,
        feedConversion: closeout?.feed_conversion ?? null,
      } satisfies PlacementCalendarReportRow;
    })
    .filter((row) => {
      if (!row.reportDate) return false;
      if (row.reportDate < startDate || row.reportDate > endDate) return false;
      if (options.farmGroupId && row.farmGroupId !== options.farmGroupId) return false;
      if (options.flockCode && row.flockCode !== options.flockCode) return false;
      return true;
    });

  const months = monthKeys.map((monthKey) => {
    const monthRows = rows.filter((row) => row.monthKey === monthKey);
    const badgesByDate = new Map<string, CalendarBadge[]>();

    for (const row of monthRows) {
      const tone = row.lifecycleStage === "archived" ? "neutral" : row.lifecycleStage === "in_barn_growing" ? "good" : "warn";
      const primaryDate = row.placedDate;
      const femaleDate = row.femalePlacedDate ?? primaryDate;
      const maleDate = row.malePlacedDate ?? primaryDate;
      const femaleCount = row.femaleHeadPlaced ?? 0;
      const maleCount = row.maleHeadPlaced ?? 0;
      const birdsByArrivalDate = new Map<string, number>();

      if (femaleDate && femaleCount > 0) {
        birdsByArrivalDate.set(femaleDate, (birdsByArrivalDate.get(femaleDate) ?? 0) + femaleCount);
      }

      if (maleDate && maleCount > 0) {
        birdsByArrivalDate.set(maleDate, (birdsByArrivalDate.get(maleDate) ?? 0) + maleCount);
      }

      if (birdsByArrivalDate.size === 0 && primaryDate) {
        birdsByArrivalDate.set(primaryDate, row.headPlaced ?? 0);
      }

      for (const [arrivalDate, arrivalCount] of birdsByArrivalDate.entries()) {
        const badges = badgesByDate.get(arrivalDate) ?? [];
        badges.push({
          label:
            arrivalCount > 0
              ? `${row.flockCode}\n${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(arrivalCount)} birds`
              : row.flockCode,
          tone,
        });
        badgesByDate.set(arrivalDate, badges.slice(0, 4));
      }
    }

    return {
      monthKey,
      rows: monthRows,
      badgesByDate,
    } satisfies PlacementCalendarReportMonth;
  });

  return {
    variant: options.variant,
    reportTitle: "Placements Report",
    reportDateLabel: `${startDate} to ${endDate}`,
    scopeLabel: buildScopeLabel(options),
    startDate,
    endDate,
    months,
    monthKeys,
    totals: {
      placements: rows.length,
      headPlaced: rows.reduce((sum, row) => sum + (row.headPlaced ?? 0), 0),
      processedHead: rows.reduce((sum, row) => sum + (row.processedHeadFinal ?? 0), 0),
      feedConsumed: rows.reduce((sum, row) => sum + (row.feedConsumedTotalLbs ?? 0), 0),
    },
  } satisfies PlacementCalendarReportData;
}

function deriveAverageHeadWeight(liveWeightFinal: number | null, processedHeadFinal: number | null) {
  if (
    liveWeightFinal === null ||
    processedHeadFinal === null ||
    !Number.isFinite(liveWeightFinal) ||
    !Number.isFinite(processedHeadFinal) ||
    processedHeadFinal <= 0
  ) {
    return null;
  }

  return liveWeightFinal / processedHeadFinal;
}

function readBreedActualAverage(value: Record<string, unknown> | null) {
  if (!value) return null;
  const record = value as { actual_avg_weight?: unknown };
  const parsed = Number(record.actual_avg_weight);
  return Number.isFinite(parsed) ? parsed : null;
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
