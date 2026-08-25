import { unstable_noStore as noStore } from "next/cache";

import { getBinSentryConfig } from "@/lib/binsentry-auth";
import { buildBinSentryEntityUrl, fetchBinSentryEntity } from "@/lib/binsentry-http";
import { readCurrentBinSentryInventory, type BinSentryFeedBinMapping } from "@/lib/binsentry";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const PENDING_BINSENTRY_ORDER_STATES = new Set(["ready", "scheduled", "not-delivered"]);

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

type FeedBinRow = BinSentryFeedBinMapping & {
  capacity: number | null;
  binsentry_last_inventory_lbs: number | null;
  binsentry_last_sync_at: string | null;
};

type SirenLink = { rel?: string[]; href?: string };
type SirenSubEntity = {
  rel?: string[];
  href?: string;
  properties?: Record<string, unknown>;
  links?: SirenLink[];
  entities?: SirenSubEntity[];
};
type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: SirenLink[];
  entities?: SirenSubEntity[];
  href?: string;
};

export type FeedInventoryReportRow = {
  feedBinId: string;
  farmId: string;
  farmName: string;
  farmGroupName: string;
  barnId: string;
  barnCode: string;
  binNumber: string;
  feedType: string;
  feedName: string | null;
  onHandLbs: number | null;
  capturedAt: string | null;
  capacityLbs: number | null;
  status: "current" | "unmapped" | "unavailable";
  statusDetail: string;
};

export type FeedInventoryComingOrder = {
  id: string;
  externalRef: string;
  farmId: string;
  farmName: string;
  barnId: string;
  barnCode: string;
  feedBinId: string;
  binNumber: string;
  feedType: string;
  feedName: string | null;
  expectedDeliveryDate: string | null;
  pounds: number | null;
  volumeM3: number;
};

export type FeedInventoryTypeTotal = {
  feedType: string;
  pounds: number;
  binCount: number;
};

export type FeedInventoryReportData = {
  generatedAt: string;
  scopeLabel: string;
  rows: FeedInventoryReportRow[];
  comingOrders: FeedInventoryComingOrder[];
  onHandByFeedType: FeedInventoryTypeTotal[];
  comingByFeedType: FeedInventoryTypeTotal[];
  totalOnHandLbs: number;
  totalComingLbs: number;
  mappedBinCount: number;
  currentBinCount: number;
  warnings: string[];
};

