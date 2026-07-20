import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type FlockRow = {
  id: string;
  farm_id: string;
  flock_number: number | null;
  date_placed: string | null;
  max_date: string | null;
  start_cnt_females: number | null;
  start_cnt_males: number | null;
};

type PlacementRow = {
  id: string;
  flock_id: string;
  farm_id: string;
  barn_id: string;
  placement_key: string | null;
  lifecycle_stage: string | null;
  date_removed: string | null;
  canceled_at: string | null;
  created_at: string | null;
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

type CloseoutRow = {
  placement_id: string;
  status: string | null;
  closeout_completed_at: string | null;
  archived_at: string | null;
};

type AppSettingRow = {
  value: string | null;
  updated_at: string | null;
};

export type FlockArchiveRecord = {
  id: string;
  flockCode: string;
  placementCode: string | null;
  placementCodes: string[];
  integrator: string;
  farmGroupNames: string[];
  farmNames: string[];
  barnCodes: string[];
  placedDate: string;
  closedDate: string;
  closedDates: string[];
  estimatedFirstCatch: string;
  femaleCount: number;
  maleCount: number;
  status: "complete" | "archived" | "canceled";
};

export async function getFlockArchiveRecords(): Promise<FlockArchiveRecord[]> {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Flock archive could not connect to Supabase.");
  }

  const [completedFlockResult, canceledPlacementResult, integratorResult] = await Promise.all([
    admin
      .from("flocks")
      .select("id,farm_id,flock_number,date_placed,max_date,start_cnt_females,start_cnt_males")
      .eq("is_complete", true)
      .order("date_placed", { ascending: false }),
    admin
      .from("placements")
      .select("id,flock_id,farm_id,barn_id,placement_key,lifecycle_stage,date_removed,canceled_at,created_at")
      .eq("lifecycle_stage", "canceled")
      .order("created_at", { ascending: true }),
    admin
      .from("app_settings")
      .select("value,updated_at")
      .eq("group", "INTEGRATOR")
      .eq("name", "company_name")
      .order("updated_at", { ascending: false }),
  ]);

  if (completedFlockResult.error) throw new Error(`Archived flocks failed to load: ${completedFlockResult.error.message}`);
  if (canceledPlacementResult.error) throw new Error(`Canceled flocks failed to load: ${canceledPlacementResult.error.message}`);
  if (integratorResult.error) throw new Error(`Integrator setting failed to load: ${integratorResult.error.message}`);

  const completedFlockRows = (completedFlockResult.data ?? []) as FlockRow[];
  const canceledPlacementRows = (canceledPlacementResult.data ?? []) as PlacementRow[];
  const completedFlockIds = new Set(completedFlockRows.map((row) => row.id));
  const additionalCanceledFlockIds = unique(
    canceledPlacementRows.map((row) => row.flock_id).filter((id) => !completedFlockIds.has(id)),
  );
  const canceledFlockResult = additionalCanceledFlockIds.length
    ? await admin
        .from("flocks")
        .select("id,farm_id,flock_number,date_placed,max_date,start_cnt_females,start_cnt_males")
        .in("id", additionalCanceledFlockIds)
        .order("date_placed", { ascending: false })
    : { data: [], error: null };

  if (canceledFlockResult.error) throw new Error(`Canceled flock profiles failed to load: ${canceledFlockResult.error.message}`);

  const flockRows = [...completedFlockRows, ...((canceledFlockResult.data ?? []) as FlockRow[])];
  const flockIds = flockRows.map((row) => row.id);
  const placementResult = flockIds.length
    ? await admin
        .from("placements")
        .select("id,flock_id,farm_id,barn_id,placement_key,lifecycle_stage,date_removed,canceled_at,created_at")
        .in("flock_id", flockIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (placementResult.error) throw new Error(`Archived placements failed to load: ${placementResult.error.message}`);

  const placementRows = (placementResult.data ?? []) as PlacementRow[];
  const placementIds = placementRows.map((row) => row.id);
  const farmIds = unique([...flockRows.map((row) => row.farm_id), ...placementRows.map((row) => row.farm_id)]);
  const barnIds = unique(placementRows.map((row) => row.barn_id));

  const [farmResult, barnResult, closeoutResult] = await Promise.all([
    farmIds.length
      ? admin.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").in("id", farmIds)
      : Promise.resolve({ data: [], error: null }),
    barnIds.length
      ? admin.from("barns").select("id,barn_code").in("id", barnIds)
      : Promise.resolve({ data: [], error: null }),
    placementIds.length
      ? admin
          .from("placement_closeouts")
          .select("placement_id,status,closeout_completed_at,archived_at")
          .in("placement_id", placementIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (farmResult.error) throw new Error(`Archived flock farms failed to load: ${farmResult.error.message}`);
  if (barnResult.error) throw new Error(`Archived flock barns failed to load: ${barnResult.error.message}`);
  if (closeoutResult.error) throw new Error(`Archived flock closeouts failed to load: ${closeoutResult.error.message}`);

  const integrator = ((integratorResult.data ?? []) as AppSettingRow[])
    .map((row) => String(row.value ?? "").trim())
    .find(Boolean) ?? "Not set";
  const farmById = new Map(((farmResult.data ?? []) as FarmRow[]).map((row) => [row.id, row]));
  const barnById = new Map(((barnResult.data ?? []) as BarnRow[]).map((row) => [row.id, row]));
  const closeoutByPlacementId = new Map(
    ((closeoutResult.data ?? []) as CloseoutRow[]).map((row) => [row.placement_id, row]),
  );

  return flockRows.flatMap((flock) => {
    const placements = placementRows.filter((row) => {
      if (row.flock_id !== flock.id) return false;

      const closeout = closeoutByPlacementId.get(row.id);
      return (
        row.lifecycle_stage === "archived" ||
        row.lifecycle_stage === "canceled" ||
        closeout?.status === "archived" ||
        Boolean(closeout?.archived_at) ||
        Boolean(closeout?.closeout_completed_at)
      );
    });

    // Planning flocks enter this historical view only after closeout or cancellation.
    if (placements.length === 0) return [];

    const farms = unique(
      placements.map((row) => row.farm_id),
    )
      .map((farmId) => farmById.get(farmId))
      .filter((farm): farm is FarmRow => Boolean(farm));
    const placementCodes = unique(
      placements.map((row) => String(row.placement_key ?? "").trim()).filter(Boolean),
    );
    const closeDates = placements
      .map((placement) => {
        const closeout = closeoutByPlacementId.get(placement.id);
        return placement.canceled_at ?? closeout?.archived_at ?? closeout?.closeout_completed_at ?? placement.date_removed;
      })
      .filter((value): value is string => Boolean(value))
      .sort();
    const isArchived = placements.some((placement) => {
      const closeout = closeoutByPlacementId.get(placement.id);
      return placement.lifecycle_stage === "archived" || closeout?.status === "archived" || Boolean(closeout?.archived_at);
    });
    const isCanceled = placements.some((placement) => placement.lifecycle_stage === "canceled");

    return [{
      id: flock.id,
      flockCode: flock.flock_number?.toString() ?? "Unknown",
      placementCode: placementCodes[0] ?? null,
      placementCodes,
      integrator,
      farmGroupNames: unique(farms.map((farm) => String(farm.farm_group_name ?? "").trim()).filter(Boolean)),
      farmNames: unique(farms.map((farm) => String(farm.farm_name ?? "").trim()).filter(Boolean)),
      barnCodes: unique(
        placements
          .map((placement) => String(barnById.get(placement.barn_id)?.barn_code ?? "").trim())
          .filter(Boolean),
      ),
      placedDate: flock.date_placed ?? "",
      closedDate: closeDates.at(-1)?.slice(0, 10) ?? "",
      closedDates: closeDates.map((value) => value.slice(0, 10)),
      estimatedFirstCatch: flock.max_date ?? "",
      femaleCount: flock.start_cnt_females ?? 0,
      maleCount: flock.start_cnt_males ?? 0,
      status: isCanceled ? "canceled" : isArchived ? "archived" : "complete",
    }];
  });
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
