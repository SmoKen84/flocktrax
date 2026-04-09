import { apiConfig } from "./config";
import {
  AuthSession,
  DashboardSettings,
  FeedTicketItem,
  FeedTicketListItem,
  FeedTicketListResponse,
  FeedTicketResponse,
  LoginResponse,
  PlacementFilterMeta,
  PlacementDayItem,
  PlacementDayResponse,
  PlacementSummary,
  PlacementSummaryResponse,
  SaveFeedTicketResponse,
  SavePlacementResponse,
  SaveWeightEntryResponse,
  UserProfile,
  WeightEntryItem,
  WeightEntryResponse,
} from "../types";

type RequestOptions = {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
};

export async function login(email: string, password: string): Promise<AuthSession> {
  const payload = await request<LoginResponse>("auth-login", {
    method: "POST",
    body: { email, password },
  });

  if (!payload.access_token) {
    throw new Error("Login succeeded but no access token was returned.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    email: payload.user?.email ?? email,
    userId: payload.user?.id ?? "",
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await request<{ ok?: boolean; error?: string }>("auth-forgot-password", {
    method: "POST",
    body: { email },
  });
}

export async function getProfile(token: string): Promise<UserProfile> {
  return request<UserProfile>("auth_me", { token });
}

export async function listPlacements(
  token: string,
  options: { farmGroupId?: string | null } = {},
): Promise<{
  items: PlacementSummary[];
  filters: PlacementFilterMeta | null;
  settings: DashboardSettings | null;
}> {
  const params = new URLSearchParams();
  if (options.farmGroupId) {
    params.set("farm_group_id", options.farmGroupId);
  }

  const path =
    params.size > 0
      ? `dashboard-placements-list?${params.toString()}`
      : "dashboard-placements-list";
  const payload = await request<PlacementSummaryResponse>(path, { token });

  if (!payload.ok) {
    throw new Error(payload.error ?? "Unable to load placements.");
  }

  return {
    items: payload.items ?? [],
    filters: payload.filters ?? null,
    settings: payload.settings ?? null,
  };
}

export async function getPlacementDay(
  token: string,
  placementId: string,
  logDate: string,
): Promise<PlacementDayItem> {
  const payload = await request<PlacementDayResponse>(
    `placement-day-get?placement_id=${encodeURIComponent(placementId)}&log_date=${encodeURIComponent(logDate)}`,
    { token },
  );

  if (!payload.ok || !payload.item) {
    throw new Error(payload.error ?? "Unable to load placement day.");
  }

  return payload.item;
}

export async function submitPlacementDay(
  token: string,
  item: PlacementDayItem,
): Promise<PlacementDayItem> {
  const payload = await request<SavePlacementResponse>("placement-day-submit", {
    method: "POST",
    token,
    body: {
      placement_id: item.placement_id,
      log_date: item.log_date,
      age_days: item.age_days,
      am_temp: item.am_temp,
      set_temp: item.set_temp,
      rel_humidity: item.rel_humidity,
      outside_temp_current: item.outside_temp_current,
      outside_temp_low: item.outside_temp_low,
      outside_temp_high: item.outside_temp_high,
      water_meter_reading: item.water_meter_reading,
      maintenance_flag: item.maintenance_flag,
      feedlines_flag: item.feedlines_flag,
      nipple_lines_flag: item.nipple_lines_flag,
      bird_health_alert: item.bird_health_alert,
      min_vent: item.min_vent,
      is_oda_open: item.is_oda_open,
      oda_exception: item.oda_exception,
      naoh: item.naoh,
      comment: item.comment,
      daily_is_active: item.daily_is_active,
      dead_female: item.dead_female,
      dead_male: item.dead_male,
      cull_female: item.cull_female,
      cull_male: item.cull_male,
      cull_female_note: item.cull_female_note,
      cull_male_note: item.cull_male_note,
      dead_reason: item.dead_reason,
      grade_litter: item.grade_litter,
      grade_footpad: item.grade_footpad,
      grade_feathers: item.grade_feathers,
      grade_lame: item.grade_lame,
      grade_pecking: item.grade_pecking,
      mortality_is_active: item.mortality_is_active,
    },
  });

  if (!payload.ok || !payload.item) {
    throw new Error(payload.error ?? "Unable to save placement day.");
  }

  return payload.item;
}

export async function getWeightEntry(
  token: string,
  placementId: string,
  logDate: string,
): Promise<WeightEntryItem> {
  const payload = await request<WeightEntryResponse>(
    `weight-entry-get?placement_id=${encodeURIComponent(placementId)}&log_date=${encodeURIComponent(logDate)}`,
    { token },
  );

  if (!payload.ok || !payload.item) {
    throw new Error(payload.error ?? "Unable to load weight entry.");
  }

  return payload.item;
}

export async function submitWeightEntry(
  token: string,
  item: WeightEntryItem,
): Promise<WeightEntryItem> {
  const payload = await request<SaveWeightEntryResponse>("weight-entry-submit", {
    method: "POST",
    token,
    body: {
      placement_id: item.placement_id,
      log_date: item.log_date,
      male_sample: item.male_sample,
      female_sample: item.female_sample,
    },
  });

  if (!payload.ok || !payload.item) {
    throw new Error(payload.error ?? "Unable to save weight entry.");
  }

  return payload.item;
}

export async function getFeedTicket(
  token: string,
  ticketId?: string | null,
): Promise<FeedTicketItem> {
  const path = ticketId
    ? `feed-ticket-get?ticket_id=${encodeURIComponent(ticketId)}`
    : "feed-ticket-get";
  const payload = await request<FeedTicketResponse>(path, { token });

  if (!payload.ok || !payload.item) {
    throw new Error(payload.error ?? "Unable to load feed ticket.");
  }

  return payload.item;
}

export async function listFeedTickets(
  token: string,
  options: {
    ticketNumber?: string | null;
    flockCode?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  } = {},
): Promise<{ items: FeedTicketListItem[] }> {
  const params = new URLSearchParams();
  if (options.ticketNumber?.trim()) params.set("ticket_number", options.ticketNumber.trim());
  if (options.flockCode?.trim()) params.set("flock_code", options.flockCode.trim());
  if (options.dateFrom) params.set("date_from", options.dateFrom);
  if (options.dateTo) params.set("date_to", options.dateTo);

  const path = params.size > 0 ? `feed-ticket-list?${params.toString()}` : "feed-ticket-list";
  const payload = await request<FeedTicketListResponse>(path, { token });

  if (!payload.ok) {
    throw new Error(payload.error ?? "Unable to load feed tickets.");
  }

  return {
    items: payload.items ?? [],
  };
}

export async function submitFeedTicket(
  token: string,
  item: FeedTicketItem,
): Promise<FeedTicketItem> {
  const payload = await request<SaveFeedTicketResponse>("feed-ticket-submit", {
    method: "POST",
    token,
    body: {
      id: item.id,
      ticket_number: item.ticket_number,
      delivered_at: item.delivered_at,
      ticket_weight_lbs: item.ticket_weight_lbs,
      feed_name: item.feed_name,
      vendor_name: item.vendor_name,
      source_type: item.source_type,
      note: item.note,
      drops: item.drops,
    },
  });

  if (!payload.ok || !payload.item) {
    throw new Error(payload.error ?? "Unable to save feed ticket.");
  }

  return payload.item;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (deviceTimeZone) {
    headers["X-Device-Timezone"] = deviceTimeZone;
  }

  if (apiConfig.supabaseAnonKey) {
    headers.apikey = apiConfig.supabaseAnonKey;
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  } else if (apiConfig.supabaseAnonKey) {
    headers.Authorization = `Bearer ${apiConfig.supabaseAnonKey}`;
  }

  const response = await fetch(`${apiConfig.apiBaseUrl}/${path}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
  });

  const raw = await response.text();
  const payload = safeJsonParse<T & { error?: string }>(raw);

  if (!response.ok && payload && typeof payload === "object" && "error" in payload && payload.error) {
    throw new Error(payload.error);
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return payload as T;
}

function safeJsonParse<T>(raw: string): T {
  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("The server returned a non-JSON response.");
  }
}
