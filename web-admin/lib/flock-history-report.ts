import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDefaultIssueTypes } from "@/lib/issues";

type FlockRow = {
  id: string;
  farm_id: string | null;
  flock_number: number | null;
  date_placed: string | null;
  max_date: string | null;
  start_cnt_females: number | null;
  start_cnt_males: number | null;
  is_active: boolean | null;
  is_complete: boolean | null;
};

type FarmRow = {
  id: string;
  farm_name: string | null;
  farm_group_name: string | null;
};

type BarnRow = {
  id: string;
  barn_code: string | null;
  sort_code: string | null;
};

type PlacementRow = {
  id: string;
  flock_id: string;
  farm_id: string;
  barn_id: string;
  placement_key: string | null;
  is_active: boolean | null;
  date_removed: string | null;
  active_start: string | null;
  active_end: string | null;
  created_at: string | null;
};

type DailyLogRow = {
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
  is_active: boolean | null;
};

type MortalityLogRow = {
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
  is_active: boolean | null;
};

type IssueRow = {
  id: string;
  entity_type: "barn" | "placement";
  entity_id: string;
  issue_type: string | null;
  title: string | null;
  description: string | null;
  status: "open" | "resolved";
  related_placement_id: string | null;
  reported_log_date: string | null;
  opened_at: string | null;
  opened_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
};

type IssueUpdateRow = {
  id: string;
  issue_id: string;
  entry_type: string | null;
  entry_text: string | null;
  effective_date: string | null;
  created_at: string | null;
  created_by: string | null;
};

type IssueTypeRow = {
  code: string;
  label: string;
};

export type FlockHistoryDailyRow = {
  placementId: string;
  placementCode: string;
  barnCode: string;
  farmName: string;
  logDate: string;
  ageDays: number | null;
  amTemp: number | null;
  setTemp: number | null;
  relHumidity: number | null;
  outsideTempCurrent: number | null;
  outsideTempLow: number | null;
  outsideTempHigh: number | null;
  waterMeterReading: number | null;
  minVent: string | null;
  isOdaOpen: boolean;
  odaException: string | null;
  naoh: string | null;
  comment: string | null;
  dailyIsActive: boolean;
};

export type FlockHistoryMortalityRow = {
  placementId: string;
  placementCode: string;
  barnCode: string;
  farmName: string;
  logDate: string;
  ageDays: number | null;
  deadFemale: number;
  deadMale: number;
  cullFemale: number;
  cullMale: number;
  cullFemaleNote: string | null;
  cullMaleNote: string | null;
  deadReason: string | null;
  gradeLitter: number | null;
  gradeFootpad: number | null;
  gradeFeathers: number | null;
  gradeLame: number | null;
  gradePecking: number | null;
  mortalityIsActive: boolean;
};

export type FlockHistoryPlacementSection = {
  placementId: string;
  placementCode: string;
  farmId: string;
  farmName: string;
  farmGroupName: string;
  barnId: string;
  barnCode: string;
  placedDate: string | null;
  projectedEndDate: string | null;
  removedDate: string | null;
  status: string;
  dailyRows: FlockHistoryDailyRow[];
  mortalityRows: FlockHistoryMortalityRow[];
};

export type FlockHistoryActionUpdate = {
  id: string;
  issueId: string;
  entryType: string | null;
  entryText: string | null;
  effectiveDate: string | null;
  createdAt: string | null;
  createdBy: string | null;
};

export type FlockHistoryActionItem = {
  id: string;
  entityType: "barn" | "placement";
  entityId: string;
  linkedPlacementId: string | null;
  placementCode: string | null;
  barnCode: string;
  issueType: string | null;
  issueTypeLabel: string;
  title: string;
  description: string | null;
  status: "open" | "resolved";
  reportedLogDate: string | null;
  openedAt: string | null;
  openedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  updates: FlockHistoryActionUpdate[];
};

