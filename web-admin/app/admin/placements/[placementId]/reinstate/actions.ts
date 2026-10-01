"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function reinstatePlacementAction(form: FormData) {
  const id = String(form.get("placement_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid placement reference.");
  const location = `/admin/placements/${id}/reinstate?date=${encodeURIComponent(String(form.get("placement_date") ?? ""))}`;
  const admin = createSupabaseAdminClient();
  const client = await createSupabaseServerClient();
  const actorId = (await client?.auth.getUser())?.data.user?.id;
  if (!admin || !actorId) redirect(`${location}&error=${encodeURIComponent("Sign in to reinstate a flock.")}`);
  if (form.get("feed_reviewed") !== "yes") redirect(`${location}&error=${encodeURIComponent("Review and confirm the feed allocations first.")}`);
  const result = await admin.rpc("reinstate_canceled_placement", {
    p_placement_id: id, p_placement_date: String(form.get("placement_date") ?? ""),
    p_fingerprint: String(form.get("fingerprint") ?? ""), p_actor_id: actorId,
  });
  if (result.error) {
    const message = result.error.code === "23P01"
      ? "These placement dates overlap another flock in the barn. Choose another placement date. No feed was moved."
      : result.error.message;
    redirect(`${location}&error=${encodeURIComponent(message)}`);
  }
  for (const path of ["/admin/placements/new", "/admin/flocks", "/admin/overview", "/admin/feed-tickets", "/admin/reports/feed-projection", "/admin/reports/feed-projection-custom"])
    revalidatePath(path);
  revalidatePath(`/admin/flocks/${result.data.flock_id}`);
  const query = new URLSearchParams({ placement: id, farm: result.data.farm_id, barn: result.data.barn_id,
    month: String(form.get("placement_date")).slice(0,7), notice: `Reinstated ${result.data.placement_key}. Placement dates and applicable feed allocations were updated.` });
  redirect(`/admin/placements/new?${query}`);
}
