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

function buildEmptySample(sex: "male" | "female", ageDays: number | null) {
  return {
    id: null,
    sex,
    cnt_weighed: null,
    avg_weight: null,
    stddev_weight: null,
    procure: null,
    other_note: null,
    is_active: true,
    has_entry: false,
    age_days: ageDays,
  };
}

function normalizeSample(row: Record<string, unknown> | null, sex: "male" | "female", ageDays: number | null) {
  if (!row) {
    return buildEmptySample(sex, ageDays);
  }

  return {
    id: typeof row.id === "string" ? row.id : null,
    sex,
    cnt_weighed: typeof row.cnt_weighed === "number" ? row.cnt_weighed : null,
    avg_weight: typeof row.avg_weight === "number" ? row.avg_weight : null,
    stddev_weight: typeof row.stddev_weight === "number" ? row.stddev_weight : null,
    procure: typeof row.procure === "number" ? row.procure : null,
    other_note: typeof row.other_note === "string" ? row.other_note : null,
    is_active: row.is_active !== false,
    has_entry: true,
    age_days: typeof row.age_days === "number" ? row.age_days : ageDays,
  };
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

  if (req.method !== "GET" && req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const url = new URL(req.url);
  const placementId = url.searchParams.get("placement_id");
  const logDate = url.searchParams.get("log_date");

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

    const [farmResult, barnResult, flockResult, weightResult] = await Promise.all([
      supabase.from("farms").select("id,farm_name").eq("id", placement.farm_id).limit(1),
      supabase.from("barns").select("id,barn_code").eq("id", placement.barn_id).limit(1),
      supabase.from("flocks").select("id,flock_number,date_placed,breed_males,breed_females").eq("id", placement.flock_id).limit(1),
      supabase.from("log_weight").select("*").eq("placement_id", placementId).eq("log_date", logDate).eq("is_active", true),
    ]);

    if (farmResult.error) throw new Error(farmResult.error.message);
    if (barnResult.error) throw new Error(barnResult.error.message);
    if (flockResult.error) throw new Error(flockResult.error.message);
    if (weightResult.error) throw new Error(weightResult.error.message);

    const farm = farmResult.data?.[0];
    const barn = barnResult.data?.[0];
    const flock = flockResult.data?.[0];
    const ageDays = typeof flock?.date_placed === "string" ? daysBetween(logDate, flock.date_placed) : null;
    const maleRow = (weightResult.data ?? []).find((row) => String(row.sex ?? "").toLowerCase().startsWith("m")) ?? null;
    const femaleRow = (weightResult.data ?? []).find((row) => String(row.sex ?? "").toLowerCase().startsWith("f")) ?? null;
    const maleBreedId = typeof flock?.breed_males === "string" ? flock.breed_males : null;
    const femaleBreedId = typeof flock?.breed_females === "string" ? flock.breed_females : null;

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
      item: {
        placement_id: placement.id,
        placement_code: placement.placement_key,
        farm_name: farm?.farm_name ?? "",
        barn_code: barn?.barn_code ?? "",
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
        male_sample: normalizeSample(maleRow as Record<string, unknown> | null, "male", ageDays),
        female_sample: normalizeSample(femaleRow as Record<string, unknown> | null, "female", ageDays),
      },
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
