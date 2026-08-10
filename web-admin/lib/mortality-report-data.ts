import { unstable_noStore as noStore } from "next/cache";

import { clampDateRange } from "@/lib/report-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { PlacementLifecycleStage } from "@/lib/types";

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  placement_key: string | null;
  lifecycle_stage: PlacementLifecycleStage | null;
  active_start: string | null;
  date_removed: string | null;
};

type FlockRow = {
  id: string;
  flock_number: number | null;
  date_placed: string | null;
  female_date_placed: string | null;
  male_date_placed: string | null;
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

type MortalityRow = {
  placement_id: string;
  log_date: string;
  dead_female: number | null;
  dead_male: number | null;
  cull_female: number | null;
  cull_male: number | null;
  is_active: boolean | null;
};

export type MortalityReportDay = {
  date: string;
  femalePlaced: number;
  femaleDead: number | null;
  femaleCull: number | null;
  femaleLoss: number | null;
  femalePopulation: number;
  malePlaced: number;
  maleDead: number | null;
  maleCull: number | null;
  maleLoss: number | null;
  malePopulation: number;
  totalLoss: number | null;
  totalPopulation: number;
};

export type MortalityReportSection = {
  placementId: string;
  placementCode: string;
  flockCode: string;
  farmGroupName: string;
  farmName: string;
  barnCode: string;
  placedDate: string;
  reportStartDate: string;
  reportEndDate: string;
  openingFemalePopulation: number;
  openingMalePopulation: number;
  openingTotalPopulation: number;
  femaleLossInRange: number;
  maleLossInRange: number;
  totalLossInRange: number;
  endingFemalePopulation: number;
  endingMalePopulation: number;
  endingTotalPopulation: number;
  days: MortalityReportDay[];
};

export type MortalityReportData = {
  startDate: string;
  endDate: string;
  scopeLabel: string;
  sections: MortalityReportSection[];
  totals: {
    openingFemalePopulation: number;
    openingMalePopulation: number;
    lossFemale: number;
    lossMale: number;
    endingFemalePopulation: number;
    endingMalePopulation: number;
  };
};

export type MortalityReportFilterOptions = {
  farmGroups: Array<{ id: string; name: string }>;
  farms: Array<{ id: string; farmGroupId: string; name: string }>;
  barns: Array<{ id: string; farmGroupId: string; farmId: string; label: string }>;
  flocks: Array<{ id: string; farmGroupId: string; farmId: string; barnId: string; value: string; label: string }>;
};

export async function getMortalityReportData(options: {
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
  const empty = emptyReport(startDate, endDate, buildScopeLabel(options));

  if (!supabase || !startDate || !endDate) return empty;

  const source = await loadMortalitySources({
    farmId: options.farmId,
    barnId: options.barnId,
    includeMortality: true,
  });
  if (!source) return empty;

  const { placements, flockById, farmById, barnById, mortalityRows } = source;
  const mortalityByPlacement = groupMortality(mortalityRows);
  const inferredEndByPlacement = inferPlacementEndDates(placements, flockById);

  const sections = placements
    .map((placement) => {
      const flock = flockById.get(placement.flock_id);
      const farm = farmById.get(placement.farm_id);
      const barn = barnById.get(placement.barn_id);
      if (!flock || !farm || !barn || placement.lifecycle_stage === "canceled") return null;
      if (options.farmGroupId && farm.farm_group_id !== options.farmGroupId) return null;

      const placementCode =
        placement.placement_key ??
        (flock.flock_number !== null ? `${flock.flock_number}-${barn.barn_code ?? ""}` : "");
      if (options.flockCode && placementCode !== options.flockCode) return null;

      const femalePlacedDate = flock.female_date_placed ?? flock.date_placed ?? placement.active_start;
      const malePlacedDate = flock.male_date_placed ?? flock.date_placed ?? placement.active_start;
      const placedDate = earliestDate(femalePlacedDate, malePlacedDate, placement.active_start);
      if (!placedDate || placedDate > endDate) return null;
      const effectiveEndDate = placement.date_removed ?? inferredEndByPlacement.get(placement.id) ?? null;
      if (effectiveEndDate && effectiveEndDate < startDate) return null;

      const sectionStart = maxDate(startDate, placedDate);
      const sectionEnd = effectiveEndDate ? minDate(endDate, effectiveEndDate) : endDate;
      if (sectionStart > sectionEnd) return null;

      const rows = mortalityByPlacement.get(placement.id) ?? [];
      const openingFemalePopulation = calculateOpeningPopulation(
        flock.start_cnt_females ?? 0,
        femalePlacedDate,
        sectionStart,
        rows,
        "female",
      );
      const openingMalePopulation = calculateOpeningPopulation(
        flock.start_cnt_males ?? 0,
        malePlacedDate,
        sectionStart,
        rows,
        "male",
      );

      let femalePopulation = openingFemalePopulation;
      let malePopulation = openingMalePopulation;
      const days: MortalityReportDay[] = [];

      for (const date of dateKeys(sectionStart, sectionEnd)) {
        const daily = rows.find((row) => row.log_date === date);
        const femalePlaced =
          femalePlacedDate === date && femalePlacedDate > sectionStart ? flock.start_cnt_females ?? 0 : 0;
        const malePlaced =
          malePlacedDate === date && malePlacedDate > sectionStart ? flock.start_cnt_males ?? 0 : 0;
        const femaleDead = daily?.dead_female ?? null;
        const femaleCull = daily?.cull_female ?? null;
        const maleDead = daily?.dead_male ?? null;
        const maleCull = daily?.cull_male ?? null;
        const femaleLoss = sumNullableCounts(femaleDead, femaleCull);
        const maleLoss = sumNullableCounts(maleDead, maleCull);

        femalePopulation = Math.max(0, femalePopulation + femalePlaced - (femaleLoss ?? 0));
        malePopulation = Math.max(0, malePopulation + malePlaced - (maleLoss ?? 0));

        days.push({
          date,
          femalePlaced,
          femaleDead,
          femaleCull,
          femaleLoss,
          femalePopulation,
          malePlaced,
          maleDead,
          maleCull,
          maleLoss,
          malePopulation,
          totalLoss: sumNullableCounts(femaleLoss, maleLoss),
          totalPopulation: femalePopulation + malePopulation,
        });
      }

      const femaleLossInRange = days.reduce((sum, day) => sum + (day.femaleLoss ?? 0), 0);
      const maleLossInRange = days.reduce((sum, day) => sum + (day.maleLoss ?? 0), 0);

      return {
        placementId: placement.id,
        placementCode: placementCode || "Unassigned Flock",
        flockCode: placementCode || "Unassigned Flock",
        farmGroupName: farm.farm_group_name ?? "Ungrouped",
        farmName: farm.farm_name ?? "Unnamed Farm",
        barnCode: barn.barn_code ?? "Barn",
        placedDate,
        reportStartDate: sectionStart,
        reportEndDate: sectionEnd,
        openingFemalePopulation,
        openingMalePopulation,
        openingTotalPopulation: openingFemalePopulation + openingMalePopulation,
        femaleLossInRange,
        maleLossInRange,
        totalLossInRange: femaleLossInRange + maleLossInRange,
        endingFemalePopulation: femalePopulation,
        endingMalePopulation: malePopulation,
        endingTotalPopulation: femalePopulation + malePopulation,
        days,
      } satisfies MortalityReportSection;
    })
    .filter((section): section is MortalityReportSection => section !== null)
    .sort(
      (left, right) =>
        left.farmName.localeCompare(right.farmName) ||
        left.barnCode.localeCompare(right.barnCode, undefined, { numeric: true }) ||
        left.placedDate.localeCompare(right.placedDate),
    );

  return {
    startDate,
    endDate,
    scopeLabel: buildScopeLabel(options),
    sections,
    totals: {
      openingFemalePopulation: sum(sections, "openingFemalePopulation"),
      openingMalePopulation: sum(sections, "openingMalePopulation"),
      lossFemale: sum(sections, "femaleLossInRange"),
      lossMale: sum(sections, "maleLossInRange"),
      endingFemalePopulation: sum(sections, "endingFemalePopulation"),
      endingMalePopulation: sum(sections, "endingMalePopulation"),
    },
  } satisfies MortalityReportData;
}

export async function getMortalityReportFilterOptions(): Promise<MortalityReportFilterOptions> {
  noStore();

  const source = await loadMortalitySources({ includeMortality: false });
  if (!source) return { farmGroups: [], farms: [], barns: [], flocks: [] };

  const rows = source.placements
    .filter((placement) => placement.lifecycle_stage !== "archived" && placement.lifecycle_stage !== "canceled")
    .map((placement) => {
      const flock = source.flockById.get(placement.flock_id);
      const farm = source.farmById.get(placement.farm_id);
      const barn = source.barnById.get(placement.barn_id);
      if (!flock || !farm || !barn) return null;
      const flockCode =
        placement.placement_key ??
        (flock.flock_number !== null ? `${flock.flock_number}-${barn.barn_code ?? ""}` : "");
      return { placement, flock, farm, barn, flockCode };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    farmGroups: dedupe(
      rows
        .filter((row) => row.farm.farm_group_id)
        .map((row) => ({ id: row.farm.farm_group_id as string, name: row.farm.farm_group_name ?? "Farm Group" })),
    ).sort((left, right) => left.name.localeCompare(right.name)),
    farms: dedupe(
      rows
        .filter((row) => row.farm.farm_group_id)
        .map((row) => ({
          id: row.farm.id,
          farmGroupId: row.farm.farm_group_id as string,
          name: row.farm.farm_name ?? "Unnamed Farm",
        })),
    ).sort((left, right) => left.name.localeCompare(right.name)),
    barns: dedupe(
      rows
        .filter((row) => row.farm.farm_group_id)
        .map((row) => ({
          id: row.barn.id,
          farmGroupId: row.farm.farm_group_id as string,
          farmId: row.farm.id,
          label: `${row.barn.barn_code ?? "Barn"} - ${row.farm.farm_name ?? "Unnamed Farm"}`,
        })),
    ).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true })),
    flocks: dedupe(
      rows
        .filter((row) => row.farm.farm_group_id && row.flockCode)
        .map((row) => ({
          id: row.placement.id,
          farmGroupId: row.farm.farm_group_id as string,
          farmId: row.farm.id,
          barnId: row.barn.id,
          value: row.flockCode,
          label: `${row.flockCode} - ${row.barn.barn_code ?? "Barn"} - ${row.farm.farm_name ?? "Unnamed Farm"}`,
        })),
    ).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true })),
  };
}