export async function getFeedInventoryReportData(options: {
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  includeComingOrders?: boolean;
}): Promise<FeedInventoryReportData> {
  noStore();
  const generatedAt = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin access is required to build the feed inventory report.");
  }

  const [farmsResult, barnsResult, binsResult] = await Promise.all([
    supabase.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").order("farm_name"),
    supabase.from("barns").select("id,farm_id,barn_code,sort_code"),
    supabase
      .from("feedbins")
      .select("id,farm_id,barn_id,bin_num,capacity,binsentry_bin_ref,binsentry_last_inventory_lbs,binsentry_last_sync_at,accessible_feed_type,accessible_feed_lbs,queued_feed_type,queued_feed_lbs,feed_state_effective_at,feed_state_source")
      .order("bin_num"),
  ]);
  const error = farmsResult.error ?? barnsResult.error ?? binsResult.error;
  if (error) throw error;

  const farms = (farmsResult.data ?? []) as FarmRow[];
  const barns = (barnsResult.data ?? []) as BarnRow[];
  const bins = (binsResult.data ?? []) as FeedBinRow[];
  const selectedFarms = farms.filter((farm) => {
    if (options.farmGroupId && farm.farm_group_id !== options.farmGroupId) return false;
    if (options.farmId && farm.id !== options.farmId) return false;
    return true;
  });
  const selectedFarmIds = new Set(selectedFarms.map((farm) => farm.id));
  const selectedBarns = barns.filter((barn) => selectedFarmIds.has(barn.farm_id) && (!options.barnId || barn.id === options.barnId));
  const selectedBarnIds = new Set(selectedBarns.map((barn) => barn.id));
  const selectedBins = bins.filter((bin) => Boolean(bin.barn_id && selectedBarnIds.has(bin.barn_id)));
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));
  const barnById = new Map(barns.map((barn) => [barn.id, barn]));
  const warnings: string[] = [];

  const rows = await mapWithConcurrency(selectedBins, 4, async (bin): Promise<FeedInventoryReportRow> => {
    const barn = bin.barn_id ? barnById.get(bin.barn_id) : null;
    const farmId = bin.farm_id ?? barn?.farm_id ?? "";
    const farm = farmById.get(farmId);
    const base = {
      feedBinId: bin.id,
      farmId,
      farmName: normalize(farm?.farm_name) || "Unknown farm",
      farmGroupName: normalize(farm?.farm_group_name) || "Ungrouped",
      barnId: bin.barn_id ?? "",
      barnCode: normalize(barn?.barn_code) || "Unknown barn",
      binNumber: normalize(bin.bin_num) || "--",
      capacityLbs: finiteNumber(bin.capacity),
    };

    if (!normalize(bin.binsentry_bin_ref)) {
      return {
        ...base,
        feedType: formatFeedType(bin.accessible_feed_type),
        feedName: null,
        onHandLbs: null,
        capturedAt: null,
        status: "unmapped",
        statusDetail: "No BinSentry mapping",
      };
    }

    try {
      const snapshot = await readCurrentBinSentryInventory(bin);
      if (!snapshot) {
        const message = `${base.farmName} ${base.barnCode} bin ${base.binNumber}: BinSentry returned no usable weight.`;
        warnings.push(message);
        return {
          ...base,
          feedType: formatFeedType(bin.accessible_feed_type),
          feedName: null,
          onHandLbs: null,
          capturedAt: null,
          status: "unavailable",
          statusDetail: "No current weight returned",
        };
      }

      return {
        ...base,
        feedType: formatFeedType(snapshot.accessibleFeedType ?? snapshot.feedName ?? bin.accessible_feed_type),
        feedName: normalize(snapshot.feedName) || null,
        onHandLbs: snapshot.inventoryLbs,
        capturedAt: snapshot.capturedAt,
        status: "current",
        statusDetail: "BinSentry latest valid reading",
      };
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "BinSentry request failed.";
      warnings.push(`${base.farmName} ${base.barnCode} bin ${base.binNumber}: ${detail}`);
      return {
        ...base,
        feedType: formatFeedType(bin.accessible_feed_type),
        feedName: null,
        onHandLbs: null,
        capturedAt: null,
        status: "unavailable",
        statusDetail: detail,
      };
    }
  });

  rows.sort(compareInventoryRows);
  let comingOrders: FeedInventoryComingOrder[] = [];
  if (options.includeComingOrders !== false) {
    try {
      comingOrders = await fetchBinSentryPendingOrders(selectedBins, farmById, barnById);
      const ordersWithoutWeight = comingOrders.filter((order) => order.pounds === null).length;
      if (ordersWithoutWeight > 0) {
        warnings.push(`${ordersWithoutWeight} pending order${ordersWithoutWeight === 1 ? " has" : "s have"} no BinSentry bulk density and could not be included in coming-pound totals.`);
      }
    } catch (caught) {
      warnings.push(caught instanceof Error ? `Coming orders: ${caught.message}` : "Coming orders could not be read from BinSentry.");
    }
  }

  return {
    generatedAt,
    scopeLabel: buildScopeLabel(farms, barns, options),
    rows,
    comingOrders,
    onHandByFeedType: summarizeByFeedType(rows.map((row) => ({ feedType: row.feedType, pounds: row.onHandLbs }))),
    comingByFeedType: summarizeByFeedType(comingOrders.map((order) => ({ feedType: order.feedType, pounds: order.pounds }))),
    totalOnHandLbs: rows.reduce((sum, row) => sum + (row.onHandLbs ?? 0), 0),
    totalComingLbs: comingOrders.reduce((sum, order) => sum + (order.pounds ?? 0), 0),
    mappedBinCount: selectedBins.filter((bin) => Boolean(normalize(bin.binsentry_bin_ref))).length,
    currentBinCount: rows.filter((row) => row.status === "current").length,
    warnings,
  };
}

