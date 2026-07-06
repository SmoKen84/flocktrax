import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PlacementOption = {
  placement_id: string;
  placement_code: string;
  farm_name: string | null;
  barn_code: string | null;
  barn_id: string | null;
  active_start: string | null;
  active_end: string | null;
  date_removed: string | null;
  is_active: boolean;
  is_in_barn: boolean;
  is_complete: boolean;
};

type FarmMembershipRow = {
  farm_id: string | null;
  role_id: string | null;
  is_active: boolean | null;
};

type FarmGroupMembershipRow = {
  farm_group_id: string | null;
  role_id: string | null;
  active: boolean | null;
};

type RoleRow = {
  id: string;
  code: string | null;
};

type SysactionRow = {
  id: string;
  action: string | null;
};

type PermissionRow = {
  role_id: string;
  action_id: string;
  createyn: boolean | null;
  updateyn: boolean | null;
};

type AppSettingRow = {
  group: string | null;
  name: string | null;
  value: string | null;
  updated_at?: string | null;
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
  queued_for_reconciliation: boolean | null;
};

type FeedTicketReceiptRow = {
  id: string;
  delivery_date: string | null;
  ticket_type: string | null;
};

const FEED_TICKET_SETTINGS_GROUP = "feed_tickets";
const HISTORICAL_SETTING_NAMES = [
  "allow_historical_entry",
  "historical_entry",
  "historical_mode",
  "history_backfill",
] as const;

function getFunctionUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  return `${baseUrl}/functions/v1/${path}`;
}

async function getAccessToken() {
  const serverClient = await createSupabaseServerClient();
  if (!serverClient) {
    return null;
  }

  const sessionResult = await serverClient.auth.getSession();
  return sessionResult.data.session?.access_token ?? null;
}

async function ensureUser() {
  const serverClient = await createSupabaseServerClient();
  if (!serverClient) {
    return null;
  }

  const authResult = await serverClient.auth.getUser();
  return authResult.data.user ?? null;
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function rankRole(value: string) {
  const normalized = normalizeCode(value);
  if (normalized === "super_admin" || normalized === "superadmin") return 500;
  if (normalized.includes("integrator")) return 400;
  if (normalized === "admin" || normalized.includes("grower")) return 300;
  if (normalized.includes("manager")) return 200;
  if (normalized.includes("tech") || normalized.includes("supervisor")) return 100;
  return 0;
}

function canManualFlockCorrectionRole(value: string | null | undefined) {
  const normalized = normalizeCode(String(value ?? ""));
  return (
    normalized === "admin" ||
    normalized === "super_admin" ||
    normalized === "superadmin" ||
    normalized === "farm_manager" ||
    normalized === "farmmanager" ||
    normalized === "manager"
  );
}

function isWriteAllowed(row: PermissionRow) {
  return row.createyn === true || row.updateyn === true;
}

function pickPreferredAppSetting(rows: AppSettingRow[], name: string) {
  return rows
    .filter((row) => row.name === name)
    .sort((left, right) => {
      const leftRank = left.group === FEED_TICKET_SETTINGS_GROUP ? 0 : left.group === null ? 1 : 2;
      const rightRank = right.group === FEED_TICKET_SETTINGS_GROUP ? 0 : right.group === null ? 1 : 2;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
    })[0] ?? null;
}

function normalizeFeedType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "starter" || normalized === "grower" ? normalized : null;
}

function isoFromDateOnly(value: string | null | undefined) {
  return value ? `${value}T00:00:00.000Z` : null;
}