async function loadMortalitySources(options: {
  farmId?: string | null;
  barnId?: string | null;
  includeMortality: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  let placementsQuery = supabase
    .from("placements")
    .select("id,farm_id,barn_id,flock_id,placement_key,lifecycle_stage,active_start,date_removed")
    .order("active_start", { ascending: true });
  if (options.farmId) placementsQuery = placementsQuery.eq("farm_id", options.farmId);
  if (options.barnId) placementsQuery = placementsQuery.eq("barn_id", options.barnId);

  const placementsResult = await placementsQuery;
  const placements = (placementsResult.data ?? []) as PlacementRow[];
  const flockIds = unique(placements.map((row) => row.flock_id));
  const farmIds = unique(placements.map((row) => row.farm_id));
  const barnIds = unique(placements.map((row) => row.barn_id));
  const placementIds = unique(placements.map((row) => row.id));

  const [flocksResult, farmsResult, barnsResult, mortalityResult] = await Promise.all([
    flockIds.length
      ? supabase
          .from("flocks")
          .select("id,flock_number,date_placed,female_date_placed,male_date_placed,start_cnt_females,start_cnt_males")
          .in("id", flockIds)
      : Promise.resolve({ data: [] }),
    farmIds.length
      ? supabase.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").in("id", farmIds)
      : Promise.resolve({ data: [] }),
    barnIds.length
      ? supabase.from("barns").select("id,barn_code").in("id", barnIds)
      : Promise.resolve({ data: [] }),
    options.includeMortality && placementIds.length
      ? supabase
          .from("log_mortality")
          .select("placement_id,log_date,dead_female,dead_male,cull_female,cull_male,is_active")
          .in("placement_id", placementIds)
          .eq("is_active", true)
          .order("log_date", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return {
    placements,
    flockById: new Map(((flocksResult.data ?? []) as FlockRow[]).map((row) => [row.id, row])),
    farmById: new Map(((farmsResult.data ?? []) as FarmRow[]).map((row) => [row.id, row])),
    barnById: new Map(((barnsResult.data ?? []) as BarnRow[]).map((row) => [row.id, row])),
    mortalityRows: (mortalityResult.data ?? []) as MortalityRow[],
  };
}

function groupMortality(rows: MortalityRow[]) {
  const grouped = new Map<string, MortalityRow[]>();
  for (const row of rows) {
    if (row.is_active === false) continue;
    const placementRows = grouped.get(row.placement_id) ?? [];
    const existing = placementRows.find((entry) => entry.log_date === row.log_date);
    if (existing) {
      existing.dead_female = sumNullableCounts(existing.dead_female, row.dead_female);
      existing.dead_male = sumNullableCounts(existing.dead_male, row.dead_male);
      existing.cull_female = sumNullableCounts(existing.cull_female, row.cull_female);
      existing.cull_male = sumNullableCounts(existing.cull_male, row.cull_male);
    } else {
      placementRows.push({ ...row });
    }
    grouped.set(row.placement_id, placementRows);
  }
  return grouped;
}

function calculateOpeningPopulation(
  placedCount: number,
  placedDate: string | null,
  reportStart: string,
  mortalityRows: MortalityRow[],
  sex: "female" | "male",
) {
  if (!placedDate || placedDate > reportStart) return 0;
  const priorLoss = mortalityRows
    .filter((row) => row.log_date < reportStart)
    .reduce(
      (total, row) =>
        total +
        (sex === "female"
          ? (row.dead_female ?? 0) + (row.cull_female ?? 0)
          : (row.dead_male ?? 0) + (row.cull_male ?? 0)),
      0,
    );
  return Math.max(0, placedCount - priorLoss);
}

function sumNullableCounts(...values: Array<number | null | undefined>) {
  const entered = values.filter((value): value is number => typeof value === "number");
  return entered.length > 0 ? entered.reduce((sum, value) => sum + value, 0) : null;
}

function inferPlacementEndDates(placements: PlacementRow[], flockById: Map<string, FlockRow>) {
  const inferred = new Map<string, string>();
  const byBarn = new Map<string, PlacementRow[]>();

  for (const placement of placements) {
    if (placement.lifecycle_stage === "canceled") continue;
    const barnPlacements = byBarn.get(placement.barn_id) ?? [];
    barnPlacements.push(placement);
    byBarn.set(placement.barn_id, barnPlacements);
  }

  for (const barnPlacements of byBarn.values()) {
    barnPlacements.sort((left, right) => {
      const leftStart = placementStartDate(left, flockById) ?? "";
      const rightStart = placementStartDate(right, flockById) ?? "";
      return leftStart.localeCompare(rightStart);
    });

    for (let index = 0; index < barnPlacements.length - 1; index += 1) {
      const current = barnPlacements[index];
      const next = barnPlacements[index + 1];
      if (current.date_removed) continue;
      const nextStart = placementStartDate(next, flockById);
      if (nextStart) inferred.set(current.id, addDays(nextStart, -1));
    }
  }

  return inferred;
}

function placementStartDate(placement: PlacementRow, flockById: Map<string, FlockRow>) {
  const flock = flockById.get(placement.flock_id);
  return earliestDate(
    flock?.female_date_placed ?? null,
    flock?.male_date_placed ?? null,
    flock?.date_placed ?? null,
    placement.active_start,
  );
}

function dateKeys(startDate: string, endDate: string) {
  const values: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return values;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function earliestDate(...values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

function maxDate(left: string, right: string) {
  return left > right ? left : right;
}

function minDate(left: string, right: string) {
  return left < right ? left : right;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupe<T extends { id: string }>(values: T[]) {
  return Array.from(new Map(values.map((value) => [value.id, value])).values());
}

function sum(sections: MortalityReportSection[], key: keyof MortalityReportSection) {
  return sections.reduce((total, section) => total + Number(section[key] ?? 0), 0);
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

function emptyReport(startDate: string, endDate: string, scopeLabel: string): MortalityReportData {
  return {
    startDate,
    endDate,
    scopeLabel,
    sections: [],
    totals: {
      openingFemalePopulation: 0,
      openingMalePopulation: 0,
      lossFemale: 0,
      lossMale: 0,
      endingFemalePopulation: 0,
      endingMalePopulation: 0,
    },
  };
}