export type FlockHistoryReportBundle = {
  generatedAt: string;
  flockId: string;
  flockCode: string;
  farmName: string;
  farmGroupName: string;
  placedDate: string | null;
  estimatedFirstCatch: string | null;
  femaleCount: number;
  maleCount: number;
  status: string;
  placements: FlockHistoryPlacementSection[];
  actionItems: {
    barnLinked: FlockHistoryActionItem[];
    placementLinked: FlockHistoryActionItem[];
  };
  totals: {
    placementCount: number;
    dailyRowCount: number;
    mortalityRowCount: number;
    barnActionItemCount: number;
    placementActionItemCount: number;
    deadFemale: number;
    deadMale: number;
    cullFemale: number;
    cullMale: number;
    totalLosses: number;
    finalFemalePopulation: number;
    finalMalePopulation: number;
    finalPopulation: number;
    finalMortalityPercent: number | null;
    finalLivePercent: number | null;
  };
};

export async function getFlockHistoryReportBundle(flockId: string): Promise<FlockHistoryReportBundle | null> {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const { data: flockRows, error: flockError } = await admin
    .from("flocks")
    .select("id,farm_id,flock_number,date_placed,max_date,start_cnt_females,start_cnt_males,is_active,is_complete")
    .eq("id", flockId)
    .limit(1);

  if (flockError) {
    throw new Error(flockError.message);
  }

  const flock = ((flockRows ?? []) as FlockRow[])[0] ?? null;
  if (!flock) {
    return null;
  }

  const [{ data: placementRows, error: placementError }, { data: farmRows, error: farmError }] = await Promise.all([
    admin
      .from("placements")
      .select("id,flock_id,farm_id,barn_id,placement_key,is_active,date_removed,active_start,active_end,created_at")
      .eq("flock_id", flockId)
      .order("created_at", { ascending: true }),
    flock.farm_id
      ? admin.from("farms_ui").select("id,farm_name,farm_group_name").eq("id", flock.farm_id).limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (placementError) {
    throw new Error(placementError.message);
  }
  if (farmError) {
    throw new Error(farmError.message);
  }

  const placements = (placementRows ?? []) as PlacementRow[];
  const placementIds = placements.map((row) => row.id);
  const farm = ((farmRows ?? []) as FarmRow[])[0] ?? null;
  const barnIds = Array.from(new Set(placements.map((row) => row.barn_id)));

  const [barnsResult, dailyResult, mortalityResult] = await Promise.all([
    barnIds.length > 0
      ? admin.from("barns").select("id,barn_code,sort_code").in("id", barnIds)
      : Promise.resolve({ data: [], error: null }),
    placementIds.length > 0
        ? admin
          .from("log_daily")
          .select(
            "placement_id,log_date,age_days,am_temp,set_temp,rel_humidity,outside_temp_current,outside_temp_low,outside_temp_high,water_meter_reading,min_vent,is_oda_open,oda_exception,naoh,comment,is_active",
          )
          .in("placement_id", placementIds)
          .order("log_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    placementIds.length > 0
      ? admin
          .from("log_mortality")
          .select(
            "placement_id,log_date,dead_female,dead_male,cull_female,cull_male,cull_female_note,cull_male_note,dead_reason,grade_litter,grade_footpad,grade_feathers,grade_lame,grade_pecking,is_active",
          )
          .in("placement_id", placementIds)
          .order("log_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (barnsResult.error) {
    throw new Error(barnsResult.error.message);
  }
  if (dailyResult.error) {
    throw new Error(dailyResult.error.message);
  }
  if (mortalityResult.error) {
    throw new Error(mortalityResult.error.message);
  }

  const barnById = new Map(
    ((barnsResult.data ?? []) as BarnRow[]).map((barn) => [barn.id, barn]),
  );
  const dailyRows = (dailyResult.data ?? []) as DailyLogRow[];
  const mortalityRows = (mortalityResult.data ?? []) as MortalityLogRow[];

  const dailyByPlacement = groupBy(dailyRows, (row) => row.placement_id);
  const mortalityByPlacement = groupBy(mortalityRows, (row) => row.placement_id);
  const deadFemaleTotal = mortalityRows.reduce((sum, row) => sum + (row.dead_female ?? 0), 0);
  const deadMaleTotal = mortalityRows.reduce((sum, row) => sum + (row.dead_male ?? 0), 0);
  const cullFemaleTotal = mortalityRows.reduce((sum, row) => sum + (row.cull_female ?? 0), 0);
  const cullMaleTotal = mortalityRows.reduce((sum, row) => sum + (row.cull_male ?? 0), 0);
  const totalLosses = deadFemaleTotal + deadMaleTotal + cullFemaleTotal + cullMaleTotal;
  const placedFemaleCount = flock.start_cnt_females ?? 0;
  const placedMaleCount = flock.start_cnt_males ?? 0;
  const placedTotal = placedFemaleCount + placedMaleCount;
  const finalFemalePopulation = Math.max(0, placedFemaleCount - deadFemaleTotal - cullFemaleTotal);
  const finalMalePopulation = Math.max(0, placedMaleCount - deadMaleTotal - cullMaleTotal);
  const finalPopulation = finalFemalePopulation + finalMalePopulation;
  const finalMortalityPercent = placedTotal > 0 ? (totalLosses / placedTotal) * 100 : null;
  const finalLivePercent = placedTotal > 0 ? (finalPopulation / placedTotal) * 100 : null;

  const placementSections = placements
    .slice()
    .sort((left, right) => {
      const leftBarn = barnById.get(left.barn_id);
      const rightBarn = barnById.get(right.barn_id);
      return compareBarns(leftBarn, rightBarn) || compareText(left.placement_key, right.placement_key);
    })
    .map((placement) => {
      const barn = barnById.get(placement.barn_id);
      const dailyForPlacement = (dailyByPlacement.get(placement.id) ?? [])
        .slice()
        .sort((left, right) => left.log_date.localeCompare(right.log_date))
        .map((row) => ({
          placementId: placement.id,
          placementCode: placement.placement_key ?? "Unlabeled Placement",
          barnCode: barn?.barn_code ?? "Barn",
          farmName: farm?.farm_name ?? "Unknown Farm",
          logDate: row.log_date,
          ageDays: row.age_days ?? resolveAgeDays(row.log_date, flock.date_placed),
          amTemp: row.am_temp,
          setTemp: row.set_temp,
          relHumidity: row.rel_humidity,
          outsideTempCurrent: row.outside_temp_current,
          outsideTempLow: row.outside_temp_low,
          outsideTempHigh: row.outside_temp_high,
          waterMeterReading: row.water_meter_reading,
          minVent: row.min_vent,
          isOdaOpen: row.is_oda_open === true,
          odaException: row.oda_exception,
          naoh: row.naoh,
          comment: row.comment,
          dailyIsActive: row.is_active !== false,
        }));

      const mortalityForPlacement = (mortalityByPlacement.get(placement.id) ?? [])
        .slice()
        .sort((left, right) => left.log_date.localeCompare(right.log_date))
        .map((row) => ({
          placementId: placement.id,
          placementCode: placement.placement_key ?? "Unlabeled Placement",
          barnCode: barn?.barn_code ?? "Barn",
          farmName: farm?.farm_name ?? "Unknown Farm",
          logDate: row.log_date,
          ageDays: resolveAgeDays(row.log_date, flock.date_placed),
          deadFemale: row.dead_female ?? 0,
          deadMale: row.dead_male ?? 0,
          cullFemale: row.cull_female ?? 0,
          cullMale: row.cull_male ?? 0,
          cullFemaleNote: row.cull_female_note,
          cullMaleNote: row.cull_male_note,
          deadReason: row.dead_reason,
          gradeLitter: row.grade_litter,
          gradeFootpad: row.grade_footpad,
          gradeFeathers: row.grade_feathers,
          gradeLame: row.grade_lame,
          gradePecking: row.grade_pecking,
          mortalityIsActive: row.is_active !== false,
        }));

      return {
        placementId: placement.id,
        placementCode: placement.placement_key ?? "Unlabeled Placement",
        farmId: placement.farm_id,
        farmName: farm?.farm_name ?? "Unknown Farm",
        farmGroupName: farm?.farm_group_name ?? "Unknown Group",
        barnId: placement.barn_id,
        barnCode: barn?.barn_code ?? "Barn",
        placedDate: flock.date_placed,
        projectedEndDate: flock.max_date ?? placement.active_end,
        removedDate: placement.date_removed,
        status: formatPlacementStatus(placement),
        dailyRows: dailyForPlacement,
        mortalityRows: mortalityForPlacement,
      };
    });

  const placementById = new Map(placementSections.map((placement) => [placement.placementId, placement]));
  const firstPlacementByBarnId = new Map<string, FlockHistoryPlacementSection>();

  for (const placement of placements) {
    if (!firstPlacementByBarnId.has(placement.barn_id)) {
      const section = placementById.get(placement.id);
      if (section) {
        firstPlacementByBarnId.set(placement.barn_id, section);
      }
    }
  }

  const [barnIssuesResult, placementIssuesResult, issueTypesResult] = await Promise.all([
    barnIds.length > 0
      ? admin
          .from("issues")
          .select(
            "id,entity_type,entity_id,issue_type,title,description,status,related_placement_id,reported_log_date,opened_at,opened_by,resolved_at,resolved_by,resolution_note",
          )
          .eq("entity_type", "barn")
          .in("entity_id", barnIds)
          .order("opened_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    placementIds.length > 0
      ? admin
          .from("issues")
          .select(
            "id,entity_type,entity_id,issue_type,title,description,status,related_placement_id,reported_log_date,opened_at,opened_by,resolved_at,resolved_by,resolution_note",
          )
          .eq("entity_type", "placement")
          .in("entity_id", placementIds)
          .order("opened_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    admin.from("issue_types").select("code,label"),
  ]);

  if (barnIssuesResult.error && barnIssuesResult.error.code !== "42P01") {
    throw new Error(barnIssuesResult.error.message);
  }
  if (placementIssuesResult.error && placementIssuesResult.error.code !== "42P01") {
    throw new Error(placementIssuesResult.error.message);
  }
  if (issueTypesResult.error && issueTypesResult.error.code !== "42P01") {
    throw new Error(issueTypesResult.error.message);
  }

  const issueRows = [
    ...((barnIssuesResult.data ?? []) as IssueRow[]),
    ...((placementIssuesResult.data ?? []) as IssueRow[]),
  ];
  const issueTypeLabelByCode = new Map<string, string>(
    (
      issueTypesResult.data && issueTypesResult.data.length > 0
        ? (issueTypesResult.data as IssueTypeRow[])
        : getDefaultIssueTypes().map((row) => ({ code: row.code, label: row.label }))
    ).map((row) => [row.code, row.label]),
  );
  const issueIds = issueRows.map((row) => row.id);

  const issueUpdatesResult =
    issueIds.length > 0
      ? await admin
          .from("issue_updates")
          .select("id,issue_id,entry_type,entry_text,effective_date,created_at,created_by")
          .in("issue_id", issueIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

  if (issueUpdatesResult.error && issueUpdatesResult.error.code !== "42P01") {
    throw new Error(issueUpdatesResult.error.message);
  }

  const issueUpdatesByIssueId = groupBy((issueUpdatesResult.data ?? []) as IssueUpdateRow[], (row) => row.issue_id);

  const actionItems = issueRows
    .slice()
    .sort(compareIssuesAscending)
    .map((issue) => {
      const placementContext =
        issue.entity_type === "placement"
          ? placementById.get(issue.entity_id) ?? null
          : issue.related_placement_id
            ? placementById.get(issue.related_placement_id) ?? firstPlacementByBarnId.get(issue.entity_id) ?? null
            : firstPlacementByBarnId.get(issue.entity_id) ?? null;

      return {
        id: issue.id,
        entityType: issue.entity_type,
        entityId: issue.entity_id,
        linkedPlacementId: placementContext?.placementId ?? null,
        placementCode: placementContext?.placementCode ?? null,
        barnCode: placementContext?.barnCode ?? barnById.get(issue.entity_id)?.barn_code ?? "Barn",
        issueType: issue.issue_type,
        issueTypeLabel: issueTypeLabelByCode.get(issue.issue_type ?? "") ?? issue.title ?? "Action Item",
        title: issue.title?.trim() || issueTypeLabelByCode.get(issue.issue_type ?? "") || "Action Item",
        description: issue.description,
        status: issue.status,
        reportedLogDate: issue.reported_log_date,
        openedAt: issue.opened_at,
        openedBy: issue.opened_by,
        resolvedAt: issue.resolved_at,
        resolvedBy: issue.resolved_by,
        resolutionNote: issue.resolution_note,
        updates: (issueUpdatesByIssueId.get(issue.id) ?? [])
          .slice()
          .sort(compareIssueUpdatesAscending)
          .map((update) => ({
            id: update.id,
            issueId: update.issue_id,
            entryType: update.entry_type,
            entryText: update.entry_text,
            effectiveDate: update.effective_date,
            createdAt: update.created_at,
            createdBy: update.created_by,
          })),
      } satisfies FlockHistoryActionItem;
    });

  const barnActionItems = actionItems.filter((item) => item.entityType === "barn");
  const placementActionItems = actionItems.filter((item) => item.entityType === "placement");

  return {
    generatedAt: new Date().toISOString(),
    flockId: flock.id,
    flockCode: flock.flock_number?.toString() ?? "Unknown",
    farmName: farm?.farm_name ?? "Unknown Farm",
    farmGroupName: farm?.farm_group_name ?? "Unknown Group",
    placedDate: flock.date_placed,
    estimatedFirstCatch: flock.max_date,
    femaleCount: flock.start_cnt_females ?? 0,
    maleCount: flock.start_cnt_males ?? 0,
    status: formatFlockStatus(flock),
    placements: placementSections,
    actionItems: {
      barnLinked: barnActionItems,
      placementLinked: placementActionItems,
    },
    totals: {
      placementCount: placementSections.length,
      dailyRowCount: placementSections.reduce((sum, item) => sum + item.dailyRows.length, 0),
      mortalityRowCount: placementSections.reduce((sum, item) => sum + item.mortalityRows.length, 0),
      barnActionItemCount: barnActionItems.length,
      placementActionItemCount: placementActionItems.length,
      deadFemale: deadFemaleTotal,
      deadMale: deadMaleTotal,
      cullFemale: cullFemaleTotal,
      cullMale: cullMaleTotal,
      totalLosses,
      finalFemalePopulation,
      finalMalePopulation,
      finalPopulation,
      finalMortalityPercent,
      finalLivePercent,
    },
  };
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
}

function compareBarns(left: BarnRow | undefined, right: BarnRow | undefined) {
  const leftSort = String(left?.sort_code ?? "").trim().toLowerCase();
  const rightSort = String(right?.sort_code ?? "").trim().toLowerCase();

  if (leftSort && rightSort && leftSort !== rightSort) {
    return leftSort.localeCompare(rightSort, undefined, { numeric: true });
  }

  if (leftSort || rightSort) {
    return leftSort ? -1 : 1;
  }

  return String(left?.barn_code ?? "").localeCompare(String(right?.barn_code ?? ""), undefined, { numeric: true });
}

function resolveAgeDays(logDate: string | null, placedDate: string | null) {
  if (!logDate || !placedDate) {
    return null;
  }

  const start = new Date(`${placedDate}T00:00:00Z`);
  const current = new Date(`${logDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) {
    return null;
  }

  return Math.round((current.getTime() - start.getTime()) / 86400000);
}

function formatPlacementStatus(placement: PlacementRow) {
  if (placement.date_removed) {
    return "Removed";
  }
  if (placement.is_active) {
    return "Active";
  }
  return "Scheduled";
}

function formatFlockStatus(flock: FlockRow) {
  if (flock.is_complete) {
    return "complete";
  }
  if (flock.is_active) {
    return "active";
  }
  return "scheduled";
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }
  return map;
}

function compareIssuesAscending(left: IssueRow, right: IssueRow) {
  const leftDate = left.reported_log_date ?? left.opened_at ?? "";
  const rightDate = right.reported_log_date ?? right.opened_at ?? "";
  const leftTime = leftDate ? new Date(leftDate).getTime() : 0;
  const rightTime = rightDate ? new Date(rightDate).getTime() : 0;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  const leftOpened = left.opened_at ? new Date(left.opened_at).getTime() : 0;
  const rightOpened = right.opened_at ? new Date(right.opened_at).getTime() : 0;
  return leftOpened - rightOpened;
}

function compareIssueUpdatesAscending(left: IssueUpdateRow, right: IssueUpdateRow) {
  const leftDate = left.effective_date ?? left.created_at ?? "";
  const rightDate = right.effective_date ?? right.created_at ?? "";
  const leftTime = leftDate ? new Date(leftDate).getTime() : 0;
  const rightTime = rightDate ? new Date(rightDate).getTime() : 0;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  const leftCreated = left.created_at ? new Date(left.created_at).getTime() : 0;
  const rightCreated = right.created_at ? new Date(right.created_at).getTime() : 0;
  return leftCreated - rightCreated;
}
