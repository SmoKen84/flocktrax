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

function parseBoolean(value: string | null) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.headers.get("x-adalo-test") === "true") {
    return json(req, [
      {
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
  const includeInactive = parseBoolean(url.searchParams.get("include_inactive")) || body.include_inactive === true;

  try {
    const supabase = getClient(accessToken);
    let query = supabase
      .from("placements_dashboard_ui")
      .select("placement_id,farm_name,barn_code,placement_code,placed_date,est_first_catch,age_days,head_count,is_active,is_removed,is_complete,is_in_barn,is_settled,sort_code")
      .order("farm_name", { ascending: true })
      .order("sort_code", { ascending: true })
      .order("placed_date", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return json(req, { error: error.message }, 400);
    }

    return json(req, data ?? []);
  } catch (error) {
    return json(req, { error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
