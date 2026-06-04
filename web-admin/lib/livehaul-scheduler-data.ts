import { unstable_noStore as noStore } from "next/cache";

import type { PlacementLifecycleStage } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type LivehaulSchedulerFarm = {
  id: string;
  farmName: string;
  farmGroupName: string;
  farmGroupId: string | null;
};

export type LivehaulSchedulerBarn = {
  id: string;
  farmId: string;
  barnCode: string;
  isActive: boolean;
};

export type LivehaulSchedulerPlacement = {
  id: string;
  barnId: string;
  farmId: string;
  flockId: string;
  placementCode: string;
  flockCode: string;
  lifecycleStage: PlacementLifecycleStage;
  startDate: string | null;
  endDate: string | null;
  removedDate: string | null;
};

export type LivehaulScheduleRow = {
  livehaulId: string;
  placementId: string;
  barnId: string;
  farmId: string;
  flockId: string;
  placementCode: string;
  flockCode: string;
  barnCode: string;
  farmName: string;
  lhDate: string;
  sequenceNum: number | null;
  actualDate: string | null;
  actualAt: string | null;
  targetSex: "male" | "female" | null;
  headTarget: number | null;
  headActual: number | null;
  status: "scheduled" | "completed" | "cancelled" | "legacy_migrated";
  comment: string | null;
  loadCount: number;
  loadHeadCountTotal: number;
  loadDoaCountTotal: number;
  loads: LivehaulLoadRow[];
};

export type LivehaulLoadRow = {
  loadId: string;
  livehaulId: string;
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

export type LivehaulSchedulerBundle = {
  farms: LivehaulSchedulerFarm[];
  barnsByFarmId: Record<string, LivehaulSchedulerBarn[]>;
  placementsByBarnId: Record<string, LivehaulSchedulerPlacement[]>;
  schedulesByBarnId: Record<string, LivehaulScheduleRow[]>;
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
  flock_number: number | null;
  date_placed: string | null;
  max_date: string | null;
};

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  placement_key: string | null;
  lifecycle_stage: PlacementLifecycleStage | null;
  active_start: string | null;
  active_end: string | null;
  date_removed: string | null;
};

