import { unstable_noStore as noStore } from "next/cache";

import { buildBinSentryEntityUrl, fetchBinSentryEntity } from "@/lib/binsentry-http";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: Array<{ rel?: string[]; href?: string }>;
  entities?: SirenEntity[];
  href?: string;
  rel?: string[];
};

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

type FeedBinRow = {
  id: string;
  farm_id: string | null;
  barn_id: string | null;
  bin_num: number | null;
  binsentry_bin_ref: string | null;
};

type OrderFeed = {
  deliveredAt: string;
  feedType: string | null;
};

export type FeedDropsSortOrder = "date" | "bin" | "feed_type";

export type FeedDropReportRow = {
  id: string;
  occurredAt: string;
  farmName: string;
  barnCode: string;
  binNumber: number | null;
  volumeCubicMeters: number;
  volumeCubicFeet: number;
  preRefillVolumeCubicMeters: number | null;
  postRefillVolumeCubicMeters: number;
  feedType: string | null;
  densityKgPerCubicMeter: number;
  densityLbPerCubicFoot: number;
  estimatedWeightLbs: number;
  weightDensityLbPerCubicFoot: number;
  weightDensitySource: "type_default" | "type_default_average" | "binsentry" | "binsentry_fallback";
};

export type FeedDropsReportData = {
  startDate: string;
  endDate: string;
  scopeLabel: string;
  sortOrder: FeedDropsSortOrder;
  rows: FeedDropReportRow[];
  mappedBinCount: number;
  errors: string[];
  useDefaultTypeDensity: boolean;
};

export type FeedDropsReportFilterOptions = {
  farmGroups: Array<{ id: string; name: string }>;
  farms: Array<{ id: string; farmGroupId: string; name: string }>;
  barns: Array<{ id: string; farmGroupId: string; farmId: string; label: string }>;
  flocks: [];
};

const CUBIC_FEET_PER_CUBIC_METER = 35.3146667;
const LB_PER_CUBIC_FOOT_PER_KG_PER_CUBIC_METER = 0.0624279606;

export async function getFeedDropsReportFilterOptions(): Promise<FeedDropsReportFilterOptions> {
  noStore();
  const [farms, barns] = await Promise.all([loadFarms(), loadBarns()]);
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));

  return {
    farmGroups: dedupeBy(
      farms
        .filter((farm) => farm.farm_group_id)
        .map((farm) => ({ id: farm.farm_group_id!, name: farm.farm_group_name?.trim() || "Unnamed group" })),
      (farmGroup) => farmGroup.id,
    ).sort((left, right) => left.name.localeCompare(right.name)),
    farms: farms
      .filter((farm) => farm.farm_group_id)
      .map((farm) => ({
        id: farm.id,
        farmGroupId: farm.farm_group_id!,
        name: farm.farm_name?.trim() || "Unnamed farm",
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    barns: barns.flatMap((barn) => {
      const farm = farmById.get(barn.farm_id);
      if (!farm?.farm_group_id) return [];
      return [{
        id: barn.id,
        farmGroupId: farm.farm_group_id,
        farmId: barn.farm_id,
        label: `${barn.barn_code?.trim() || "Unnamed barn"} - ${farm.farm_name?.trim() || "Unnamed farm"}`,
      }];
    }).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true })),
    flocks: [],
  };
}

