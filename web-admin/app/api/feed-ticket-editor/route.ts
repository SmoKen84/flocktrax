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
  const parsedCounter = Number.parseInt(String(counterRow?.value ?? "").trim(), 10);

  return {
    voucherPrefix: prefixRow?.value?.trim() || null,
    nextVoucherNumber: String(Number.isFinite(parsedCounter) && parsedCounter > 0 ? parsedCounter : 1),
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

  const [placementOptions, ticketNumberDefaults, allowHistoricalEntry] = await Promise.all([
    listPlacementOptions(),
    getTicketNumberDefaults(),
    getAllowHistoricalEntry(),
  ]);
  return NextResponse.json(
    { ...payload, placementOptions, ticketNumberDefaults, settings: { allowHistoricalEntry } },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(req: NextRequest) {
  const user = await ensureUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
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
    .select("id,farm_id")
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

  return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
}
