import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type BreedBenchmarkRow = {
  id: number;
  geneticname: string | null;
  breedid: string | null;
  age: number | null;
  dayfeedperbird: number | string | null;
  targetweight: number | string | null;
  note: string | null;
  created_date: string | null;
  last_updated: string | null;
  is_active: boolean | null;
};

export type BreedBenchmarkEntry = {
  id: string;
  geneticLine: string;
  sex: string;
  ageDays: number | null;
  feedPerBird: number | null;
  targetWeight: number | null;
  note: string;
  isActive: boolean;
  createdDate: string | null;
  lastUpdated: string | null;
};

export type BreedBenchmarkFamily = {
  key: string;
  geneticLine: string;
  sex: string;
  displayLabel: string;
  entryCount: number;
  activeCount: number;
  ageRangeLabel: string;
};

export type BreedBenchmarksBundle = {
  entries: BreedBenchmarkEntry[];
  families: BreedBenchmarkFamily[];
};

export async function getBreedBenchmarksBundle(): Promise<BreedBenchmarksBundle> {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      entries: [],
      families: [],
    };
  }

  const result = await admin
    .from("stdbreedspec")
    .select("id,geneticname,breedid,age,dayfeedperbird,targetweight,note,created_date,last_updated,is_active")
    .order("geneticname", { ascending: true })
    .order("breedid", { ascending: true })
    .order("age", { ascending: true });

  if (result.error) {
    throw new Error(`Breed benchmarks could not be loaded: ${result.error.message}`);
  }

  const entries = ((result.data ?? []) as BreedBenchmarkRow[]).map((row) => {
    const geneticLine = normalizeText(row.geneticname, "Unknown Line");
    const sex = normalizeText(row.breedid, "Unknown Sex");

    return {
      id: String(row.id),
      geneticLine,
      sex,
      ageDays: row.age ?? null,
      feedPerBird: toNullableNumber(row.dayfeedperbird),
      targetWeight: toNullableNumber(row.targetweight),
      note: row.note?.trim() ?? "",
      isActive: row.is_active !== false,
      createdDate: row.created_date,
      lastUpdated: row.last_updated,
    } satisfies BreedBenchmarkEntry;
  });

  const familyMap = new Map<string, BreedBenchmarkEntry[]>();
  for (const entry of entries) {
    const familyKey = buildFamilyKey(entry.geneticLine, entry.sex);
    const current = familyMap.get(familyKey) ?? [];
    current.push(entry);
    familyMap.set(familyKey, current);
  }

  const families = Array.from(familyMap.entries())
    .map(([key, familyEntries]) => {
      const [firstEntry] = familyEntries;
      const activeCount = familyEntries.filter((entry) => entry.isActive).length;
      const ages = familyEntries
        .map((entry) => entry.ageDays)
        .filter((age): age is number => age !== null)
        .sort((left, right) => left - right);

      return {
        key,
        geneticLine: firstEntry?.geneticLine ?? "Unknown Line",
        sex: firstEntry?.sex ?? "Unknown Sex",
        displayLabel: `${firstEntry?.geneticLine ?? "Unknown Line"} / ${firstEntry?.sex ?? "Unknown Sex"}`,
        entryCount: familyEntries.length,
        activeCount,
        ageRangeLabel:
          ages.length > 0 ? `${ages[0]}-${ages[ages.length - 1]} days` : "No daily entries yet",
      } satisfies BreedBenchmarkFamily;
    })
    .sort(
      (left, right) =>
        left.geneticLine.localeCompare(right.geneticLine) || left.sex.localeCompare(right.sex),
    );

  return {
    entries,
    families,
  };
}

export function buildFamilyKey(geneticLine: string, sex: string) {
  return `${geneticLine}:::${sex}`;
}

function normalizeText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function toNullableNumber(value: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
