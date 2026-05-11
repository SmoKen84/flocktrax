import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getServiceClient,
  issueTypeLabel,
  loadOpenIssueBundle,
  normalizeIssueType,
} from "../_shared/issues.ts";
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

function isDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
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
  const entityType = payload.entity_type === "barn" ? "barn" : payload.entity_type === "placement" ? "placement" : null;
  const entityId = typeof payload.entity_id === "string" ? payload.entity_id : null;
  const placementId = typeof payload.placement_id === "string" ? payload.placement_id : null;
  const issueType = entityType ? normalizeIssueType(payload.issue_type, entityType) : null;
  const description = normalizeNullableText(payload.description);
  const reportedLogDate = payload.reported_log_date == null ? null : typeof payload.reported_log_date === "string"
    ? payload.reported_log_date
    : null;

  if (!entityType || !isUuid(entityId) || !isUuid(placementId) || !issueType) {
    return json(req, { ok: false, error: "Invalid or missing entity_type, entity_id, placement_id, or issue_type." }, 400);
  }

  if (reportedLogDate && !isDate(reportedLogDate)) {
    return json(req, { ok: false, error: "reported_log_date must be a valid YYYY-MM-DD date." }, 400);
  }

  try {
    const supabase = getClient(accessToken);
    const service = getServiceClient();
    const userId = await getAuthenticatedUserId(supabase);

    const { data: placementRows, error: placementError } = await service
      .from("placements")
      .select("id,farm_id,barn_id,is_active")
      .eq("id", placementId)
      .limit(1);

    if (placementError) {
      return json(req, { ok: false, error: placementError.message }, 400);
    }

    const placement = placementRows?.[0];
    if (!placement) {
      return json(req, { ok: false, error: "Placement not found." }, 404);
    }

    if (entityType === "placement" && entityId !== placement.id) {
      return json(req, { ok: false, error: "Placement issues must target the current placement." }, 400);
    }

    if (entityType === "barn" && entityId !== placement.barn_id) {
      return json(req, { ok: false, error: "Barn issues must target the barn tied to the current placement." }, 400);
    }

    const access = await getMobileAccessContext(supabase, userId, placement.farm_id);
    if (!access.permissions.daily_logs) {
      return json(req, { ok: false, error: "You are not authorized to manage operational issues." }, 403);
    }

    const { error: insertError } = await service
      .from("issues")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        issue_type: issueType,
        title: issueTypeLabel(issueType),
        description,
        status: "open",
        related_placement_id: placement.id,
        reported_log_date: reportedLogDate,
        opened_by: userId,
      });

    if (insertError) {
      return json(req, { ok: false, error: insertError.message }, 400);
    }

    const bundle = await loadOpenIssueBundle(service, placement.id, placement.barn_id);
    return json(req, { ok: true, bundle });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
