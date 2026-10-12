import { unstable_noStore as noStore } from "next/cache";

import { buildBarnVacancies, type VacancyPlacement } from "@/lib/barn-vacancy";
import { getBarnOrder } from "@/lib/barn-sort-settings";
import { hasActorFarmScope, type ActorPlacementAccess } from "@/lib/placement-editor-access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Farm = { id: string; farm_name: string | null; farm_group_id: string | null; farm_group_name: string | null };
type Barn = { id: string; farm_id: string; barn_code: string | null; is_active: boolean | null };
type Placement = { id: string; barn_id: string; flock_id: string; active_start: string | null; lifecycle_stage: string | null; date_removed: string | null };
type Flock = { id: string; date_placed: string | null };

async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await fetchPage(offset, offset + 999);
    if (result.error || !result.data) throw new Error("Could not load the barn vacancy schedule. Please try again.");
    rows.push(...result.data as T[]);
    if (result.data.length < 1000) return rows;
  }
}

export async function getVacancyBarnOptions(actor: ActorPlacementAccess) {
  noStore();
  if (!actor.actorId || !actor.hasDashboardView) return [];
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("The barn vacancy schedule is unavailable.");
  const [farms, barns, order] = await Promise.all([
    readAll<Farm>((from, to) => supabase.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").order("id").range(from, to)),
    readAll<Barn>((from, to) => supabase.from("barns").select("id,farm_id,barn_code,is_active").order("id").range(from, to)),
    getBarnOrder(),
  ]);
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));
  return barns.filter((barn) => barn.is_active !== false).flatMap((barn) => {
    const farm = farmById.get(barn.farm_id);
    if (!farm || !hasActorFarmScope(actor, { farmId: farm.id, farmGroupId: farm.farm_group_id ?? "" })) return [];
    return [{
      id: barn.id,
      barnCode: barn.barn_code ?? "Barn",
      farmId: farm.id,
      farmName: farm.farm_name ?? "Unnamed Farm",
      farmGroupId: farm.farm_group_id ?? "",
      farmGroupName: farm.farm_group_name ?? "Ungrouped",
    }];
  }).sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) || a.barnCode.localeCompare(b.barnCode, undefined, { numeric: true }));
}

export function vacancyFilterOptions(barns: Awaited<ReturnType<typeof getVacancyBarnOptions>>) {
  return {
    farmGroups: Array.from(new Map(barns.filter((barn) => barn.farmGroupId).map((barn) => [barn.farmGroupId, { id: barn.farmGroupId, name: barn.farmGroupName }])).values()),
    farms: Array.from(new Map(barns.map((barn) => [barn.farmId, { id: barn.farmId, name: barn.farmName, farmGroupId: barn.farmGroupId }])).values()),
    barns: barns.map((barn) => ({ id: barn.id, farmId: barn.farmId, farmGroupId: barn.farmGroupId, label: `${barn.barnCode} · ${barn.farmName}` })),
  };
}

export async function getBarnVacancyReport(actor: ActorPlacementAccess, filters: {
  farmGroupId?: string | null; farmId?: string | null; barnId?: string | null; startDate: string; endDate: string;
}) {
  const barns = (await getVacancyBarnOptions(actor)).filter((barn) =>
    (!filters.farmGroupId || barn.farmGroupId === filters.farmGroupId) &&
    (!filters.farmId || barn.farmId === filters.farmId) &&
    (!filters.barnId || barn.id === filters.barnId),
  );
  const supabase = createSupabaseAdminClient();
  if (!supabase || !barns.length) return [];
  const placements: Placement[] = [];
  for (let offset = 0; offset < barns.length; offset += 100) {
    const ids = barns.slice(offset, offset + 100).map((barn) => barn.id);
    placements.push(...await readAll<Placement>((from, to) => supabase.from("placements")
      .select("id,barn_id,flock_id,active_start,lifecycle_stage,date_removed")
      .in("barn_id", ids).order("id").range(from, to)));
  }
  const flockIds = Array.from(new Set(placements.filter((row) => !row.active_start).map((row) => row.flock_id).filter(Boolean)));
  const flocks: Flock[] = [];
  for (let offset = 0; offset < flockIds.length; offset += 100) {
    flocks.push(...await readAll<Flock>((from, to) => supabase.from("flocks").select("id,date_placed")
      .in("id", flockIds.slice(offset, offset + 100)).order("id").range(from, to)));
  }
  const flockById = new Map(flocks.map((flock) => [flock.id, flock]));
  const normalized: VacancyPlacement[] = placements.map((row) => ({
    barnId: row.barn_id,
    startDate: row.active_start || flockById.get(row.flock_id)?.date_placed || null,
    lifecycleStage: row.lifecycle_stage,
    removedDate: row.date_removed,
  }));
  return barns.map((barn) => ({
    ...barn,
    ...buildBarnVacancies(normalized.filter((row) => row.barnId === barn.id), filters.startDate, filters.endDate),
  }));
}