export async function getFeedDropsReportData(options: {
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  startDate: string;
  endDate: string;
  sortOrder?: string | null;
  useDefaultTypeDensity?: boolean;
}): Promise<FeedDropsReportData> {
  noStore();

  const startDate = normalizeDateKey(options.startDate) ?? todayDateKey();
  const endDateCandidate = normalizeDateKey(options.endDate) ?? startDate;
  const endDate = endDateCandidate < startDate ? startDate : endDateCandidate;
  const sortOrder = normalizeSortOrder(options.sortOrder);
  const useDefaultTypeDensity = options.useDefaultTypeDensity === true;
  const [farms, barns] = await Promise.all([loadFarms(), loadBarns()]);
  const selectedFarms = farms.filter((farm) => {
    if (options.farmGroupId && farm.farm_group_id !== options.farmGroupId) return false;
    if (options.farmId && farm.id !== options.farmId) return false;
    return true;
  });
  const farmById = new Map(selectedFarms.map((farm) => [farm.id, farm]));
  const barnById = new Map(barns.map((barn) => [barn.id, barn]));
  const scopeLabel = buildScopeLabel(selectedFarms, barns, options.farmGroupId, options.farmId, options.barnId);
  const supabase = createSupabaseAdminClient();

  if (!supabase || selectedFarms.length === 0) {
    return { startDate, endDate, scopeLabel, sortOrder, rows: [], mappedBinCount: 0, errors: [], useDefaultTypeDensity };
  }

  const defaultDensities = await loadDefaultTypeDensities(supabase);

  let feedBinsQuery = supabase
    .from("feedbins")
    .select("id,farm_id,barn_id,bin_num,binsentry_bin_ref")
    .in("farm_id", selectedFarms.map((farm) => farm.id));
  if (options.barnId) feedBinsQuery = feedBinsQuery.eq("barn_id", options.barnId);

  const { data, error } = await feedBinsQuery;

  if (error) throw error;

  const mappings = ((data ?? []) as FeedBinRow[]).filter(
    (bin) => bin.farm_id && bin.binsentry_bin_ref?.trim(),
  );
  const errors: string[] = [];
  const nestedRows = await mapWithConcurrency(mappings, 4, async (bin) => {
    try {
      return await loadBinRefills({
        bin,
        farmName: farmById.get(bin.farm_id!)?.farm_name?.trim() || "Unnamed farm",
        barnCode: bin.barn_id
          ? barnById.get(bin.barn_id)?.barn_code?.trim() || "Unnamed barn"
          : "Unassigned barn",
        startDate,
        endDate,
        defaultDensities,
        useDefaultTypeDensity,
      });
    } catch (caught) {
      errors.push(
        `Bin ${bin.bin_num ?? "unknown"}: ${caught instanceof Error ? caught.message : "BinSentry request failed."}`,
      );
      return [];
    }
  });
  const rows = nestedRows.flat();
  sortRows(rows, sortOrder);

  return { startDate, endDate, scopeLabel, sortOrder, rows, mappedBinCount: mappings.length, errors, useDefaultTypeDensity };
}

