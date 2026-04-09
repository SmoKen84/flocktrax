import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.15.4/index.ts";

const LOCAL_SUPABASE_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

function corsHeaders(req) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "";
  return {
    "Access-Control-Allow-Origin": origin,
    // Echo requested headers so Adalo's x-adalo-test (and anything else) is allowed
    "Access-Control-Allow-Headers": reqHeaders || "authorization, content-type, x-adalo-test",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Headers"
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
function redactToken(token) {
  if (!token) return "";
  if (token.length <= 16) return token;
  return `${token.slice(0, 8)}...${token.slice(-8)}`;
}
function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets");
  return createClient(url, serviceRole, {
    auth: {
      persistSession: false
    }
  });
}
function resolveJwtSecret() {
  const configuredSecret = Deno.env.get("FTX_JWT_SECRET") ?? Deno.env.get("SUPABASE_INTERNAL_JWT_SECRET") ?? Deno.env.get("JWT_SECRET") ?? Deno.env.get("SUPABASE_JWT_SECRET");
  if (configuredSecret) return configuredSecret;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost") || supabaseUrl.includes("kong:8000")) {
    return LOCAL_SUPABASE_JWT_SECRET;
  }
  throw new Error("Missing FTX_JWT_SECRET secret");
}
async function mintToken(args) {
  const secret = resolveJwtSecret();
  const key = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = 8 * 60 * 60; // 8 hours
  const exp = now + ttlSeconds;
  const token = await new jose.SignJWT({
    adalo_user_id: args.adalo_user_id,
    email: args.email ?? null,
    role: "authenticated"
  }).setProtectedHeader({
    alg: "HS256",
    typ: "JWT"
  }).setSubject(args.user_id) // sub is UUID string (app_users.user_id)
  .setAudience("authenticated")
  .setIssuedAt(now).setExpirationTime(exp).sign(key);
  return {
    token,
    exp,
    expires_at: new Date(exp * 1000).toISOString()
  };
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders(req)
  });
  try {
    // --- Robust Adalo-safe body parsing ---
    const raw = await req.text();
    // If Adalo sends an empty body, don't crash
    const body = raw ? JSON.parse(raw) : {};
    const adalo_user_id = body.adalo_user_id;
    const email = body.email;
    const display_name = body.display_name;
    if (req.headers.get("x-adalo-test") === "true") {
      return json(req, {
        ok: 1,
        user_id: "00000000-0000-0000-0000-000000000000",
        token: "",
        exp: 0,
        expires_at: "",
        message: "Adalo test mode",
        mode: "adalo_test",
        debug: {
          method: req.method,
          content_type: req.headers.get("content-type") ?? "",
          apikey_present: !!(req.headers.get("apikey") ?? req.headers.get("Apikey")),
          has_authorization_header: !!(req.headers.get("authorization") ?? req.headers.get("Authorization")),
          authorization_token_preview: redactToken((req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")),
          body_keys: Object.keys(body).sort(),
          body,
          parsed: {
            adalo_user_id,
            email: typeof email === "string" ? email : null,
            display_name: typeof display_name === "string" ? display_name : null,
            adalo_user_id_present: typeof adalo_user_id === "string" && adalo_user_id.length > 0
          }
        }
      });
    }
    if (!adalo_user_id || typeof adalo_user_id !== "string") {
      return json(req, {
        ok: false,
        error: "adalo_user_id is required (string)"
      }, 400);
    }
    const admin = getAdminClient();
    const { data: up, error: upErr } = await admin.from("app_users").upsert({
      adalo_user_id,
      email: typeof email === "string" ? email : null,
      display_name: typeof display_name === "string" ? display_name : null,
      active: true,
      last_seen_at: new Date().toISOString()
    }, {
      onConflict: "adalo_user_id"
    }).select("user_id, adalo_user_id, email, active").limit(1);
    if (upErr) return json(req, {
      ok: false,
      error: upErr.message
    }, 500);
    const row = up?.[0];
    if (!row?.user_id) return json(req, {
      ok: false,
      error: "Failed to resolve user_id"
    }, 500);
    if (row.active === false) return json(req, {
      ok: false,
      error: "User is inactive"
    }, 403);
    // Ensure canonical identity row exists (FK target for farm_memberships)
    const { error: coreErr } = await admin.from("core_users").upsert({
      id: row.user_id
    }, {
      onConflict: "id"
    });
    if (coreErr) return json(req, {
      ok: false,
      error: `core_users upsert failed: ${coreErr.message}`
    }, 500);
    const { token, exp, expires_at } = await mintToken({
      user_id: row.user_id,
      adalo_user_id: row.adalo_user_id,
      email: row.email ?? undefined
    });
    return json(req, {
      ok: 1,
      user_id: row.user_id,
      token,
      exp,
      expires_at,
      message: "Ok"
    });
  } catch (e) {
    // return json(req, { ok: false, error: String(e?.message ?? e) }, 500);
    // return json(req, { ok: 0, error: String(e?.message ?? e) }, 400);
    return json(req, {
      ok: 0,
      user_id: "",
      token: "",
      exp: 0,
      expires_at: "",
      message: String(e?.message ?? e)
    }, 400);
  }
});