async function recalculateFeedBinLayerState(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  feedBinIds: string[],
) {
  const uniqueFeedBinIds = Array.from(new Set(feedBinIds.filter((value) => typeof value === "string" && value.length > 0)));
  if (uniqueFeedBinIds.length === 0) {
    return;
  }

  const { data: binRows, error: binError } = await admin
    .from("feedbins")
    .select("id,binsentry_last_inventory_lbs")
    .in("id", uniqueFeedBinIds);
  if (binError) {
    throw new Error(binError.message);
  }

  const { data: dropRows, error: dropError } = await admin
    .from("feed_drops")
    .select("id,feed_bin_id,feed_ticket_id,type,drop_weight,drop_order")
    .in("feed_bin_id", uniqueFeedBinIds)
    .eq("off_farm_redirect", false)
    .eq("queued_for_reconciliation", false);
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
    ? await admin.from("feed_tickets").select("id,delivery_date").in("id", ticketIds)
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

    const { error: updateError } = await admin
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
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  farmIds: string[],
) {
  const uniqueFarmIds = Array.from(new Set(farmIds.filter((value) => typeof value === "string" && value.length > 0)));
  if (uniqueFarmIds.length === 0) {
    return;
  }

  const { data: orderRows, error: orderError } = await admin
    .from("feed_order_commitments")
    .select("commitment_id,farm_id,barn_id,feed_bin_id,placement_id,expected_delivery_date,ordered_lbs,received_lbs,status,feed_type,created_at")
    .in("farm_id", uniqueFarmIds)
    .neq("status", "cancelled");
  if (orderError) {
    throw new Error(orderError.message);
  }

  const { data: dropRows, error: dropError } = await admin
    .from("feed_drops")
    .select("id,feed_ticket_id,farm_id,barn_id,feed_bin_id,placement_id,type,drop_weight,drop_order,off_farm_redirect,queued_for_reconciliation")
    .in("farm_id", uniqueFarmIds)
    .eq("off_farm_redirect", false)
    .eq("queued_for_reconciliation", false);
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
    ? await admin.from("feed_tickets").select("id,delivery_date,ticket_type").in("id", ticketIds)
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

    const { error: updateError } = await admin
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

async function getTicketNumberDefaults() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      voucherPrefix: null,
      nextVoucherNumber: null,
    };
  }

  const { data, error } = await admin
    .from("app_settings")
    .select("group,name,value,updated_at")
    .in("name", ["voucher_prefix", "internal_voucher_number", "internal_voucher_num"])
    .limit(20);

  if (error) {
    return {
      voucherPrefix: null,
      nextVoucherNumber: null,
    };
  }

  const rows = (data ?? []) as AppSettingRow[];
  const prefixRow = pickPreferredAppSetting(rows, "voucher_prefix");
  const counterRow =
    pickPreferredAppSetting(rows, "internal_voucher_number") ??
    pickPreferredAppSetting(rows, "internal_voucher_num");
  const prefix = prefixRow?.value?.trim() || null;
  const parsedCounter = Number.parseInt(String(counterRow?.value ?? "").trim(), 10);
  let nextVoucherNumber = Number.isFinite(parsedCounter) && parsedCounter > 0 ? parsedCounter : 1;

  if (prefix) {
    const { data: ticketRows, error: ticketError } = await admin
      .from("feed_tickets")
      .select("ticket_num,ticket_type")
      .in("ticket_type", ["xTran", "iTran", "f2f"])
      .ilike("ticket_num", `${prefix}%`)
      .limit(5000);

    if (!ticketError) {
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`^${escapedPrefix}(\\d+)$`, "i");
      const maxExisting = Math.max(
        0,
        ...(ticketRows ?? []).map((row) => {
          const match = pattern.exec(String(row.ticket_num ?? "").trim());
          return match ? Number.parseInt(match[1], 10) || 0 : 0;
        }),
      );
      nextVoucherNumber = Math.max(nextVoucherNumber, maxExisting + 1);
    }
  }

  return {
    voucherPrefix: prefix,
    nextVoucherNumber: String(nextVoucherNumber),
  };
}

