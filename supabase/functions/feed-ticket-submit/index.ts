import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthenticatedUserId, getMobileAccessContext } from "../_shared/mobile-access.ts";

type FeedTicketType = "Reg" | "xTran" | "iTran" | "f2f";
type PlacementStateRow = {
  id: string;
  placement_key: string | null;
  flock_id: string | null;
  is_active: boolean | null;
  date_removed: string | null;
};
type FlockStateRow = {
  id: string;
  is_complete: boolean | null;
  is_in_barn: boolean | null;
};

type FeedBinLayerBinRow = {
  id: string;
  binsentry_last_inventory_lbs: number | null;
};

type FeedBinLayerDropRow = {
  id: string;
  feed_bin_id: string | null;
  feed_ticket_id: string | null;
  type: string | null;
  drop_weight: number | null;
  drop_order: number | null;
};

type FeedBinLayerTicketRow = {
  id: string;
  delivery_date: string | null;
};

type FeedOrderCommitmentReceiptRow = {
  commitment_id: string;
  farm_id: string | null;
  barn_id: string | null;
  feed_bin_id: string | null;
  placement_id: string | null;
  expected_delivery_date: string | null;
  ordered_lbs: number | null;
  received_lbs: number | null;
  status: string | null;
  feed_type?: string | null;
  created_at?: string | null;
};

type FeedDropReceiptRow = {
  id: string;
  feed_ticket_id: string | null;
  farm_id: string | null;
  barn_id: string | null;
  feed_bin_id: string | null;
  placement_id: string | null;
  type: string | null;
  drop_weight: number | null;
  drop_order: number | null;
  off_farm_redirect: boolean | null;
};

type FeedTicketReceiptRow = {
  id: string;
  delivery_date: string | null;
  ticket_type: string | null;
};

const OFF_FARM_PLACEMENT_CODE = "OFF-FARM";

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

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseTicketType(value: unknown): FeedTicketType {
  return value === "xTran" || value === "iTran" || value === "f2f" ? value : "Reg";
}

function normalizeFeedType(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "starter" || normalized === "grower" ? normalized : null;
}

function isoFromDateOnly(value: string | null | undefined) {
  return value ? `${value}T00:00:00.000Z` : null;
}

function isAdminLikeRole(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "admin" || normalized === "super_admin" || normalized === "superadmin";
}

function isApproximatelyZero(value: number, tolerance = 0.01) {
  return Math.abs(value) <= tolerance;
}

