import { unstable_noStore as noStore } from "next/cache";

import type { PlacementLifecycleStage } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PlacementCloseoutRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  placement_key: string;
  lifecycle_stage: PlacementLifecycleStage;
  date_removed: string | null;
  active_start: string | null;
  created_at: string | null;
};

type FlockCloseoutRow = {
  id: string;
  flock_number: number | null;
  date_placed: string | null;
  max_date: string | null;
  start_cnt_females: number | null;
  start_cnt_males: number | null;
  is_complete: boolean | null;
  breed_males: string | null;
  breed_females: string | null;
};

type FarmCloseoutRow = {
  id: string;
  farm_name: string | null;
  farm_group_id: string | null;
  farm_group_name: string | null;
};

type BarnCloseoutRow = {
  id: string;
  barn_code: string | null;
};

type ActivityCloseoutRow = {
  placement_id: string | null;
  occurred_at: string | null;
  details: string | null;
  action_key: string | null;
};

type IssueCloseoutRow = {
  entity_type: string | null;
  entity_id: string | null;
  status: string | null;
};

type MortalityCloseoutRow = {
  placement_id: string;
  log_date: string | null;
  dead_female: number | null;
  dead_male: number | null;
  cull_female: number | null;
  cull_male: number | null;
};

type PlacementCloseoutRecordRow = {
  closeout_id: string;
  placement_id: string;
  status: "draft" | "submitted" | "settlement_received" | "archived";
  processed_head_final: number | null;
  live_weight_final: number | null;
  feed_delivered_total_lbs: number | null;
  feed_remaining_credit_lbs: number | null;
  feed_consumed_total_lbs: number | null;
  starter_consumed_lbs: number | null;
  grower_consumed_lbs: number | null;
  feed_per_head_lbs: number | null;
  starter_per_head_lbs: number | null;
  grower_per_head_lbs: number | null;
  feed_conversion: number | null;
  breed_stat_snapshot: Record<string, unknown> | null;
  breed_stat_comparison: Record<string, unknown> | null;
  notes: string | null;
  manual_override_reason: string | null;
  livehaul_complete_at: string | null;
  feed_verified_at: string | null;
  invoice_created_at: string | null;
  closeout_completed_at: string | null;
  submitted_at: string | null;
  settlement_received_at: string | null;
  archived_at: string | null;
};

type FeedDropCloseoutRow = {
  placement_code: string | null;
  drop_weight: number | null;
  type: string | null;
};

type BreedCloseoutRow = {
  id: string;
  breed_name: string | null;
  sex: string | null;
};

type BreedSpecCloseoutRow = {
  geneticname: string | null;
  breedid: string | null;
  age: number | null;
  dayfeedperbird: number | null;
  targetweight: number | null;
};

export type CloseoutQueueStageFilter = "all" | "waiting_closeout" | "closeout_submitted";

export type CloseoutQueueFilters = {
  q?: string | null;
  stage?: CloseoutQueueStageFilter | null;
  farm?: string | null;
  removedFrom?: string | null;
  removedTo?: string | null;
  placement?: string | null;
};

export type CloseoutQueueItem = {
  placementId: string;
  placementCode: string;
  flockId: string;
  flockCode: string;
  lifecycleStage: PlacementLifecycleStage;
  farmId: string;
  farmName: string;
  farmGroupName: string;
  barnId: string;
  barnCode: string;
  placedDate: string | null;
  projectedEndDate: string | null;
  removedDate: string | null;
  headCount: number;
  finalHeadCount: number;
  livehaulHeadCount: number;
  flockIsComplete: boolean;
  latestActivityAt: string | null;
  latestActivityLabel: string | null;
  openPlacementIssueCount: number;
  openBarnIssueCount: number;
  queueTasks: {
    livehaulComplete: boolean;
    feedVerified: boolean;
    invoiceCreated: boolean;
    submitted: boolean;
    settlementReceived: boolean;
    closeoutDone: boolean;
  };
  closeout: PlacementCloseoutWorksheet | null;
  livehauls: CloseoutLivehaulRow[];
};

