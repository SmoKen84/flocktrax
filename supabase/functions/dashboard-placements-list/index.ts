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

function parseBoolean(value: string | null) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readDeviceTimeZone(req: Request) {
  const value = req.headers.get("x-device-timezone") ?? req.headers.get("X-Device-Timezone");
  if (!value) return "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function deriveDashboardStatus(flags: {
  isActive: boolean;
  maintenance: boolean;
  feedlines: boolean;
  nippleLines: boolean;
  birdHealthAlert: boolean;
  completedTodayLabel: string | null;
}) {
  if (!flags.isActive) {
    return { label: "Inactive", tone: "neutral" as const };
  }

  if (flags.birdHealthAlert) {
    return { label: "Health Alert", tone: "danger" as const };
  }

  if (flags.maintenance || flags.feedlines || flags.nippleLines) {
    return { label: "Needs R&M", tone: "warn" as const };
  }

  if (flags.completedTodayLabel) {
    return { label: flags.completedTodayLabel, tone: "good" as const };
  }

  return { label: "Pending", tone: "neutral" as const };
}

function formatCompletionBadgeLabel(timestamp: string | null | undefined, today: string, timeZone: string) {
  if (!timestamp) return null;

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  if (formatDateInTimeZone(date, timeZone) !== today) return null;

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return `Done ${time}`;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.headers.get("x-adalo-test") === "true") {
    return json(req, {
      ok: true,
      items: [
        {
          placement_id: "00000000-0000-0000-0000-000000000000",
          farm_id: "00000000-0000-0000-0000-000000000001",
          farm_group_id: "00000000-0000-0000-0000-000000000002",
          farm_group_name: "Sample Group",
          farm_name: "Sample Farm",
          barn_code: "Barn-A",
          placement_code: "123-Barn-A",
          placed_date: "2026-02-01",
          est_first_catch: "2026-03-11",
          age_days: 41,
          placed_female_count: 12345,
          placed_male_count: 12655,
          mortality_female_count: 145,
          mortality_male_count: 155,
          current_female_count: 12200,
          current_male_count: 12500,
          current_total_count: 24700,
          needs_maintenance: false,
          needs_feedlines: false,
          needs_nipple_lines: false,
          has_bird_health_alert: true,
          dashboard_status_label: "Health Alert",
          dashboard_status_tone: "danger",
          head_count: 25000,
          is_active: true,
          is_removed: false,
          is_complete: false,
          is_in_barn: true,
          is_settled: true,
        },
      ],
      filters: {
        can_select_farm_group: false,
        selected_farm_group_id: "00000000-0000-0000-0000-000000000002",
        available_farm_groups: [
          {
            farm_group_id: "00000000-0000-0000-0000-000000000002",
            farm_group_name: "Sample Group",
          },
        ],
        available_farms: [
          {
            farm_id: "00000000-0000-0000-0000-000000000001",
            farm_name: "Sample Farm",
            farm_group_id: "00000000-0000-0000-0000-000000000002",
          },
        ],
      },
      settings: {
        dow_date: "dow_mon_dd_yy",
        first_lh: 42,
      },
      count: 1,
      mode: "adalo_test",
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  const accessToken = parseAuthHeader(req);
  if (!accessToken) {
    return json(req, { ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  const url = new URL(req.url);
  const deviceTimeZone = readDeviceTimeZone(req);
  const today = formatDateInTimeZone(new Date(), deviceTimeZone);
  const body = req.method === "POST" ? await readBody(req) : {};
  const includeInactive = parseBoolean(url.searchParams.get("include_inactive")) || body.include_inactive === true;

  try {
    const supabase = getClient(accessToken);
    const { data: isAdminData, error: isAdminError } = await supabase.rpc("is_admin");
    if (isAdminError) {
      return json(req, { ok: false, error: isAdminError.message }, 400);
    }
    const isGlobalAdmin = isAdminData === true;

    const {
      data: authInfo,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return json(req, { ok: false, error: authError.message }, 401);
    }

    const authUserId = authInfo.user?.id;
    if (!authUserId) {
      return json(req, { ok: false, error: "Unable to resolve authenticated user" }, 401);
    }

    const {
      data: farmMemberships,
      error: farmMembershipsError,
    } = await supabase
      .from("farm_memberships")
      .select("farm_id,role_id,is_active")
      .eq("user_id", authUserId)
      .eq("is_active", true);

    if (farmMembershipsError) {
      return json(req, { ok: false, error: farmMembershipsError.message }, 400);
    }

    const {
      data: groupMemberships,
      error: groupMembershipsError,
    } = await supabase
      .from("farm_group_memberships")
      .select("farm_group_id,role_id,active")
      .eq("user_id", authUserId)
      .eq("active", true);

    if (groupMembershipsError) {
      return json(req, { ok: false, error: groupMembershipsError.message }, 400);
    }

    const roleIds = Array.from(
      new Set(
        (groupMemberships ?? [])
          .map((row) => row.role_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );

    const roleCodeById = new Map<string, string>();
    if (roleIds.length > 0) {
      const { data: roles, error: rolesError } = await supabase
        .from("roles")
        .select("id,code")
        .in("id", roleIds);

      if (rolesError) {
        return json(req, { ok: false, error: rolesError.message }, 400);
      }

      for (const role of roles ?? []) {
        if (typeof role.id === "string" && typeof role.code === "string") {
          roleCodeById.set(role.id, role.code);
        }
      }
    }

    const accessibleFarmIds = Array.from(
      new Set(
        (farmMemberships ?? [])
          .map((row) => row.farm_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );

    const accessibleFarmRows = new Map<string, { farm_group_id: string | null; farm_name: string }>();
    if (accessibleFarmIds.length > 0) {
      const { data: accessibleFarms, error: accessibleFarmsError } = await supabase
        .from("farms")
        .select("id,farm_name,farm_group_id")
        .in("id", accessibleFarmIds);

      if (accessibleFarmsError) {
        return json(req, { ok: false, error: accessibleFarmsError.message }, 400);
      }

      for (const farm of accessibleFarms ?? []) {
        if (typeof farm.id === "string") {
          accessibleFarmRows.set(farm.id, {
            farm_group_id: typeof farm.farm_group_id === "string" ? farm.farm_group_id : null,
            farm_name: typeof farm.farm_name === "string" ? farm.farm_name : "",
          });
        }
      }
    }

    const selectableGroupMemberships = (groupMemberships ?? []).filter(
      (row) => typeof row.farm_group_id === "string" && row.farm_group_id.length > 0,
    );
    const accessibleFarmGroupIds = Array.from(
      new Set([
        ...selectableGroupMemberships.map((row) => row.farm_group_id as string),
        ...Array.from(accessibleFarmRows.values())
          .map((farm) => farm.farm_group_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ]),
    );
    const hasFarmGroupAdminRole = selectableGroupMemberships.some((row) => {
      if (typeof row.role_id !== "string") return false;
      return roleCodeById.get(row.role_id) === "admin";
    });
    const canSelectFarmGroup =
      isGlobalAdmin || accessibleFarmGroupIds.length > 1 || hasFarmGroupAdminRole;
    const requestedFarmGroupId = url.searchParams.get("farm_group_id");
    const inferredSingleFarmGroupId =
      accessibleFarmGroupIds.length === 1 ? accessibleFarmGroupIds[0] : null;
    const selectedFarmGroupId =
      canSelectFarmGroup
        ? requestedFarmGroupId || inferredSingleFarmGroupId
        : inferredSingleFarmGroupId;

    let dowDateSetting = "dow_mon_dd_yy";
    let firstLivehaulDaysSetting = 38;
    const { data: appSettingRows, error: appSettingsError } = await supabase
      .from("app_settings")
      .select("name,value")
      .in("name", ["DOW_Date", "First-LH"])
      .eq("is_active", true)
      .limit(10);

    if (!appSettingsError) {
      for (const row of appSettingRows ?? []) {
        if (row?.name === "DOW_Date" && typeof row.value === "string" && row.value.trim().length > 0) {
          dowDateSetting = row.value.trim();
        }

        if (row?.name === "First-LH") {
          const parsed = Number(row.value);
          if (Number.isFinite(parsed) && parsed > 0) {
            firstLivehaulDaysSetting = parsed;
          }
        }
      }
    }

    let query = supabase
      .from("placements")
      .select("id,farm_id,barn_id,flock_id,date_removed,is_active,placement_key", { count: "exact" });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (!isGlobalAdmin) {
      if (accessibleFarmIds.length === 0) {
        return json(req, {
          ok: true,
          items: [],
          filters: {
            can_select_farm_group: false,
            selected_farm_group_id: null,
            available_farm_groups: [],
            available_farms: [],
          },
          count: 0,
        });
      }

      query = query.in("farm_id", accessibleFarmIds);
    }

    if (selectedFarmGroupId) {
      let farmIdsInGroup: string[] = [];

      if (isGlobalAdmin) {
        const { data: farmsInGroup, error: farmsInGroupError } = await supabase
          .from("farms")
          .select("id")
          .eq("farm_group_id", selectedFarmGroupId)
          .eq("is_active", true);

        if (farmsInGroupError) {
          return json(req, { ok: false, error: farmsInGroupError.message }, 400);
        }

        farmIdsInGroup = (farmsInGroup ?? [])
          .map((row) => row.id)
          .filter((value): value is string => typeof value === "string" && value.length > 0);
      } else {
        farmIdsInGroup = accessibleFarmIds.filter(
          (farmId) => accessibleFarmRows.get(farmId)?.farm_group_id === selectedFarmGroupId,
        );
      }

      if (farmIdsInGroup.length === 0) {
        const availableFarmGroups = await loadFarmGroupOptions(
          supabase,
          isGlobalAdmin ? null : accessibleFarmGroupIds,
        );
        return json(req, {
          ok: true,
          items: [],
          filters: {
            can_select_farm_group: canSelectFarmGroup,
            selected_farm_group_id: selectedFarmGroupId,
            available_farm_groups: availableFarmGroups,
            available_farms: [],
          },
          count: 0,
        });
      }

      query = query.in("farm_id", farmIdsInGroup);
    }

    const { data, error, count } = await query;

    if (error) {
      return json(req, { ok: false, error: error.message }, 400);
    }

    const placements = data ?? [];
    const farmIds = Array.from(new Set(
      placements
        .map((row) => row.farm_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ));
    const barnIds = Array.from(new Set(
      placements
        .map((row) => row.barn_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ));
    const flockIds = Array.from(new Set(
      placements
        .map((row) => row.flock_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ));
    const placementIds = Array.from(new Set(
      placements
        .map((row) => row.id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ));

    const farmById = new Map<string, Record<string, unknown>>();
    const barnById = new Map<string, Record<string, unknown>>();
    const flockById = new Map<string, Record<string, unknown>>();
    const mortalityByPlacementId = new Map<
      string,
      {
        dead_female: number;
        dead_male: number;
        cull_female: number;
        cull_male: number;
      }
    >();
    const dailyFlagsByPlacementId = new Map<
      string,
      {
        maintenance: boolean;
        feedlines: boolean;
        nippleLines: boolean;
        birdHealthAlert: boolean;
        latestLogDate: string | null;
        completedTodayLabel: string | null;
      }
    >();

    if (farmIds.length > 0) {
      const { data: farms, error: farmsError } = await supabase
        .from("farms")
        .select("id,farm_name,farm_group_id")
        .in("id", farmIds);

      if (farmsError) {
        return json(req, { ok: false, error: farmsError.message }, 400);
      }

      for (const farm of farms ?? []) {
        if (typeof farm.id === "string") {
          farmById.set(farm.id, farm);
        }
      }
    }

    if (barnIds.length > 0) {
      const { data: barns, error: barnsError } = await supabase
        .from("barns")
        .select("id,barn_code,sort_code")
        .in("id", barnIds);

      if (barnsError) {
        return json(req, { ok: false, error: barnsError.message }, 400);
      }

      for (const barn of barns ?? []) {
        if (typeof barn.id === "string") {
          barnById.set(barn.id, barn);
        }
      }
    }

    if (flockIds.length > 0) {
      const { data: flocks, error: flocksError } = await supabase
        .from("flocks")
        .select("id,date_placed,start_cnt_females,start_cnt_males,is_complete,is_in_barn,is_settled")
        .in("id", flockIds);

      if (flocksError) {
        return json(req, { ok: false, error: flocksError.message }, 400);
      }

      for (const flock of flocks ?? []) {
        if (typeof flock.id === "string") {
          flockById.set(flock.id, flock);
        }
      }
    }

    if (placementIds.length > 0) {
      const { data: dailyRows, error: dailyRowsError } = await supabase
        .from("log_daily")
        .select("placement_id,log_date,created_at,updated_at,maintenance_flag,feedlines_flag,nipple_lines_flag,bird_health_alert,is_active")
        .in("placement_id", placementIds)
        .eq("is_active", true);

      if (dailyRowsError) {
        return json(req, { ok: false, error: dailyRowsError.message }, 400);
      }

      for (const row of dailyRows ?? []) {
        if (typeof row.placement_id !== "string") continue;

        const current = dailyFlagsByPlacementId.get(row.placement_id) ?? {
          maintenance: false,
          feedlines: false,
          nippleLines: false,
          birdHealthAlert: false,
          latestLogDate: null,
          completedTodayLabel: null,
        };

        current.maintenance = current.maintenance || row.maintenance_flag === true;
        current.feedlines = current.feedlines || row.feedlines_flag === true;
        current.nippleLines = current.nippleLines || row.nipple_lines_flag === true;
        current.birdHealthAlert = current.birdHealthAlert || row.bird_health_alert === true;
        const rowLogDate = typeof row.log_date === "string" ? row.log_date : null;
        if (!current.latestLogDate || (rowLogDate && rowLogDate > current.latestLogDate)) {
          current.latestLogDate = rowLogDate;
        }
        const completionLabel = formatCompletionBadgeLabel(
          typeof row.updated_at === "string" ? row.updated_at : (typeof row.created_at === "string" ? row.created_at : null),
          today,
          deviceTimeZone,
        );
        if (completionLabel && rowLogDate === today) {
          current.completedTodayLabel = completionLabel;
        }

        dailyFlagsByPlacementId.set(row.placement_id, current);
      }

      const { data: mortalityRows, error: mortalityError } = await supabase
        .from("log_mortality")
        .select("placement_id,dead_female,dead_male,cull_female,cull_male,is_active")
        .in("placement_id", placementIds)
        .eq("is_active", true);

      if (mortalityError) {
        return json(req, { ok: false, error: mortalityError.message }, 400);
      }

      for (const row of mortalityRows ?? []) {
        if (typeof row.placement_id !== "string") continue;

        const current = mortalityByPlacementId.get(row.placement_id) ?? {
          dead_female: 0,
          dead_male: 0,
          cull_female: 0,
          cull_male: 0,
        };

        current.dead_female += typeof row.dead_female === "number" ? row.dead_female : 0;
        current.dead_male += typeof row.dead_male === "number" ? row.dead_male : 0;
        current.cull_female += typeof row.cull_female === "number" ? row.cull_female : 0;
        current.cull_male += typeof row.cull_male === "number" ? row.cull_male : 0;

        mortalityByPlacementId.set(row.placement_id, current);
      }
    }

    const items = placements.map((row) => {
      const farm = typeof row.farm_id === "string" ? farmById.get(row.farm_id) : undefined;
      const barn = typeof row.barn_id === "string" ? barnById.get(row.barn_id) : undefined;
      const flock = typeof row.flock_id === "string" ? flockById.get(row.flock_id) : undefined;
      const femaleCount = typeof flock?.start_cnt_females === "number" ? flock.start_cnt_females : 0;
      const maleCount = typeof flock?.start_cnt_males === "number" ? flock.start_cnt_males : 0;
      const placedDate = typeof flock?.date_placed === "string" ? flock.date_placed : null;
      const mortality = typeof row.id === "string"
        ? mortalityByPlacementId.get(row.id)
        : undefined;
      const mortalityFemaleCount = (mortality?.dead_female ?? 0) + (mortality?.cull_female ?? 0);
      const mortalityMaleCount = (mortality?.dead_male ?? 0) + (mortality?.cull_male ?? 0);
      const currentFemaleCount = Math.max(0, femaleCount - mortalityFemaleCount);
      const currentMaleCount = Math.max(0, maleCount - mortalityMaleCount);
      const firstLivehaulDays = placedDate ? firstLivehaulDaysSetting : null;
      const flags = typeof row.id === "string"
        ? (dailyFlagsByPlacementId.get(row.id) ?? {
            maintenance: false,
            feedlines: false,
            nippleLines: false,
            birdHealthAlert: false,
            latestLogDate: null,
            completedTodayLabel: null,
          })
        : {
            maintenance: false,
            feedlines: false,
            nippleLines: false,
            birdHealthAlert: false,
            latestLogDate: null,
            completedTodayLabel: null,
          };
      const dashboardStatus = deriveDashboardStatus({
        isActive: row.is_active === true,
        maintenance: flags.maintenance,
        feedlines: flags.feedlines,
        nippleLines: flags.nippleLines,
        birdHealthAlert: flags.birdHealthAlert,
        completedTodayLabel: flags.completedTodayLabel,
      });

      return {
        placement_id: row.id,
        farm_id: row.farm_id,
        farm_group_id: typeof farm?.farm_group_id === "string" ? farm.farm_group_id : null,
        farm_group_name: null,
        farm_name: typeof farm?.farm_name === "string" ? farm.farm_name : "",
        barn_code: typeof barn?.barn_code === "string" ? barn.barn_code : "",
        placement_code: row.placement_key,
        placed_date: placedDate,
        est_first_catch: placedDate ? addDays(placedDate, firstLivehaulDaysSetting) : null,
        first_livehaul_days: firstLivehaulDays,
        age_days: placedDate ? daysSince(placedDate) : null,
        placed_female_count: femaleCount,
        placed_male_count: maleCount,
        mortality_female_count: mortalityFemaleCount,
        mortality_male_count: mortalityMaleCount,
        current_female_count: currentFemaleCount,
        current_male_count: currentMaleCount,
        current_total_count: currentFemaleCount + currentMaleCount,
        needs_maintenance: flags.maintenance,
        needs_feedlines: flags.feedlines,
        needs_nipple_lines: flags.nippleLines,
        has_bird_health_alert: flags.birdHealthAlert,
        dashboard_status_label: dashboardStatus.label,
        dashboard_status_tone: dashboardStatus.tone,
        head_count: femaleCount + maleCount,
        is_active: row.is_active,
        is_removed: row.date_removed !== null,
        is_complete: flock?.is_complete === true,
        is_in_barn: flock?.is_in_barn === true,
        is_settled: flock?.is_settled === true,
        sort_code: typeof barn?.sort_code === "string" ? barn.sort_code : null,
      };
    });

    const resultFarmGroupIds = Array.from(
      new Set(
        [
          ...items
          .map((item) => item.farm_group_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
          ...accessibleFarmGroupIds,
        ],
      ),
    );
    const farmGroupNameById = new Map<string, string>();
    if (resultFarmGroupIds.length > 0) {
      const { data: farmGroups, error: farmGroupsError } = await supabase
        .from("farm_groups")
        .select("id,group_name")
        .in("id", resultFarmGroupIds);

      if (farmGroupsError) {
        return json(req, { ok: false, error: farmGroupsError.message }, 400);
      }

      for (const group of farmGroups ?? []) {
        if (typeof group.id === "string" && typeof group.group_name === "string") {
          farmGroupNameById.set(group.id, group.group_name);
        }
      }
    }

    for (const item of items) {
      if (typeof item.farm_group_id === "string") {
        item.farm_group_name = farmGroupNameById.get(item.farm_group_id) ?? null;
      }
    }

    items.sort((a, b) => {
      const groupCompare = (a.farm_group_name ?? "").localeCompare(b.farm_group_name ?? "");
      if (groupCompare !== 0) return groupCompare;

      const farmCompare = (a.farm_name ?? "").localeCompare(b.farm_name ?? "");
      if (farmCompare !== 0) return farmCompare;

      const sortCompare = (a.sort_code ?? "").localeCompare(b.sort_code ?? "");
      if (sortCompare !== 0) return sortCompare;

      return (b.placed_date ?? "").localeCompare(a.placed_date ?? "");
    });

    const availableFarmGroups = await loadFarmGroupOptions(
      supabase,
      isGlobalAdmin ? null : accessibleFarmGroupIds,
    );
    const normalizedSelectedFarmGroupId =
      selectedFarmGroupId ??
      (availableFarmGroups.length === 1 ? availableFarmGroups[0].farm_group_id : null);

    return json(req, {
      ok: true,
      items,
      filters: {
        can_select_farm_group: canSelectFarmGroup,
        selected_farm_group_id: normalizedSelectedFarmGroupId,
        available_farm_groups: availableFarmGroups,
        available_farms: Array.from(
          new Map(
            items.map((item) => [
              item.farm_id,
              {
                farm_id: item.farm_id,
                farm_name: item.farm_name,
                farm_group_id: item.farm_group_id,
              },
            ]),
          ).values(),
        ),
      },
      settings: {
        dow_date: dowDateSetting,
        first_lh: firstLivehaulDaysSetting,
      },
      count: count ?? items.length,
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});

function addDays(date: string, days: number) {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function daysSince(date: string) {
  const start = new Date(`${date}T00:00:00Z`);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.ceil((todayUtc - startUtc) / 86400000);
}

async function loadFarmGroupOptions(
  supabase: ReturnType<typeof createClient>,
  farmGroupIds: string[] | null,
) {
  let query = supabase
    .from("farm_groups")
    .select("id,group_name")
    .eq("is_active", true);

  if (farmGroupIds && farmGroupIds.length > 0) {
    query = query.in("id", farmGroupIds);
  }

  if (farmGroupIds && farmGroupIds.length === 0) {
    return [] as { farm_group_id: string; farm_group_name: string }[];
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row) => typeof row.id === "string" && typeof row.group_name === "string")
    .map((row) => ({
      farm_group_id: row.id as string,
      farm_group_name: row.group_name as string,
    }));
}