async function ensureUniqueTicketNumber(
  service: ReturnType<typeof getServiceClient>,
  ticketNum: string | null,
  currentTicketId: string | null,
) {
  const normalizedTicketNum = typeof ticketNum === "string" ? ticketNum.trim() : "";
  if (!normalizedTicketNum) {
    return;
  }

  let query = service
    .from("feed_tickets")
    .select("id,ticket_num")
    .ilike("ticket_num", normalizedTicketNum)
    .limit(5);

  if (isUuid(currentTicketId)) {
    query = query.neq("id", currentTicketId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const duplicate = (data ?? []).find((row) =>
    typeof row.ticket_num === "string" &&
    row.ticket_num.trim().toLowerCase() === normalizedTicketNum.toLowerCase()
  );

  if (duplicate) {
    throw new Error(`Ticket number ${normalizedTicketNum} already exists.`);
  }
}

function isDuplicateTicketNumberError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const normalized = message.toLowerCase();
  return (
    normalized.includes("duplicate key") ||
    normalized.includes("already exists") ||
    normalized.includes("feed_ticket_ticket_num_unique") ||
    normalized.includes("ticket_num")
  );
}

function validateTicketMath(
  ticketType: FeedTicketType,
  ticketWeight: number,
  dropSum: number,
  drops: Array<{ drop_weight_lbs: number | null }>,
) {
  const weights = drops.map((drop) => drop.drop_weight_lbs ?? 0);
  const hasPositiveDrop = weights.some((value) => value > 0);
  const hasNegativeDrop = weights.some((value) => value < 0);

  if (ticketType === "Reg") {
    if (ticketWeight <= 0) return "Reg tickets must have a positive total weight.";
    if (dropSum <= 0) return "Reg tickets must allocate a positive total across drops.";
    if (weights.some((value) => value <= 0)) return "Reg ticket drops must all be positive.";
    if (Math.abs(ticketWeight - dropSum) > 0.01) {
      return "Reg tickets must fully allocate the total weight across drops.";
    }
    return null;
  }

  if (ticketType === "xTran") {
    if (ticketWeight >= 0) return "xTran tickets must have a negative total weight.";
    if (dropSum >= 0) return "xTran drops must total a negative value.";
    if (weights.some((value) => value >= 0)) return "xTran drops must all be negative.";
    if (Math.abs(ticketWeight - dropSum) > 0.01) {
      return "xTran total weight must equal the summed drop value.";
    }
    return null;
  }

  if (!isApproximatelyZero(ticketWeight)) {
    return `${ticketType} tickets must have a zero total weight.`;
  }
  if (!isApproximatelyZero(dropSum)) {
    return `${ticketType} drops must net to zero.`;
  }
  if (!hasPositiveDrop || !hasNegativeDrop) {
    return `${ticketType} tickets must contain both positive and negative drops.`;
  }

  return null;
}

function validatePlacementState(
  ticketType: FeedTicketType,
  placements: Array<{
    placementCode: string;
    isActive: boolean;
    isInBarn: boolean;
    isComplete: boolean;
  }>,
  allowHistoricalOverride: boolean,
) {
  if (allowHistoricalOverride) {
    return null;
  }

  for (const placement of placements) {
    if (placement.isComplete) {
      return `${ticketType} tickets cannot target completed flocks while historical entry is disabled (${placement.placementCode}).`;
    }

    if (ticketType === "Reg" && !(placement.isInBarn || placement.isActive)) {
      return `Reg tickets require target flocks to be active or in-barn (${placement.placementCode}).`;
    }

    if (ticketType === "iTran" && !placement.isActive) {
      return `iTran tickets require all referenced flocks to be active (${placement.placementCode}).`;
    }

  }

  return null;
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
        off_farm_redirect: row.off_farm_redirect === true,
      };
    })
    .filter((drop) => {
      if (drop.drop_weight_lbs === null || isApproximatelyZero(drop.drop_weight_lbs)) {
        return false;
      }

      if (drop.off_farm_redirect) {
        return true;
      }

      return Boolean(drop.feed_bin_id && drop.placement_id);
    });
}

function hasUnresolvedPlacements(
  placements: PlacementStateRow[],
  placementIds: string[],
) {
  return placements.length !== placementIds.length;
}

function hasUnresolvedBins(
  bins: Array<{ id: string | null }>,
  binIds: string[],
) {
  return bins.length !== binIds.length;
}

