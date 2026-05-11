import { createClient } from "npm:@supabase/supabase-js@2.45.4";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders =
    req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type";

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

function parseBearerToken(req: Request) {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return auth.slice(7).trim();
}

function getUserClient(accessToken: string) {
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
      autoRefreshToken: false,
    },
  });
}

function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
      autoRefreshToken: false,
    },
  });
}

async function bestEffortCleanup(
  service: ReturnType<typeof createClient>,
  userId: string,
) {
  const operations: Promise<unknown>[] = [
    service.from("user_roles").delete().eq("user_id", userId),
    service.from("farm_memberships").delete().eq("user_id", userId),
    service.from("farm_group_memberships").delete().eq("user_id", userId),
    service.from("profiles").delete().eq("id", userId),
    service.from("app_users").delete().eq("user_id", userId),
    service.from("core_users").delete().eq("id", userId),
  ];

  await Promise.allSettled(operations);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "method_not_allowed" }, 405);
  }

  const accessToken = parseBearerToken(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "missing_bearer_token" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
  if (confirmation.toUpperCase() !== "DELETE") {
    return json(req, { ok: false, error: "delete_confirmation_required" }, 400);
  }

  try {
    const userClient = getUserClient(accessToken);
    const service = getServiceClient();

    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;

    if (authError || !user) {
      return json(req, { ok: false, error: authError?.message ?? "Unauthorized" }, 401);
    }

    await bestEffortCleanup(service, user.id);

    const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return json(req, { ok: false, error: deleteError.message }, 500);
    }

    return json(req, {
      ok: true,
      deleted_user_id: user.id,
      deleted_email: user.email ?? null,
    });
  } catch (error) {
    return json(
      req,
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
