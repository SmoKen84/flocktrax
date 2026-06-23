import { unstable_noStore as noStore } from "next/cache";

import type { PlacementLifecycleStage } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PlacementRow = {
  id: string;
  farm_id: string;
  barn_id: string;
  flock_id: string;
  placement_key: string | null;
  lifecycle_stage: PlacementLifecycleStage;
  date_removed: string | null;
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

type FlockRow = {
  id: string;
  flock_number: number | null;
  date_placed: string | null;
  breed_males: string | null;
  breed_females: string | null;
};

type WeightLogRow = {
  id: string;
  placement_id: string;
  log_date: string;
  age_days: number | null;
  sex: string | null;
  cnt_weighed: number | null;
  avg_weight: number | null;
  stddev_weight: number | null;
  procure: number | null;
  other_note: string | null;
};

type BreedRow = {
  id: string;
  breed_name: string | null;
  sex: string | null;
};

type BreedSpecRow = {
  breedid: string | null;
  geneticname: string | null;
  age: number | null;
  dayfeedperbird: number | null;
  targetweight: number | null;
  note: string | null;
};

export type PlacementLogWeightReportRow = {
  id: string;
  logDate: string;
  ageDays: number | null;
  sex: "male" | "female" | "unknown";
  breedId: string | null;
  breedName: string | null;
  sampleCount: number | null;
  averageWeight: number | null;
  standardDeviation: number | null;
  procure: number | null;
  sampleNote: string | null;
  benchmarkGeneticName: string | null;
  benchmarkTargetWeight: number | null;
  benchmarkDayFeedPerBird: number | null;
  benchmarkNote: string | null;
  percentOfBenchmark: number | null;
  varianceFromBenchmark: number | null;
};

export type PlacementLogWeightReportBundle = {
  placementId: string;
  placementCode: string;
  flockId: string;
  flockCode: string;
  lifecycleStage: PlacementLifecycleStage;
  farmId: string;
  farmGroupId: string | null;
  farmName: string;
  farmGroupName: string;
  barnId: string;
  barnCode: string;
  placedDate: string;
  removedDate: string | null;
  maleBreedName: string | null;
  femaleBreedName: string | null;
  rows: PlacementLogWeightReportRow[];
  latestMaleRow: PlacementLogWeightReportRow | null;
  latestFemaleRow: PlacementLogWeightReportRow | null;
};

export async function getPlacementLogWeightReportBundle(
  placementId: string,
): Promise<PlacementLogWeightReportBundle | null> {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Placement log-weight report could not connect to Supabase.");
  }

  const { data: placementRows, error: placementError } = await admin
    .from("placements")
    .select("id,farm_id,barn_id,flock_id,placement_key,lifecycle_stage,date_removed")
    .eq("id", placementId)
    .limit(1);

  if (placementError) {
    throw new Error(`Placement log-weight report failed to load placement: ${placementError.message}`);
  }

  const placement = ((placementRows ?? []) as PlacementRow[])[0] ?? null;
  if (!placement) {
    return null;
  }

  const [farmResult, barnResult, flockResult, weightResult] = await Promise.all([
    admin.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").eq("id", placement.farm_id).limit(1),
    admin.from("barns").select("id,barn_code").eq("id", placement.barn_id).limit(1),
    admin
      .from("flocks")
      .select("id,flock_number,date_placed,breed_males,breed_females")
      .eq("id", placement.flock_id)
      .limit(1),
    admin
      .from("log_weight")
      .select("id,placement_id,log_date,age_days,sex,cnt_weighed,avg_weight,stddev_weight,procure,other_note")
      .eq("placement_id", placement.id)
      .eq("is_active", true)
      .order("log_date", { ascending: true }),
  ]);

  if (farmResult.error) throw new Error(`Placement log-weight report failed to load farm: ${farmResult.error.message}`);
  if (barnResult.error) throw new Error(`Placement log-weight report failed to load barn: ${barnResult.error.message}`);
  if (flockResult.error) throw new Error(`Placement log-weight report failed to load flock: ${flockResult.error.message}`);
  if (weightResult.error) throw new Error(`Placement log-weight report failed to load weight logs: ${weightResult.error.message}`);

  const farm = ((farmResult.data ?? []) as FarmRow[])[0] ?? null;
  const barn = ((barnResult.data ?? []) as BarnRow[])[0] ?? null;
  const flock = ((flockResult.data ?? []) as FlockRow[])[0] ?? null;
  const placedDate = flock?.date_placed ?? null;

  if (!placedDate) {
    throw new Error("Placement log-weight report requires the flock placed date.");
  }

  const breedIds = unique([flock?.breed_males ?? null, flock?.breed_females ?? null]);
  const [breedResult, breedSpecResult] = await Promise.all([
    breedIds.length > 0
      ? admin.from("breeds").select("id,breed_name,sex").in("id", breedIds)
      : Promise.resolve({ data: [], error: null }),
    breedIds.length > 0
      ? admin
          .from("stdbreedspec")
          .select("breedid,geneticname,age,dayfeedperbird,targetweight,note")
          .in("breedid", breedIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (breedResult.error) throw new Error(`Placement log-weight report failed to load breeds: ${breedResult.error.message}`);
  if (breedSpecResult.error) {
    throw new Error(`Placement log-weight report failed to load breed specs: ${breedSpecResult.error.message}`);
  }

  const breedById = new Map(((breedResult.data ?? []) as BreedRow[]).map((row) => [row.id, row]));
  const breedSpecByAgeAndBreed = new Map<string, BreedSpecRow>();
  for (const row of (breedSpecResult.data ?? []) as BreedSpecRow[]) {
    const breedId = normalizeText(row.breedid);
    if (!breedId || row.age === null) continue;
    const key = `${breedId}:${row.age}`;
    if (!breedSpecByAgeAndBreed.has(key)) {
      breedSpecByAgeAndBreed.set(key, row);
    }
  }

  const rows = ((weightResult.data ?? []) as WeightLogRow[])
    .map((row) => {
      const normalizedSex = normalizeWeightSex(row.sex);
      const ageDays = row.age_days ?? deriveAgeDays(row.log_date, placedDate);
      const breedId =
        normalizedSex === "male" ? flock?.breed_males ?? null : normalizedSex === "female" ? flock?.breed_females ?? null : null;
      const breed = breedId ? breedById.get(breedId) ?? null : null;
      const benchmark =
        breedId && ageDays !== null ? breedSpecByAgeAndBreed.get(`${normalizeText(breedId)}:${ageDays}`) ?? null : null;
      const benchmarkTargetWeight = benchmark?.targetweight ?? null;
      const benchmarkDayFeedPerBird = benchmark?.dayfeedperbird ?? null;
      const benchmarkNote = benchmark?.note ?? null;
      const benchmarkGeneticName = benchmark?.geneticname ?? breed?.breed_name ?? null;
      const percentOfBenchmark = calculateBenchmarkPercent(row.avg_weight, benchmarkTargetWeight);
      const varianceFromBenchmark =
        row.avg_weight !== null &&
        benchmarkTargetWeight !== null &&
        Number.isFinite(row.avg_weight) &&
        Number.isFinite(benchmarkTargetWeight)
          ? row.avg_weight - benchmarkTargetWeight
          : null;

      return {
        id: row.id,
        logDate: row.log_date,
        ageDays,
        sex: normalizedSex,
        breedId,
        breedName: breed?.breed_name ?? benchmark?.geneticname ?? null,
        sampleCount: row.cnt_weighed,
        averageWeight: row.avg_weight,
        standardDeviation: row.stddev_weight,
        procure: row.procure,
        sampleNote: row.other_note,
        benchmarkGeneticName,
        benchmarkTargetWeight,
        benchmarkDayFeedPerBird,
        benchmarkNote,
        percentOfBenchmark,
        varianceFromBenchmark,
      } satisfies PlacementLogWeightReportRow;
    })
    .sort((left, right) => {
      const dateCompare = left.logDate.localeCompare(right.logDate);
      if (dateCompare !== 0) return dateCompare;
      return weightSexRank(left.sex) - weightSexRank(right.sex);
    });

  const latestMaleRow = [...rows].reverse().find((row) => row.sex === "male") ?? null;
  const latestFemaleRow = [...rows].reverse().find((row) => row.sex === "female") ?? null;

  return {
    placementId: placement.id,
    placementCode: placement.placement_key ?? "Unlabeled Placement",
    flockId: placement.flock_id,
    flockCode: flock?.flock_number !== null && flock?.flock_number !== undefined ? String(flock.flock_number) : "Unknown Flock",
    lifecycleStage: placement.lifecycle_stage,
    farmId: placement.farm_id,
    farmGroupId: farm?.farm_group_id ?? null,
    farmName: farm?.farm_name ?? "Unknown Farm",
    farmGroupName: farm?.farm_group_name ?? "Unknown Group",
    barnId: placement.barn_id,
    barnCode: barn?.barn_code ?? "Barn",
    placedDate,
    removedDate: placement.date_removed,
    maleBreedName: flock?.breed_males ? (breedById.get(flock.breed_males)?.breed_name ?? null) : null,
    femaleBreedName: flock?.breed_females ? (breedById.get(flock.breed_females)?.breed_name ?? null) : null,
    rows,
    latestMaleRow,
    latestFemaleRow,
  };
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter((value) => value.length > 0)));
}

function normalizeWeightSex(value: string | null | undefined): "male" | "female" | "unknown" {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized.startsWith("m")) return "male";
  if (normalized.startsWith("f")) return "female";
  return "unknown";
}

function weightSexRank(value: PlacementLogWeightReportRow["sex"]) {
  if (value === "male") return 0;
  if (value === "female") return 1;
  return 2;
}

function deriveAgeDays(logDate: string, placedDate: string) {
  const log = new Date(`${logDate}T00:00:00Z`);
  const placed = new Date(`${placedDate}T00:00:00Z`);
  if (Number.isNaN(log.getTime()) || Number.isNaN(placed.getTime())) {
    return null;
  }

  return Math.round((log.getTime() - placed.getTime()) / 86400000);
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
