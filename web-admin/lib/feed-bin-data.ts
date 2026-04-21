import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type FeedBinFarmRecord = {
  id: string;
  farmGroupName: string;
  farmName: string;
  city: string;
  state: string;
  barnCount: number;
  feedBinCount: number;
};

export type FeedBinBarnRecord = {
  id: string;
  farmId: string;
  barnCode: string;
  capacity: number;
  currentPlacementCode: string | null;
  feedBinCount: number;
  isActive: boolean;
};

export type FeedBinEditorRecord = {
  id: string;
  farmId: string;
  barnId: string;
  binNumber: string;
  capacity: string;
};

export type FeedBinScreenBundle = {
  farms: FeedBinFarmRecord[];
  barnsByFarmId: Record<string, FeedBinBarnRecord[]>;
  binsByBarnId: Record<string, FeedBinEditorRecord[]>;
};

type FarmRow = {
  id: string;
  farm_name: string | null;
  city: string | null;
  state: string | null;
  farm_group_name: string | null;
};

type BarnRow = {
  id: string;
  farm_id: string;
  barn_code: string | null;
  sort_code: string | null;
  sqft: number | null;
  stdroc_head: string | null;
  is_active: boolean | null;
};

type PlacementRow = {
  barn_id: string;
  placement_key: string | null;
  is_active: boolean | null;
};

type FeedBinRow = {
  id: string;
  farm_id: string | null;
  barn_id: string | null;
  bin_num: number | null;
  capacity: number | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function formatNumeric(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function parseCapacity(standardHead: string | null, squareFeet: number | null) {
  const normalizedHead = Number(String(standardHead ?? "").replace(/[^0-9.]/g, ""));
  if (Number.isFinite(normalizedHead) && normalizedHead > 0) {
    return Math.round(normalizedHead);
  }

  if (typeof squareFeet === "number" && Number.isFinite(squareFeet) && squareFeet > 0) {
    return Math.round(squareFeet / 2.1);
  }

  return 0;
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

export async function getFeedBinScreenBundle(): Promise<FeedBinScreenBundle> {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      farms: [],
      barnsByFarmId: {},
      binsByBarnId: {},
    };
  }

  const [farmsResult, barnsResult, placementsResult, binsResult] = await Promise.all([
    supabase
      .from("farms_ui")
      .select("id,farm_name,city,state,farm_group_name")
      .order("farm_name"),
    supabase
      .from("barns")
      .select("id,farm_id,barn_code,sort_code,sqft,stdroc_head,is_active"),
    supabase
      .from("placements")
      .select("barn_id,placement_key,is_active")
      .eq("is_active", true)
      .order("placement_key"),
    supabase
      .from("feedbins")
      .select("id,farm_id,barn_id,bin_num,capacity")
      .order("bin_num", { ascending: true }),
  ]);

  const farmRows = (farmsResult.data ?? []) as FarmRow[];
  const barnRows = ((barnsResult.data ?? []) as BarnRow[]).sort((left, right) => {
    const farmCompare = String(left.farm_id).localeCompare(String(right.farm_id));
    return farmCompare !== 0 ? farmCompare : compareBarnRows(left, right);
  });
  const placementRows = (placementsResult.data ?? []) as PlacementRow[];
  const binRows = (binsResult.data ?? []) as FeedBinRow[];

  const barnCountByFarmId = countBy(barnRows, (row) => row.farm_id);
  const binCountByFarmId = countBy(
    binRows.filter((row) => !!row.farm_id),
    (row) => row.farm_id ?? "unknown",
  );
  const binCountByBarnId = countBy(
    binRows.filter((row) => !!row.barn_id),
    (row) => row.barn_id ?? "unknown",
  );
  const activePlacementByBarnId = new Map(
    placementRows
      .filter((row) => row.is_active === true)
      .map((row) => [row.barn_id, normalize(row.placement_key) || null]),
  );

  const barnsByFarmId = barnRows.reduce<Record<string, FeedBinBarnRecord[]>>((acc, row) => {
    const record: FeedBinBarnRecord = {
      id: row.id,
      farmId: row.farm_id,
      barnCode: normalize(row.barn_code) || "Barn",
      capacity: parseCapacity(row.stdroc_head, row.sqft),
      currentPlacementCode: activePlacementByBarnId.get(row.id) ?? null,
      feedBinCount: binCountByBarnId.get(row.id) ?? 0,
      isActive: row.is_active !== false,
    };

    acc[row.farm_id] ??= [];
    acc[row.farm_id].push(record);
    return acc;
  }, {});

  const binsByBarnId = binRows.reduce<Record<string, FeedBinEditorRecord[]>>((acc, row) => {
    if (!row.barn_id || !row.farm_id) {
      return acc;
    }

    const record: FeedBinEditorRecord = {
      id: row.id,
      farmId: row.farm_id,
      barnId: row.barn_id,
      binNumber: formatNumeric(row.bin_num),
      capacity: formatNumeric(row.capacity),
    };

    acc[row.barn_id] ??= [];
    acc[row.barn_id].push(record);
    return acc;
  }, {});

  return {
    farms: farmRows.map((row) => ({
      id: row.id,
      farmGroupName: normalize(row.farm_group_name) || "Ungrouped",
      farmName: normalize(row.farm_name) || "Unnamed Farm",
      city: normalize(row.city),
      state: normalize(row.state),
      barnCount: barnCountByFarmId.get(row.id) ?? 0,
      feedBinCount: binCountByFarmId.get(row.id) ?? 0,
    })),
    barnsByFarmId,
    binsByBarnId,
  };
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}
