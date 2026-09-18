import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { compareBarnOrder, sortBySortCodeEnabled } from "@/lib/barn-sort";

export const getSortBySortCode = cache(async (): Promise<boolean> => {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.from("app_settings").select("value")
    .eq("name", "sort_by_sort_code").order("updated_at", { ascending: false, nullsFirst: false }).limit(1);
  if (error) throw new Error("Unable to load barn sorting setting: " + error.message);
  return sortBySortCodeEnabled(data?.[0]?.value);
});

export const getBarnOrder = cache(async () => {
  const admin = createSupabaseAdminClient();
  if (!admin) return new Map<string, number>();
  const [useSortCode, barns, farms] = await Promise.all([
    getSortBySortCode(),
    admin.from("barns").select("id,farm_id,barn_code,sort_code"),
    admin.from("farms_ui").select("id,farm_name,farm_group_name"),
  ]);
  if (barns.error || farms.error) throw new Error("Unable to load barn ordering.");
  const farmById = new Map((farms.data ?? []).map(farm => [farm.id, farm]));
  const compare = (a: string | null | undefined, b: string | null | undefined) =>
    (a ?? "").localeCompare(b ?? "", undefined, { numeric: true, sensitivity: "base" });
  const rows = (barns.data ?? []).sort((a, b) => {
    const fa = farmById.get(a.farm_id), fb = farmById.get(b.farm_id);
    return compare(fa?.farm_group_name, fb?.farm_group_name) ||
      compare(fa?.farm_name, fb?.farm_name) || compare(a.farm_id, b.farm_id) ||
      compareBarnOrder(a, b, useSortCode) || compare(a.id, b.id);
  });
  return new Map(rows.map((row, index) => [row.id, index]));
});
