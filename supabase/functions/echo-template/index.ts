// echo-template: Minimal starter function you can always save and call
// - GET /echo-template
// - POST /echo-template  (application/json optional)
// No auth required by default. Add checks later if needed.
// Tip: Only edit the "EDIT HERE" block to change response content.
function json(res, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Connection", "keep-alive");
  return new Response(JSON.stringify(res), {
    ...init,
    headers
  });
}
Deno.serve(async (req)=>{
  try {
    const url = new URL(req.url);
    // Accept only this function’s route
    if (!url.pathname.startsWith("/echo-template")) {
      return json({
        error: "Not found"
      }, {
        status: 404
      });
    }
    // Parse request metadata (safe to log/echo for debugging)
    const method = req.method;
    const query = {};
    url.searchParams.forEach((v, k)=>query[k] = v);
    // Parse body if JSON
    let body = null;
    const ctype = req.headers.get("content-type")?.toLowerCase() || "";
    if (method !== "GET" && ctype.includes("application/json")) {
      try {
        body = await req.json();
      } catch  {
        body = {
          _parse_error: "Invalid JSON body"
        };
      }
    }
    // EDIT HERE: Put any static or computed payload you want to return
    const yourPayload = {
      //ok: true,
      //reason: "starter function ready",
      // Add any fields you’d like to confirm Adalo wiring
      //*********************************************************************
      id: "log_daily_pk_uuid",
      placement_id: "placement_id_uuid",
      log_date: "yyyy-dd-mm",
      age_days: "calculated now-place_date",
      am_temp: 89,
      set_temp: 90,
      ambient_temp: "extra_data_field",
      min_vent: "00 / 000",
      is_oda_open: "True/False",
      oda_exception: "Reason oda False",
      naoh: "<=000 ppm",
      comment: "long freeform text",
      is_active: "True/False",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: "user_uuid",
      created_by: "user_uuid"
    };
    // Helpful context included for debugging; keep or remove as you like
    const response = {
      data: yourPayload,
      _request: {
        method,
        path: url.pathname,
        query,
        has_json_body: body !== null,
        body
      }
    };
    return json(response, {
      status: 200
    });
  } catch (e) {
    console.error("echo-template error:", e);
    return json({
      error: "Internal Server Error"
    }, {
      status: 500
    });
  }
});