async function recalculateFeedBinLayerState(
  service: ReturnType<typeof getServiceClient>,
  feedBinIds: string[],
) {
  const uniqueFeedBinIds = Array.from(new Set(feedBinIds.filter((value) => typeof value === "string" && value.length > 0)));
  if (uniqueFeedBinIds.length === 0) {
    return;
  }

  const { data: binRows, error: binError } = await service
    .from("feedbins")
    .select("id,binsentry_last_inventory_lbs")
    .in("id", uniqueFeedBinIds);
  if (binError) {
    throw new Error(binError.message);
  }

  const { data: dropRows, error: dropError } = await service
    .from("feed_drops")
    .select("id,feed_bin_id,feed_ticket_id,type,drop_weight,drop_order")
    .in("feed_bin_id", uniqueFeedBinIds)
    .eq("off_farm_redirect", false);
  if (dropError) {
    throw new Error(dropError.message);
  }

  const ticketIds = Array.from(
    new Set(
      ((dropRows ?? []) as FeedBinLayerDropRow[])
        .map((row) => row.feed_ticket_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const ticketRowsResult = ticketIds.length
    ? await service.from("feed_tickets").select("id,delivery_date").in("id", ticketIds)
    : { data: [], error: null };
  if (ticketRowsResult.error) {
    throw new Error(ticketRowsResult.error.message);
  }

  const ticketDateById = new Map(
    ((ticketRowsResult.data ?? []) as FeedBinLayerTicketRow[]).map((row) => [row.id, row.delivery_date ?? ""]),
  );

  const dropsByFeedBinId = new Map<string, FeedBinLayerDropRow[]>();
  for (const row of (dropRows ?? []) as FeedBinLayerDropRow[]) {
    if (!row.feed_bin_id) continue;
    const bucket = dropsByFeedBinId.get(row.feed_bin_id) ?? [];
    bucket.push(row);
    dropsByFeedBinId.set(row.feed_bin_id, bucket);
  }

  for (const row of (binRows ?? []) as FeedBinLayerBinRow[]) {
    const drops = (dropsByFeedBinId.get(row.id) ?? []).slice().sort((left, right) => {
      const leftDate = ticketDateById.get(left.feed_ticket_id ?? "") ?? "";
      const rightDate = ticketDateById.get(right.feed_ticket_id ?? "") ?? "";
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
      const leftOrder = left.drop_order ?? 0;
      const rightOrder = right.drop_order ?? 0;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return String(left.id).localeCompare(String(right.id));
    });

    let accessibleFeedType: "starter" | "grower" | null = null;
    let accessibleFeedLbs = 0;
    let queuedFeedType: "starter" | "grower" | null = null;
    let queuedFeedLbs = 0;
    let latestEventDate: string | null = null;

    for (const drop of drops) {
      const feedType = normalizeFeedType(drop.type) as "starter" | "grower" | null;
      const weight = typeof drop.drop_weight === "number" && Number.isFinite(drop.drop_weight) ? drop.drop_weight : 0;
      if (!feedType || Math.abs(weight) <= 0.01) {
        continue;
      }

      latestEventDate = ticketDateById.get(drop.feed_ticket_id ?? "") ?? latestEventDate;

      if (weight > 0) {
        if (!accessibleFeedType || accessibleFeedLbs <= 0) {
          accessibleFeedType = feedType;
          accessibleFeedLbs = weight;
          if (queuedFeedLbs <= 0) {
            queuedFeedType = null;
            queuedFeedLbs = 0;
          }
          continue;
        }

        if (accessibleFeedType === feedType && !queuedFeedType) {
          accessibleFeedLbs += weight;
          continue;
        }

        if (queuedFeedType === feedType || (!queuedFeedType && accessibleFeedType !== feedType)) {
          queuedFeedType = feedType;
          queuedFeedLbs += weight;
          continue;
        }

        if (accessibleFeedType === feedType) {
          accessibleFeedLbs += weight;
        }
      } else {
        const reduction = Math.abs(weight);
        if (queuedFeedType === feedType && queuedFeedLbs > 0) {
          queuedFeedLbs = Math.max(0, queuedFeedLbs - reduction);
          if (queuedFeedLbs <= 0.01) {
            queuedFeedType = null;
            queuedFeedLbs = 0;
          }
          continue;
        }

        if (accessibleFeedType === feedType && accessibleFeedLbs > 0) {
          accessibleFeedLbs = Math.max(0, accessibleFeedLbs - reduction);
          if (accessibleFeedLbs <= 0.01) {
            accessibleFeedLbs = 0;
            if (queuedFeedType && queuedFeedLbs > 0) {
              accessibleFeedType = queuedFeedType;
              accessibleFeedLbs = queuedFeedLbs;
              queuedFeedType = null;
              queuedFeedLbs = 0;
            } else {
              accessibleFeedType = null;
            }
          }
        }
      }
    }

    if (accessibleFeedType && !queuedFeedType && typeof row.binsentry_last_inventory_lbs === "number" && Number.isFinite(row.binsentry_last_inventory_lbs)) {
      accessibleFeedLbs = Math.max(0, row.binsentry_last_inventory_lbs);
    }

    const { error: updateError } = await service
      .from("feedbins")
      .update({
        accessible_feed_type: accessibleFeedType,
        accessible_feed_lbs: accessibleFeedType ? accessibleFeedLbs : null,
        queued_feed_type: queuedFeedType,
        queued_feed_lbs: queuedFeedType ? queuedFeedLbs : null,
        feed_state_effective_at: accessibleFeedType || queuedFeedType ? isoFromDateOnly(latestEventDate) : null,
        feed_state_source: accessibleFeedType || queuedFeedType ? "ticket_inferred" : null,
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }
}

function orderSpecificityRank(order: Pick<FeedOrderCommitmentReceiptRow, "feed_bin_id" | "placement_id" | "barn_id">) {
  if (order.feed_bin_id) return 0;
  if (order.placement_id) return 1;
  if (order.barn_id) return 2;
  return 3;
}

async function recalculateFeedOrderReceipts(
  service: ReturnType<typeof getServiceClient>,
  farmIds: string[],
) {
  const uniqueFarmIds = Array.from(new Set(farmIds.filter((value) => typeof value === "string" && value.length > 0)));
  if (uniqueFarmIds.length === 0) {
    return;
  }

  const { data: orderRows, error: orderError } = await service
    .from("feed_order_commitments")
    .select("commitment_id,farm_id,barn_id,feed_bin_id,placement_id,expected_delivery_date,ordered_lbs,received_lbs,status,feed_type,created_at")
    .in("farm_id", uniqueFarmIds)
    .neq("status", "cancelled");
  if (orderError) {
    throw new Error(orderError.message);
  }

  const { data: dropRows, error: dropError } = await service
    .from("feed_drops")
    .select("id,feed_ticket_id,farm_id,barn_id,feed_bin_id,placement_id,type,drop_weight,drop_order,off_farm_redirect")
    .in("farm_id", uniqueFarmIds)
    .eq("off_farm_redirect", false);
  if (dropError) {
    throw new Error(dropError.message);
  }

  const ticketIds = Array.from(
    new Set(
      ((dropRows ?? []) as FeedDropReceiptRow[])
        .map((row) => row.feed_ticket_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const ticketRowsResult = ticketIds.length
    ? await service.from("feed_tickets").select("id,delivery_date,ticket_type").in("id", ticketIds)
    : { data: [], error: null };
  if (ticketRowsResult.error) {
    throw new Error(ticketRowsResult.error.message);
  }

  const ticketById = new Map(
    ((ticketRowsResult.data ?? []) as FeedTicketReceiptRow[]).map((row) => [row.id, row]),
  );

  const eligibleDrops = ((dropRows ?? []) as FeedDropReceiptRow[])
    .map((row) => {
      const ticket = row.feed_ticket_id ? ticketById.get(row.feed_ticket_id) : null;
      return {
        ...row,
        ticket_type: String(ticket?.ticket_type ?? "").trim(),
        delivery_date: ticket?.delivery_date ?? "",
      };
    })
    .filter((row) => {
      const dropWeight = typeof row.drop_weight === "number" && Number.isFinite(row.drop_weight) ? row.drop_weight : 0;
      return row.ticket_type === "Reg" && dropWeight > 0;
    })
    .sort((left, right) => {
      if (left.delivery_date !== right.delivery_date) return left.delivery_date.localeCompare(right.delivery_date);
      const leftOrder = left.drop_order ?? 0;
      const rightOrder = right.drop_order ?? 0;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return String(left.id).localeCompare(String(right.id));
    });

  const orderState = new Map(
    ((orderRows ?? []) as FeedOrderCommitmentReceiptRow[]).map((row) => [
      row.commitment_id,
      {
        row,
        receivedLbs: 0,
        ticketIds: new Set<string>(),
      },
    ]),
  );

  for (const drop of eligibleDrops) {
    const feedType = normalizeFeedType(drop.type);
    if (!drop.farm_id) {
      continue;
    }

    let remaining = Math.max(0, drop.drop_weight ?? 0);
    if (remaining <= 0) {
      continue;
    }

    const candidates = Array.from(orderState.values())
      .filter(({ row, receivedLbs }) => {
        const orderedLbs = Math.max(0, row.ordered_lbs ?? 0);
        if (orderedLbs - receivedLbs <= 0.01) return false;
        if (row.farm_id !== drop.farm_id) return false;

        const orderFeedType = normalizeFeedType(row.feed_type);
        if (orderFeedType && orderFeedType !== feedType) return false;
        if (row.feed_bin_id && row.feed_bin_id !== drop.feed_bin_id) return false;
        if (!row.feed_bin_id && row.placement_id && row.placement_id !== drop.placement_id) return false;
        if (!row.feed_bin_id && !row.placement_id && row.barn_id && row.barn_id !== drop.barn_id) return false;
        return true;
      })
      .sort((left, right) => {
        const specificityCompare = orderSpecificityRank(left.row) - orderSpecificityRank(right.row);
        if (specificityCompare !== 0) return specificityCompare;

        const leftTypeRank = normalizeFeedType(left.row.feed_type) ? 0 : 1;
        const rightTypeRank = normalizeFeedType(right.row.feed_type) ? 0 : 1;
        if (leftTypeRank !== rightTypeRank) return leftTypeRank - rightTypeRank;

        const leftEta = left.row.expected_delivery_date ?? "9999-12-31";
        const rightEta = right.row.expected_delivery_date ?? "9999-12-31";
        if (leftEta !== rightEta) return leftEta.localeCompare(rightEta);

        const leftCreated = left.row.created_at ?? "";
        const rightCreated = right.row.created_at ?? "";
        if (leftCreated !== rightCreated) return leftCreated.localeCompare(rightCreated);

        return left.row.commitment_id.localeCompare(right.row.commitment_id);
      });

    for (const candidate of candidates) {
      if (remaining <= 0.01) {
        break;
      }

      const orderedLbs = Math.max(0, candidate.row.ordered_lbs ?? 0);
      const openLbs = Math.max(0, orderedLbs - candidate.receivedLbs);
      if (openLbs <= 0.01) {
        continue;
      }

      const applied = Math.min(openLbs, remaining);
      candidate.receivedLbs += applied;
      remaining -= applied;
      if (drop.feed_ticket_id) {
        candidate.ticketIds.add(drop.feed_ticket_id);
      }
    }
  }

  for (const state of orderState.values()) {
    const orderedLbs = Math.max(0, state.row.ordered_lbs ?? 0);
    const receivedLbs = Math.min(orderedLbs, Math.max(0, state.receivedLbs));
    const nextStatus =
      receivedLbs <= 0.01 ? "open" : receivedLbs >= orderedLbs - 0.01 ? "received" : "partial";
    const receivedTicketId = state.ticketIds.size === 1 && nextStatus === "received"
      ? Array.from(state.ticketIds)[0] ?? null
      : null;

    const { error: updateError } = await service
      .from("feed_order_commitments")
      .update({
        received_lbs: receivedLbs,
        status: nextStatus,
        received_ticket_id: receivedTicketId,
        updated_at: new Date().toISOString(),
      })
      .eq("commitment_id", state.row.commitment_id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }
}

async function reserveVoucherNumber(service: ReturnType<typeof getServiceClient>) {
  const { data, error } = await service.rpc("reserve_internal_voucher_number");
  if (!error) {
    const voucherNumber = typeof data === "string" ? data.trim() : "";
    if (!voucherNumber) {
      throw new Error("Internal voucher counter did not return a ticket number.");
    }

    return voucherNumber;
  }

  const { data: settingRows, error: settingsError } = await service
    .from("app_settings")
    .select("id,group,name,value,updated_at")
    .in("name", ["voucher_prefix", "internal_voucher_number", "internal_voucher_num"])
    .limit(20);
  if (settingsError) {
    throw new Error(error.message);
  }

  const rows = (settingRows ?? []) as Array<{
    id: string;
    group: string | null;
    name: string | null;
    value: string | null;
    updated_at?: string | null;
  }>;
  const pickSetting = (name: string) =>
    rows
      .filter((row) => row.name === name)
      .sort((left, right) => {
        const leftRank = left.group === "feed_tickets" ? 0 : left.group === null ? 1 : 2;
        const rightRank = right.group === "feed_tickets" ? 0 : right.group === null ? 1 : 2;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
      })[0] ?? null;

  const prefix = pickSetting("voucher_prefix")?.value?.trim() ?? "";
  const counterRow = pickSetting("internal_voucher_number") ?? pickSetting("internal_voucher_num");
  const nextNumber = Math.max(Number.parseInt(counterRow?.value?.trim() ?? "1", 10) || 1, 1);

  if (counterRow?.id) {
    const { error: updateError } = await service
      .from("app_settings")
      .update({
        value: String(nextNumber + 1),
        updated_at: new Date().toISOString(),
      })
      .eq("id", counterRow.id);
    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error: insertError } = await service
      .from("app_settings")
      .insert({
        group: "feed_tickets",
        name: "internal_voucher_number",
        value: "2",
        desc: "Next internal voucher number used for xTran, iTran, and f2f feed tickets.",
        updated_at: new Date().toISOString(),
      });
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  return `${prefix}${nextNumber}`.trim();
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
    const userId = await getAuthenticatedUserId(userClient);

    const ticketId = typeof payload.id === "string" ? payload.id : null;
    const ticketWeight = toNumber(payload.ticket_weight_lbs);
    const ticketType = parseTicketType(payload.ticket_type);
    const drops = normalizeDrops(payload.drops);

    if (ticketWeight === null) {
      return json(req, { ok: false, error: "Ticket weight is required." }, 400);
    }

    if (drops.length === 0) {
      return json(req, { ok: false, error: "At least one valid feed drop is required." }, 400);
    }

    for (const [index, drop] of drops.entries()) {
      if (drop.off_farm_redirect) {
        if (toTrimmedString(drop.note).length === 0) {
          return json(req, { ok: false, error: `Drop ${index + 1} must include a note when marked Off Farm Redirect.` }, 400);
        }
        continue;
      }

      if (!isUuid(drop.feed_bin_id) || !isUuid(drop.placement_id)) {
        return json(req, { ok: false, error: `Drop ${index + 1} is missing a valid bin or flock.` }, 400);
      }
    }

    const totalDropped = drops.reduce((sum, drop) => sum + (drop.drop_weight_lbs ?? 0), 0);
    const mathError = validateTicketMath(ticketType, ticketWeight, totalDropped, drops);
    if (mathError) {
      return json(req, { ok: false, error: mathError }, 400);
    }

    const service = getServiceClient();
    let allowHistoricalEntry = false;
    const { data: platformSettingRows, error: platformSettingsError } = await service
      .schema("platform")
      .from("settings")
      .select("name,value")
      .limit(25);
    if (!platformSettingsError) {
      for (const row of platformSettingRows ?? []) {
        const name = String(row?.name ?? "").trim().toLowerCase();
        const rawValue = String(row?.value ?? "").trim().toLowerCase();
        if (["allow_historical_entry", "historical_entry", "historical_mode", "history_backfill"].includes(name)) {
          allowHistoricalEntry = ["1", "true", "yes", "on"].includes(rawValue);
        }
      }
    }

    const accessContext = await getMobileAccessContext(userClient, userId);
    const allowHistoricalOverride = allowHistoricalEntry && isAdminLikeRole(accessContext.role);

    const placementIds = Array.from(
      new Set(drops.filter((drop) => !drop.off_farm_redirect).map((drop) => drop.placement_id).filter(isUuid)),
    );
    const placementResult = placementIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("placements")
          .select("id,placement_key,flock_id,is_active,date_removed")
          .in("id", placementIds);
    if (placementResult.error) throw new Error(placementResult.error.message);
    const placementCodeById = new Map((placementResult.data ?? []).map((row) => [row.id, row.placement_key]));
    const placementRows = (placementResult.data ?? []) as PlacementStateRow[];
    if (hasUnresolvedPlacements(placementRows, placementIds)) {
      return json(req, { ok: false, error: "One or more feed drops reference a placement that could not be resolved." }, 400);
    }
    const flockIds = Array.from(
      new Set(
        placementRows.map((row) => row.flock_id).filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );
    const flockResult = flockIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("flocks")
          .select("id,is_complete,is_in_barn")
          .in("id", flockIds);
    if (flockResult.error) throw new Error(flockResult.error.message);
    const flockById = new Map(
      ((flockResult.data ?? []) as FlockStateRow[]).map((row) => [row.id, row]),
    );
    const placementStateError = validatePlacementState(
      ticketType,
      placementRows.map((row) => {
        const flock = row.flock_id ? flockById.get(row.flock_id) : null;
        return {
          placementCode: row.placement_key ?? row.id,
          isActive: row.is_active === true,
          isInBarn: flock?.is_in_barn === true,
          isComplete: flock?.is_complete === true,
        };
      }),
      allowHistoricalOverride,
    );
    if (placementStateError) {
      return json(req, { ok: false, error: placementStateError }, 400);
    }

    const binIds = Array.from(
      new Set(drops.filter((drop) => !drop.off_farm_redirect).map((drop) => drop.feed_bin_id).filter(isUuid)),
    );
    const binsResult = binIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("feedbins")
          .select("id,farm_id,barn_id,bin_num")
          .in("id", binIds);
    if (binsResult.error) throw new Error(binsResult.error.message);
    if (hasUnresolvedBins(binsResult.data ?? [], binIds)) {
      return json(req, { ok: false, error: "One or more feed drops reference a bin that could not be resolved." }, 400);
    }
    const binById = new Map((binsResult.data ?? []).map((row) => [row.id, row]));
    const targetFarmIds = Array.from(
      new Set(
        (binsResult.data ?? [])
          .map((row) => row.farm_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );

    for (const farmId of targetFarmIds) {
      const access = await getMobileAccessContext(userClient, userId, farmId);
      if (!access.permissions.feed_tickets) {
        return json(req, { ok: false, error: "You are not authorized to save feed tickets." }, 403);
      }
    }

    const deliveryIso = typeof payload.delivered_at === "string" ? payload.delivered_at : new Date().toISOString();
    const deliveryDate = deliveryIso.slice(0, 10);
    const submittedTicketNumber = toTrimmedString(payload.ticket_number);
    let ticketNum =
      ticketType === "Reg"
        ? submittedTicketNumber || null
        : submittedTicketNumber || null;
    if (!ticketNum && !ticketId) {
      return json(req, { ok: false, error: "Ticket number is required." }, 400);
    }
    const baseTicketPayload = {
      delivery_date: deliveryDate,
      feed_weight: ticketWeight,
      ticket_type: ticketType,
      feedmill: typeof payload.vendor_name === "string" ? payload.vendor_name : null,
      feed_name: typeof payload.feed_name === "string" ? payload.feed_name : null,
      source_type: typeof payload.source_type === "string" && payload.source_type.trim()
        ? payload.source_type.trim()
        : "mill",
      comment: typeof payload.note === "string" ? payload.note : null,
    };
    let savedTicketId = ticketId;
    let existingDropFeedBinIds: string[] = [];
    let existingDropFarmIds: string[] = [];

    if (isUuid(ticketId)) {
      const existingDropsResult = await service
        .from("feed_drops")
        .select("feed_bin_id,farm_id")
        .eq("feed_ticket_id", ticketId);
      if (existingDropsResult.error) throw new Error(existingDropsResult.error.message);
      existingDropFeedBinIds = Array.from(
        new Set(
          (existingDropsResult.data ?? [])
            .map((row) => row.feed_bin_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );
      existingDropFarmIds = Array.from(
        new Set(
          (existingDropsResult.data ?? [])
            .map((row) => row.farm_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );

      await ensureUniqueTicketNumber(service, ticketNum, ticketId);
      const ticketPayload = ticketNum ? { ...baseTicketPayload, ticket_num: ticketNum } : baseTicketPayload;
      const { error: updateError } = await service
        .from("feed_tickets")
        .update(ticketPayload)
        .eq("id", ticketId);
      if (updateError) throw new Error(updateError.message);

      const { error: deleteDropsError } = await service
        .from("feed_drops")
        .delete()
        .eq("feed_ticket_id", ticketId);
      if (deleteDropsError) throw new Error(deleteDropsError.message);
    } else {
      const shouldAutoReserveInternalVoucher =
        ticketType !== "Reg" && !submittedTicketNumber;

      if (shouldAutoReserveInternalVoucher) {
        let lastInsertError: Error | null = null;

        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            ticketNum = await reserveVoucherNumber(service);
            await ensureUniqueTicketNumber(service, ticketNum, ticketId);

            const ticketPayload = ticketNum
              ? { ...baseTicketPayload, ticket_num: ticketNum }
              : baseTicketPayload;

            const { data: insertRows, error: insertError } = await service
              .from("feed_tickets")
              .insert(ticketPayload)
              .select("id")
              .limit(1);

            if (insertError) {
              throw new Error(insertError.message);
            }

            savedTicketId = insertRows?.[0]?.id ?? null;
            lastInsertError = null;
            break;
          } catch (error) {
            lastInsertError = error instanceof Error ? error : new Error(String(error));
            if (!isDuplicateTicketNumberError(lastInsertError)) {
              throw lastInsertError;
            }
          }
        }

        if (lastInsertError) {
          throw lastInsertError;
        }
      } else {
        await ensureUniqueTicketNumber(service, ticketNum, ticketId);
        const ticketPayload = ticketNum ? { ...baseTicketPayload, ticket_num: ticketNum } : baseTicketPayload;
        const { data: insertRows, error: insertError } = await service
          .from("feed_tickets")
          .insert(ticketPayload)
          .select("id")
          .limit(1);
        if (insertError) throw new Error(insertError.message);
        savedTicketId = insertRows?.[0]?.id ?? null;
      }
    }

    if (!savedTicketId) {
      throw new Error("Unable to resolve saved feed ticket id.");
    }

    const insertDropsPayload = drops.map((drop, index) => {
      const bin = drop.off_farm_redirect ? null : binById.get(drop.feed_bin_id ?? "");
      return {
      feed_ticket_id: savedTicketId,
      feed_bin_id: drop.off_farm_redirect ? null : drop.feed_bin_id,
      placement_id: drop.off_farm_redirect ? null : drop.placement_id,
      placement_code: drop.off_farm_redirect
        ? OFF_FARM_PLACEMENT_CODE
        : drop.placement_code ?? placementCodeById.get(drop.placement_id ?? "") ?? null,
      ticket_num: ticketNum,
      bin_code: drop.off_farm_redirect
        ? null
        : bin?.bin_num === null || bin?.bin_num === undefined ? drop.feed_bin_id : String(bin.bin_num),
      type: drop.feed_type ?? (typeof payload.source_type === "string" && payload.source_type.trim() ? payload.source_type.trim() : "mill"),
      drop_weight: drop.drop_weight_lbs,
      comment: drop.note,
      farm_id: bin?.farm_id ?? null,
      barn_id: bin?.barn_id ?? null,
      drop_order: index + 1,
      off_farm_redirect: drop.off_farm_redirect === true,
      };
    });

    const { error: insertDropsError } = await service
      .from("feed_drops")
      .insert(insertDropsPayload);
    if (insertDropsError) throw new Error(insertDropsError.message);

    await recalculateFeedBinLayerState(
      service,
      Array.from(
        new Set([
          ...existingDropFeedBinIds,
          ...insertDropsPayload
            .map((row) => row.feed_bin_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ]),
      ),
    );
    await recalculateFeedOrderReceipts(
      service,
      Array.from(
        new Set([
          ...existingDropFarmIds,
          ...insertDropsPayload
            .map((row) => row.farm_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ]),
      ),
    );

    const [allBinsResult, barnsResult, farmsResult, dropsResult, ticketResult] = await Promise.all([
      service.from("feedbins").select("id,farm_id,barn_id,bin_num,capacity").order("bin_num", { ascending: true }),
      service.from("barns").select("id,barn_code,farm_id"),
      service.from("farms").select("id,farm_name"),
      service
        .from("feed_drops")
        .select("id,feed_bin_id,placement_id,placement_code,type,drop_weight,drop_order,comment,bin_code,off_farm_redirect")
        .eq("feed_ticket_id", savedTicketId)
        .order("drop_order", { ascending: true }),
      service
        .from("feed_tickets")
        .select("id,ticket_num,feedmill,delivery_date,comment,feed_weight,feed_name,source_type,ticket_type")
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
        ticket_type: parseTicketType(ticket?.ticket_type),
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
            placement_code: drop.off_farm_redirect === true ? OFF_FARM_PLACEMENT_CODE : drop.placement_code ?? null,
            feed_type: drop.type ?? null,
            drop_weight_lbs: typeof drop.drop_weight === "number" ? drop.drop_weight : null,
            note: drop.comment ?? null,
            drop_order: typeof drop.drop_order === "number" ? drop.drop_order : 1,
            off_farm_redirect: drop.off_farm_redirect === true,
          };
        }),
      },
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
