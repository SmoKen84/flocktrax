import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceClient, loadOpenIssueBundle } from "../_shared/issues.ts";
import { getAuthenticatedUserId, getMobileAccessContext } from "../_shared/mobile-access.ts";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type";

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

function isUuid(value: string | null | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeNullableText(value: unknown) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const payload = await readBody(req);
  const issueId = typeof payload.issue_id === "string" ? payload.issue_id : null;
  const resolutionNote = normalizeNullableText(payload.resolution_note);

  if (!isUuid(issueId)) {
    return json(req, { ok: false, error: "Invalid or missing issue_id." }, 400);
  }

  try {
    const supabase = getClient(accessToken);
    const service = getServiceClient();
    const userId = await getAuthenticatedUserId(supabase);

    const { data: issueRows, error: issueError } = await service
      .from("issues")
      .select("id,status,entity_type,entity_id,related_placement_id")
      .eq("id", issueId)
      .limit(1);

    if (issueError) {
      return json(req, { ok: false, error: issueError.message }, 400);
    }

    const issue = issueRows?.[0];
    if (!issue) {
      return json(req, { ok: false, error: "Issue not found." }, 404);
    }

    if (issue.status !== "open") {
      return json(req, { ok: false, error: "Issue is already resolved." }, 400);
    }

    const placementContextId =
      typeof issue.related_placement_id === "string" && issue.related_placement_id.length > 0
        ? issue.related_placement_id
        : issue.entity_type === "placement" && typeof issue.entity_id === "string"
        ? issue.entity_id
        : null;

    if (!placementContextId || !isUuid(placementContextId)) {
      return json(req, { ok: false, error: "Issue is missing placement context." }, 400);
    }

    const { data: placementRows, error: placementError } = await service
      .from("placements")
      .select("id,farm_id,barn_id")
      .eq("id", placementContextId)
      .limit(1);

    if (placementError) {
      return json(req, { ok: false, error: placementError.message }, 400);
    }

    const placement = placementRows?.[0];
    if (!placement) {
      return json(req, { ok: false, error: "Placement context not found." }, 404);
    }

    const access = await getMobileAccessContext(supabase, userId, placement.farm_id);
    if (!access.permissions.daily_logs) {
      return json(req, { ok: false, error: "You are not authorized to manage operational issues." }, 403);
    }

    const { error: updateError } = await service
      .from("issues")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_note: resolutionNote,
      })
      .eq("id", issueId);

    if (updateError) {
      return json(req, { ok: false, error: updateError.message }, 400);
    }

    const bundle = await loadOpenIssueBundle(service, placement.id, placement.barn_id);
    return json(req, { ok: true, bundle });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