async function getAllowHistoricalEntry() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return false;
  }

  const { data, error } = await admin
    .from("app_settings")
    .select("group,name,value,updated_at")
    .in("name", [...HISTORICAL_SETTING_NAMES])
    .limit(20);

  if (error) {
    return false;
  }

  const rows = (data ?? []) as AppSettingRow[];
  const preferred = rows
    .filter((row) => typeof row.name === "string" && HISTORICAL_SETTING_NAMES.includes(row.name as (typeof HISTORICAL_SETTING_NAMES)[number]))
    .sort((left, right) => String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? "")))[0];

  const rawValue = String(preferred?.value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(rawValue);
}

async function getFeedTicketWriteAccess(
  userId: string,
  targetFarmId: string | null,
) {
  const admin = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  if (!admin || !serverClient) {
    return { role: null, allowed: false };
  }

  const { data: isAdminData, error: isAdminError } = await serverClient.rpc("is_admin");
  if (!isAdminError && isAdminData === true) {
    return { role: "admin", allowed: true };
  }

  const [farmMembershipsResult, farmGroupMembershipsResult] = await Promise.all([
    admin
      .from("farm_memberships")
      .select("farm_id,role_id,is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
    admin
      .from("farm_group_memberships")
      .select("farm_group_id,role_id,active")
      .eq("user_id", userId)
      .eq("active", true),
  ]);

  if (farmMembershipsResult.error || farmGroupMembershipsResult.error) {
    return { role: null, allowed: false };
  }

  const farmMemberships = (farmMembershipsResult.data ?? []) as FarmMembershipRow[];
  const farmGroupMemberships = (farmGroupMembershipsResult.data ?? []) as FarmGroupMembershipRow[];

  let targetFarmGroupId: string | null = null;
  if (targetFarmId) {
    const farmResult = await admin
      .from("farms")
      .select("id,farm_group_id")
      .eq("id", targetFarmId)
      .limit(1);
    if (!farmResult.error) {
      targetFarmGroupId =
        typeof farmResult.data?.[0]?.farm_group_id === "string" ? farmResult.data[0].farm_group_id : null;
    }
  }

  const allRoleIds = Array.from(
    new Set(
      [...farmMemberships.map((row) => row.role_id), ...farmGroupMemberships.map((row) => row.role_id)].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  );
  if (allRoleIds.length === 0) {
    return { role: null, allowed: false };
  }

  const { data: roleRows, error: roleError } = await admin
    .from("roles")
    .select("id,code")
    .in("id", allRoleIds);
  if (roleError) {
    return { role: null, allowed: false };
  }

  const roles = (roleRows ?? []) as RoleRow[];
  const relevantRoleIds = targetFarmId
    ? Array.from(
        new Set(
          [
            ...farmMemberships.filter((row) => row.farm_id === targetFarmId).map((row) => row.role_id),
            ...farmGroupMemberships.filter((row) => row.farm_group_id === targetFarmGroupId).map((row) => row.role_id),
          ].filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      )
    : allRoleIds;

  const highestRole =
    roles
      .map((row) => row.code)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .sort((left, right) => rankRole(right) - rankRole(left) || left.localeCompare(right))[0] ?? null;

  if (relevantRoleIds.length === 0) {
    return { role: highestRole, allowed: false };
  }

  const [sysactionsResult, permissionsResult] = await Promise.all([
    admin.from("sysactions").select("id,action"),
    admin
      .from("roles_actions_permissions")
      .select("role_id,action_id,createyn,updateyn")
      .in("role_id", relevantRoleIds),
  ]);
  if (sysactionsResult.error || permissionsResult.error) {
    return { role: highestRole, allowed: false };
  }

  const actionById = new Map(
    ((sysactionsResult.data ?? []) as SysactionRow[])
      .filter((row) => typeof row.id === "string" && typeof row.action === "string")
      .map((row) => [row.id, normalizeCode(row.action as string)]),
  );

  const canWriteFeedTickets = ((permissionsResult.data ?? []) as PermissionRow[]).some((row) => {
    const action = actionById.get(row.action_id);
    return action === "feed_tickets" && isWriteAllowed(row);
  });

  return {
    role: highestRole,
    allowed: canWriteFeedTickets,
  };
}

async function callFeedTicketFunction(path: string, init: RequestInit) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  if (anonKey) {
    headers.set("apikey", anonKey);
  }

  const response = await fetch(getFunctionUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "Invalid response from feed ticket function." }));
  return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

async function listPlacementOptions(): Promise<PlacementOption[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return [];
  }

  const { data: placements, error: placementError } = await admin
    .from("placements")
    .select("id,placement_key,barn_id,flock_id,is_active,date_removed,active_start,active_end")
    .order("active_start", { ascending: false })
    .order("placement_key", { ascending: true })
    .limit(1000);

  if (placementError || !placements?.length) {
    return [];
  }

  const barnIds = Array.from(new Set(placements.map((row) => row.barn_id).filter(Boolean)));
  const flockIds = Array.from(new Set(placements.map((row) => row.flock_id).filter(Boolean)));

  const [barnResult, flockResult] = await Promise.all([
    barnIds.length
      ? admin.from("barns").select("id,barn_code,farm_id").in("id", barnIds)
      : Promise.resolve({ data: [], error: null }),
    flockIds.length
      ? admin.from("flocks").select("id,is_complete,is_in_barn").in("id", flockIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (barnResult.error || flockResult.error) {
    return [];
  }

  const farmIds = Array.from(new Set((barnResult.data ?? []).map((row) => row.farm_id).filter(Boolean)));
  const farmResult = farmIds.length
    ? await admin.from("farms").select("id,farm_name").in("id", farmIds)
    : { data: [], error: null };

  if (farmResult.error) {
    return [];
  }

  const barnById = new Map((barnResult.data ?? []).map((row) => [row.id, row]));
  const flockById = new Map((flockResult.data ?? []).map((row) => [row.id, row]));
  const farmById = new Map((farmResult.data ?? []).map((row) => [row.id, row]));

  return placements
    .map((placement) => {
      const flock = placement.flock_id ? flockById.get(placement.flock_id) : null;
      const barn = placement.barn_id ? barnById.get(placement.barn_id) : null;
      const farm = barn?.farm_id ? farmById.get(barn.farm_id) : null;
      return {
        placement_id: placement.id,
        placement_code: placement.placement_key ?? placement.id,
        farm_name: farm?.farm_name ?? null,
        barn_code: barn?.barn_code ?? null,
        barn_id: placement.barn_id ?? null,
        active_start: placement.active_start ?? null,
        active_end: placement.active_end ?? null,
        date_removed: placement.date_removed ?? null,
        is_active: placement.is_active === true,
        is_in_barn: flock?.is_in_barn === true,
        is_complete: flock?.is_complete === true,
      } satisfies PlacementOption;
    })
    .filter((row) => Boolean(row.active_start) || row.is_active || row.is_in_barn || !row.is_complete);
}

export async function GET(req: NextRequest) {
  const user = await ensureUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ticketId = req.nextUrl.searchParams.get("ticketId");
  const result = await callFeedTicketFunction(
    ticketId ? `feed-ticket-get?ticket_id=${encodeURIComponent(ticketId)}` : "feed-ticket-get",
    { method: "GET" },
  );
  const payload = await result.json();

  if (!result.ok) {
    return NextResponse.json(payload, { status: result.status });
  }

  const access = await getFeedTicketWriteAccess(user.id, null);
  const canManualFlockCorrection = canManualFlockCorrectionRole(access.role);

  const [placementOptions, ticketNumberDefaults, allowHistoricalEntry] = await Promise.all([
    listPlacementOptions(),
    getTicketNumberDefaults(),
    getAllowHistoricalEntry(),
  ]);
  return NextResponse.json(
    {
      ...payload,
      placementOptions,
      ticketNumberDefaults,
      settings: { allowHistoricalEntry, canManualFlockCorrection },
    },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(req: NextRequest) {
  const user = await ensureUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const drops: unknown[] = Array.isArray(body?.drops) ? body.drops : [];
  const manualOverrideDrops = drops.filter((drop: unknown) => {
    if (!drop || typeof drop !== "object") {
      return false;
    }
    const row = drop as Record<string, unknown>;
    return row.off_farm_redirect !== true && row.queued_for_reconciliation !== true && row.manual_flock_override === true;
  });

  if (manualOverrideDrops.length > 0) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Manual flock correction is unavailable." }, { status: 500 });
    }

    const feedBinIds = Array.from(
      new Set(
        manualOverrideDrops
          .map((drop: unknown) => (typeof (drop as Record<string, unknown>).feed_bin_id === "string"
            ? (drop as Record<string, unknown>).feed_bin_id as string
            : null))
          .filter((value: string | null): value is string => Boolean(value && value.length > 0)),
      ),
    );

    const feedBinsResult = feedBinIds.length
      ? await admin.from("feedbins").select("id,farm_id").in("id", feedBinIds)
      : { data: [], error: null };

    if (feedBinsResult.error) {
      return NextResponse.json({ ok: false, error: feedBinsResult.error.message }, { status: 500 });
    }

    const farmIds = Array.from(
      new Set(
        (feedBinsResult.data ?? [])
          .map((row) => row.farm_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );

    if (farmIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Manual flock correction requires a valid bin tied to a farm." },
        { status: 400 },
      );
    }

    for (const farmId of farmIds) {
      const access = await getFeedTicketWriteAccess(user.id, farmId);
      if (!access.allowed || !canManualFlockCorrectionRole(access.role)) {
        return NextResponse.json(
          { ok: false, error: "Only super admin or farm manager can correct a feed drop to a different flock." },
          { status: 403 },
        );
      }
    }
  }

  return callFeedTicketFunction("feed-ticket-submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function DELETE(req: NextRequest) {
  const user = await ensureUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Feed ticket delete is unavailable." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const ticketId = typeof body.ticketId === "string" ? body.ticketId : null;
  if (!ticketId) {
    return NextResponse.json({ ok: false, error: "ticketId is required." }, { status: 400 });
  }

  const dropResult = await admin
    .from("feed_drops")
    .select("id,farm_id,feed_bin_id")
    .eq("feed_ticket_id", ticketId);
  if (dropResult.error) {
    return NextResponse.json({ ok: false, error: dropResult.error.message }, { status: 500 });
  }

  const farmIds = Array.from(
    new Set(
      (dropResult.data ?? [])
        .map((row) => row.farm_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  if (farmIds.length === 0) {
    const access = await getFeedTicketWriteAccess(user.id, null);
    if (!access.allowed) {
      return NextResponse.json({ ok: false, error: "You are not authorized to delete this feed ticket." }, { status: 403 });
    }
  } else {
    for (const farmId of farmIds) {
      const access = await getFeedTicketWriteAccess(user.id, farmId);
      if (!access.allowed) {
        return NextResponse.json({ ok: false, error: "You are not authorized to delete this feed ticket." }, { status: 403 });
      }
    }
  }

  const { error: deleteDropsError } = await admin
    .from("feed_drops")
    .delete()
    .eq("feed_ticket_id", ticketId);
  if (deleteDropsError) {
    return NextResponse.json({ ok: false, error: deleteDropsError.message }, { status: 500 });
  }

  const { error: deleteTicketError } = await admin
    .from("feed_tickets")
    .delete()
    .eq("id", ticketId);
  if (deleteTicketError) {
    return NextResponse.json({ ok: false, error: deleteTicketError.message }, { status: 500 });
  }

  try {
    await recalculateFeedBinLayerState(
      admin,
      Array.from(
        new Set(
          (dropResult.data ?? [])
            .map((row) => row.feed_bin_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      ),
    );
    await recalculateFeedOrderReceipts(admin, farmIds);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to refresh inferred feed-bin state." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
}
