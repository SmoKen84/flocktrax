// Updated auth-login: accepts JSON body or query params, returns clear 4xx errors
// Assumptions:
// - Using Supabase Auth: signInWithPassword via @supabase/supabase-js
// - Environment vars SUPABASE_URL and SUPABASE_ANON_KEY are available automatically
// - Route is /auth-login (function name prefix is handled by platform)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
console.info("auth-login function started");
function badRequest(message, detail) {
  return new Response(JSON.stringify({
    error: message,
    ...detail ? {
      detail
    } : {}
  }), {
    status: 400,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
function serverError(message = "Internal Server Error", detail) {
  return new Response(JSON.stringify({
    error: message,
    ...detail ? {
      detail
    } : {}
  }), {
    status: 500,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
function ok(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
Deno.serve({
  onError: (e)=>{
    console.error("Unhandled error:", e);
    return serverError();
  }
}, async (req)=>{
  if (req.method !== "POST") {
    return badRequest("method_not_allowed", {
      allowed: "POST"
    });
  }
  const url = new URL(req.url);
  const params = url.searchParams;
  let email = null;
  let password = null;
  // Try JSON body first; gracefully handle empty body
  try {
    if (req.headers.get("content-length") !== "0") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const body = await req.json().catch(()=>null);
        if (body && typeof body === "object") {
          email = typeof body.email === "string" ? body.email : null;
          password = typeof body.password === "string" ? body.password : null;
        }
      }
    }
  } catch (e) {
    console.warn("JSON parse failed, falling back to query params", e);
  }
  // Fallback to query params
  if (!email) email = params.get("email");
  if (!password) password = params.get("password");
  if (!email || !password) {
    return badRequest("missing_credentials", {
      hint: "Send JSON body { email, password } or use ?email=...&password=...",
      received: {
        has_body: req.headers.get("content-length") !== "0",
        has_email: Boolean(email),
        has_password: Boolean(password)
      }
    });
  }
  // Basic normalization
  email = email.trim();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing Supabase envs");
    return serverError("missing_environment", {
      required: [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY"
      ]
    });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      // Return as 401 to signal bad credentials explicitly
      return new Response(JSON.stringify({
        error: error.message,
        code: error.name || "auth_error"
      }), {
        status: 401,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Limit the response payload; return access_token and user basics
    return ok({
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      token_type: data.session ? "bearer" : null,
      user: data.user ? {
        id: data.user.id,
        email: data.user.email
      } : null
    });
  } catch (e) {
    console.error("auth.signInWithPassword failed", e);
    return serverError();
  }
});
