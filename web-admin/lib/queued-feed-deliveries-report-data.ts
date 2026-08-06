import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type FarmRow = {
  id: string;
  farm_name: string | null;
  farm_group_id: string | null;
  farm_group_name: string | null;
};

type BarnRow = {
  id: string;
  farm_id: string;
  barn_code: string | null;
  sort_code: string | null;
};

type TicketRow = {
  id: string;
  ticket_num: string | null;
  delivery_date: string | null;
  feedmill: string | null;
  feed_name: string | null;
  source_type: string | null;
};

type DropRow = {
  id: string;
  feed_ticket_id: string;
  farm_id: string | null;
  barn_id: string | null;
  feed_bin_id: string | null;
  bin_code: string | null;
  placement_code: string | null;
  type: string | null;
  drop_weight: number | null;
  queued_at: string | null;
  queued_from_feed_bin_id: string | null;
  queued_from_bin_code: string | null;
  queued_from_barn_id: string | null;
  queued_from_barn_code: string | null;
  queued_from_placement_code: string | null;
};

type BinRow = {
  id: string;
  bin_num: number | string | null;
};

export type QueuedFeedDeliveryReportRow = {
  id: string;
  deliveryDate: string;
  queuedAt: string | null;
  ticketNumber: string;
  feedMill: string;
  farmName: string;
  barnCode: string;
  binCode: string;
  placementCode: string;
  feedType: string;
  queuedWeightLbs: number;
};

export type QueuedFeedDeliveriesReportData = {
  startDate: string;
  endDate: string;
  scopeLabel: string;
  rows: QueuedFeedDeliveryReportRow[];
  totalsByFeedType: Array<{ feedType: string; pounds: number; dropCount: number }>;
  totalQueuedLbs: number;
};

export type QueuedFeedDeliveriesFilterOptions = {
  farmGroups: Array<{ id: string; name: string }>;
  farms: Array<{ id: string; farmGroupId: string; name: string }>;
  barns: Array<{ id: string; farmGroupId: string; farmId: string; label: string }>;
  flocks: [];
  feedMills: string[];
};

export async function getQueuedFeedDeliveriesFilterOptions(): Promise<QueuedFeedDeliveriesFilterOptions> {
  noStore();
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { farmGroups: [], farms: [], barns: [], flocks: [], feedMills: [] };

  const [farmsResult, barnsResult, ticketsResult] = await Promise.all([
    supabase.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").order("farm_name"),
    supabase.from("barns").select("id,farm_id,barn_code,sort_code"),
    supabase.from("feed_tickets").select("feedmill").not("feedmill", "is", null).limit(2000),
  ]);
  const error = farmsResult.error ?? barnsResult.error ?? ticketsResult.error;
  if (error) throw error;

  const farms = (farmsResult.data ?? []) as FarmRow[];
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));
  return {
    farmGroups: dedupeBy(
      farms.filter((farm) => farm.farm_group_id).map((farm) => ({
        id: farm.farm_group_id!,
        name: normalize(farm.farm_group_name) || "Unnamed group",
      })),
      (row) => row.id,
    ).sort((left, right) => left.name.localeCompare(right.name)),
    farms: farms.filter((farm) => farm.farm_group_id).map((farm) => ({
      id: farm.id,
      farmGroupId: farm.farm_group_id!,
      name: normalize(farm.farm_name) || "Unnamed farm",
    })),
    barns: ((barnsResult.data ?? []) as BarnRow[]).flatMap((barn) => {
      const farm = farmById.get(barn.farm_id);
      if (!farm?.farm_group_id) return [];
      return [{
        id: barn.id,
        farmGroupId: farm.farm_group_id,
        farmId: barn.farm_id,
        label: `${normalize(barn.barn_code) || "Unnamed barn"} · ${normalize(farm.farm_name) || "Unnamed farm"}`,
      }];
    }).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true })),
    flocks: [],
    feedMills: Array.from(new Set((ticketsResult.data ?? []).map((row) => normalize(row.feedmill)).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right)),
  };
}

