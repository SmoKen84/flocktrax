import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type, x-adalo-test";

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

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeDrops(rawDrops: unknown) {
  if (!Array.isArray(rawDrops)) {
    return [];
  }

  return rawDrops
    .map((drop, index) => {
      const row = typeof drop === "object" && drop ? drop as Record<string, unknown> : {};
      return {
        id: typeof row.id === "string" ? row.id : null,
        feed_bin_id: typeof row.feed_bin_id === "string" ? row.feed_bin_id : null,
        placement_id: typeof row.placement_id === "string" ? row.placement_id : null,
        placement_code: typeof row.placement_code === "string" ? row.placement_code : null,
        feed_type: typeof row.feed_type === "string" ? row.feed_type : null,
        drop_weight_lbs: toNumber(row.drop_weight_lbs),
        note: typeof row.note === "string" ? row.note : null,
        drop_order: typeof row.drop_order === "number" ? row.drop_order : index + 1,
      };
    })
    .filter((drop) => drop.feed_bin_id && drop.placement_id && drop.drop_weight_lbs && drop.drop_weight_lbs > 0);
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

  try {
    const payload = await readBody(req);
    const userClient = getUserClient(accessToken);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json(req, { ok: false, error: authError?.message ?? "Unauthorized" }, 401);
    }

    const ticketId = typeof payload.id === "string" ? payload.id : null;
    const ticketWeight = toNumber(payload.ticket_weight_lbs);
    const drops = normalizeDrops(payload.drops);

    if (!ticketWeight || ticketWeight <= 0) {
      return json(req, { ok: false, error: "Ticket weight must be greater than zero." }, 400);
    }

    if (drops.length === 0) {
      return json(req, { ok: false, error: "At least one valid feed drop is required." }, 400);
    }

    const totalDropped = drops.reduce((sum, drop) => sum + (drop.drop_weight_lbs ?? 0), 0);
    const remainingWeight = ticketWeight - totalDropped;
    if (Math.abs(remainingWeight) > 0.01) {
      return json(req, { ok: false, error: "Feed ticket must be fully allocated before it can be saved." }, 400);
    }

    const service = getServiceClient();
    const deliveryIso = typeof payload.delivered_at === "string" ? payload.delivered_at : new Date().toISOString();
    const deliveryDate = deliveryIso.slice(0, 10);
    const ticketNum = typeof payload.ticket_number === "string" ? payload.ticket_number : null;
    const baseTicketPayload = {
      ticket_num: ticketNum,
      delivery_date: deliveryDate,
      feed_weight: ticketWeight,
      feedmill: typeof payload.vendor_name === "string" ? payload.vendor_name : null,
      feed_name: typeof payload.feed_name === "string" ? payload.feed_name : null,
      source_type: typeof payload.source_type === "string" && payload.source_type.trim()
        ? payload.source_type.trim()
        : "mill",
      comment: typeof payload.note === "string" ? payload.note : null,
    };

    let savedTicketId = ticketId;

    if (isUuid(ticketId)) {
      const { error: updateError } = await service
        .from("feed_tickets")
        .update(baseTicketPayload)
        .eq("id", ticketId);
      if (updateError) throw new Error(updateError.message);

      const { error: deleteDropsError } = await service
        .from("feed_drops")
        .delete()
        .eq("feed_ticket_id", ticketId);
      if (deleteDropsError) throw new Error(deleteDropsError.message);
    } else {
      const { data: insertRows, error: insertError } = await service
        .from("feed_tickets")
        .insert(baseTicketPayload)
        .select("id")
        .limit(1);
      if (insertError) throw new Error(insertError.message);
      savedTicketId = insertRows?.[0]?.id ?? null;
    }

    if (!savedTicketId) {
      throw new Error("Unable to resolve saved feed ticket id.");
    }

    const placementIds = Array.from(new Set(drops.map((drop) => drop.placement_id).filter(isUuid)));
    const placementResult = placementIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("placements")
          .select("id,placement_key")
          .in("id", placementIds);
    if (placementResult.error) throw new Error(placementResult.error.message);
    const placementCodeById = new Map((placementResult.data ?? []).map((row) => [row.id, row.placement_key]));

    const binIds = Array.from(new Set(drops.map((drop) => drop.feed_bin_id).filter(isUuid)));
    const binsResult = binIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("feedbins")
          .select("id,farm_id,barn_id,bin_num")
          .in("id", binIds);
    if (binsResult.error) throw new Error(binsResult.error.message);
    const binById = new Map((binsResult.data ?? []).map((row) => [row.id, row]));

    const insertDropsPayload = drops.map((drop, index) => {
      const bin = binById.get(drop.feed_bin_id ?? "");
      return {
      feed_ticket_id: savedTicketId,
      feed_bin_id: drop.feed_bin_id,
      placement_id: drop.placement_id,
      placement_code: drop.placement_code ?? placementCodeById.get(drop.placement_id ?? "") ?? null,
      ticket_num: ticketNum,
      bin_code: bin?.bin_num === null || bin?.bin_num === undefined ? drop.feed_bin_id : String(bin.bin_num),
      type: drop.feed_type ?? (typeof payload.source_type === "string" && payload.source_type.trim() ? payload.source_type.trim() : "mill"),
      drop_weight: drop.drop_weight_lbs,
      comment: drop.note,
      farm_id: bin?.farm_id ?? null,
      barn_id: bin?.barn_id ?? null,
      drop_order: index + 1,
      };
    });

    const { error: insertDropsError } = await service
      .from("feed_drops")
      .insert(insertDropsPayload);
    if (insertDropsError) throw new Error(insertDropsError.message);

    const [allBinsResult, barnsResult, farmsResult, dropsResult, ticketResult] = await Promise.all([
      service.from("feedbins").select("id,farm_id,barn_id,bin_num,capacity").order("bin_num", { ascending: true }),
      service.from("barns").select("id,barn_code,farm_id"),
      service.from("farms").select("id,farm_name"),
      service
        .from("feed_drops")
        .select("id,feed_bin_id,placement_id,placement_code,type,drop_weight,drop_order,comment,bin_code")
        .eq("feed_ticket_id", savedTicketId)
        .order("drop_order", { ascending: true }),
      service
        .from("feed_tickets")
        .select("id,ticket_num,feedmill,delivery_date,comment,feed_weight,feed_name,source_type")
        .eq("id", savedTicketId)
        .limit(1),
    ]);

    if (allBinsResult.error) throw new Error(allBinsResult.error.message);
    if (barnsResult.error) throw new Error(barnsResult.error.message);
    if (farmsResult.error) throw new Error(farmsResult.error.message);
    if (dropsResult.error) throw new Error(dropsResult.error.message);
    if (ticketResult.error) throw new Error(ticketResult.error.message);

    const activePlacementsResult = await service
      .from("placements")
      .select("id,barn_id,placement_key,is_active,date_removed")
      .eq("is_active", true)
      .is("date_removed", null);
    if (activePlacementsResult.error) throw new Error(activePlacementsResult.error.message);

    const barnById = new Map((barnsResult.data ?? []).map((row) => [row.id, row]));
    const farmById = new Map((farmsResult.data ?? []).map((row) => [row.id, row]));
    const placementByBarnId = new Map((activePlacementsResult.data ?? []).map((row) => [row.barn_id, row]));
    const bins = (allBinsResult.data ?? []).map((row) => {
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

    const allBinById = new Map(bins.map((bin) => [bin.feed_bin_id, bin]));
    const ticket = ticketResult.data?.[0];

    return json(req, {
      ok: true,
      ticket_saved: true,
      drop_count: insertDropsPayload.length,
      item: {
        id: ticket?.id ?? savedTicketId,
        ticket_number: ticket?.ticket_num ?? null,
        delivered_at: ticket?.delivery_date ? `${ticket.delivery_date}T00:00:00.000Z` : deliveryIso,
        ticket_weight_lbs: typeof ticket?.feed_weight === "number" ? ticket.feed_weight : ticketWeight,
        feed_name: ticket?.feed_name ?? null,
        vendor_name: ticket?.feedmill ?? null,
        source_type: ticket?.source_type ?? "mill",
        note: ticket?.comment ?? null,
        bins,
        drops: (dropsResult.data ?? []).map((drop) => {
          const bin = drop.feed_bin_id ? allBinById.get(drop.feed_bin_id) : null;
          return {
            id: drop.id,
            feed_bin_id: drop.feed_bin_id ?? null,
            bin_code: bin?.bin_code ?? drop.bin_code ?? null,
            barn_code: bin?.barn_code ?? null,
            placement_id: drop.placement_id ?? null,
            placement_code: drop.placement_code ?? null,
            feed_type: drop.type ?? null,
            drop_weight_lbs: typeof drop.drop_weight === "number" ? drop.drop_weight : null,
            note: drop.comment ?? null,
            drop_order: typeof drop.drop_order === "number" ? drop.drop_order : 1,
          };
        }),
      },
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
