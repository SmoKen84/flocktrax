import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type, x-adalo-test";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "GET") {
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
    const ticketNumber = url.searchParams.get("ticket_number")?.trim() ?? null;
    const flockCode = url.searchParams.get("flock_code")?.trim() ?? null;
    const dateFrom = url.searchParams.get("date_from")?.trim() ?? null;
    const dateTo = url.searchParams.get("date_to")?.trim() ?? null;

    let eligibleTicketIds: string[] | null = null;
    if (flockCode) {
      const matchingDropsResult = await service
        .from("feed_drops")
        .select("feed_ticket_id")
        .ilike("placement_code", `%${flockCode}%`);
      if (matchingDropsResult.error) throw new Error(matchingDropsResult.error.message);
      eligibleTicketIds = Array.from(
        new Set((matchingDropsResult.data ?? []).map((row) => row.feed_ticket_id).filter(Boolean)),
      );
      if (eligibleTicketIds.length === 0) {
        return json(req, { ok: true, items: [] });
      }
    }

    let ticketsQuery = service
      .from("feed_tickets")
      .select("id,ticket_num,delivery_date,created_at,feedmill,feed_weight,feed_name,source_type")
      .order("delivery_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (ticketNumber) {
      ticketsQuery = ticketsQuery.ilike("ticket_num", `%${ticketNumber}%`);
    }
    if (dateFrom) {
      ticketsQuery = ticketsQuery.gte("delivery_date", dateFrom);
    }
    if (dateTo) {
      ticketsQuery = ticketsQuery.lte("delivery_date", dateTo);
    }
    if (eligibleTicketIds) {
      ticketsQuery = ticketsQuery.in("id", eligibleTicketIds);
    }

    const ticketsResult = await ticketsQuery;
    if (ticketsResult.error) throw new Error(ticketsResult.error.message);

    const ticketIds = (ticketsResult.data ?? []).map((row) => row.id).filter(Boolean);
    if (ticketIds.length === 0) {
      return json(req, { ok: true, items: [] });
    }

    const dropsResult = await service
      .from("feed_drops")
      .select("feed_ticket_id,farm_id,barn_id,drop_weight,placement_code")
      .in("feed_ticket_id", ticketIds);
    if (dropsResult.error) throw new Error(dropsResult.error.message);

    const farmIds = Array.from(new Set((dropsResult.data ?? []).map((row) => row.farm_id).filter(Boolean)));
    const barnIds = Array.from(new Set((dropsResult.data ?? []).map((row) => row.barn_id).filter(Boolean)));
    const farmsResult = farmIds.length === 0
      ? { data: [], error: null }
      : await service.from("farms").select("id,farm_name").in("id", farmIds);
    if (farmsResult.error) throw new Error(farmsResult.error.message);
    const barnsResult = barnIds.length === 0
      ? { data: [], error: null }
      : await service.from("barns").select("id,barn_code").in("id", barnIds);
    if (barnsResult.error) throw new Error(barnsResult.error.message);

    const farmNameById = new Map((farmsResult.data ?? []).map((row) => [row.id, row.farm_name]));
    const barnCodeById = new Map((barnsResult.data ?? []).map((row) => [row.id, row.barn_code]));

    const dropsByTicketId = new Map<string, typeof dropsResult.data>();
    for (const row of dropsResult.data ?? []) {
      const current = dropsByTicketId.get(row.feed_ticket_id) ?? [];
      current.push(row);
      dropsByTicketId.set(row.feed_ticket_id, current);
    }

    const items = (ticketsResult.data ?? []).map((ticket) => {
      const drops = dropsByTicketId.get(ticket.id) ?? [];
      const allocatedWeight = drops.reduce(
        (sum, drop) => sum + (typeof drop.drop_weight === "number" ? drop.drop_weight : 0),
        0,
      );
      const farmNames = Array.from(
        new Set(drops.map((drop) => farmNameById.get(drop.farm_id ?? "")).filter(Boolean)),
      ) as string[];
      const barnCodes = Array.from(
        new Set(drops.map((drop) => barnCodeById.get(drop.barn_id ?? "")).filter(Boolean)),
      ) as string[];
      const placementCodes = Array.from(
        new Set(drops.map((drop) => drop.placement_code).filter(Boolean)),
      ) as string[];

      return {
        id: ticket.id,
        ticket_number: ticket.ticket_num ?? null,
        delivery_date: ticket.delivery_date ?? null,
        vendor_name: ticket.feedmill ?? null,
        source_type: ticket.source_type ?? ticket.feed_name ?? null,
        ticket_weight_lbs: typeof ticket.feed_weight === "number" ? ticket.feed_weight : null,
        allocated_weight_lbs: allocatedWeight,
        remaining_weight_lbs:
          (typeof ticket.feed_weight === "number" ? ticket.feed_weight : 0) - allocatedWeight,
        drop_count: drops.length,
        placement_codes: placementCodes,
        farm_names: farmNames,
        barn_codes: barnCodes,
      };
    });

    return json(req, { ok: true, items });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
