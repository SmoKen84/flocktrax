import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.headers.get("x-adalo-test") === "true") {
    return json(req, [
      {
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
        ambient_temp: 65,
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
        daily_is_active: true,
        mortality_is_active: true,
        placement_is_active: true,
        placement_is_removed: false,
        is_existing_log: true,
      },
    ]);
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { error: "Missing or invalid Authorization header" }, 401);
  }

  const url = new URL(req.url);
  const body = req.method === "POST" ? await readBody(req) : {};
  const placementId = (req.method === "GET" ? url.searchParams.get("placement_id") : body.placement_id) as string | undefined;
  const logDate = (req.method === "GET" ? url.searchParams.get("log_date") : body.log_date) as string | undefined;

  if (!isUuid(placementId) || !isDate(logDate)) {
    return json(req, { error: "Invalid or missing placement_id or log_date" }, 400);
  }

  try {
    const supabase = getClient(accessToken);

    const { data: existingRow, error: existingError } = await supabase
      .from("placement_day_ui")
      .select("*")
      .eq("placement_id", placementId)
      .eq("log_date", logDate)
      .maybeSingle();

    if (existingError) {
      return json(req, { error: existingError.message }, 400);
    }

    if (existingRow) {
      return json(req, [{
        ...existingRow,
        is_existing_log: true,
      }]);
    }

    const { data: placementRow, error: placementError } = await supabase
      .from("placements_ui2")
      .select("placement_id,farm_name,barn_code,flock_number,placement_key,date_placed,is_active,date_removed")
      .eq("placement_id", placementId)
      .maybeSingle();

    if (placementError) {
      return json(req, { error: placementError.message }, 400);
    }

    if (!placementRow) {
      return json(req, { error: "Placement not found" }, 404);
    }

    return json(req, [
      {
        placement_id: placementRow.placement_id,
        placement_code: placementRow.placement_key,
        farm_name: placementRow.farm_name,
        barn_code: placementRow.barn_code,
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
      },
    ]);
  } catch (error) {
    return json(req, { error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
