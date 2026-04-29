import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getAuthenticatedUserId, getMobileAccessContext } from "../_shared/mobile-access.ts";

console.info("auth_me started");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
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

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return json({ error: "missing_bearer_token" }, 401);
  }

  try {
    const accessToken = auth.split(" ")[1];
    const supabase = getClient(accessToken);
    const userId = await getAuthenticatedUserId(supabase);
    const access = await getMobileAccessContext(supabase, userId);
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return json({ error: "user_lookup_failed", detail: authError.message }, 401);
    }

    const payload = authData.user;
    return json({
      user_id: payload?.id ?? null,
      email: payload?.email ?? null,
      role: access.role,
      can_write_daily_logs: access.permissions.daily_logs,
      can_write_log_mortality: access.permissions.log_mortality,
      can_write_weight_samples: access.permissions.weight_samples,
      can_write_feed_tickets: access.permissions.feed_tickets,
      can_write_grade_birds: access.permissions.grade_birds,
      expires_at: null,
    });
  } catch (error) {
    return json({ error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
