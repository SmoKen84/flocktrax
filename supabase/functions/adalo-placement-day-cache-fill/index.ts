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

function isUuid(value: string | null | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(`${dateA}T00:00:00Z`);
  const b = new Date(`${dateB}T00:00:00Z`);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.headers.get("x-adalo-test") === "true") {
    return json(req, {
      ok: true,
      deleted_count: 1,
      created_count: 1,
      item: {
        cache_owner_user_id: "sample-user-id",
        cache_type: "placement_day",
        placement_id: "00000000-0000-0000-0000-000000000000",
        placement_code: "123-Barn-A",
        farm_name: "Sample Farm",
        barn_code: "Barn-A",
        flock_number: 123,
        placed_date: "2026-02-01",
        log_date: "2026-03-13",
        placement_age_days: 40,
        age_days: 40,
        is_existing_log: true,
        updated_at: new Date().toISOString(),
      },
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
    const placementId = requireString(body.placement_id, "placement_id");
    const logDate = requireString(body.log_date, "log_date");

    if (!isUuid(placementId) || !isDate(logDate)) {
      return json(req, { ok: false, error: "Invalid or missing placement_id or log_date" }, 400);
    }

    const supabase = getUserClient(accessToken);

    const { data: existingRow, error: existingError } = await supabase
      .from("placement_day_ui")
      .select("*")
      .eq("placement_id", placementId)
      .eq("log_date", logDate)
      .maybeSingle();

    if (existingError) {
      return json(req, { ok: false, error: existingError.message }, 400);
    }

    let item = existingRow;

    if (!item) {
      const { data: placementRow, error: placementError } = await supabase
        .from("placements_ui2")
        .select("placement_id,farm_name,barn_code,flock_number,placement_key,date_placed,is_active,date_removed")
        .eq("placement_id", placementId)
        .maybeSingle();

      if (placementError) {
        return json(req, { ok: false, error: placementError.message }, 400);
      }

      if (!placementRow) {
        return json(req, { ok: false, error: "Placement not found" }, 404);
      }

      item = {
        placement_id: placementRow.placement_id,
        placement_code: placementRow.placement_key,
        farm_id: "",
        farm_name: placementRow.farm_name,
        barn_id: "",
        barn_code: placementRow.barn_code,
        flock_id: "",
        flock_number: placementRow.flock_number,
        placed_date: placementRow.date_placed,
        log_date: logDate,
        placement_age_days: daysBetween(logDate, placementRow.date_placed),
        age_days: daysBetween(logDate, placementRow.date_placed),
        am_temp: null,
        set_temp: null,
        ambient_temp: null,
        min_vent: null,
        is_oda_open: false,
        oda_exception: null,
        naoh: null,
        comment: null,
        dead_female: 0,
        dead_male: 0,
        cull_female: 0,
        cull_male: 0,
        cull_female_note: null,
        cull_male_note: null,
        dead_reason: null,
        grade_litter: null,
        grade_footpad: null,
        grade_feathers: null,
        grade_lame: null,
        grade_pecking: null,
        daily_is_active: true,
        mortality_is_active: true,
        placement_is_active: placementRow.is_active,
        placement_is_removed: placementRow.date_removed !== null,
        is_existing_log: false,
      };
    }

    const clearResult = await clearAdaloCache("placement_day", cacheOwnerUserId, "placement_day");
    const row = {
      cache_owner_user_id: cacheOwnerUserId,
      cache_type: "placement_day",
      placement_id: item.placement_id,
      placement_code: item.placement_code,
      farm_id: item.farm_id ?? "",
      farm_name: item.farm_name,
      barn_id: item.barn_id ?? "",
      barn_code: item.barn_code,
      flock_id: item.flock_id ?? "",
      flock_number: item.flock_number,
      placed_date: item.placed_date,
      log_date: item.log_date,
      placement_age_days: item.placement_age_days,
      age_days: item.age_days,
      am_temp: item.am_temp,
      set_temp: item.set_temp,
      ambient_temp: item.ambient_temp,
      min_vent: item.min_vent,
      is_oda_open: item.is_oda_open,
      oda_exception: item.oda_exception,
      naoh: item.naoh,
      comment: item.comment,
      dead_female: item.dead_female,
      dead_male: item.dead_male,
      cull_female: item.cull_female,
      cull_male: item.cull_male,
      cull_female_note: item.cull_female_note,
      cull_male_note: item.cull_male_note,
      dead_reason: item.dead_reason,
      grade_litter: item.grade_litter,
      grade_footpad: item.grade_footpad,
      grade_feathers: item.grade_feathers,
      grade_lame: item.grade_lame,
      grade_pecking: item.grade_pecking,
      daily_is_active: item.daily_is_active,
      mortality_is_active: item.mortality_is_active,
      placement_is_active: item.placement_is_active,
      placement_is_removed: item.placement_is_removed,
      is_existing_log: item.is_existing_log,
      updated_at: new Date().toISOString(),
    };

    const createResult = await createAdaloRows("placement_day", [row]);

    return json(req, {
      ok: true,
      cache_owner_user_id: cacheOwnerUserId,
      deleted_count: clearResult.deletedCount,
      created_count: createResult.createdCount,
      item: row,
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