export type PlacementCloseoutWorksheet = {
  closeoutId: string | null;
  status: "draft" | "submitted" | "settlement_received" | "archived";
  processedHeadFinal: number | null;
  liveWeightFinal: number | null;
  averageHeadWeight: number | null;
  feedDeliveredTotalLbs: number | null;
  feedRemainingCreditLbs: number | null;
  feedConsumedTotalLbs: number | null;
  starterConsumedLbs: number | null;
  growerConsumedLbs: number | null;
  feedPerHeadLbs: number | null;
  starterPerHeadLbs: number | null;
  growerPerHeadLbs: number | null;
  feedConversion: number | null;
  breedExpectedAvgWeight: number | null;
  breedActualAvgWeight: number | null;
  breedWeightPercent: number | null;
  overallLivePercent: number | null;
  femaleMortalityPercent: number | null;
  maleMortalityPercent: number | null;
  first7DayFemaleMortalityPercent: number | null;
  first7DayMaleMortalityPercent: number | null;
  first7DayLivePercent: number | null;
  first7DayFemaleLosses: number;
  first7DayMaleLosses: number;
  first7DayTotalLosses: number;
  first7DayBreakdown: Array<{
    date: string;
    label: string;
    male: number;
    female: number;
  }>;
  removedAgeDays: number | null;
  notes: string | null;
  manualOverrideReason: string | null;
  livehaulComplete: boolean;
  feedVerified: boolean;
  invoiceCreated: boolean;
  submitted: boolean;
  settlementReceived: boolean;
  closeoutCompleted: boolean;
  submittedAt: string | null;
  settlementReceivedAt: string | null;
  archivedAt: string | null;
  derived: {
    processedHead: number | null;
    liveWeight: number | null;
    feedDelivered: number;
    starterDelivered: number;
    growerDelivered: number;
  };
};

