// Redeem a sign-up code and grant membership in public.farm_memberships
// Assumptions:
// - Table public.signup_codes(code text unique, farm_id uuid, role_id uuid, max_uses int, uses int, expires_at timestamptz, active boolean, created_at timestamptz, updated_at timestamptz)
// - Table public.farm_memberships(user_id uuid, farm_id uuid, role_id uuid, is_active boolean, created_at timestamptz, updated_at timestamptz)
// - Composite PK on farm_memberships(user_id, farm_id, role_id)
// - Caller is authenticated (bearer token). We use auth.uid() equivalent via supabase client.
// - RLS: farm_memberships should allow inserts/updates by authenticated users to their own user_id, or this function uses service role if needed.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
function json(res, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Connection": "keep-alive"
    }
  });
}
function badRequest(message) {
  return json({
    error: message
  }, 400);
}
function unauthorized(message = "Unauthorized") {
  return json({
    error: message
  }, 401);
}
function forbidden(message = "Forbidden") {
  return json({
    error: message
  }, 403);
}
function serverError(message) {
  return json({
    error: message
  }, 500);
}
Deno.serve(async (req)=>{
  try {
    if (req.method !== "POST") return badRequest("Use POST with JSON { code }");
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) return unauthorized();
    const accessToken = authHeader.split(" ")[1];
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return serverError("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    // Authed client with the end-user token (RLS context = the user)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });
    // Service client for atomic updates if RLS blocks updating signup_codes
    const serviceClient = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
    const { data: user, error: getUserErr } = await userClient.auth.getUser();
    if (getUserErr || !user?.user) return unauthorized("Invalid or expired token");
    const userId = user.user.id;
    const body = await req.json().catch(()=>({}));
    const code = (body.code || "").trim();
    if (!code) return badRequest("code is required");
    // Fetch code row (service or user client; prefer service to bypass RLS on codes)
    const clientForCodes = serviceClient ?? userClient;
    const { data: codeRow, error: codeErr } = await clientForCodes.from("signup_codes").select("id, code, farm_id, role_id, max_uses, uses, expires_at, active").eq("code", code).limit(1).maybeSingle();
    if (codeErr) return serverError(`Error fetching code: ${codeErr.message}`);
    if (!codeRow) return badRequest("Invalid code");
    if (!codeRow.active) return forbidden("Code is inactive");
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) return forbidden("Code expired");
    if (typeof codeRow.max_uses === "number" && codeRow.uses >= codeRow.max_uses) return forbidden("Code usage limit reached");
    // Upsert membership for the user
    const nowIso = new Date().toISOString();
    const membership = {
      user_id: userId,
      farm_id: codeRow.farm_id,
      role_id: codeRow.role_id,
      is_active: true,
      created_at: nowIso,
      updated_at: nowIso
    };
    // Use service client for membership if RLS might block cross-scope inserts
    const clientForMemberships = userClient; // Prefer user context first for least privilege
    // Try user insert; if blocked and service key exists, fallback to service
    let upsertErr = null;
    {
      const { error } = await clientForMemberships.from("farm_memberships").upsert(membership, {
        onConflict: "user_id,farm_id,role_id"
      }).select("user_id, farm_id, role_id, is_active").maybeSingle();
      if (error) upsertErr = error;
    }
    if (upsertErr && serviceClient) {
      const { error } = await serviceClient.from("farm_memberships").upsert({
        ...membership,
        created_at: undefined
      }, {
        onConflict: "user_id,farm_id,role_id"
      }).select("user_id, farm_id, role_id, is_active").maybeSingle();
      if (error) return serverError(`Membership upsert failed: ${error.message}`);
      upsertErr = null;
    }
    if (upsertErr) return forbidden(`Membership upsert blocked: ${upsertErr.message}`);
    // Update code usage atomically
    if (serviceClient) {
      const { error: useErr } = await serviceClient.rpc("redeem_signup_code", {
        p_code: code
      });
      if (useErr) return serverError(`Failed to update code usage: ${useErr.message}`);
    } else {
      // Fallback: best-effort non-atomic update with user client
      const nextUses = (codeRow.uses ?? 0) + 1;
      const deactivate = typeof codeRow.max_uses === "number" && nextUses >= codeRow.max_uses;
      const { error: updateErr } = await userClient.from("signup_codes").update({
        uses: nextUses,
        active: deactivate ? false : codeRow.active,
        updated_at: nowIso
      }).eq("code", code);
      if (updateErr) return serverError(`Failed to update code usage: ${updateErr.message}`);
    }
    return json({
      ok: true,
      farm_id: codeRow.farm_id,
      role_id: codeRow.role_id
    });
  } catch (e) {
    console.error(e);
    return serverError("Unexpected error");
  }
});
