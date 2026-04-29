import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthenticatedUserId, getMobileAccessContext } from "../_shared/mobile-access.ts";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type, x-adalo-test";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
    },
  });
}

function parseAuthHeader(req: Request) {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return auth.slice(7).trim();
}

function redactToken(token: string | null) {
  if (!token) return "";
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}...${token.slice(-8)}`;
}

async function readBody(req: Request) {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return {} as Record<string, unknown>;
  }

  try {
    return await req.json();
  } catch {
    return {} as Record<string, unknown>;
  }
}

function getClient(accessToken: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

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

function pickPresent(payload: Record<string, unknown>, keys: string[]) {
  const row: Record<string, unknown> = {};
  for (const key of keys) {
    if (payload[key] !== undefined) {
      row[key] = payload[key];
    }
  }
  return row;
}

function hasAnyOwnKeys(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function normalizeNullableInteger(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "boolean") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (value === undefined) return undefined;
  if (value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function normalizeNullableText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function assignIfDefined(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined) {
    target[key] = value;
  }
}

async function getDailyAgeTasks(
  supabase: ReturnType<typeof createClient>,
  ageDays: number | null,
) {
  if (ageDays === null) {
    return [];
  }

  const { data, error } = await supabase
    .from("daily_age_tasks")
    .select("id,task_label,display_order,min_age_days,max_age_days")
    .eq("is_active", true)
    .or(`min_age_days.is.null,min_age_days.lte.${ageDays}`)
    .or(`max_age_days.is.null,max_age_days.gte.${ageDays}`)
    .order("display_order", { ascending: true })
    .order("task_label", { ascending: true })
    .limit(4);

  if (error) {
    console.warn("daily_age_tasks lookup failed", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    task_label: String(row.task_label ?? ""),
    display_order: typeof row.display_order === "number" ? row.display_order : null,
  }));
}

async function buildPlacementDayItem(
  supabase: ReturnType<typeof createClient>,
  placementId: string,
  logDate: string,
) {
  const { data: placementRows, error: placementError } = await supabase
    .from("placements")
    .select("id,farm_id,barn_id,flock_id,placement_key,is_active,date_removed")
    .eq("id", placementId)
    .limit(1);

  if (placementError) throw new Error(placementError.message);

  const placement = placementRows?.[0];
  if (!placement) throw new Error("Placement not found");

  const [farmResult, barnResult, flockResult, dailyResult, mortalityResult] = await Promise.all([
    supabase.from("farms").select("id,farm_name").eq("id", placement.farm_id).limit(1),
    supabase.from("barns").select("id,barn_code").eq("id", placement.barn_id).limit(1),
    supabase.from("flocks").select("id,flock_number,date_placed").eq("id", placement.flock_id).limit(1),
    supabase.from("log_daily").select("*").eq("placement_id", placementId).eq("log_date", logDate).limit(1),
    supabase.from("log_mortality").select("*").eq("placement_id", placementId).eq("log_date", logDate).limit(1),
  ]);

  if (farmResult.error) throw new Error(farmResult.error.message);
  if (barnResult.error) throw new Error(barnResult.error.message);
  if (flockResult.error) throw new Error(flockResult.error.message);
  if (dailyResult.error) throw new Error(dailyResult.error.message);
  if (mortalityResult.error) throw new Error(mortalityResult.error.message);

  const farm = farmResult.data?.[0];
  const barn = barnResult.data?.[0];
  const flock = flockResult.data?.[0];
  const dailyRow = dailyResult.data?.[0] ?? null;
  const mortalityRow = mortalityResult.data?.[0] ?? null;
  const placedDate = typeof flock?.date_placed === "string" ? flock.date_placed : null;
  const ageDays = placedDate ? Math.round((new Date(`${logDate}T00:00:00Z`).getTime() - new Date(`${placedDate}T00:00:00Z`).getTime()) / 86400000) : null;

  return {
    placement_id: placement.id,
    placement_code: placement.placement_key,
    farm_name: farm?.farm_name ?? "",
    barn_code: barn?.barn_code ?? "",
    flock_number: flock?.flock_number ?? null,
    placed_date: placedDate,
    log_date: logDate,
    placement_age_days: ageDays,
    age_days: dailyRow?.age_days ?? ageDays,
    am_temp: dailyRow?.am_temp ?? null,
    set_temp: dailyRow?.set_temp ?? null,
    rel_humidity: dailyRow?.rel_humidity ?? null,
    outside_temp_current: dailyRow?.outside_temp_current ?? null,
    outside_temp_low: dailyRow?.outside_temp_low ?? null,
    outside_temp_high: dailyRow?.outside_temp_high ?? null,
    water_meter_reading: dailyRow?.water_meter_reading ?? null,
    maintenance_flag: dailyRow?.maintenance_flag === true,
    feedlines_flag: dailyRow?.feedlines_flag === true,
    nipple_lines_flag: dailyRow?.nipple_lines_flag === true,
    bird_health_alert: dailyRow?.bird_health_alert === true,
    min_vent: dailyRow?.min_vent ?? null,
    is_oda_open: dailyRow?.is_oda_open ?? false,
    oda_exception: dailyRow?.oda_exception ?? null,
    naoh: dailyRow?.naoh ?? null,
    comment: dailyRow?.comment ?? null,
    dead_female: mortalityRow?.dead_female ?? 0,
    dead_male: mortalityRow?.dead_male ?? 0,
    cull_female: mortalityRow?.cull_female ?? 0,
    cull_male: mortalityRow?.cull_male ?? 0,
    cull_female_note: mortalityRow?.cull_female_note ?? null,
    cull_male_note: mortalityRow?.cull_male_note ?? null,
    dead_reason: mortalityRow?.dead_reason ?? null,
    grade_litter: mortalityRow?.grade_litter ?? null,
    grade_footpad: mortalityRow?.grade_footpad ?? null,
    grade_feathers: mortalityRow?.grade_feathers ?? null,
    grade_lame: mortalityRow?.grade_lame ?? null,
    grade_pecking: mortalityRow?.grade_pecking ?? null,
    daily_tasks: await getDailyAgeTasks(supabase, dailyRow?.age_days ?? ageDays),
    daily_is_active: dailyRow?.is_active ?? true,
    mortality_is_active: mortalityRow?.is_active ?? true,
    placement_is_active: placement.is_active,
    placement_is_removed: placement.date_removed !== null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.headers.get("x-adalo-test") === "true") {
    const payload = await readBody(req);
    const accessToken = parseAuthHeader(req);
    const placementId = typeof payload.placement_id === "string" ? payload.placement_id : null;
    const logDate = typeof payload.log_date === "string" ? payload.log_date : null;
    const dailyFields = [
      "age_days",
      "am_temp",
      "set_temp",
      "rel_humidity",
      "outside_temp_current",
      "outside_temp_low",
      "outside_temp_high",
      "water_meter_reading",
      "maintenance_flag",
      "feedlines_flag",
      "nipple_lines_flag",
      "bird_health_alert",
      "min_vent",
      "is_oda_open",
      "oda_exception",
      "naoh",
      "comment",
    ];
    const mortalityFields = [
      "dead_female",
      "dead_male",
      "cull_female",
      "cull_male",
      "cull_female_note",
      "cull_male_note",
      "dead_reason",
      "grade_litter",
      "grade_footpad",
      "grade_feathers",
      "grade_lame",
      "grade_pecking",
    ];
    const hasDailyFields = hasAnyOwnKeys(pickPresent(payload, dailyFields));
    const hasMortalityFields = hasAnyOwnKeys(pickPresent(payload, mortalityFields));

    return json(req, {
      ok: true,
      daily_saved: true,
      mortality_saved: true,
      item: {
        placement_id: placementId ?? "00000000-0000-0000-0000-000000000000",
        log_date: logDate ?? "2026-03-13",
        rel_humidity: 65.5,
        outside_temp_current: 58.2,
        outside_temp_low: 49.1,
        outside_temp_high: 66.8,
        water_meter_reading: 1248.5,
        maintenance_flag: false,
        feedlines_flag: false,
        nipple_lines_flag: false,
        bird_health_alert: true,
      },
      mode: "adalo_test",
      debug: {
        method: req.method,
        has_authorization_header: !!accessToken,
        authorization_token_preview: redactToken(accessToken),
        apikey_present: !!(req.headers.get("apikey") ?? req.headers.get("Apikey")),
        content_type: req.headers.get("content-type") ?? "",
        payload_keys: Object.keys(payload).sort(),
        payload,
        parsed: {
          placement_id: placementId,
          log_date: logDate,
          placement_id_valid: isUuid(placementId),
          log_date_valid: isDate(logDate),
          has_daily_fields: hasDailyFields,
          has_mortality_fields: hasMortalityFields,
          daily_is_active_present: payload.daily_is_active !== undefined,
          mortality_is_active_present: payload.mortality_is_active !== undefined,
        },
      },
    });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const payload = await readBody(req);
  if ((req.headers.get("content-type")?.toLowerCase() ?? "").includes("application/json") && Object.keys(payload).length === 0) {
    return json(req, { ok: false, error: "Body must be valid JSON" }, 400);
  }

  const placementId = typeof payload.placement_id === "string" ? payload.placement_id : null;
  const logDate = typeof payload.log_date === "string" ? payload.log_date : null;

  if (!isUuid(placementId) || !isDate(logDate)) {
    return json(req, { ok: false, error: "Invalid or missing placement_id or log_date" }, 400);
  }

  const dailyFields = [
    "age_days",
    "am_temp",
    "set_temp",
    "rel_humidity",
    "outside_temp_current",
    "outside_temp_low",
    "outside_temp_high",
    "water_meter_reading",
    "maintenance_flag",
    "feedlines_flag",
    "nipple_lines_flag",
    "bird_health_alert",
    "min_vent",
    "is_oda_open",
    "oda_exception",
    "naoh",
    "comment",
  ];

  const mortalityFields = [
    "dead_female",
    "dead_male",
    "cull_female",
    "cull_male",
    "cull_female_note",
    "cull_male_note",
    "dead_reason",
    "grade_litter",
    "grade_footpad",
    "grade_feathers",
    "grade_lame",
    "grade_pecking",
  ];

  const dailyPayload = pickPresent(payload, dailyFields);
  const mortalityPayload = pickPresent(payload, mortalityFields);
  const gradeFields = [
    "grade_litter",
    "grade_footpad",
    "grade_feathers",
    "grade_lame",
    "grade_pecking",
  ];
  const mortalityCoreFields = mortalityFields.filter((field) => !gradeFields.includes(field));

  assignIfDefined(mortalityPayload, "dead_female", normalizeNullableInteger(mortalityPayload.dead_female));
  assignIfDefined(mortalityPayload, "dead_male", normalizeNullableInteger(mortalityPayload.dead_male));
  assignIfDefined(mortalityPayload, "cull_female", normalizeNullableInteger(mortalityPayload.cull_female));
  assignIfDefined(mortalityPayload, "cull_male", normalizeNullableInteger(mortalityPayload.cull_male));
  assignIfDefined(mortalityPayload, "grade_litter", normalizeNullableInteger(mortalityPayload.grade_litter));
  assignIfDefined(mortalityPayload, "grade_footpad", normalizeNullableInteger(mortalityPayload.grade_footpad));
  assignIfDefined(mortalityPayload, "grade_feathers", normalizeNullableInteger(mortalityPayload.grade_feathers));
  assignIfDefined(mortalityPayload, "grade_lame", normalizeNullableInteger(mortalityPayload.grade_lame));
  assignIfDefined(mortalityPayload, "grade_pecking", normalizeNullableInteger(mortalityPayload.grade_pecking));
  assignIfDefined(mortalityPayload, "cull_female_note", normalizeNullableText(mortalityPayload.cull_female_note));
  assignIfDefined(mortalityPayload, "cull_male_note", normalizeNullableText(mortalityPayload.cull_male_note));
  assignIfDefined(mortalityPayload, "dead_reason", normalizeNullableText(mortalityPayload.dead_reason));

  if (payload.daily_is_active !== undefined) {
    dailyPayload.daily_is_active = payload.daily_is_active;
  }

  if (payload.mortality_is_active !== undefined) {
    mortalityPayload.mortality_is_active = normalizeBoolean(payload.mortality_is_active, true);
  }

  const shouldSaveDaily = hasAnyOwnKeys(pickPresent(payload, dailyFields)) || payload.daily_is_active !== undefined;
  const shouldSaveMortality = hasAnyOwnKeys(pickPresent(payload, mortalityFields)) || payload.mortality_is_active !== undefined;
  const includesGradeUpdates = hasAnyOwnKeys(pickPresent(payload, gradeFields));
  const includesMortalityCoreUpdates =
    hasAnyOwnKeys(pickPresent(payload, mortalityCoreFields)) || payload.mortality_is_active !== undefined;

  if (!shouldSaveDaily && !shouldSaveMortality) {
    return json(req, { ok: false, error: "No daily or mortality fields were provided" }, 400);
  }

  try {
    const supabase = getClient(accessToken);
    const userId = await getAuthenticatedUserId(supabase);
    const { data: placementRows, error: placementLookupError } = await supabase
      .from("placements")
      .select("id,farm_id")
      .eq("id", placementId)
      .limit(1);

    if (placementLookupError) {
      return json(req, { ok: false, error: placementLookupError.message }, 400);
    }

    const placementRow = placementRows?.[0];
    if (!placementRow) {
      return json(req, { ok: false, error: "Placement not found" }, 404);
    }

    const access = await getMobileAccessContext(supabase, userId, placementRow.farm_id);

    if (shouldSaveDaily && !access.permissions.daily_logs) {
      return json(req, { ok: false, error: "You are not authorized to save daily log entries." }, 403);
    }

    if (includesMortalityCoreUpdates && !access.permissions.log_mortality) {
      return json(req, { ok: false, error: "You are not authorized to save mortality entries." }, 403);
    }

    if (includesGradeUpdates && !access.permissions.grade_birds) {
      return json(req, { ok: false, error: "You are not authorized to save grading entries." }, 403);
    }

    let dailyResult: Record<string, unknown> | null = null;
    let mortalityResult: Record<string, unknown> | null = null;

    if (shouldSaveDaily) {
      const { data, error } = await supabase.rpc("save_log_daily_mobile", {
        p_placement_id: placementId,
        p_log_date: logDate,
        p_payload: dailyPayload,
      });

      if (error) {
        return json(req, { ok: false, error: `Daily save failed: ${error.message}` }, 400);
      }

      dailyResult = data;
    }

    if (shouldSaveMortality) {
      const { data, error } = await supabase.rpc("save_log_mortality_mobile", {
        p_placement_id: placementId,
        p_log_date: logDate,
        p_payload: mortalityPayload,
      });

      if (error) {
        return json(req, { ok: false, error: `Mortality save failed: ${error.message}` }, 400);
      }

      mortalityResult = data;
    }

    const combinedRow = await buildPlacementDayItem(supabase, placementId, logDate);

    return json(req, {
      ok: true,
      daily_saved: shouldSaveDaily,
      mortality_saved: shouldSaveMortality,
      daily_row: dailyResult,
      mortality_row: mortalityResult,
      item: combinedRow,
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
