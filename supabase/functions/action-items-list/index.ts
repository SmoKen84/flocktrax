import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getServiceClient,
  mapIssueRow,
  mapIssueUpdateRow,
  type IssueUpdateItem,
} from "../_shared/issues.ts";
import { getAuthenticatedUserId } from "../_shared/mobile-access.ts";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function parseAuthHeader(req: Request) {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
}

function getClient(accessToken: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, detectSessionInUrl: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "GET") return json(req, { ok: false, error: "Method not allowed" }, 405);

  const accessToken = parseAuthHeader(req);
  if (!accessToken) return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);

  try {
    const includeResolved = ["1", "true", "yes"].includes(
      (new URL(req.url).searchParams.get("include_resolved") ?? "").toLowerCase(),
    );
    const supabase = getClient(accessToken);
    const service = getServiceClient();
    const userId = await getAuthenticatedUserId(supabase);
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError) throw new Error(adminError.message);

    const [farmMembershipResult, groupMembershipResult] = await Promise.all([
      supabase.from("farm_memberships").select("farm_id").eq("user_id", userId).eq("is_active", true),
      supabase.from("farm_group_memberships").select("farm_group_id").eq("user_id", userId).eq("active", true),
    ]);
    if (farmMembershipResult.error) throw new Error(farmMembershipResult.error.message);
    if (groupMembershipResult.error) throw new Error(groupMembershipResult.error.message);

    const directFarmIds = (farmMembershipResult.data ?? [])
      .map((row) => row.farm_id)
      .filter((value): value is string => typeof value === "string");
    const groupIds = (groupMembershipResult.data ?? [])
      .map((row) => row.farm_group_id)
      .filter((value): value is string => typeof value === "string");

    let farmsQuery = service.from("farms").select("id,farm_name,farm_group_id").order("farm_name");
    if (isAdmin !== true) {
      const filters: string[] = [];
      if (directFarmIds.length > 0) filters.push(`id.in.(${directFarmIds.join(",")})`);
      if (groupIds.length > 0) filters.push(`farm_group_id.in.(${groupIds.join(",")})`);
      if (filters.length === 0) return json(req, { ok: true, items: [], farms: [], barns: [] });
      farmsQuery = farmsQuery.or(filters.join(","));
    }

    const { data: farms, error: farmsError } = await farmsQuery;
    if (farmsError) throw new Error(farmsError.message);
    const farmIds = (farms ?? []).map((farm) => farm.id).filter((value): value is string => typeof value === "string");
    if (farmIds.length === 0) return json(req, { ok: true, items: [], farms: [], barns: [] });

    const { data: barns, error: barnsError } = await service
      .from("barns")
      .select("id,barn_code,farm_id")
      .in("farm_id", farmIds)
      .order("barn_code");
    if (barnsError) throw new Error(barnsError.message);
    const barnIds = (barns ?? []).map((barn) => barn.id).filter((value): value is string => typeof value === "string");

    const { data: placements, error: placementsError } = await service
      .from("placements")
      .select("id,placement_key,farm_id,barn_id")
      .in("farm_id", farmIds);
    if (placementsError) throw new Error(placementsError.message);
    const placementIds = (placements ?? []).map((row) => row.id).filter((value): value is string => typeof value === "string");

    const issueFilters: string[] = [];
    if (barnIds.length > 0) issueFilters.push(`and(entity_type.eq.barn,entity_id.in.(${barnIds.join(",")}))`);
    if (placementIds.length > 0) issueFilters.push(`and(entity_type.eq.placement,entity_id.in.(${placementIds.join(",")}))`);
    if (issueFilters.length === 0) return json(req, { ok: true, items: [], farms, barns });

    const { data: issueRows, error: issuesError } = await service
      .from("issues")
      .select("id,entity_type,entity_id,issue_type,title,description,status,opened_at,resolved_at,resolution_note,related_placement_id,reported_log_date,opened_by,updated_by")
      .in("status", includeResolved ? ["open", "resolved"] : ["open"])
      .or(issueFilters.join(","))
      .order("opened_at", { ascending: false });
    if (issuesError) throw new Error(issuesError.message);

    const issues = (issueRows ?? []).map((row) => mapIssueRow(row as Record<string, unknown>));
    const issueIds = issues.map((issue) => issue.id);
    const updatesByIssueId = new Map<string, IssueUpdateItem[]>();
    if (issueIds.length > 0) {
      const { data: updates, error: updatesError } = await service
        .from("issue_updates")
        .select("id,issue_id,entry_type,entry_text,effective_date,created_at,created_by")
        .in("issue_id", issueIds)
        .order("created_at", { ascending: true });
      if (updatesError) throw new Error(updatesError.message);
      for (const row of updates ?? []) {
        const update = mapIssueUpdateRow(row as Record<string, unknown>);
        const list = updatesByIssueId.get(update.issue_id) ?? [];
        list.push(update);
        updatesByIssueId.set(update.issue_id, list);
      }
    }

    const farmById = new Map((farms ?? []).map((farm) => [farm.id, farm]));
    const barnById = new Map((barns ?? []).map((barn) => [barn.id, barn]));
    const placementById = new Map((placements ?? []).map((placement) => [placement.id, placement]));
    const { data: authUsers, error: authUsersError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authUsersError) throw new Error(authUsersError.message);
    const userNameById = new Map(
      authUsers.users.map((user) => [
        user.id,
        String(
          user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.user_metadata?.display_name ??
            user.email ??
            "Unknown User",
        ),
      ]),
    );

    const items = issues.map((issue) => {
      const placement = issue.related_placement_id ? placementById.get(issue.related_placement_id) : null;
      const barnId = issue.entity_type === "barn" ? issue.entity_id : placement?.barn_id ?? null;
      const barn = barnId ? barnById.get(barnId) : null;
      const farmId = placement?.farm_id ?? barn?.farm_id ?? null;
      const farm = farmId ? farmById.get(farmId) : null;
      return {
        ...issue,
        updates: (updatesByIssueId.get(issue.id) ?? []).map((update) => ({
          ...update,
          created_by_name: update.created_by ? userNameById.get(update.created_by) ?? null : null,
        })),
        farm_id: farmId,
        farm_name: farm?.farm_name ?? "Unknown Farm",
        farm_group_id: farm?.farm_group_id ?? null,
        barn_id: barnId,
        barn_code: barn?.barn_code ?? "Unknown Barn",
        placement_code: placement?.placement_key ?? null,
        created_by_name: issue.opened_by ? userNameById.get(issue.opened_by) ?? null : null,
        updated_by_name: issue.updated_by ? userNameById.get(issue.updated_by) ?? null : null,
      };
    });

    return json(req, { ok: true, items, farms, barns });
  } catch (error) {
    return json(req, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
