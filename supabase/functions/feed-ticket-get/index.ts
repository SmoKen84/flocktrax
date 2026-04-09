import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type, x-adalo-test";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    },
  });
}

function isUuid(value: string | null | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function emptyDraft() {
  return {
    id: null,
    ticket_number: null,
    delivered_at: new Date().toISOString(),
    ticket_weight_lbs: null,
    feed_name: null,
    vendor_name: null,
    source_type: null,
    note: null,
    bins: [],
    drops: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  try {
    const userClient = getUserClient(accessToken);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json(req, { ok: false, error: authError?.message ?? "Unauthorized" }, 401);
    }

    const service = getServiceClient();
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticket_id");

    const [binsResult, placementsResult] = await Promise.all([
      service
        .from("feedbins")
        .select("id,farm_id,barn_id,bin_num,capacity")
        .order("bin_num", { ascending: true }),
      service
        .from("placements")
        .select("id,barn_id,placement_key,is_active,date_removed")
        .eq("is_active", true)
        .is("date_removed", null),
    ]);

    if (binsResult.error) throw new Error(binsResult.error.message);
    if (placementsResult.error) throw new Error(placementsResult.error.message);

    const barnIds = Array.from(new Set((binsResult.data ?? []).map((row) => row.barn_id).filter(Boolean)));
    const barnsResult = barnIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("barns")
          .select("id,barn_code,farm_id")
          .in("id", barnIds);

    if (barnsResult.error) throw new Error(barnsResult.error.message);

    const farmIds = Array.from(new Set((barnsResult.data ?? []).map((row) => row.farm_id).filter(Boolean)));
    const farmsResult = farmIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("farms")
          .select("id,farm_name")
          .in("id", farmIds);

    if (farmsResult.error) throw new Error(farmsResult.error.message);

    const barnById = new Map((barnsResult.data ?? []).map((row) => [row.id, row]));
    const farmById = new Map((farmsResult.data ?? []).map((row) => [row.id, row]));
    const placementByBarnId = new Map(
      (placementsResult.data ?? []).map((row) => [row.barn_id, row]),
    );

    const bins = (binsResult.data ?? []).map((row) => {
      const barn = barnById.get(row.barn_id);
      const farm = barn?.farm_id ? farmById.get(barn.farm_id) : null;
      const placement = placementByBarnId.get(row.barn_id);

      return {
        feed_bin_id: row.id,
        farm_id: row.farm_id,
        barn_id: row.barn_id,
        barn_code: barn?.barn_code ?? "",
        farm_name: farm?.farm_name ?? null,
        bin_code: row.bin_num === null || row.bin_num === undefined ? "" : String(row.bin_num),
        capacity_lbs: typeof row.capacity === "number" ? row.capacity : null,
        active_placement_id: placement?.id ?? null,
        active_placement_code: placement?.placement_key ?? null,
      };
    });

    let item = emptyDraft();
    item.bins = bins;

    if (isUuid(ticketId)) {
      const [ticketResult, dropsResult] = await Promise.all([
        service
          .from("feed_tickets")
          .select("id,ticket_num,feedmill,delivery_date,comment,feed_weight,feed_name,source_type")
          .eq("id", ticketId)
          .limit(1),
        service
          .from("feed_drops")
          .select("id,feed_bin_id,placement_id,placement_code,type,drop_weight,drop_order,comment,bin_code,barn_id")
          .eq("feed_ticket_id", ticketId)
          .order("drop_order", { ascending: true }),
      ]);

      if (ticketResult.error) throw new Error(ticketResult.error.message);
      if (dropsResult.error) throw new Error(dropsResult.error.message);

      const ticket = ticketResult.data?.[0];
      if (ticket) {
        const binById = new Map(bins.map((bin) => [bin.feed_bin_id, bin]));
        item = {
          id: ticket.id,
          ticket_number: ticket.ticket_num ?? null,
          delivered_at: ticket.delivery_date ? `${ticket.delivery_date}T00:00:00.000Z` : new Date().toISOString(),
          ticket_weight_lbs: typeof ticket.feed_weight === "number" ? ticket.feed_weight : null,
          feed_name: ticket.feed_name ?? null,
          vendor_name: ticket.feedmill ?? null,
          source_type: ticket.source_type ?? "mill",
          note: ticket.comment ?? null,
          bins,
          drops: (dropsResult.data ?? []).map((drop) => {
            const bin = drop.feed_bin_id ? binById.get(drop.feed_bin_id) : null;
            return {
              id: drop.id,
              feed_bin_id: drop.feed_bin_id ?? null,
              bin_code: bin?.bin_code ?? drop.bin_code ?? null,
              barn_code: bin?.barn_code ?? null,
              placement_id: drop.placement_id ?? null,
              placement_code: drop.placement_code ?? bin?.active_placement_code ?? null,
              feed_type: drop.type ?? null,
              drop_weight_lbs: typeof drop.drop_weight === "number" ? drop.drop_weight : null,
              note: drop.comment ?? null,
              drop_order: typeof drop.drop_order === "number" ? drop.drop_order : 1,
            };
          }),
        };
      }
    }

    return json(req, { ok: true, item });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