async function fetchBinSentryPendingOrders(
  bins: FeedBinRow[],
  farmById: Map<string, FarmRow>,
  barnById: Map<string, BarnRow>,
) {
  const mappedBins = bins.filter((bin) => Boolean(normalize(bin.binsentry_bin_ref)));
  if (mappedBins.length === 0) return [];

  const binByHref = new Map<string, FeedBinRow>();
  for (const bin of mappedBins) {
    const rawRef = normalize(bin.binsentry_bin_ref);
    for (const candidate of [rawRef, buildBinSentryEntityUrl(rawRef)]) {
      const key = canonicalHref(candidate);
      if (key) binByHref.set(key, bin);
    }
  }

  const root = (await fetchBinSentryEntity(getBinSentryConfig().rootUrl)) as SirenEntity;
  const organizationHref = findHrefByRel(root, ["/primary-organization", "primary-organization"]);
  if (!organizationHref) throw new Error("Primary organization link was not present in the BinSentry response.");
  const organization = (await fetchBinSentryEntity(organizationHref)) as SirenEntity;
  const searchOrdersHref = findHrefByRel(organization, ["/search-orders", "search-orders"]);
  if (!searchOrdersHref) throw new Error("Search Orders link was not present in the BinSentry organization response.");

  const firstUrl = new URL(searchOrdersHref);
  firstUrl.searchParams.set("limit", "50");
  firstUrl.searchParams.set("sortOrder", "asc");
  firstUrl.searchParams.delete("state");
  for (const state of PENDING_BINSENTRY_ORDER_STATES) {
    firstUrl.searchParams.append("state", state);
  }

  const orders: FeedInventoryComingOrder[] = [];
  const feedByHref = new Map<string, { feedType: string; feedName: string | null; density: number | null }>();
  const seenOrders = new Set<string>();
  const seenPageUrls = new Set<string>();
  let nextUrl: string | null = firstUrl.toString();

  while (nextUrl && !seenPageUrls.has(nextUrl)) {
    seenPageUrls.add(nextUrl);
    const page = (await fetchBinSentryEntity(nextUrl)) as SirenEntity;
    for (const summary of page.entities ?? []) {
      const summaryState = normalize(summary.properties?.state).toLowerCase();
      if (summaryState && !PENDING_BINSENTRY_ORDER_STATES.has(summaryState)) continue;
      const detail = summary.href ? (await fetchBinSentryEntity(summary.href)) as SirenEntity : summary as SirenEntity;
      const properties = { ...(summary.properties ?? {}), ...(detail.properties ?? {}) };
      if (!PENDING_BINSENTRY_ORDER_STATES.has(normalize(properties.state).toLowerCase())) continue;

      const binHref = findHrefByRel(detail, ["/bin", "bin"]);
      const bin = binHref ? binByHref.get(canonicalHref(binHref)) : null;
      if (!bin?.barn_id) continue;
      const quantity = finiteNumber(properties.quantity);
      if (quantity === null || quantity <= 0) continue;

      const feedHref = findHrefByRel(detail, ["/feed", "feed"]);
      let feed = feedHref ? feedByHref.get(canonicalHref(feedHref)) : undefined;
      if (feedHref && !feed) {
        const feedEntity = (await fetchBinSentryEntity(feedHref)) as SirenEntity;
        feed = {
          feedType: formatFeedType(feedEntity.properties?.feedType),
          feedName: firstText(feedEntity.properties ?? {}, ["name", "feedName", "productName", "description"]),
          density: finiteNumber(feedEntity.properties?.bulkDensity),
        };
        feedByHref.set(canonicalHref(feedHref), feed);
      }

      const barn = barnById.get(bin.barn_id);
      const farmId = bin.farm_id ?? barn?.farm_id ?? "";
      const farm = farmById.get(farmId);
      const href = normalize(summary.href) || normalize(detail.href);
      const externalRef = firstText(properties, ["orderNumber", "purchaseOrderNumber", "externalReference", "id"]) ?? deriveId(href) ?? "Pending";
      const id = href || `${bin.id}:${externalRef}:${normalize(properties.deliveryDate)}`;
      if (seenOrders.has(id)) continue;
      seenOrders.add(id);
      orders.push({
        id,
        externalRef,
        farmId,
        farmName: normalize(farm?.farm_name) || "Unknown farm",
        barnId: bin.barn_id,
        barnCode: normalize(barn?.barn_code) || "Unknown barn",
        feedBinId: bin.id,
        binNumber: normalize(bin.bin_num) || "--",
        feedType: feed?.feedType ?? "Unknown",
        feedName: feed?.feedName ?? null,
        expectedDeliveryDate: normalize(properties.deliveryDate).slice(0, 10) || null,
        pounds: feed?.density ? Math.max(0, quantity * feed.density * 2.20462) : null,
        volumeM3: quantity,
      });
    }
    nextUrl = findHrefByRel(page, ["next"]);
  }

  return orders.sort((left, right) =>
    (left.expectedDeliveryDate ?? "9999-12-31").localeCompare(right.expectedDeliveryDate ?? "9999-12-31")
      || left.farmName.localeCompare(right.farmName)
      || left.barnCode.localeCompare(right.barnCode, undefined, { numeric: true })
      || left.binNumber.localeCompare(right.binNumber, undefined, { numeric: true }),
  );
}

