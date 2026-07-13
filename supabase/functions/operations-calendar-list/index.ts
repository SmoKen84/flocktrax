import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceClient } from "../_shared/issues.ts";
import { getAuthenticatedUserId } from "../_shared/mobile-access.ts";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function getClient(accessToken: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Missing Supabase environment configuration");
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, detectSessionInUrl: false },
  });
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "GET") return json(req, { ok: false, error: "Method not allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const accessToken = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!accessToken) return json(req, { ok: false, error: "Missing Authorization header" }, 401);

  try {
    const supabase = getClient(accessToken);
    const service = getServiceClient();
    const userId = await getAuthenticatedUserId(supabase);
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError) throw new Error(adminError.message);

    const [farmMembershipResult, groupMembershipResult] = await Promise.all([
      supabase.from("farm_memberships").select("farm_id").eq("user_id", userId).eq("is_active", true),
      supabase.from("farm_group_memberships").select("farm_group_id").eq("user_id", userId).eq("active", true),
    ]);
    if (farmMembershipResult.error) throw new Error(farmMembershipResult.error.message);
    if (groupMembershipResult.error) throw new Error(groupMembershipResult.error.message);

    const directFarmIds = (farmMembershipResult.data ?? []).map((row) => row.farm_id).filter(Boolean);
    const groupIds = (groupMembershipResult.data ?? []).map((row) => row.farm_group_id).filter(Boolean);
    let farmsQuery = service.from("farms").select("id,farm_name,farm_group_id").order("farm_name");
    if (isAdmin !== true) {
      const filters: string[] = [];
      if (directFarmIds.length) filters.push(`id.in.(${directFarmIds.join(",")})`);
      if (groupIds.length) filters.push(`farm_group_id.in.(${groupIds.join(",")})`);
      if (!filters.length) return json(req, { ok: true, events: [] });
      farmsQuery = farmsQuery.or(filters.join(","));
    }

    const { data: farms, error: farmsError } = await farmsQuery;
    if (farmsError) throw new Error(farmsError.message);
    const farmIds = (farms ?? []).map((row) => row.id).filter(Boolean);
    if (!farmIds.length) return json(req, { ok: true, events: [] });

    const today = new Date().toISOString().slice(0, 10);
    const endDate = addDays(today, 365);
    const [barnsResult, placementsResult, livehaulResult] = await Promise.all([
      service.from("barns").select("id,barn_code,farm_id").in("farm_id", farmIds),
      service
        .from("placements")
        .select("id,flock_id,farm_id,barn_id,placement_key,active_start,lifecycle_stage")
        .in("farm_id", farmIds)
        .gte("active_start", today)
        .lte("active_start", endDate)
        .or("lifecycle_stage.in.(scheduled,awaiting_arrival),lifecycle_stage.is.null"),
      service
        .from("livehaul_schedule")
        .select("livehaul_id,placement_id,farm_id,barn_id,lh_date,sequence_num,target_sex,head_target,status")
        .in("farm_id", farmIds)
        .gte("lh_date", today)
        .lte("lh_date", endDate)
        .in("status", ["scheduled", "legacy_migrated"]),
    ]);
    if (barnsResult.error) throw new Error(barnsResult.error.message);
    if (placementsResult.error) throw new Error(placementsResult.error.message);
    if (livehaulResult.error) throw new Error(livehaulResult.error.message);

    const placements = placementsResult.data ?? [];
    const livehaulPlacementIds = Array.from(
      new Set((livehaulResult.data ?? []).map((row) => row.placement_id).filter(Boolean)),
    );
    const missingLivehaulPlacementIds = livehaulPlacementIds.filter(
      (placementId) => !placements.some((placement) => placement.id === placementId),
    );
    const { data: livehaulPlacements, error: livehaulPlacementsError } = missingLivehaulPlacementIds.length
      ? await service
          .from("placements")
          .select("id,flock_id,farm_id,barn_id,placement_key,active_start,lifecycle_stage")
          .in("id", missingLivehaulPlacementIds)
      : { data: [], error: null };
    if (livehaulPlacementsError) throw new Error(livehaulPlacementsError.message);

    const flockIds = Array.from(new Set(placements.map((row) => row.flock_id).filter(Boolean)));
    const { data: flocks, error: flocksError } = flockIds.length
      ? await service
          .from("flocks")
          .select("id,female_date_placed,male_date_placed,start_cnt_females,start_cnt_males")
          .in("id", flockIds)
      : { data: [], error: null };
    if (flocksError) throw new Error(flocksError.message);

    const farmById = new Map((farms ?? []).map((row) => [row.id, row]));
    const barnById = new Map((barnsResult.data ?? []).map((row) => [row.id, row]));
    const placementById = new Map([...placements, ...(livehaulPlacements ?? [])].map((row) => [row.id, row]));
    const flockById = new Map((flocks ?? []).map((row) => [row.id, row]));
    const events: Array<Record<string, unknown>> = [];

    for (const placement of placements) {
      const flock = flockById.get(placement.flock_id);
      const arrivals = new Map<string, { head: number; sexes: string[] }>();
      const femaleDate = flock?.female_date_placed ?? placement.active_start;
      const maleDate = flock?.male_date_placed ?? placement.active_start;
      if (femaleDate) arrivals.set(femaleDate, { head: flock?.start_cnt_females ?? 0, sexes: ["female"] });
      if (maleDate) {
        const arrival = arrivals.get(maleDate) ?? { head: 0, sexes: [] };
        arrival.head += flock?.start_cnt_males ?? 0;
        arrival.sexes.push("male");
        arrivals.set(maleDate, arrival);
      }

      for (const [date, arrival] of arrivals) {
        if (date < today || date > endDate) continue;
        const farm = farmById.get(placement.farm_id);
        const barn = barnById.get(placement.barn_id);
        events.push({
          id: `placement:${placement.id}:${date}`,
          type: "placement",
          date,
          farm_id: placement.farm_id,
          farm_name: farm?.farm_name ?? "Farm",
          barn_id: placement.barn_id,
          barn_code: barn?.barn_code ?? "Barn",
          placement_id: placement.id,
          placement_code: placement.placement_key ?? "Placement",
          head_count: arrival.head || null,
          target_sex: arrival.sexes.length === 1 ? arrival.sexes[0] : null,
        });
      }
    }

    for (const livehaul of livehaulResult.data ?? []) {
      const placement = placementById.get(livehaul.placement_id);
      const farm = farmById.get(livehaul.farm_id);
      const barn = barnById.get(livehaul.barn_id);
      events.push({
        id: `livehaul:${livehaul.livehaul_id}`,
        type: "livehaul",
        date: livehaul.lh_date,
        farm_id: livehaul.farm_id,
        farm_name: farm?.farm_name ?? "Farm",
        barn_id: livehaul.barn_id,
        barn_code: barn?.barn_code ?? "Barn",
        placement_id: livehaul.placement_id,
        placement_code: placement?.placement_key ?? "Placement",
        head_count: livehaul.head_target,
        target_sex: livehaul.target_sex,
        sequence_num: livehaul.sequence_num,
      });
    }

    events.sort((left, right) => String(left.date).localeCompare(String(right.date)) || String(left.barn_code).localeCompare(String(right.barn_code)));
    return json(req, { ok: true, events, start_date: today, end_date: endDate });
  } catch (error) {
    return json(req, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
