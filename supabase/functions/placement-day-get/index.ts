import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getEnabledGoogleSheetsColumnMap,
  getGoogleSheetsSyncContext,
  getSheetRowByDate,
  isGoogleSheetsReadBeforeEditEnabled,
} from "../_shared/google-sheets-read.ts";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type, x-adalo-test";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
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

function rowOrNull<T>(rows: T[] | null | undefined) {
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

async function buildPlacementDayItem(
  supabase: ReturnType<typeof createClient>,
  placementId: string,
  logDate: string,
) {
  const placementMeta = await getPlacementMeta(supabase, placementId);
  if (!placementMeta) {
    return null;
  }

  const [dailyResult, mortalityResult] = await Promise.all([
    supabase.from("log_daily").select("*").eq("placement_id", placementId).eq("log_date", logDate).limit(1),
    supabase.from("log_mortality").select("*").eq("placement_id", placementId).eq("log_date", logDate).limit(1),
  ]);

  if (dailyResult.error) throw new Error(dailyResult.error.message);
  if (mortalityResult.error) throw new Error(mortalityResult.error.message);

  const dailyRow = rowOrNull(dailyResult.data) as Record<string, unknown> | null;
  const mortalityRow = rowOrNull(mortalityResult.data) as Record<string, unknown> | null;
  const placementAgeDays = typeof placementMeta.placed_date === "string"
    ? daysBetween(logDate, placementMeta.placed_date)
    : null;

  return {
    placement_id: placementMeta.placement_id,
    placement_code: placementMeta.placement_code,
    farm_name: placementMeta.farm_name,
    barn_code: placementMeta.barn_code,
    flock_number: placementMeta.flock_number,
    placed_date: placementMeta.placed_date,
    log_date: logDate,
    placement_age_days: placementAgeDays,
    age_days: typeof dailyRow?.age_days === "number" ? dailyRow.age_days : placementAgeDays,
    am_temp: typeof dailyRow?.am_temp === "number" ? dailyRow.am_temp : null,
    set_temp: typeof dailyRow?.set_temp === "number" ? dailyRow.set_temp : null,
    rel_humidity: typeof dailyRow?.rel_humidity === "number" ? dailyRow.rel_humidity : null,
    outside_temp_current: typeof dailyRow?.outside_temp_current === "number" ? dailyRow.outside_temp_current : null,
    outside_temp_low: typeof dailyRow?.outside_temp_low === "number" ? dailyRow.outside_temp_low : null,
    outside_temp_high: typeof dailyRow?.outside_temp_high === "number" ? dailyRow.outside_temp_high : null,
    water_meter_reading: typeof dailyRow?.water_meter_reading === "number" ? dailyRow.water_meter_reading : null,
    maintenance_flag: dailyRow?.maintenance_flag === true,
    feedlines_flag: dailyRow?.feedlines_flag === true,
    nipple_lines_flag: dailyRow?.nipple_lines_flag === true,
    bird_health_alert: dailyRow?.bird_health_alert === true,
    min_vent: typeof dailyRow?.min_vent === "string" ? dailyRow.min_vent : null,
    is_oda_open: dailyRow?.is_oda_open === true,
    oda_exception: typeof dailyRow?.oda_exception === "string" ? dailyRow.oda_exception : null,
    naoh: typeof dailyRow?.naoh === "string" ? dailyRow.naoh : null,
    comment: typeof dailyRow?.comment === "string" ? dailyRow.comment : null,
    dead_female: typeof mortalityRow?.dead_female === "number" ? mortalityRow.dead_female : 0,
    dead_male: typeof mortalityRow?.dead_male === "number" ? mortalityRow.dead_male : 0,
    cull_female: typeof mortalityRow?.cull_female === "number" ? mortalityRow.cull_female : 0,
    cull_male: typeof mortalityRow?.cull_male === "number" ? mortalityRow.cull_male : 0,
    cull_female_note: typeof mortalityRow?.cull_female_note === "string" ? mortalityRow.cull_female_note : null,
    cull_male_note: typeof mortalityRow?.cull_male_note === "string" ? mortalityRow.cull_male_note : null,
    dead_reason: typeof mortalityRow?.dead_reason === "string" ? mortalityRow.dead_reason : null,
    grade_litter: typeof mortalityRow?.grade_litter === "number" ? mortalityRow.grade_litter : null,
    grade_footpad: typeof mortalityRow?.grade_footpad === "number" ? mortalityRow.grade_footpad : null,
    grade_feathers: typeof mortalityRow?.grade_feathers === "number" ? mortalityRow.grade_feathers : null,
    grade_lame: typeof mortalityRow?.grade_lame === "number" ? mortalityRow.grade_lame : null,
    grade_pecking: typeof mortalityRow?.grade_pecking === "number" ? mortalityRow.grade_pecking : null,
    daily_tasks: await getDailyAgeTasks(
      supabase,
      typeof dailyRow?.age_days === "number" ? dailyRow.age_days : placementAgeDays,
    ),
    daily_is_active: dailyRow?.is_active !== false,
    mortality_is_active: mortalityRow?.is_active !== false,
    placement_is_active: placementMeta.placement_is_active,
    placement_is_removed: placementMeta.placement_is_removed,
    is_existing_log: Boolean(dailyRow || mortalityRow),
  };
}

const COUNT_FIELDS = new Set(["dead_female", "dead_male", "cull_female", "cull_male"]);
const NUMERIC_FIELDS = new Set([
  "age_days",
  "am_temp",
  "set_temp",
  "rel_humidity",
  "outside_temp_current",
  "outside_temp_low",
  "outside_temp_high",
  "water_meter_reading",
  "grade_litter",
  "grade_footpad",
  "grade_feathers",
  "grade_lame",
  "grade_pecking",
]);

async function hydratePlacementDayFromSheets(
  supabase: ReturnType<typeof createClient>,
  item: Record<string, unknown>,
  debug = false,
) {
  const syncContext = await getGoogleSheetsSyncContext(supabase, String(item.placement_id));
  if (!syncContext) {
    return debug
      ? {
          item,
          debug: {
            hasSyncContext: false,
            mapCount: 0,
            foundRow: false,
          },
        }
      : item;
  }

  const mapRows = await getEnabledGoogleSheetsColumnMap(supabase, syncContext.endpointId, [
    "public.log_daily",
    "public.log_mortality",
  ]);
  if (mapRows.length === 0) {
    return debug
      ? {
          item,
          debug: {
            hasSyncContext: true,
            syncContext,
            mapCount: 0,
            foundRow: false,
          },
        }
      : item;
  }

  const rowValues = await getSheetRowByDate(
    syncContext.spreadsheetId,
    syncContext.placementKey,
    syncContext.headerRow,
    syncContext.dateHeaderLabel,
    String(item.log_date),
  );
  if (!rowValues) {
    return debug
      ? {
          item,
          debug: {
            hasSyncContext: true,
            syncContext,
            mapCount: mapRows.length,
            foundRow: false,
          },
        }
      : item;
  }

  const nextItem = { ...item };
  const appliedFields: string[] = [];
  nextItem.is_existing_log = true;
  for (const row of mapRows) {
    const normalizedLabel = row.sheetLabel.trim().toUpperCase().replace(/\s+/g, " ");
    if (!(normalizedLabel in rowValues)) {
      continue;
    }

    nextItem[row.sourceField] = coerceSheetValue(
      rowValues[normalizedLabel],
      row.sourceField,
      row.valueMode,
      nextItem[row.sourceField],
    );
    appliedFields.push(`${row.sourceField}:${normalizedLabel}`);
  }

  return debug
    ? {
        item: nextItem,
        debug: {
          hasSyncContext: true,
          syncContext,
          mapCount: mapRows.length,
          foundRow: true,
          appliedFields,
          sampleRowValues: {
            RO_DATE: rowValues["RO_DATE"] ?? null,
            TEMP: rowValues["TEMP"] ?? null,
            H20_METER: rowValues["H20_METER"] ?? null,
            COMMENTS: rowValues["COMMENTS"] ?? null,
            MINVENTINFO: rowValues["MINVENTINFO"] ?? null,
            ROODEAD: rowValues["ROODEAD"] ?? null,
            HENDEAD: rowValues["HENDEAD"] ?? null,
            ROOCULL: rowValues["ROOCULL"] ?? null,
            HENCULL: rowValues["HENCULL"] ?? null,
            DEADNOTE: rowValues["DEADNOTE"] ?? null,
            CULLNOTE: rowValues["CULLNOTE"] ?? null,
            PECKINGYN: rowValues["PECKINGYN"] ?? null,
            OUTDOORYN: rowValues["OUTDOORYN"] ?? null,
            AMMONIA: rowValues["AMMONIA"] ?? null,
          },
        },
      }
    : nextItem;
}

function coerceSheetValue(
  rawValue: string | null,
  fieldName: string,
  valueMode: string,
  currentValue: unknown,
) {
  const raw = String(rawValue ?? "").trim();

  if (valueMode === "boolean_flag") {
    if (!raw) return false;
    const normalized = raw.toLowerCase();
    return !["0", "false", "n", "no", "off"].includes(normalized);
  }

  if (COUNT_FIELDS.has(fieldName)) {
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : currentValue ?? 0;
  }

  if (NUMERIC_FIELDS.has(fieldName) || typeof currentValue === "number") {
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : currentValue ?? null;
  }

  return raw || null;
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

async function getPlacementMeta(
  supabase: ReturnType<typeof createClient>,
  placementId: string,
) {
  const { data: placementRows, error: placementError } = await supabase
    .from("placements")
    .select("id,farm_id,barn_id,flock_id,placement_key,is_active,date_removed")
    .eq("id", placementId)
    .limit(1);

  if (placementError) {
    throw new Error(placementError.message);
  }

  const placement = rowOrNull(placementRows);
  if (!placement) return null;

  const [farmResult, barnResult, flockResult] = await Promise.all([
    supabase.from("farms").select("id,farm_name").eq("id", placement.farm_id).limit(1),
    supabase.from("barns").select("id,barn_code").eq("id", placement.barn_id).limit(1),
    supabase.from("flocks").select("id,flock_number,date_placed").eq("id", placement.flock_id).limit(1),
  ]);

  if (farmResult.error) throw new Error(farmResult.error.message);
  if (barnResult.error) throw new Error(barnResult.error.message);
  if (flockResult.error) throw new Error(flockResult.error.message);

  const farm = rowOrNull(farmResult.data);
  const barn = rowOrNull(barnResult.data);
  const flock = rowOrNull(flockResult.data);

  return {
    placement_id: placement.id,
    placement_code: placement.placement_key,
    farm_name: farm?.farm_name ?? "",
    barn_code: barn?.barn_code ?? "",
    flock_number: flock?.flock_number ?? null,
    placed_date: flock?.date_placed ?? null,
    placement_is_active: placement.is_active,
    placement_is_removed: placement.date_removed !== null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.headers.get("x-adalo-test") === "true") {
    return json(req, {
      ok: true,
      item: {
        placement_id: "00000000-0000-0000-0000-000000000000",
        placement_code: "123-Barn-A",
        farm_name: "Sample Farm",
        barn_code: "Barn-A",
        flock_number: 123,
        placed_date: "2026-02-01",
        log_date: "2026-03-13",
        placement_age_days: 40,
        age_days: 40,
        am_temp: 72,
        set_temp: 70,
        rel_humidity: 65.5,
        outside_temp_current: 58.2,
        outside_temp_low: 49.1,
        outside_temp_high: 66.8,
        water_meter_reading: 1248.5,
        maintenance_flag: false,
        feedlines_flag: false,
        nipple_lines_flag: false,
        bird_health_alert: true,
        min_vent: "Minimum",
        is_oda_open: false,
        oda_exception: "",
        naoh: "Normal",
        comment: "Adalo schema capture only",
        dead_female: 0,
        dead_male: 0,
        cull_female: 0,
        cull_male: 0,
        cull_female_note: "",
        cull_male_note: "",
        dead_reason: "",
        grade_litter: null,
        grade_footpad: null,
        grade_feathers: null,
        grade_lame: null,
        grade_pecking: null,
        daily_tasks: [
          { id: "task-1", task_label: "Fill Feeder Trays (AM & PM)", display_order: 1 },
          { id: "task-2", task_label: "Adjust Nipple Line Height", display_order: 2 },
          { id: "task-3", task_label: "Check level of feedline - Adjust by cables only", display_order: 3 },
        ],
        daily_is_active: true,
        mortality_is_active: true,
        placement_is_active: true,
        placement_is_removed: false,
        is_existing_log: true,
      },
      mode: "adalo_test",
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const url = new URL(req.url);
  const body = req.method === "POST" ? await readBody(req) : {};
  const placementId = (req.method === "GET" ? url.searchParams.get("placement_id") : body.placement_id) as string | undefined;
  const logDate = (req.method === "GET" ? url.searchParams.get("log_date") : body.log_date) as string | undefined;
  const debugSync = url.searchParams.get("debug_sync") === "true";

  if (!isUuid(placementId) || !isDate(logDate)) {
    return json(req, { ok: false, error: "Invalid or missing placement_id or log_date" }, 400);
  }

  try {
    const supabase = getClient(accessToken);
    const adminSupabase = getAdminClient();

    const item = await buildPlacementDayItem(supabase, placementId, logDate);
    if (!item) {
      return json(req, { ok: false, error: "Placement not found" }, 404);
    }

    const readBeforeEditEnabled = await isGoogleSheetsReadBeforeEditEnabled(adminSupabase);
    if (!readBeforeEditEnabled) {
      return json(req, { ok: true, item });
    }

    const hydratedPayload = await hydratePlacementDayFromSheets(
      adminSupabase,
      item as Record<string, unknown>,
      debugSync,
    );

    if (debugSync) {
      const debugWrapper =
        typeof hydratedPayload === "object" && hydratedPayload !== null && "item" in hydratedPayload
          ? hydratedPayload as { item: unknown; debug?: unknown }
          : { item: hydratedPayload, debug: null };

      return json(req, {
        ok: true,
        debug_sync: true,
        item: debugWrapper.item,
        debug: debugWrapper.debug,
      });
    }

    return json(req, { ok: true, item: hydratedPayload });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