function findHrefByRel(entity: SirenEntity, needles: string[]) {
  const matches = (values: string[] | undefined) => (values ?? []).some((value) => {
    const normalized = normalize(value).toLowerCase();
    return needles.some((needle) => normalized === needle.toLowerCase() || (needle.includes("/") && normalized.endsWith(needle.toLowerCase())));
  });
  const link = (entity.links ?? []).find((candidate) => matches(candidate.rel) && normalize(candidate.href));
  if (link?.href) return link.href;
  return (entity.entities ?? []).find((candidate) => matches(candidate.rel) && normalize(candidate.href))?.href ?? null;
}

function canonicalHref(value: string | null | undefined) {
  const normalized = normalize(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized, getBinSentryConfig().rootUrl);
    url.hash = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return normalized.replace(/\/+$/, "").toLowerCase();
  }
}

function compareInventoryRows(left: FeedInventoryReportRow, right: FeedInventoryReportRow) {
  return left.farmName.localeCompare(right.farmName)
    || left.barnCode.localeCompare(right.barnCode, undefined, { numeric: true })
    || left.binNumber.localeCompare(right.binNumber, undefined, { numeric: true });
}

function summarizeByFeedType(rows: Array<{ feedType: string; pounds: number | null }>) {
  const totals = new Map<string, FeedInventoryTypeTotal>();
  for (const row of rows) {
    if (row.pounds === null) continue;
    const key = row.feedType.toLowerCase();
    const current = totals.get(key) ?? { feedType: row.feedType, pounds: 0, binCount: 0 };
    current.pounds += row.pounds;
    current.binCount += 1;
    totals.set(key, current);
  }
  return [...totals.values()].sort((left, right) => left.feedType.localeCompare(right.feedType));
}

function buildScopeLabel(farms: FarmRow[], barns: BarnRow[], options: { farmGroupId?: string | null; farmId?: string | null; barnId?: string | null }) {
  if (options.barnId) {
    const barn = barns.find((row) => row.id === options.barnId);
    const farm = barn ? farms.find((row) => row.id === barn.farm_id) : null;
    return `${normalize(farm?.farm_name) || "Selected farm"} / ${normalize(barn?.barn_code) || "Selected barn"}`;
  }
  if (options.farmId) return normalize(farms.find((farm) => farm.id === options.farmId)?.farm_name) || "Selected farm";
  if (options.farmGroupId) return normalize(farms.find((farm) => farm.farm_group_id === options.farmGroupId)?.farm_group_name) || "Selected farm group";
  return "All farm groups";
}

async function mapWithConcurrency<T, R>(rows: T[], limit: number, mapper: (row: T) => Promise<R>) {
  const results = new Array<R>(rows.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, rows.length)) }, async () => {
    while (nextIndex < rows.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(rows[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalize(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstText(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalize(source[key]);
    if (value) return value;
  }
  return null;
}

function formatFeedType(value: unknown) {
  const normalized = normalize(value).toLowerCase();
  if (normalized.includes("starter")) return "Starter";
  if (normalized.includes("grower")) return "Grower";
  return normalized ? normalized.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
}

function deriveId(href: string) {
  const match = href.match(/\/([^/?#]+)(?:[?#].*)?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
