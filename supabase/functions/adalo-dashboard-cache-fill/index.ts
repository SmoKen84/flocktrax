import {
  clearAdaloCache,
  corsHeaders,
  createAdaloRows,
  getUserClient,
  json,
  parseAuthHeader,
  readJsonBody,
  requireString,
} from "../_shared/adalo-cache.ts";

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.headers.get("x-adalo-test") === "true") {
    return json(req, {
      ok: true,
      deleted_count: 2,
      created_count: 1,
      items: [
        {
          cache_owner_user_id: "sample-user-id",
          cache_type: "dashboard",
          placement_id: "00000000-0000-0000-0000-000000000000",
          farm_name: "Sample Farm",
          barn_code: "Barn-A",
          placement_code: "123-Barn-A",
          placed_date: "2026-02-01",
          est_first_catch: "2026-03-11",
          age_days: 41,
          head_count: 25000,
          is_active: true,
          is_removed: false,
          is_complete: false,
          is_in_barn: true,
          is_settled: true,
          status_text: "Active | Age 41 | In Barn",
          sort_code: "SAMPLE-001",
          updated_at: new Date().toISOString(),
        },
      ],
      mode: "adalo_test",
    });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  try {
    const body = await readJsonBody(req);
    const cacheOwnerUserId = requireString(body.cache_owner_user_id, "cache_owner_user_id");
    const includeInactive = parseBoolean(body.include_inactive);
    const supabase = getUserClient(accessToken);

    let query = supabase
      .from("placements_dashboard_ui")
      .select(
        "placement_id,farm_name,barn_code,placement_code,placed_date,est_first_catch,age_days,head_count,is_active,is_removed,is_complete,is_in_barn,is_settled,sort_code",
        { count: "exact" },
      )
      .order("farm_name", { ascending: true })
      .order("sort_code", { ascending: true })
      .order("placed_date", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error, count } = await query;
    if (error) {
      return json(req, { ok: false, error: error.message }, 400);
    }

    const clearResult = await clearAdaloCache("dashboard", cacheOwnerUserId, "dashboard");
    const nowIso = new Date().toISOString();
    const rows = (data ?? []).map((item) => ({
      cache_owner_user_id: cacheOwnerUserId,
      cache_type: "dashboard",
      placement_id: item.placement_id,
      farm_id: "",
      farm_name: item.farm_name,
      barn_id: "",
      barn_code: item.barn_code,
      flock_id: "",
      flock_number: null,
      placement_code: item.placement_code,
      placed_date: item.placed_date,
      est_first_catch: item.est_first_catch,
      age_days: item.age_days,
      head_count: item.head_count,
      is_active: item.is_active,
      is_removed: item.is_removed,
      is_complete: item.is_complete,
      is_in_barn: item.is_in_barn,
      is_settled: item.is_settled,
      status_text: `Active | Age ${item.age_days ?? ""} | ${item.is_in_barn ? "In Barn" : "Out"}`.trim(),
      sort_code: item.sort_code,
      updated_at: nowIso,
    }));

    const createResult = await createAdaloRows("dashboard", rows);

    return json(req, {
      ok: true,
      cache_owner_user_id: cacheOwnerUserId,
      deleted_count: clearResult.deletedCount,
      created_count: createResult.createdCount,
      source_count: count ?? rows.length,
      items: rows,
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
