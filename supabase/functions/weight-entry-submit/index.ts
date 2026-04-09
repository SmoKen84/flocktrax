import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function sanitizeWeightPayload(sample: Record<string, unknown> | null | undefined) {
  if (!sample || typeof sample !== "object") {
    return {};
  }

  const payload: Record<string, unknown> = {};
  for (const key of ["cnt_weighed", "avg_weight", "stddev_weight", "procure", "other_note", "is_active", "age_days"]) {
    if (sample[key] !== undefined) {
      payload[key] = sample[key];
    }
  }
  return payload;
}

function normalizeBenchmark(row: Record<string, unknown> | null, breedId: string | null, ageDays: number | null) {
  if (!row) {
    return null;
  }

  return {
    breed_id: breedId,
    genetic_name: typeof row.geneticname === "string" ? row.geneticname : null,
    age_days: typeof row.age === "number" ? row.age : ageDays,
    target_weight: typeof row.targetweight === "number" ? row.targetweight : null,
    day_feed_per_bird: typeof row.dayfeedperbird === "number" ? row.dayfeedperbird : null,
    note: typeof row.note === "string" ? row.note : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const payload = await readBody(req);
  const placementId = typeof payload.placement_id === "string" ? payload.placement_id : null;
  const logDate = typeof payload.log_date === "string" ? payload.log_date : null;

  if (!isUuid(placementId) || !isDate(logDate)) {
    return json(req, { ok: false, error: "Invalid or missing placement_id or log_date" }, 400);
  }

  try {
    const supabase = getClient(accessToken);

    const { data: placementRows, error: placementError } = await supabase
      .from("placements")
      .select("id,farm_id,barn_id,flock_id,placement_key")
      .eq("id", placementId)
      .limit(1);

    if (placementError) throw new Error(placementError.message);
    const placement = placementRows?.[0];
    if (!placement) {
      return json(req, { ok: false, error: "Placement not found" }, 404);
    }

    const { data: flockRows, error: flockError } = await supabase
      .from("flocks")
      .select("id,flock_number,date_placed,breed_males,breed_females")
      .eq("id", placement.flock_id)
      .limit(1);

    if (flockError) throw new Error(flockError.message);
    const flock = flockRows?.[0];
    const ageDays = typeof flock?.date_placed === "string"
      ? Math.round((new Date(`${logDate}T00:00:00Z`).getTime() - new Date(`${flock.date_placed}T00:00:00Z`).getTime()) / 86400000)
      : null;
    const maleBreedId = typeof flock?.breed_males === "string" ? flock.breed_males : null;
    const femaleBreedId = typeof flock?.breed_females === "string" ? flock.breed_females : null;

    const malePayload = {
      ...sanitizeWeightPayload(payload.male_sample as Record<string, unknown> | null | undefined),
      age_days: ageDays,
    };
    const femalePayload = {
      ...sanitizeWeightPayload(payload.female_sample as Record<string, unknown> | null | undefined),
      age_days: ageDays,
    };

    const [maleResult, femaleResult] = await Promise.all([
      supabase.rpc("save_log_weight_mobile", {
        p_placement_id: placementId,
        p_log_date: logDate,
        p_sex: "male",
        p_payload: malePayload,
      }),
      supabase.rpc("save_log_weight_mobile", {
        p_placement_id: placementId,
        p_log_date: logDate,
        p_sex: "female",
        p_payload: femalePayload,
      }),
    ]);

    if (maleResult.error) {
      return json(req, { ok: false, error: `Male weight save failed: ${maleResult.error.message}` }, 400);
    }
    if (femaleResult.error) {
      return json(req, { ok: false, error: `Female weight save failed: ${femaleResult.error.message}` }, 400);
    }

    const { data: farmRows, error: farmError } = await supabase
      .from("farms")
      .select("id,farm_name")
      .eq("id", placement.farm_id)
      .limit(1);
    if (farmError) throw new Error(farmError.message);

    const { data: barnRows, error: barnError } = await supabase
      .from("barns")
      .select("id,barn_code")
      .eq("id", placement.barn_id)
      .limit(1);
    if (barnError) throw new Error(barnError.message);

    const [maleBenchmarkResult, femaleBenchmarkResult] = await Promise.all([
      maleBreedId && ageDays !== null
        ? supabase
            .from("stdbreedspec")
            .select("breedid,geneticname,age,dayfeedperbird,targetweight,note")
            .eq("breedid", maleBreedId)
            .eq("age", ageDays)
            .eq("is_active", true)
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
      femaleBreedId && ageDays !== null
        ? supabase
            .from("stdbreedspec")
            .select("breedid,geneticname,age,dayfeedperbird,targetweight,note")
            .eq("breedid", femaleBreedId)
            .eq("age", ageDays)
            .eq("is_active", true)
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (maleBenchmarkResult.error) throw new Error(maleBenchmarkResult.error.message);
    if (femaleBenchmarkResult.error) throw new Error(femaleBenchmarkResult.error.message);

    return json(req, {
      ok: true,
      male_saved: true,
      female_saved: true,
      item: {
        placement_id: placement.id,
        placement_code: placement.placement_key,
        farm_name: farmRows?.[0]?.farm_name ?? "",
        barn_code: barnRows?.[0]?.barn_code ?? "",
        flock_number: flock?.flock_number ?? null,
        placed_date: flock?.date_placed ?? null,
        log_date: logDate,
        placement_age_days: ageDays,
        male_benchmark: normalizeBenchmark(
          (maleBenchmarkResult.data?.[0] ?? null) as Record<string, unknown> | null,
          maleBreedId,
          ageDays,
        ),
        female_benchmark: normalizeBenchmark(
          (femaleBenchmarkResult.data?.[0] ?? null) as Record<string, unknown> | null,
          femaleBreedId,
          ageDays,
        ),
        male_sample: {
          id: maleResult.data?.id ?? null,
          sex: "male",
          cnt_weighed: maleResult.data?.cnt_weighed ?? null,
          avg_weight: maleResult.data?.avg_weight ?? null,
          stddev_weight: maleResult.data?.stddev_weight ?? null,
          procure: maleResult.data?.procure ?? null,
          other_note: maleResult.data?.other_note ?? null,
          is_active: maleResult.data?.is_active !== false,
          has_entry: true,
        },
        female_sample: {
          id: femaleResult.data?.id ?? null,
          sex: "female",
          cnt_weighed: femaleResult.data?.cnt_weighed ?? null,
          avg_weight: femaleResult.data?.avg_weight ?? null,
          stddev_weight: femaleResult.data?.stddev_weight ?? null,
          procure: femaleResult.data?.procure ?? null,
          other_note: femaleResult.data?.other_note ?? null,
          is_active: femaleResult.data?.is_active !== false,
          has_entry: true,
        },
      },
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
