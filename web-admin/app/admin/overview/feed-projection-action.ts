"use server";

import { getFeedProjectionReportData } from "@/lib/feed-projection-report-data";
import { getPlacementEditorActorAccess, hasActorFarmScope } from "@/lib/placement-editor-access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function getDashboardFeedProjection(barnId: string) {
  const actor = await getPlacementEditorActorAccess();
  if (!actor.actorId || !actor.hasDashboardView) throw new Error("Dashboard access is required.");
  const db = createSupabaseAdminClient();
  if (!db || !barnId) throw new Error("Barn could not be loaded.");
  const barn = await db.from("barns").select("farm_id").eq("id", barnId).maybeSingle();
  if (barn.error || !barn.data) throw new Error("Barn could not be loaded.");
  const farm = await db.from("farms").select("farm_group_id").eq("id", barn.data.farm_id).maybeSingle();
  if (farm.error || !farm.data || !hasActorFarmScope(actor, {
    farmId: barn.data.farm_id, farmGroupId: farm.data.farm_group_id ?? "ungrouped",
  })) throw new Error("Access to this farm is required.");

  const report = await getFeedProjectionReportData({
    barnId, windowDays: 10, reportMode: "operational", includeBinSentryOnOrder: true,
  });
  return { ...report, loadedAt: Date.now() };
}