type LivehaulScheduleDbRow = {
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

type LivehaulLoadDbRow = {
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

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
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

export async function getLivehaulSchedulerBundle(options?: {
  selectedFarmId?: string | null;
  selectedBarnId?: string | null;
}): Promise<LivehaulSchedulerBundle> {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      farms: [],
      barnsByFarmId: {},
      placementsByBarnId: {},
      schedulesByBarnId: {},
    };
  }

  const selectedFarmId = normalize(options?.selectedFarmId);
  const selectedBarnId = normalize(options?.selectedBarnId);
  const scopeToFarm = Boolean(selectedFarmId);
  const scopeToSingleBarn = Boolean(selectedBarnId);

  const [farmsResult, barnsResult, flocksResult, placementsResult, livehaulScheduleResult, livehaulLoadsResult] =
    await Promise.all([
      supabase.from("farms_ui").select("id,farm_name,farm_group_name,farm_group_id").order("farm_name"),
      selectedFarmId
        ? supabase.from("barns").select("id,farm_id,barn_code,sort_code,is_active").eq("farm_id", selectedFarmId)
        : Promise.resolve({ data: [], error: null }),
      scopeToFarm
        ? supabase.from("flocks").select("id,flock_number,date_placed,max_date")
        : Promise.resolve({ data: [], error: null }),
      scopeToSingleBarn
        ? supabase
            .from("placements")
            .select("id,farm_id,barn_id,flock_id,placement_key,lifecycle_stage,active_start,active_end,date_removed")
            .eq("barn_id", selectedBarnId)
            .neq("lifecycle_stage", "archived")
            .order("active_start", { ascending: false, nullsFirst: false })
        : scopeToFarm
          ? supabase
              .from("placements")
              .select("id,farm_id,barn_id,flock_id,placement_key,lifecycle_stage,active_start,active_end,date_removed")
              .eq("farm_id", selectedFarmId)
              .neq("lifecycle_stage", "archived")
              .order("active_start", { ascending: false, nullsFirst: false })
        : Promise.resolve({ data: [], error: null }),
      scopeToSingleBarn
        ? supabase
            .from("livehaul_schedule")
            .select("livehaul_id,placement_id,flock_id,farm_id,barn_id,lh_date,sequence_num,actual_date,actual_at,target_sex,head_target,head_actual,status,comment")
            .eq("barn_id", selectedBarnId)
            .order("lh_date", { ascending: false })
        : scopeToFarm
          ? supabase
              .from("livehaul_schedule")
              .select("livehaul_id,placement_id,flock_id,farm_id,barn_id,lh_date,sequence_num,actual_date,actual_at,target_sex,head_target,head_actual,status,comment")
              .eq("farm_id", selectedFarmId)
              .order("lh_date", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      scopeToFarm
        ? supabase
            .from("livehaul_loads")
            .select("load_id,livehaul_id,truck_num,trailer_num,scale_location,scale_empty,scale_loaded,live_weight,head_count,doa_count,comment")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

  const farmRows = (farmsResult.data ?? []) as FarmRow[];
  const barnRows = ((barnsResult.data ?? []) as BarnRow[]).sort((left, right) => {
    const farmCompare = String(left.farm_id).localeCompare(String(right.farm_id));
    return farmCompare !== 0 ? farmCompare : compareBarnRows(left, right);
  });
  const flockRows = (flocksResult.data ?? []) as FlockRow[];
  const placementRows = (placementsResult.data ?? []) as PlacementRow[];
  const livehaulScheduleRows = (livehaulScheduleResult.data ?? []) as LivehaulScheduleDbRow[];
  const livehaulLoadRows = (livehaulLoadsResult.data ?? []) as LivehaulLoadDbRow[];

  const farmById = new Map(farmRows.map((row) => [row.id, row]));
  const barnById = new Map(barnRows.map((row) => [row.id, row]));
  const flockById = new Map(flockRows.map((row) => [row.id, row]));
  const placementById = new Map(placementRows.map((row) => [row.id, row]));

  const loadTotalsByLivehaulId = new Map<
    string,
    { count: number; headTotal: number; doaTotal: number }
  >();
  const loadsByLivehaulId = new Map<string, LivehaulLoadRow[]>();
  for (const row of livehaulLoadRows) {
    const bucket = loadTotalsByLivehaulId.get(row.livehaul_id) ?? { count: 0, headTotal: 0, doaTotal: 0 };
    bucket.count += 1;
    bucket.headTotal += row.head_count ?? 0;
    bucket.doaTotal += row.doa_count ?? 0;
    loadTotalsByLivehaulId.set(row.livehaul_id, bucket);

    const loads = loadsByLivehaulId.get(row.livehaul_id) ?? [];
    loads.push({
      loadId: row.load_id,
      livehaulId: row.livehaul_id,
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
    loadsByLivehaulId.set(row.livehaul_id, loads);
  }

  const farms: LivehaulSchedulerFarm[] = farmRows.map((row) => ({
    id: row.id,
    farmName: row.farm_name ?? "Unnamed Farm",
    farmGroupName: row.farm_group_name ?? "Ungrouped",
    farmGroupId: row.farm_group_id ?? null,
  }));

  const barnsByFarmId = barnRows.reduce<Record<string, LivehaulSchedulerBarn[]>>((acc, row) => {
    acc[row.farm_id] ??= [];
    acc[row.farm_id].push({
      id: row.id,
      farmId: row.farm_id,
      barnCode: row.barn_code ?? "Barn",
      isActive: row.is_active !== false,
    });
    return acc;
  }, {});

  const placementsByBarnId = placementRows.reduce<Record<string, LivehaulSchedulerPlacement[]>>((acc, row) => {
    const flock = flockById.get(row.flock_id);
    acc[row.barn_id] ??= [];
    acc[row.barn_id].push({
      id: row.id,
      barnId: row.barn_id,
      farmId: row.farm_id,
      flockId: row.flock_id,
      placementCode: row.placement_key ?? "Placement",
      flockCode: flock?.flock_number?.toString() ?? "Unknown",
      lifecycleStage: row.lifecycle_stage ?? "scheduled",
      startDate: row.active_start ?? flock?.date_placed ?? null,
      endDate: row.active_end ?? flock?.max_date ?? null,
      removedDate: row.date_removed ?? null,
    });
    return acc;
  }, {});

  for (const barnId of Object.keys(placementsByBarnId)) {
    placementsByBarnId[barnId].sort((left, right) => {
      const leftDate = left.startDate ?? "9999-12-31";
      const rightDate = right.startDate ?? "9999-12-31";
      return leftDate.localeCompare(rightDate) || left.placementCode.localeCompare(right.placementCode);
    });
  }

  const schedulesByBarnId = livehaulScheduleRows.reduce<Record<string, LivehaulScheduleRow[]>>((acc, row) => {
    const placement = placementById.get(row.placement_id);
    const barn = barnById.get(row.barn_id);
    const farm = farmById.get(row.farm_id);
    const flock = flockById.get(row.flock_id);
    const loadTotals = loadTotalsByLivehaulId.get(row.livehaul_id) ?? { count: 0, headTotal: 0, doaTotal: 0 };
    acc[row.barn_id] ??= [];
    acc[row.barn_id].push({
      livehaulId: row.livehaul_id,
      placementId: row.placement_id,
      barnId: row.barn_id,
      farmId: row.farm_id,
      flockId: row.flock_id,
      placementCode: placement?.placement_key ?? "Placement",
      flockCode: flock?.flock_number?.toString() ?? "Unknown",
      barnCode: barn?.barn_code ?? "Barn",
      farmName: farm?.farm_name ?? "Unnamed Farm",
      lhDate: row.lh_date,
      sequenceNum: row.sequence_num,
      actualDate: row.actual_date,
      actualAt: row.actual_at,
      targetSex: row.target_sex,
      headTarget: row.head_target,
      headActual: row.head_actual,
      status: row.status,
      comment: row.comment,
      loadCount: loadTotals.count,
      loadHeadCountTotal: loadTotals.headTotal,
      loadDoaCountTotal: loadTotals.doaTotal,
      loads: loadsByLivehaulId.get(row.livehaul_id) ?? [],
    });
    return acc;
  }, {});

  for (const barnId of Object.keys(schedulesByBarnId)) {
    schedulesByBarnId[barnId].sort((left, right) => {
      return left.lhDate.localeCompare(right.lhDate) ||
        (left.sequenceNum ?? 999).toString().localeCompare((right.sequenceNum ?? 999).toString(), undefined, {
          numeric: true,
        });
    });
  }

  return {
    farms,
    barnsByFarmId,
    placementsByBarnId,
    schedulesByBarnId,
  };
}