async function loadBinRefills(options: {
  bin: FeedBinRow;
  farmName: string;
  barnCode: string;
  startDate: string;
  endDate: string;
  defaultDensities: { starter: number | null; grower: number | null };
  useDefaultTypeDensity: boolean;
}) {
  const entityUrl = buildBinSentryEntityUrl(options.bin.binsentry_bin_ref!.trim());
  const binEntity = (await fetchBinSentryEntity(entityUrl)) as SirenEntity;
  const levelsHref = findHrefByRel(binEntity, ["v2/bin-levels", "bin-levels"]);
  if (!levelsHref) return [];

  const levelsUrl = new URL(levelsHref);
  // Include earlier readings so a refill on the first report day still has a baseline.
  levelsUrl.searchParams.set("startDate", `${addDays(options.startDate, -2)}T00:00:00.000Z`);
  levelsUrl.searchParams.set("endDate", `${addDays(options.endDate, 1)}T00:00:00.000Z`);
  levelsUrl.searchParams.set("filter", "raw");
  levelsUrl.searchParams.set("limit", "1000");
  const levelsPayload = (await fetchBinSentryEntity(levelsUrl.toString())) as SirenEntity;
  const refillEntities = (levelsPayload.entities ?? []).filter(
    (entity) => normalize(entity.properties?.label).toUpperCase() === "REFILL",
  );
  if (refillEntities.length === 0) return [];

  const orders = await loadDeliveredOrderFeeds(binEntity);
  const levelPoints = (levelsPayload.entities ?? [])
    .flatMap((entity) => {
      const properties = entity.properties ?? {};
      const occurredAt = normalize(properties.createdAt) || normalize(properties.publishedAt);
      const volumeCubicMeters = coerceNumber(properties.estimatedVolume ?? properties.volume);
      return occurredAt && volumeCubicMeters !== null ? [{ occurredAt, volumeCubicMeters }] : [];
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  return refillEntities.flatMap((entity, index): FeedDropReportRow[] => {
    const properties = entity.properties ?? {};
    const occurredAt = normalize(properties.createdAt) || normalize(properties.publishedAt);
    const postRefillVolumeCubicMeters = coerceNumber(properties.estimatedVolume ?? properties.volume);
    const densityKgPerCubicMeter = coerceNumber(properties.bulkDensity);
    if (!occurredAt || postRefillVolumeCubicMeters === null || densityKgPerCubicMeter === null) return [];
    const dateKey = centralDateKey(occurredAt);
    if (dateKey < options.startDate || dateKey > options.endDate) return [];
    const preRefillVolumeCubicMeters = levelPoints
      .filter((point) => point.occurredAt < occurredAt)
      .at(-1)?.volumeCubicMeters ?? null;
    const volumeCubicMeters = preRefillVolumeCubicMeters === null
      ? postRefillVolumeCubicMeters
      : Math.max(0, postRefillVolumeCubicMeters - preRefillVolumeCubicMeters);
    const feedType = matchFeedType(orders, occurredAt);
    const storedDensityLbPerCubicFoot = densityKgPerCubicMeter * LB_PER_CUBIC_FOOT_PER_KG_PER_CUBIC_METER;
    const defaultDensity = feedType === "starter"
      ? options.defaultDensities.starter
      : feedType === "grower"
        ? options.defaultDensities.grower
        : averageKnownDensities(options.defaultDensities);
    const useTypeDefault = options.useDefaultTypeDensity && defaultDensity !== null;
    const weightDensityLbPerCubicFoot = useTypeDefault ? defaultDensity : storedDensityLbPerCubicFoot;

    return [{
      id: `${options.bin.id}-${occurredAt}-${index}`,
      occurredAt,
      farmName: options.farmName,
      barnCode: options.barnCode,
      binNumber: options.bin.bin_num,
      volumeCubicMeters,
      volumeCubicFeet: volumeCubicMeters * CUBIC_FEET_PER_CUBIC_METER,
      preRefillVolumeCubicMeters,
      postRefillVolumeCubicMeters,
      feedType,
      densityKgPerCubicMeter,
      densityLbPerCubicFoot: storedDensityLbPerCubicFoot,
      estimatedWeightLbs: volumeCubicMeters * CUBIC_FEET_PER_CUBIC_METER * weightDensityLbPerCubicFoot,
      weightDensityLbPerCubicFoot,
      weightDensitySource: useTypeDefault
        ? feedType === "starter" || feedType === "grower"
          ? "type_default"
          : "type_default_average"
        : options.useDefaultTypeDensity
          ? "binsentry_fallback"
          : "binsentry",
    }];
  });
}

function averageKnownDensities(densities: { starter: number | null; grower: number | null }) {
  const known = [densities.starter, densities.grower].filter((value): value is number => value !== null);
  return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

async function loadDefaultTypeDensities(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("name,value")
    .in("name", ["default_density_starter", "default_density_grower"]);
  if (error) throw error;
  const values = new Map((data ?? []).map((row) => [String(row.name), coerceNumber(row.value)]));
  return {
    starter: values.get("default_density_starter") ?? null,
    grower: values.get("default_density_grower") ?? null,
  };
}

async function loadDeliveredOrderFeeds(binEntity: SirenEntity): Promise<OrderFeed[]> {
  const ordersHref = findHrefByRel(binEntity, ["v2/orders", "orders"]);
  if (!ordersHref) return [];

  const ordersUrl = new URL(ordersHref);
  ordersUrl.searchParams.set("limit", "100");
  const payload = (await fetchBinSentryEntity(ordersUrl.toString())) as SirenEntity;
  const feedCache = new Map<string, string | null>();
  const candidates = (payload.entities ?? []).flatMap((entity) => {
    const properties = entity.properties ?? {};
    const state = normalize(properties.state).toLowerCase();
    const deliveredAt = normalize(properties.deliveryDate) || normalize(properties.deliveredAt) || normalize(properties.updatedAt);
    const feedHref = findHrefByRel(entity, ["feed"]);
    if (!deliveredAt || !feedHref || (state !== "delivered" && state !== "closed")) return [];
    return [{ deliveredAt, feedHref }];
  });

  return Promise.all(
    candidates.map(async (candidate) => {
      if (!feedCache.has(candidate.feedHref)) {
        const feedEntity = (await fetchBinSentryEntity(candidate.feedHref)) as SirenEntity;
        feedCache.set(candidate.feedHref, normalizeFeedType(feedEntity.properties?.feedType));
      }
      return { deliveredAt: candidate.deliveredAt, feedType: feedCache.get(candidate.feedHref) ?? null };
    }),
  );
}

function matchFeedType(orders: OrderFeed[], refillAt: string) {
  const refillDate = refillAt.slice(0, 10);
  const exactDate = orders
    .filter((order) => order.feedType && order.deliveredAt.slice(0, 10) === refillDate)
    .sort((left, right) => right.deliveredAt.localeCompare(left.deliveredAt))[0];
  if (exactDate) return exactDate.feedType;

  return orders
    .filter((order) => order.feedType && order.deliveredAt <= refillAt)
    .sort((left, right) => right.deliveredAt.localeCompare(left.deliveredAt))[0]?.feedType ?? null;
}

async function loadFarms() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("farms_ui")
    .select("id,farm_name,farm_group_id,farm_group_name");
  if (error) throw error;
  return (data ?? []) as FarmRow[];
}

async function loadBarns() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("barns")
    .select("id,farm_id,barn_code,sort_code");
  if (error) throw error;
  return (data ?? []) as BarnRow[];
}

function findHrefByRel(entity: SirenEntity, needles: string[]) {
  const matches = (rels: string[] | undefined) =>
    (rels ?? []).some((rel) => {
      const normalizedRel = rel.trim().toLowerCase();
      return needles.some((needle) => {
        const normalizedNeedle = needle.trim().toLowerCase().replace(/^\/+/, "");
        return normalizedRel === normalizedNeedle || normalizedRel.endsWith(`/${normalizedNeedle}`);
      });
    });
  return entity.links?.find((link) => matches(link.rel))?.href
    ?? entity.entities?.find((child) => matches(child.rel))?.href
    ?? null;
}

function normalizeFeedType(value: unknown) {
  const normalized = normalize(value).toLowerCase();
  if (normalized.includes("starter")) return "starter";
  if (normalized.includes("grower")) return "grower";
  return normalized || null;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDateKey(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : null;
}

function normalizeSortOrder(value: string | null | undefined): FeedDropsSortOrder {
  return value === "bin" || value === "feed_type" ? value : "date";
}

function sortRows(rows: FeedDropReportRow[], sortOrder: FeedDropsSortOrder) {
  rows.sort((left, right) => {
    if (sortOrder === "bin") {
      return left.farmName.localeCompare(right.farmName)
        || (left.binNumber ?? Number.MAX_SAFE_INTEGER) - (right.binNumber ?? Number.MAX_SAFE_INTEGER)
        || left.occurredAt.localeCompare(right.occurredAt);
    }
    if (sortOrder === "feed_type") {
      return (left.feedType ?? "Unknown").localeCompare(right.feedType ?? "Unknown")
        || left.occurredAt.localeCompare(right.occurredAt)
        || (left.binNumber ?? 0) - (right.binNumber ?? 0);
    }
    return left.occurredAt.localeCompare(right.occurredAt)
      || left.farmName.localeCompare(right.farmName)
      || (left.binNumber ?? 0) - (right.binNumber ?? 0);
  });
}

function buildScopeLabel(
  farms: FarmRow[],
  barns: BarnRow[],
  farmGroupId?: string | null,
  farmId?: string | null,
  barnId?: string | null,
) {
  if (barnId) {
    const barn = barns.find((row) => row.id === barnId);
    const farm = farms.find((row) => row.id === barn?.farm_id);
    const barnLabel = barn?.barn_code?.trim() || "Selected barn";
    return farm ? `${farm.farm_name?.trim() || "Selected farm"} / ${barnLabel}` : barnLabel;
  }
  if (farmId) return farms[0]?.farm_name?.trim() || "Selected farm";
  if (farmGroupId) return farms[0]?.farm_group_name?.trim() || "Selected farm group";
  return "All farm groups";
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function centralDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Chicago",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
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
