// deno-lint-ignore-file no-explicit-any
// log-daily-get: Return the unique daily log row by placement_id + log_date
// Assumptions:
// - Table: public.log_daily
// - Columns: placement_id (uuid), log_date (date)
// - Unique constraint on (placement_id, log_date)
// - RLS enabled; access governed by existing policies
//
// Auth: Authorization: Bearer <session_token>
// Input:
//   - GET /log-daily-get?placement_id=<uuid>&log_date=<YYYY-MM-DD>
//   - POST /log-daily-get  { placement_id: string, log_date: string }
// Responses:
//   - 200: { data: <row> }
//   - 400: { error: '...' }
//   - 401: { error: 'Unauthorized' }
//   - 404: { error: 'Not found' }
//   - 409: { error: 'Multiple rows found' }
//==================================================================================



import { createClient } from "npm:@supabase/supabase-js@2.44.4";

console.log("start");

const accessToken = parseAuthHeader(req);

console.log("have_token", !!accessToken);

console.log("envs", {
  has_url: !!Deno.env.get("SUPABASE_URL"),
  has_key: !!Deno.env.get("SUPABASE_ANON_KEY")
});

const supabase = getSupabaseClient(accessToken);

console.log("client_ok");

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Connection", "keep-alive");
  return new Response(JSON.stringify(body), {
    ...init,
    headers
  });
}

function getSupabaseClient(accessToken) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  return client;
}

function parseAuthHeader(req1) {
  const auth = req1.headers.get("authorization") || req1.headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function parseParamsFromUrl(url1) {
  const placement_id1 = url1.searchParams.get("placement_id") ?? undefined;
  const log_date1 = url1.searchParams.get("log_date") ?? undefined;
  return {
    placement_id: placement_id1,
    log_date: log_date1
  };
}

async function parseBody(req1) {
  const contentType = req1.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("application/json")) {
    try {
      const body = await req1.json();
      return {
        placement_id: body.placement_id,
        log_date: body.log_date
      };
    } catch  {
      return {};
    }
  }
  return {};
}

console.log("params", {
  placement_id,
  log_date,
  method: req.method,
  path: url.pathname
});

function validateUuid(v) {
  if (!v) return false;
  // Accept any 36-char UUID with dashes
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function validateDate(v) {
  if (!v) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Ensure it round-trips to same Y-M-D (catches 2024-02-31)
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}


Deno.serve(async (req1)=>{
  try {
    // Route handling (single route, supports GET/POST)
    const url1 = new URL(req1.url);
    if (!url1.pathname.startsWith("/log-daily-get")) {
      return jsonResponse({
        error: "Not found"
      }, {
        status: 404
      });
    }
    // Auth
    const accessToken = parseAuthHeader(req1);
    if (!accessToken) return jsonResponse({
      error: "Unauthorized"
    }, {
      status: 401
    });
    const supabase = getSupabaseClient(accessToken);
    // Params
    let params = {};
    if (req1.method === "GET") {
      params = parseParamsFromUrl(url1);
    } else if (req1.method === "POST") {
      const bodyParams = await parseBody(req1);
      params = bodyParams;
    } else {
      return jsonResponse({
        error: "Method not allowed"
      }, {
        status: 405
      });
    }
    const { placement_id: placement_id1, log_date: log_date1 } = params;

    if (!validateUuid(placement_id1) || !validateDate(log_date1)) {
      return jsonResponse({
        error: "Invalid or missing placement_id or log_date"
      }, {
        status: 400
      });
    }
    // Query with RLS scope of the provided token
    const { data, error } = await supabase.from("log_daily").select("*", {
      count: "exact"
    }).eq("placement_id", placement_id1).eq("log_date", log_date1).limit(2); // guard against duplicates

  if (error) {
      // Surface permission issues distinctly
      if (error.code === "PGRST301" || error.message?.toLowerCase().includes("permission")) {
        return jsonResponse({
          error: "Forbidden"
        }, {
          status: 403
        });
      }
      return jsonResponse({
        error: error.message ?? "Query error"
      }, {
        status: 400
      });
    }
    if (!data || data.length === 0) {
      return jsonResponse({
        error: "Not found"
      }, {
        status: 404
      });
    }
    if (data.length > 1) {
      return jsonResponse({
        error: "Multiple rows found"
      }, {
        status: 409
      });
    }
    return jsonResponse({
      data: data[0]
    }, {
      status: 200
    });
  } catch (e) {
    console.error("log-daily-get error:", e);
    return jsonResponse({
      error: "Internal Server Error"
    }, {
      status: 500
    });
  }
});