export type CloseoutLivehaulLoadRow = {
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

export type CloseoutLivehaulRow = {
  livehaulId: string;
  placementId: string;
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
  breedAgeDays: number | null;
  breedExpectedAvgWeight: number | null;
  breedActualAvgWeight: number | null;
  breedWeightPercent: number | null;
  loads: CloseoutLivehaulLoadRow[];
};

export type CloseoutQueueData = {
  items: CloseoutQueueItem[];
  totals: {
    all: number;
    waitingCloseout: number;
    closeoutSubmitted: number;
    totalBirds: number;
  };
};

type LivehaulScheduleCloseoutRow = {
  livehaul_id: string;
  placement_id: string;
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

type LivehaulLoadCloseoutRow = {
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

export async function getCloseoutQueueData(filters: CloseoutQueueFilters = {}): Promise<CloseoutQueueData> {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Closeout queue could not connect to Supabase.");
  }

  const stageFilter = normalizeStage(filters.stage);
  const stages: PlacementLifecycleStage[] =
    stageFilter === "all" ? ["waiting_closeout", "closeout_submitted"] : [stageFilter];

  const { data: placementData, error: placementError } = await admin
    .from("placements")
    .select("id,farm_id,barn_id,flock_id,placement_key,lifecycle_stage,date_removed,active_start,created_at")
    .in("lifecycle_stage", stages)
    .order("date_removed", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (placementError) {
    throw new Error(`Closeout placements failed to load: ${placementError.message}`);
  }

  const placementRows = (placementData ?? []) as PlacementCloseoutRow[];
  const farmIds = unique(placementRows.map((row) => row.farm_id));
  const barnIds = unique(placementRows.map((row) => row.barn_id));
  const flockIds = unique(placementRows.map((row) => row.flock_id));
  const placementIds = unique(placementRows.map((row) => row.id));

  const [farmResult, barnResult, flockResult, activityResult, issueResult, mortalityResult] = await Promise.all([
    farmIds.length > 0
      ? admin.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").in("id", farmIds)
      : Promise.resolve({ data: [], error: null }),
    barnIds.length > 0
      ? admin.from("barns").select("id,barn_code").in("id", barnIds)
      : Promise.resolve({ data: [], error: null }),
    flockIds.length > 0
      ? admin
          .from("flocks")
          .select("id,flock_number,date_placed,max_date,start_cnt_females,start_cnt_males,is_complete,breed_males,breed_females")
          .in("id", flockIds)
      : Promise.resolve({ data: [], error: null }),
    placementIds.length > 0
      ? admin
          .from("activity_log")
          .select("placement_id,occurred_at,details,action_key")
          .in("placement_id", placementIds)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    placementIds.length > 0 || barnIds.length > 0
      ? admin
          .from("issues")
          .select("entity_type,entity_id,status")
          .eq("status", "open")
          .or(buildIssuesOrFilter(placementIds, barnIds))
      : Promise.resolve({ data: [], error: null }),
    placementIds.length > 0
      ? admin
          .from("log_mortality")
          .select("placement_id,log_date,dead_female,dead_male,cull_female,cull_male")
          .in("placement_id", placementIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (farmResult.error) throw new Error(`Closeout farms failed to load: ${farmResult.error.message}`);
  if (barnResult.error) throw new Error(`Closeout barns failed to load: ${barnResult.error.message}`);
  if (flockResult.error) throw new Error(`Closeout flocks failed to load: ${flockResult.error.message}`);
  if (activityResult.error) throw new Error(`Closeout activity failed to load: ${activityResult.error.message}`);
  if (issueResult.error) throw new Error(`Closeout issues failed to load: ${issueResult.error.message}`);
  if (mortalityResult.error) throw new Error(`Closeout mortality failed to load: ${mortalityResult.error.message}`);

  const allPlacementIds = unique(placementRows.map((row) => row.id));

  const selectedPlacementIds = unique(
    normalize(filters.placement)
      ? placementRows.filter((row) => row.id === normalize(filters.placement)).map((row) => row.id)
      : [],
  );

  const selectedPlacementCodes = unique(
    selectedPlacementIds.length > 0
      ? placementRows.filter((row) => selectedPlacementIds.includes(row.id)).map((row) => row.placement_key)
      : [],
  );

  const [livehaulScheduleResult, livehaulLoadResult, placementCloseoutResult, feedDropResult, breedResult, breedSpecResult] = await Promise.all([
    selectedPlacementIds.length > 0
      ? admin
          .from("livehaul_schedule")
          .select("livehaul_id,placement_id,lh_date,sequence_num,actual_date,actual_at,target_sex,head_target,head_actual,status,comment")
          .in("placement_id", selectedPlacementIds)
          .order("lh_date", { ascending: true })
          .order("sequence_num", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    selectedPlacementIds.length > 0
      ? admin
          .from("livehaul_loads")
          .select("load_id,livehaul_id,truck_num,trailer_num,scale_location,scale_empty,scale_loaded,live_weight,head_count,doa_count,comment")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    allPlacementIds.length > 0
      ? admin
          .from("placement_closeouts")
          .select(
            "closeout_id,placement_id,status,processed_head_final,live_weight_final,feed_delivered_total_lbs,feed_remaining_credit_lbs,feed_consumed_total_lbs,starter_consumed_lbs,grower_consumed_lbs,feed_per_head_lbs,starter_per_head_lbs,grower_per_head_lbs,feed_conversion,breed_stat_snapshot,breed_stat_comparison,notes,manual_override_reason,livehaul_complete_at,feed_verified_at,invoice_created_at,closeout_completed_at,submitted_at,settlement_received_at,archived_at",
          )
          .in("placement_id", allPlacementIds)
      : Promise.resolve({ data: [], error: null }),
    selectedPlacementCodes.length > 0
      ? admin
          .from("feed_drops")
          .select("placement_code,drop_weight,type")
          .in("placement_code", selectedPlacementCodes)
      : Promise.resolve({ data: [], error: null }),
    selectedPlacementIds.length > 0
      ? admin.from("breeds").select("id,breed_name,sex").eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
    selectedPlacementIds.length > 0
      ? admin.from("stdbreedspec").select("geneticname,breedid,age,dayfeedperbird,targetweight").eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (livehaulScheduleResult.error) {
    throw new Error(`Closeout livehauls failed to load: ${livehaulScheduleResult.error.message}`);
  }
  if (livehaulLoadResult.error) {
    throw new Error(`Closeout livehaul loads failed to load: ${livehaulLoadResult.error.message}`);
  }
  if (placementCloseoutResult.error) {
    throw new Error(`Closeout records failed to load: ${placementCloseoutResult.error.message}`);
  }
  if (feedDropResult.error) {
    throw new Error(`Closeout feed rows failed to load: ${feedDropResult.error.message}`);
  }
  if (breedResult.error) {
    throw new Error(`Closeout breeds failed to load: ${breedResult.error.message}`);
  }
  if (breedSpecResult.error) {
    throw new Error(`Closeout breed specs failed to load: ${breedSpecResult.error.message}`);
  }

  const farmById = new Map(((farmResult.data ?? []) as FarmCloseoutRow[]).map((row) => [row.id, row]));
  const barnById = new Map(((barnResult.data ?? []) as BarnCloseoutRow[]).map((row) => [row.id, row]));
  const flockById = new Map(((flockResult.data ?? []) as FlockCloseoutRow[]).map((row) => [row.id, row]));
  const latestActivityByPlacementId = new Map<string, ActivityCloseoutRow>();
  for (const row of (activityResult.data ?? []) as ActivityCloseoutRow[]) {
    if (row.placement_id && !latestActivityByPlacementId.has(row.placement_id)) {
      latestActivityByPlacementId.set(row.placement_id, row);
    }
  }

  const openPlacementIssueCountByPlacementId = new Map<string, number>();
  const openBarnIssueCountByBarnId = new Map<string, number>();
  for (const row of (issueResult.data ?? []) as IssueCloseoutRow[]) {
    if (row.entity_type === "placement" && row.entity_id) {
      openPlacementIssueCountByPlacementId.set(row.entity_id, (openPlacementIssueCountByPlacementId.get(row.entity_id) ?? 0) + 1);
    }
    if (row.entity_type === "barn" && row.entity_id) {
      openBarnIssueCountByBarnId.set(row.entity_id, (openBarnIssueCountByBarnId.get(row.entity_id) ?? 0) + 1);
    }
  }

  const mortalityRowsByPlacementId = new Map<string, MortalityCloseoutRow[]>();
  const mortalityTotalsByPlacementId = new Map<string, number>();
  const femaleLossTotalsByPlacementId = new Map<string, number>();
  const maleLossTotalsByPlacementId = new Map<string, number>();
  for (const row of (mortalityResult.data ?? []) as MortalityCloseoutRow[]) {
    const bucket = mortalityRowsByPlacementId.get(row.placement_id) ?? [];
    bucket.push(row);
    mortalityRowsByPlacementId.set(row.placement_id, bucket);
    const femaleLoss = (row.dead_female ?? 0) + (row.cull_female ?? 0);
    const maleLoss = (row.dead_male ?? 0) + (row.cull_male ?? 0);
    const totalLoss = femaleLoss + maleLoss;
    mortalityTotalsByPlacementId.set(row.placement_id, (mortalityTotalsByPlacementId.get(row.placement_id) ?? 0) + totalLoss);
    femaleLossTotalsByPlacementId.set(row.placement_id, (femaleLossTotalsByPlacementId.get(row.placement_id) ?? 0) + femaleLoss);
    maleLossTotalsByPlacementId.set(row.placement_id, (maleLossTotalsByPlacementId.get(row.placement_id) ?? 0) + maleLoss);
  }

  const livehaulScheduleRows = (livehaulScheduleResult.data ?? []) as LivehaulScheduleCloseoutRow[];
  const livehaulIds = new Set(livehaulScheduleRows.map((row) => row.livehaul_id));
  const loadRows = ((livehaulLoadResult.data ?? []) as LivehaulLoadCloseoutRow[]).filter((row) => livehaulIds.has(row.livehaul_id));
  const placementCloseoutRows = (placementCloseoutResult.data ?? []) as PlacementCloseoutRecordRow[];
  const feedDropRows = (feedDropResult.data ?? []) as FeedDropCloseoutRow[];
  const breedRows = (breedResult.data ?? []) as BreedCloseoutRow[];
  const breedSpecRows = (breedSpecResult.data ?? []) as BreedSpecCloseoutRow[];
  const loadsByLivehaulId = new Map<string, CloseoutLivehaulLoadRow[]>();
  const loadTotalsByLivehaulId = new Map<string, { count: number; headTotal: number; doaTotal: number }>();
  const closeoutByPlacementId = new Map(placementCloseoutRows.map((row) => [row.placement_id, row]));
  const feedTotalsByPlacementCode = new Map<
    string,
    {
      delivered: number;
      starter: number;
      grower: number;
    }
  >();
  const breedById = new Map(breedRows.map((row) => [row.id, row]));

  for (const row of feedDropRows) {
    const placementCode = normalize(row.placement_code);
    if (!placementCode) continue;
    const bucket = feedTotalsByPlacementCode.get(placementCode) ?? { delivered: 0, starter: 0, grower: 0 };
    const pounds = row.drop_weight ?? 0;
    bucket.delivered += pounds;
    const feedType = normalize(row.type).toLowerCase();
    if (feedType === "starter") {
      bucket.starter += pounds;
    } else if (feedType === "grower") {
      bucket.grower += pounds;
    }
    feedTotalsByPlacementCode.set(placementCode, bucket);
  }

  for (const row of loadRows) {
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

    const totals = loadTotalsByLivehaulId.get(row.livehaul_id) ?? { count: 0, headTotal: 0, doaTotal: 0 };
    totals.count += 1;
    totals.headTotal += row.head_count ?? 0;
    totals.doaTotal += row.doa_count ?? 0;
    loadTotalsByLivehaulId.set(row.livehaul_id, totals);
  }

  const livehaulsByPlacementId = new Map<string, CloseoutLivehaulRow[]>();
  for (const row of livehaulScheduleRows) {
    const bucket = livehaulsByPlacementId.get(row.placement_id) ?? [];
    const totals = loadTotalsByLivehaulId.get(row.livehaul_id) ?? { count: 0, headTotal: 0, doaTotal: 0 };
    bucket.push({
      livehaulId: row.livehaul_id,
      placementId: row.placement_id,
      lhDate: row.lh_date,
      sequenceNum: row.sequence_num,
      actualDate: row.actual_date,
      actualAt: row.actual_at,
      targetSex: row.target_sex,
      headTarget: row.head_target,
      headActual: row.head_actual,
      status: row.status,
      comment: row.comment,
      loadCount: totals.count,
      loadHeadCountTotal: totals.headTotal,
      loadDoaCountTotal: totals.doaTotal,
      breedAgeDays: null,
      breedExpectedAvgWeight: null,
      breedActualAvgWeight: null,
      breedWeightPercent: null,
      loads: loadsByLivehaulId.get(row.livehaul_id) ?? [],
    });
    livehaulsByPlacementId.set(row.placement_id, bucket);
  }

  for (const [placementId, rows] of livehaulsByPlacementId.entries()) {
    rows.sort((left, right) => {
      const sequenceCompare = (left.sequenceNum ?? 999) - (right.sequenceNum ?? 999);
      if (sequenceCompare !== 0) return sequenceCompare;
      const dateCompare = left.lhDate.localeCompare(right.lhDate);
      if (dateCompare !== 0) return dateCompare;
      return left.livehaulId.localeCompare(right.livehaulId);
    });
    livehaulsByPlacementId.set(placementId, rows);
  }

  const queryNeedle = normalize(filters.q).toLowerCase();
  const farmNeedle = normalize(filters.farm).toLowerCase();
  const removedFrom = normalize(filters.removedFrom);
  const removedTo = normalize(filters.removedTo);

  const items = placementRows
    .map<CloseoutQueueItem>((row) => {
      const farm = farmById.get(row.farm_id);
      const barn = barnById.get(row.barn_id);
      const flock = flockById.get(row.flock_id);
      const closeout = closeoutByPlacementId.get(row.id) ?? null;
      const latestActivity = latestActivityByPlacementId.get(row.id);
      const startedHeadCount = (flock?.start_cnt_females ?? 0) + (flock?.start_cnt_males ?? 0);
      const finalHeadCount = Math.max(0, startedHeadCount - (mortalityTotalsByPlacementId.get(row.id) ?? 0));
      const femaleStartCount = flock?.start_cnt_females ?? 0;
      const maleStartCount = flock?.start_cnt_males ?? 0;
      const femaleLossTotal = femaleLossTotalsByPlacementId.get(row.id) ?? 0;
      const maleLossTotal = maleLossTotalsByPlacementId.get(row.id) ?? 0;
      const first7DayLosses = calculateFirst7DayLosses(
        mortalityRowsByPlacementId.get(row.id) ?? [],
        flock?.date_placed ?? row.active_start,
      );
      const first7DayBreakdown = buildFirst7DayBreakdown(
        mortalityRowsByPlacementId.get(row.id) ?? [],
        flock?.date_placed ?? row.active_start,
      );
      const feedTotals = feedTotalsByPlacementCode.get(row.placement_key) ?? { delivered: 0, starter: 0, grower: 0 };
      const baseLivehauls = livehaulsByPlacementId.get(row.id) ?? [];
      const remainingCredit = closeout?.feed_remaining_credit_lbs ?? null;
      const starterConsumed = closeout?.starter_consumed_lbs ?? feedTotals.starter;
      const growerConsumed = closeout?.grower_consumed_lbs ?? feedTotals.grower;
      const feedConsumed = closeout?.feed_consumed_total_lbs ?? feedTotals.delivered;
      const livehauls = baseLivehauls.map((livehaul) => {
        const ageDays = calculateAgeDays(flock?.date_placed ?? row.active_start, livehaul.actualDate ?? livehaul.lhDate);
        const expectedAvgWeight = resolveCombinedBreedTargetWeight({
          ageDays,
          breedFemales: flock?.breed_females ?? null,
          breedMales: flock?.breed_males ?? null,
          femaleCount: femaleStartCount,
          maleCount: maleStartCount,
          targetSex: livehaul.targetSex,
          breedById,
          breedSpecRows,
        });
        const actualHead = livehaul.loadHeadCountTotal > 0 ? livehaul.loadHeadCountTotal : (livehaul.headActual ?? 0);
        const actualLiveWeight = livehaul.loads.reduce((sum, load) => sum + (load.liveWeight ?? 0), 0);
        const actualAvgWeight = actualHead > 0 && actualLiveWeight > 0 ? actualLiveWeight / actualHead : null;
        return {
          ...livehaul,
          breedAgeDays: ageDays,
          breedExpectedAvgWeight: expectedAvgWeight,
          breedActualAvgWeight: actualAvgWeight,
          breedWeightPercent: calculateBenchmarkPercent(actualAvgWeight, expectedAvgWeight),
        };
      });
      const derivedProcessedHead = deriveProcessedHeadCount(livehauls, closeout?.processed_head_final ?? null);
      const livehaulHeadCount = livehauls.reduce((sum, livehaul) => sum + livehaul.loadHeadCountTotal, 0);
      const derivedLiveWeight = deriveLiveWeightTotal(livehauls, closeout?.live_weight_final ?? null);
      const processedHeadFinal = derivedProcessedHead;
      const liveWeightFinal = closeout?.live_weight_final ?? derivedLiveWeight;
      const averageHeadWeight =
        processedHeadFinal && processedHeadFinal > 0 && liveWeightFinal !== null ? liveWeightFinal / processedHeadFinal : null;
      const removedAgeDays = calculateAgeDays(flock?.date_placed ?? row.active_start, row.date_removed);
      const weightedBreedComparison = deriveWeightedLivehaulBreedComparison(livehauls);
      const queueTasks = deriveCloseoutQueueTasks({
        lifecycleStage: row.lifecycle_stage,
        closeout,
        livehauls,
      });
      const overallLivePercent = startedHeadCount > 0 ? (finalHeadCount / startedHeadCount) * 100 : null;
      const femaleMortalityPercent = femaleStartCount > 0 ? (femaleLossTotal / femaleStartCount) * 100 : null;
      const maleMortalityPercent = maleStartCount > 0 ? (maleLossTotal / maleStartCount) * 100 : null;
      const first7DayFemaleMortalityPercent =
        femaleStartCount > 0 ? (first7DayLosses.female / femaleStartCount) * 100 : null;
      const first7DayMaleMortalityPercent =
        maleStartCount > 0 ? (first7DayLosses.male / maleStartCount) * 100 : null;
      const first7DayLivePercent =
        startedHeadCount > 0
          ? ((startedHeadCount - (first7DayLosses.female + first7DayLosses.male)) / startedHeadCount) * 100
          : null;
      return {
        placementId: row.id,
        placementCode: row.placement_key,
        flockId: row.flock_id,
        flockCode: flock?.flock_number?.toString() ?? "Unknown",
        lifecycleStage: row.lifecycle_stage,
        farmId: row.farm_id,
        farmName: farm?.farm_name ?? "Unnamed Farm",
        farmGroupName: farm?.farm_group_name ?? "Ungrouped",
        barnId: row.barn_id,
        barnCode: barn?.barn_code ?? "Barn",
        placedDate: flock?.date_placed ?? row.active_start,
        projectedEndDate: flock?.max_date ?? null,
        removedDate: row.date_removed,
        headCount: startedHeadCount,
        finalHeadCount,
        livehaulHeadCount,
        flockIsComplete: flock?.is_complete === true,
        latestActivityAt: latestActivity?.occurred_at ?? null,
        latestActivityLabel: latestActivity?.details ?? latestActivity?.action_key ?? null,
        openPlacementIssueCount: openPlacementIssueCountByPlacementId.get(row.id) ?? 0,
        openBarnIssueCount: openBarnIssueCountByBarnId.get(row.barn_id) ?? 0,
        queueTasks,
        closeout: {
          closeoutId: closeout?.closeout_id ?? null,
          status: closeout?.status ?? "draft",
          processedHeadFinal,
          liveWeightFinal,
          averageHeadWeight,
          feedDeliveredTotalLbs: closeout?.feed_delivered_total_lbs ?? feedTotals.delivered,
          feedRemainingCreditLbs: remainingCredit,
          feedConsumedTotalLbs: feedConsumed,
          starterConsumedLbs: starterConsumed,
          growerConsumedLbs: growerConsumed,
          feedPerHeadLbs:
            closeout?.feed_per_head_lbs ??
            (processedHeadFinal && processedHeadFinal > 0 ? feedConsumed / processedHeadFinal : null),
          starterPerHeadLbs:
            closeout?.starter_per_head_lbs ??
            (processedHeadFinal && processedHeadFinal > 0 ? starterConsumed / processedHeadFinal : null),
          growerPerHeadLbs:
            closeout?.grower_per_head_lbs ??
            (processedHeadFinal && processedHeadFinal > 0 ? growerConsumed / processedHeadFinal : null),
          feedConversion:
            closeout?.feed_conversion ??
            (liveWeightFinal && liveWeightFinal > 0 ? feedConsumed / liveWeightFinal : null),
          breedExpectedAvgWeight: weightedBreedComparison.expectedAvgWeight,
          breedActualAvgWeight: weightedBreedComparison.actualAvgWeight,
          breedWeightPercent: weightedBreedComparison.percentOfTarget,
          overallLivePercent,
          femaleMortalityPercent,
          maleMortalityPercent,
          first7DayFemaleMortalityPercent,
          first7DayMaleMortalityPercent,
          first7DayLivePercent,
          first7DayFemaleLosses: first7DayLosses.female,
          first7DayMaleLosses: first7DayLosses.male,
          first7DayTotalLosses: first7DayLosses.female + first7DayLosses.male,
          first7DayBreakdown,
          removedAgeDays,
          notes: closeout?.notes ?? null,
          manualOverrideReason: closeout?.manual_override_reason ?? null,
          livehaulComplete: closeout?.livehaul_complete_at !== null,
          feedVerified: closeout?.feed_verified_at !== null,
          invoiceCreated: closeout?.invoice_created_at !== null,
          submitted: closeout?.submitted_at !== null,
          settlementReceived: closeout?.settlement_received_at !== null,
          closeoutCompleted: closeout?.closeout_completed_at !== null,
          submittedAt: closeout?.submitted_at ?? null,
          settlementReceivedAt: closeout?.settlement_received_at ?? null,
          archivedAt: closeout?.archived_at ?? null,
          derived: {
            processedHead: derivedProcessedHead,
            liveWeight: derivedLiveWeight,
            feedDelivered: feedTotals.delivered,
            starterDelivered: feedTotals.starter,
            growerDelivered: feedTotals.grower,
          },
        },
        livehauls,
      };
    })
    .filter((item) => {
      if (queryNeedle) {
        const haystack = `${item.placementCode} ${item.flockCode} ${item.farmName} ${item.barnCode}`.toLowerCase();
        if (!haystack.includes(queryNeedle)) return false;
      }

      if (farmNeedle && !item.farmName.toLowerCase().includes(farmNeedle)) {
        return false;
      }

      if (removedFrom && item.removedDate && item.removedDate < removedFrom) {
        return false;
      }

      if (removedTo && item.removedDate && item.removedDate > removedTo) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const stageRank = stageSortRank(left.lifecycleStage) - stageSortRank(right.lifecycleStage);
      if (stageRank !== 0) return stageRank;
      return String(right.removedDate ?? "").localeCompare(String(left.removedDate ?? ""));
    });

  return {
    items,
    totals: {
      all: items.length,
      waitingCloseout: items.filter((item) => item.lifecycleStage === "waiting_closeout").length,
      closeoutSubmitted: items.filter((item) => item.lifecycleStage === "closeout_submitted").length,
      totalBirds: items.reduce((sum, item) => sum + item.headCount, 0),
    },
  };
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.length > 0)));
}

function normalizeStage(value: CloseoutQueueStageFilter | null | undefined): CloseoutQueueStageFilter {
  if (value === "waiting_closeout" || value === "closeout_submitted") {
    return value;
  }
  return "all";
}

function stageSortRank(stage: PlacementLifecycleStage) {
  return stage === "waiting_closeout" ? 0 : stage === "closeout_submitted" ? 1 : 9;
}

function buildIssuesOrFilter(placementIds: string[], barnIds: string[]) {
  const parts: string[] = [];
  if (placementIds.length > 0) {
    parts.push(`and(entity_type.eq.placement,entity_id.in.(${placementIds.join(",")}))`);
  }
  if (barnIds.length > 0) {
    parts.push(`and(entity_type.eq.barn,entity_id.in.(${barnIds.join(",")}))`);
  }
  return parts.join(",");
}

function deriveProcessedHeadCount(livehauls: CloseoutLivehaulRow[], persistedValue: number | null) {
  const loadTotal = livehauls.reduce((sum, row) => sum + row.loadHeadCountTotal, 0);
  if (loadTotal > 0) return loadTotal;
  const actualTotal = livehauls.reduce((sum, row) => sum + (row.headActual ?? 0), 0);
  if (actualTotal > 0) return actualTotal;
  return persistedValue !== null ? persistedValue : null;
}

function deriveLiveWeightTotal(livehauls: CloseoutLivehaulRow[], persistedValue: number | null) {
  if (persistedValue !== null) return persistedValue;
  const total = livehauls.reduce((sum, row) => {
    return (
      sum +
      row.loads.reduce((loadSum, load) => {
        return loadSum + (load.liveWeight ?? 0);
      }, 0)
    );
  }, 0);
  return total > 0 ? total : null;
}

function calculateAgeDays(placedDate: string | null, removedDate: string | null) {
  if (!placedDate || !removedDate) return null;
  const placed = new Date(`${placedDate}T00:00:00`);
  const removed = new Date(`${removedDate}T00:00:00`);
  if (Number.isNaN(placed.getTime()) || Number.isNaN(removed.getTime())) return null;
  return Math.max(0, Math.round((removed.getTime() - placed.getTime()) / 86400000));
}

function calculateFirst7DayLosses(rows: MortalityCloseoutRow[], placedDate: string | null) {
  if (!placedDate) {
    return { female: 0, male: 0 };
  }

  const placed = new Date(`${placedDate}T00:00:00`);
  if (Number.isNaN(placed.getTime())) {
    return { female: 0, male: 0 };
  }

  const end = new Date(placed);
  end.setDate(end.getDate() + 6);

  let female = 0;
  let male = 0;

  for (const row of rows) {
    if (!row.log_date) continue;
    const logDate = new Date(`${row.log_date}T00:00:00`);
    if (Number.isNaN(logDate.getTime())) continue;
    if (logDate < placed || logDate > end) continue;
    female += (row.dead_female ?? 0) + (row.cull_female ?? 0);
    male += (row.dead_male ?? 0) + (row.cull_male ?? 0);
  }

  return { female, male };
}

function buildFirst7DayBreakdown(rows: MortalityCloseoutRow[], placedDate: string | null) {
  if (!placedDate) {
    return [];
  }

  const placed = new Date(`${placedDate}T00:00:00`);
  if (Number.isNaN(placed.getTime())) {
    return [];
  }

  const dayMap = new Map<string, { male: number; female: number }>();
  for (const row of rows) {
    const key = normalize(row.log_date);
    if (!key) continue;
    const bucket = dayMap.get(key) ?? { male: 0, female: 0 };
    bucket.female += (row.dead_female ?? 0) + (row.cull_female ?? 0);
    bucket.male += (row.dead_male ?? 0) + (row.cull_male ?? 0);
    dayMap.set(key, bucket);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(placed);
    current.setDate(current.getDate() + index);
    const key = current.toLocaleDateString("en-CA");
    const bucket = dayMap.get(key) ?? { male: 0, female: 0 };
    return {
      date: key,
      label: current.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      male: bucket.male,
      female: bucket.female,
    };
  });
}

function deriveWeightedLivehaulBreedComparison(livehauls: CloseoutLivehaulRow[]) {
  let expectedWeightTotal = 0;
  let actualWeightTotal = 0;
  let headTotal = 0;

  for (const livehaul of livehauls) {
    const heads = livehaul.loadHeadCountTotal > 0 ? livehaul.loadHeadCountTotal : 0;
    if (heads <= 0) continue;
    if (livehaul.breedExpectedAvgWeight !== null) {
      expectedWeightTotal += livehaul.breedExpectedAvgWeight * heads;
    }
    if (livehaul.breedActualAvgWeight !== null) {
      actualWeightTotal += livehaul.breedActualAvgWeight * heads;
    }
    headTotal += heads;
  }

  const expectedAvgWeight = headTotal > 0 && expectedWeightTotal > 0 ? expectedWeightTotal / headTotal : null;
  const actualAvgWeight = headTotal > 0 && actualWeightTotal > 0 ? actualWeightTotal / headTotal : null;

  return {
    expectedAvgWeight,
    actualAvgWeight,
    percentOfTarget: calculateBenchmarkPercent(actualAvgWeight, expectedAvgWeight),
  };
}

function deriveCloseoutQueueTasks(options: {
  lifecycleStage: PlacementLifecycleStage;
  closeout: PlacementCloseoutRecordRow | null;
  livehauls: CloseoutLivehaulRow[];
}) {
  const closeout = options.closeout;

  return {
    livehaulComplete: closeout?.livehaul_complete_at !== null,
    feedVerified: closeout?.feed_verified_at !== null,
    invoiceCreated: closeout?.invoice_created_at !== null,
    submitted: closeout?.submitted_at !== null,
    settlementReceived: closeout?.settlement_received_at !== null,
    closeoutDone: closeout?.closeout_completed_at !== null,
  };
}

function normalizeBreedText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeBreedSex(value: string | null | undefined) {
  const normalized = normalizeBreedText(value);
  if (normalized.startsWith("m")) return "male";
  if (normalized.startsWith("f")) return "female";
  return normalized || null;
}

function resolveBreedSpecMetric(
  breedId: string | null,
  ageDays: number | null,
  breedById: Map<string, BreedCloseoutRow>,
  breedSpecRows: BreedSpecCloseoutRow[],
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

function resolveCombinedBreedTargetWeight({
  ageDays,
  breedFemales,
  breedMales,
  femaleCount,
  maleCount,
  targetSex,
  breedById,
  breedSpecRows,
}: {
  ageDays: number | null;
  breedFemales: string | null;
  breedMales: string | null;
  femaleCount: number;
  maleCount: number;
  targetSex: "male" | "female" | null;
  breedById: Map<string, BreedCloseoutRow>;
  breedSpecRows: BreedSpecCloseoutRow[];
}) {
  if (targetSex === "female") {
    return resolveBreedSpecMetric(breedFemales, ageDays, breedById, breedSpecRows, "targetweight");
  }

  if (targetSex === "male") {
    return resolveBreedSpecMetric(breedMales, ageDays, breedById, breedSpecRows, "targetweight");
  }

  const femaleTarget = resolveBreedSpecMetric(breedFemales, ageDays, breedById, breedSpecRows, "targetweight");
  const maleTarget = resolveBreedSpecMetric(breedMales, ageDays, breedById, breedSpecRows, "targetweight");
  const totalHead = Math.max(0, femaleCount) + Math.max(0, maleCount);

  if (femaleTarget === null && maleTarget === null) {
    return null;
  }

  if (totalHead <= 0) {
    return femaleTarget ?? maleTarget ?? null;
  }

  return (((femaleTarget ?? 0) * Math.max(0, femaleCount)) + ((maleTarget ?? 0) * Math.max(0, maleCount))) / totalHead;
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
