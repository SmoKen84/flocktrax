import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function canManagePlacementLifecycle(farmId: string) {
  const admin = createSupabaseAdminClient();
  const client = await createSupabaseServerClient();
  const actorId = (await client?.auth.getUser())?.data.user?.id;
  if (!admin || !actorId) return false;
  const result = await admin.rpc("can_manage_placement_lifecycle", { p_actor: actorId, p_farm: farmId });
  return !result.error && result.data === true;
}
