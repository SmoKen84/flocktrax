import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export type MortalityWindowDay = {
  log_date: string;
  dead_female: number | null;
  dead_male: number | null;
  cull_female: number | null;
  cull_male: number | null;
};

export type MortalityWindow = {
  placement_id: string;
  opening_female: number;
  opening_male: number;
  total_female: number;
  total_male: number;
  first_week_female: number;
  first_week_male: number;
  period_female: number;
  period_male: number;
  days: MortalityWindowDay[];
};

export async function getMortalityWindows(
  supabase: SupabaseClient,
  placementIds: string[],
  startDate: string,
  endDate: string,
  includeFirstWeek = false,
): Promise<MortalityWindow[]> {
  const ids = Array.from(new Set(placementIds));
  const rows: MortalityWindow[] = [];
  // Bound both the request and daily-detail response sizes per RPC. Paging is
  // retained as a safeguard if a project's API row cap is lower than this batch.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    // The function returns at most one row per ID. Avoid another network
    // request once all possible summaries in this batch have arrived.
    const { data, error } = await fetchAllRows((from, to) => from >= batch.length
      ? Promise.resolve({ data: [], error: null })
      : supabase
      .rpc("get_mortality_window", {
        p_placement_ids: batch,
        p_start_date: startDate,
        p_end_date: endDate,
        p_include_first_week: includeFirstWeek,
      })
      .order("placement_id", { ascending: true })
      .range(from, to));
    if (error) throw new Error(`Mortality summary failed to load: ${error.message}`);
    rows.push(...(data ?? []) as MortalityWindow[]);
  }
  return rows;
}