export async function getQueuedFeedDeliveriesReportData(options: {
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  feedMill?: string | null;
  startDate: string;
  endDate: string;
}): Promise<QueuedFeedDeliveriesReportData> {
  noStore();
  const startDate = normalizeDateKey(options.startDate) ?? todayDateKey();
  const requestedEnd = normalizeDateKey(options.endDate) ?? startDate;
  const endDate = requestedEnd < startDate ? startDate : requestedEnd;
  const supabase = createSupabaseAdminClient();
  const empty = { startDate, endDate, scopeLabel: "Selected scope", rows: [], totalsByFeedType: [], totalQueuedLbs: 0 };
  if (!supabase) return empty;

  const [farmsResult, barnsResult] = await Promise.all([
    supabase.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name"),
    supabase.from("barns").select("id,farm_id,barn_code,sort_code"),
  ]);
  if (farmsResult.error) throw farmsResult.error;
  if (barnsResult.error) throw barnsResult.error;

  const farms = (farmsResult.data ?? []) as FarmRow[];
  const barns = (barnsResult.data ?? []) as BarnRow[];
  const selectedFarmIds = farms.filter((farm) => {
    if (options.farmGroupId && farm.farm_group_id !== options.farmGroupId) return false;
    if (options.farmId && farm.id !== options.farmId) return false;
    return true;
  }).map((farm) => farm.id);
  if (selectedFarmIds.length === 0) return { ...empty, scopeLabel: buildScopeLabel(farms, options) };

  let ticketsQuery = supabase
    .from("feed_tickets")
    .select("id,ticket_num,delivery_date,feedmill,feed_name,source_type")
    .gte("delivery_date", startDate)
    .lte("delivery_date", endDate)
    .order("delivery_date", { ascending: false });
  if (normalize(options.feedMill)) ticketsQuery = ticketsQuery.eq("feedmill", normalize(options.feedMill));
  const ticketsResult = await ticketsQuery;
  if (ticketsResult.error) throw ticketsResult.error;
  const tickets = (ticketsResult.data ?? []) as TicketRow[];
  if (tickets.length === 0) return { ...empty, scopeLabel: buildScopeLabel(farms, options) };

  const dropsResult = await supabase
    .from("feed_drops")
    .select("id,feed_ticket_id,farm_id,barn_id,feed_bin_id,bin_code,placement_code,type,drop_weight,queued_at,queued_from_feed_bin_id,queued_from_bin_code,queued_from_barn_id,queued_from_barn_code,queued_from_placement_code")
    .eq("queued_for_reconciliation", true)
    .in("feed_ticket_id", tickets.map((ticket) => ticket.id));
  if (dropsResult.error) throw dropsResult.error;
  const drops = (dropsResult.data ?? []) as DropRow[];
  const binIds = Array.from(new Set(drops.flatMap((drop) => [drop.queued_from_feed_bin_id, drop.feed_bin_id]).filter(Boolean))) as string[];
  const binsResult = binIds.length > 0
    ? await supabase.from("feedbins").select("id,bin_num").in("id", binIds)
    : { data: [], error: null };
  if (binsResult.error) throw binsResult.error;

  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));
  const barnById = new Map(barns.map((barn) => [barn.id, barn]));
  const binById = new Map(((binsResult.data ?? []) as BinRow[]).map((bin) => [bin.id, bin]));
  const rows = drops.flatMap((drop): QueuedFeedDeliveryReportRow[] => {
    const ticket = ticketById.get(drop.feed_ticket_id);
    const sourceBarnId = drop.queued_from_barn_id ?? drop.barn_id;
    const barn = sourceBarnId ? barnById.get(sourceBarnId) : null;
    const farmId = drop.farm_id ?? barn?.farm_id ?? null;
    if (!ticket?.delivery_date || !farmId || !selectedFarmIds.includes(farmId)) return [];
    if (options.barnId && sourceBarnId !== options.barnId) return [];
    const bin = binById.get(drop.queued_from_feed_bin_id ?? drop.feed_bin_id ?? "");
    return [{
      id: drop.id,
      deliveryDate: ticket.delivery_date,
      queuedAt: drop.queued_at,
      ticketNumber: normalize(ticket.ticket_num) || "--",
      feedMill: normalize(ticket.feedmill) || normalize(ticket.source_type) || normalize(ticket.feed_name) || "Unknown",
      farmName: normalize(farmById.get(farmId)?.farm_name) || "Unknown farm",
      barnCode: normalize(drop.queued_from_barn_code) || normalize(barn?.barn_code) || "--",
      binCode: normalize(drop.queued_from_bin_code) || normalize(bin?.bin_num === null ? null : String(bin?.bin_num ?? "")) || normalize(drop.bin_code) || "--",
      placementCode: normalize(drop.queued_from_placement_code) || normalize(drop.placement_code) || "--",
      feedType: titleCase(normalize(drop.type) || "Unknown"),
      queuedWeightLbs: typeof drop.drop_weight === "number" && Number.isFinite(drop.drop_weight) ? drop.drop_weight : 0,
    }];
  }).sort((left, right) =>
    right.deliveryDate.localeCompare(left.deliveryDate)
      || left.farmName.localeCompare(right.farmName)
      || left.barnCode.localeCompare(right.barnCode, undefined, { numeric: true })
      || left.binCode.localeCompare(right.binCode, undefined, { numeric: true }),
  );

  const totals = new Map<string, { feedType: string; pounds: number; dropCount: number }>();
  for (const row of rows) {
    const key = row.feedType.toLowerCase();
    const current = totals.get(key) ?? { feedType: row.feedType, pounds: 0, dropCount: 0 };
    current.pounds += row.queuedWeightLbs;
    current.dropCount += 1;
    totals.set(key, current);
  }

  return {
    startDate,
    endDate,
    scopeLabel: buildScopeLabel(farms, options),
    rows,
    totalsByFeedType: [...totals.values()].sort((left, right) => left.feedType.localeCompare(right.feedType)),
    totalQueuedLbs: rows.reduce((sum, row) => sum + row.queuedWeightLbs, 0),
  };
}

function buildScopeLabel(farms: FarmRow[], options: { farmGroupId?: string | null; farmId?: string | null }) {
  if (options.farmId) return normalize(farms.find((farm) => farm.id === options.farmId)?.farm_name) || "Selected farm";
  if (options.farmGroupId) return normalize(farms.find((farm) => farm.farm_group_id === options.farmGroupId)?.farm_group_name) || "Selected farm group";
  return "All farm groups";
}

function normalize(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value.trim() : "";
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeDateKey(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : null;
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function dedupeBy<T>(rows: T[], getKey: (row: T) => string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = getKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
