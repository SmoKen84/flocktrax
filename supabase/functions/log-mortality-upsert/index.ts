import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
function corsHeaders(req) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type, x-adalo-test, x-client, x-legacy-jwt",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req)
    }
  });
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders(req)
    });
  }
  if (req.method !== "POST") {
    return json(req, {
      error: "Method not allowed"
    }, 405);
  }
  // Adalo Builder Test Mode (Schema Capture)
  if (req.headers.get("x-adalo-test") === "true") {
    return json(req, {
      ok: true,
      mode: "adalo_test",
      row: {
        id: "00000000-0000-0000-0000-000000000000",
        placement_id: "00000000-0000-0000-0000-000000000000",
        log_date: "2026-01-25",
        notes: "Adalo schema capture only"
      }
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(req, {
      error: "Server misconfigured (missing env)"
    }, 500);
  }
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(req, {
      error: "Missing or invalid Authorization header"
    }, 401);
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return json(req, {
      error: "Unauthorized",
      details: userErr?.message
    }, 401);
  }
  let payload;
  try {
    payload = await req.json();
  } catch  {
    return json(req, {
      error: "Body must be valid JSON"
    }, 400);
  }
  const placement_id = payload?.placement_id;
  const log_date = payload?.log_date;
  if (!placement_id || !log_date) {
    return json(req, {
      error: "Missing required fields",
      required: [
        "placement_id",
        "log_date"
      ]
    }, 400);
  }
  const allowedFields = [
    "placement_id",
    "log_date",
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
    "mortality_is_active"
  ];
  const deprecatedFields = [
    "age_days",
    "male_dead",
    "female_dead",
    "unknown_dead",
    "culls",
    "doa",
    "euthanized",
    "notes"
  ];
  const upsertRow = {};
  for (const key of allowedFields){
    if (payload[key] !== undefined) upsertRow[key] = payload[key];
  }
  // Preserve legacy compatibility for older callers that still post the old dead-count names.
  if (payload.dead_male === undefined && payload.male_dead !== undefined) {
    upsertRow.dead_male = payload.male_dead;
  }
  if (payload.dead_female === undefined && payload.female_dead !== undefined) {
    upsertRow.dead_female = payload.female_dead;
  }
  const ignoredDeprecatedFields = deprecatedFields.filter((key)=>payload[key] !== undefined);
  const { data, error } = await supabase.from("log_mortality").upsert(upsertRow, {
    onConflict: "placement_id,log_date"
  }).select("*").single();
  if (error) {
    return json(req, {
      error: "Upsert failed",
      details: error.message,
      hint: "If this is RLS, confirm the placement_id belongs to the logged-in user (placements.created_by = auth.uid())."
    }, 400);
  }
  return json(req, {
    ok: true,
    row: data,
    ignored_legacy_fields: ignoredDeprecatedFields
  }, 200);
});
