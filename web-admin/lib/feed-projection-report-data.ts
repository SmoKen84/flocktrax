import { getAdminData } from "@/lib/admin-data";
import { getBinSentryAccessToken, getBinSentryConfig } from "@/lib/binsentry-auth";
import { buildBinSentryEntityUrl } from "@/lib/binsentry-http";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { ActivePlacementRecord } from "@/lib/types";

type BreedRow = {
  id: string;
  breed_name: string | null;
  sex: string | null;
};

type BreedSpecRow = {
  geneticname: string | null;
  breedid: string | null;
  age: number | null;
  dayfeedperbird: number | null;
};

type FeedProjectionLiveHaulEvent = {
  date: string;
  targetHead: number | null;
  actualHead: number | null;
};

type FeedOrderCommitmentRow = {
  commitment_id: string;
  farm_id: string | null;
  placement_id: string | null;
  barn_id: string | null;
  feed_bin_id: string | null;
  source: string | null;
  status: string | null;
  ordered_lbs: number | null;
  received_lbs: number | null;
  expected_delivery_date: string | null;
  feed_type: string | null;
  feed_name: string | null;
  external_order_ref: string | null;
};

type FeedOrderWindowBucket = {
  pounds: number;
  starterLbs: number;
  allOpenStarterLbs: number;
  growerLbs: number;
  typedCount: number;
  untypedCount: number;
  count: number;
  nextEta: string | null;
};

type FeedBinMappingRow = {
  id: string;
  barn_id: string | null;
  bin_num: string | number | null;
  binsentry_bin_ref: string | null;
};

type FeedBinNumberRow = {
  id: string;
  bin_num: string | number | null;
};

type BinSentryOnOrderRecord = {
  id: string;
  barnId: string;
  binNumber: string | null;
  status: string;
  deliveryDate: string | null;
  feedType: string | null;
  feedName: string | null;
  externalOrderRef: string | null;
  pounds: number;
};

export type FeedProjectionOnOrderRow = {
  id: string;
  source: string;
  farmName: string;
  barnCode: string;
  binNumber: string | null;
  placementCode: string | null;
  feedType: string | null;
  feedName: string | null;
  status: string;
  deliveryDate: string | null;
  orderedLbs: number;
  receivedLbs: number;
  remainingLbs: number;
  externalOrderRef: string | null;
};

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: Array<{ rel?: string[]; href?: string }>;
  entities?: Array<{ rel?: string[]; href?: string; properties?: Record<string, unknown> }>;
  href?: string;
};

const PENDING_BINSENTRY_ORDER_STATES = new Set(["ready", "scheduled", "not-delivered"]);
const STARTER_FEED_MAX_AGE_DAYS = 21;
const FEED_ORDER_LEAD_DAYS = 5;

export type FeedProjectionReportRow = {
  id: string;
  farmName: string;
  barnCode: string;
  placementCode: string;
  ageDays: number | null;
  statusLabel: string;
  statusTone: string;
  headCount: number | null | undefined;
  starterTotalLbs: number | null | undefined;
  growerTotalLbs: number | null | undefined;
  starterTargetLbs: number | null | undefined;
  starterDeliveredLbs: number | null | undefined;
  starterRecognizedSupplyLbs: number | null | undefined;
  starterRemainingObligationLbs: number | null | undefined;
  starterDeliveredPlusOnOrderLbs: number | null | undefined;
  starterLbsPerChick: number | null | undefined;
  daily: Array<{
    date: string;
    pounds: number | null;
  }>;
  totalLbs: number | null | undefined;
  onHandLbs: number | null | undefined;
  onOrderLbs: number | null | undefined;
  recommendedOrderLbs: number | null | undefined;
  starterAccessibleLbs: number | null | undefined;
  growerAccessibleLbs: number | null | undefined;
  starterQueuedLbs: number | null | undefined;
  growerQueuedLbs: number | null | undefined;
  starterOnOrderLbs: number | null | undefined;
  growerOnOrderLbs: number | null | undefined;
  starterRecommendedLbs: number | null | undefined;
  starterRecommendationConvertedToGrowerLbs: number;
  growerRecommendedLbs: number | null | undefined;
  orderingMode: "typed" | "legacy" | "pending";
};

export async function getFeedProjectionReportData(options: {
  windowDays: number;
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  flockCode?: string | null;
  reportMode?: "operational" | "planning";
  includeBinSentryOnOrder?: boolean;
}) {
  const windowDays = clampWindowDays(options.windowDays);
  const reportMode = options.reportMode ?? (windowDays === 10 ? "operational" : "planning");
  const includeBinSentryOnOrder = options.includeBinSentryOnOrder === true;
  const adminData = await getAdminData();
  const supabase = createSupabaseAdminClient();
  const farmGroupId = normalizeOptionalId(options.farmGroupId);
  const farmId = normalizeOptionalId(options.farmId);
  const barnId = normalizeOptionalId(options.barnId);
  const flockCode = normalizeOptionalText(options.flockCode);

  if (!supabase) {
    throw new Error("Supabase admin access is required to build the feed projection report.");
  }

  const filteredPlacements = filterPlacementsForFeedProjection({
    placements: adminData.activePlacements,
    farmGroupId,
    farmId,
    barnId,
    flockCode,
    reportMode,
    windowDays,
  });
  const filteredPlacementIds = Array.from(
    new Set(
      filteredPlacements
        .map((placement) => normalizeOptionalId(placement.placementId))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [breedsResult, breedSpecsResult, livehaulResult] = await Promise.all([
    supabase.from("breeds").select("id,breed_name,sex").eq("is_active", true),
    supabase
      .from("stdbreedspec")
      .select("geneticname,breedid,age,dayfeedperbird")
      .eq("is_active", true),
    filteredPlacementIds.length > 0
      ? supabase
          .from("livehaul_schedule")
          .select("placement_id,lh_date,head_target,head_actual")
          .in("placement_id", filteredPlacementIds)
          .order("lh_date")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (breedsResult.error || breedSpecsResult.error || livehaulResult.error) {
    throw new Error(
      breedsResult.error?.message ??
        breedSpecsResult.error?.message ??
        livehaulResult.error?.message ??
        "Feed projection report inputs could not be loaded.",
    );
  }

  const today = isoDate(new Date());
  const windowDates = Array.from({ length: windowDays }, (_, index) => addDays(today, index));
  const windowEnd = windowDates[windowDates.length - 1] ?? today;
  const uniqueBarnIds = Array.from(new Set(filteredPlacements.map((placement) => placement.barnId).filter(Boolean)));
  const uniquePlacementIds = Array.from(
    new Set(filteredPlacements.map((placement) => placement.placementId).filter(Boolean)),
  );

  const [placementOrdersResult, barnOrdersResult, feedBinNumbersResult, binsentryScheduledOrders] = await Promise.all([
    uniquePlacementIds.length > 0
      ? supabase
          .from("feed_order_commitments")
          .select("commitment_id,farm_id,placement_id,barn_id,feed_bin_id,source,status,ordered_lbs,received_lbs,expected_delivery_date,feed_type,feed_name,external_order_ref")
          .in("status", ["open", "partial"])
          .in("placement_id", uniquePlacementIds)
      : Promise.resolve({ data: [], error: null }),
    uniqueBarnIds.length > 0
      ? supabase
          .from("feed_order_commitments")
          .select("commitment_id,farm_id,placement_id,barn_id,feed_bin_id,source,status,ordered_lbs,received_lbs,expected_delivery_date,feed_type,feed_name,external_order_ref")
          .in("status", ["open", "partial"])
          .in("barn_id", uniqueBarnIds)
          .is("placement_id", null)
      : Promise.resolve({ data: [], error: null }),
    uniqueBarnIds.length > 0
      ? supabase.from("feedbins").select("id,bin_num").in("barn_id", uniqueBarnIds)
      : Promise.resolve({ data: [], error: null }),
    fetchBinSentryScheduledOrdersSafe(supabase, uniqueBarnIds, windowEnd),
  ]);

  if (placementOrdersResult.error || barnOrdersResult.error || feedBinNumbersResult.error) {
    throw new Error(
      placementOrdersResult.error?.message ??
        barnOrdersResult.error?.message ??
        feedBinNumbersResult.error?.message ??
        "Feed projection order commitments could not be loaded.",
    );
  }

  const feedOrdersByPlacementId = buildFeedOrderWindowMap(
    (placementOrdersResult.data ?? []) as FeedOrderCommitmentRow[],
    "placement_id",
    windowEnd,
  );
  const feedOrdersByBarnId = buildFeedOrderWindowMap(
    (barnOrdersResult.data ?? []) as FeedOrderCommitmentRow[],
    "barn_id",
    windowEnd,
  );
  const placementById = new Map(filteredPlacements.map((placement) => [placement.placementId, placement]));
  const placementByBarnId = new Map(filteredPlacements.map((placement) => [placement.barnId, placement]));
  const feedBinNumberById = new Map(
    ((feedBinNumbersResult.data ?? []) as FeedBinNumberRow[]).map((row) => [row.id, normalizeOptionalText(String(row.bin_num ?? ""))]),
  );
  const databaseOnOrderRows = buildDatabaseOnOrderRows({
    rows: [
      ...((placementOrdersResult.data ?? []) as FeedOrderCommitmentRow[]),
      ...((barnOrdersResult.data ?? []) as FeedOrderCommitmentRow[]),
    ],
    placementById,
    placementByBarnId,
    feedBinNumberById,
  });
  const binSentryOnOrderRows = buildBinSentryOnOrderRows({
    rows: binsentryScheduledOrders.orders,
    placementByBarnId,
  });
  const onOrderRows = [...databaseOnOrderRows, ...binSentryOnOrderRows].sort(compareOnOrderRows);

  const breedById = new Map(
    ((breedsResult.data ?? []) as BreedRow[]).map((breed) => [breed.id, breed]),
  );
  const breedSpecRows = (breedSpecsResult.data ?? []) as BreedSpecRow[];
  const liveHaulEventsByPlacementId = new Map<string, FeedProjectionLiveHaulEvent[]>();

  for (const row of (livehaulResult.data ?? []) as Array<{
    placement_id: string | null;
    lh_date: string | null;
    head_target: number | null;
    head_actual: number | null;
  }>) {
    const placementId = String(row.placement_id ?? "").trim();
    const date = String(row.lh_date ?? "").trim();
    if (!placementId || !date) continue;
    const list = liveHaulEventsByPlacementId.get(placementId) ?? [];
    list.push({
      date,
      targetHead: typeof row.head_target === "number" ? row.head_target : null,
      actualHead: typeof row.head_actual === "number" ? row.head_actual : null,
    });
    liveHaulEventsByPlacementId.set(placementId, list);
  }

  const rows = filteredPlacements
    .map((placement) =>
      toReportRow({
        placement,
        windowDates,
        breedById,
        breedSpecRows,
        liveHaulEvents: liveHaulEventsByPlacementId.get(placement.placementId) ?? [],
        feedOrdersForPlacement: feedOrdersByPlacementId.get(placement.placementId) ?? null,
        feedOrdersForBarn: feedOrdersByBarnId.get(placement.barnId) ?? null,
        binSentryOrdersForBarn: includeBinSentryOnOrder
          ? binsentryScheduledOrders.byBarnId.get(placement.barnId) ?? null
          : null,
        reportMode,
      }),
    )
    .sort(compareReportRows);

  const dailyTotals = windowDates.map((date, index) => ({
    date,
    pounds: rows.reduce((sum, row) => sum + (row.daily[index]?.pounds ?? 0), 0),
  }));

  return {
    rows,
    windowDates,
    windowEnd,
    today,
    windowDays,
    onOrderRows,
    dailyTotals,
    overallTotal: rows.reduce((sum, row) => sum + (row.totalLbs ?? 0), 0),
    overallOnHand: rows.reduce((sum, row) => sum + (row.onHandLbs ?? 0), 0),
    overallOnOrder: rows.reduce((sum, row) => sum + (row.onOrderLbs ?? 0), 0),
    overallRecommended: rows.reduce((sum, row) => sum + (row.recommendedOrderLbs ?? 0), 0),
    overallStarterRecommended: rows.reduce((sum, row) => sum + (row.starterRecommendedLbs ?? 0), 0),
    overallGrowerRecommended: rows.reduce((sum, row) => sum + (row.growerRecommendedLbs ?? 0), 0),
  };
}

function filterPlacementsForFeedProjection({
  placements,
  farmGroupId,
  farmId,
  barnId,
  flockCode,
  reportMode,
  windowDays,
}: {
  placements: ActivePlacementRecord[];
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
  flockCode?: string | null;
  reportMode: "operational" | "planning";
  windowDays: number;
}) {
  const windowStart = isoDate(new Date());
  const windowEnd = addDays(windowStart, Math.max(0, windowDays - 1));

  return placements.filter((placement) => {
    if (farmGroupId && placement.farmGroupId !== farmGroupId) return false;
    if (farmId && placement.farmId !== farmId) return false;
    if (barnId && placement.barnId !== barnId) return false;
    if (flockCode) {
      const haystack = `${placement.placementCode} ${placement.flockCode ?? ""}`.toLowerCase();
      if (!haystack.includes(flockCode.toLowerCase())) return false;
    }
    if (!placementBelongsInProjectionWindow({
      placement,
      windowStart,
      windowEnd,
      includeScheduled: reportMode === "planning",
      includeInventoryOnly: reportMode === "planning",
    })) {
      return false;
    }
    return true;
  });
}

function toReportRow({
  placement,
  windowDates,
  breedById,
  breedSpecRows,
  liveHaulEvents,
  feedOrdersForPlacement,
  feedOrdersForBarn,
  binSentryOrdersForBarn,
  reportMode,
}: {
  placement: ActivePlacementRecord;
  windowDates: string[];
  breedById: Map<string, BreedRow>;
  breedSpecRows: BreedSpecRow[];
  liveHaulEvents: FeedProjectionLiveHaulEvent[];
  feedOrdersForPlacement: FeedOrderWindowBucket | null;
  feedOrdersForBarn: FeedOrderWindowBucket | null;
  binSentryOrdersForBarn: FeedOrderWindowBucket | null;
  reportMode: "operational" | "planning";
}): FeedProjectionReportRow {
  const windowDays = windowDates.length;
  const anchorToday = addDays(windowDates[0] ?? isoDate(new Date()), -1);
  const projection = buildFeedProjection({
    today: anchorToday,
    windowDays,
    ageDays: placement.ageDays,
    currentFemaleCount: placement.currentFemaleCount,
    currentMaleCount: placement.currentMaleCount,
    projectedFemaleMortalityPerDay: resolveProjectedMortalityPerDay(
      placement.mortalityFemaleLast7Days,
      placement.mortalityFemaleFirst7Days,
      placement.ageDays,
    ),
    projectedMaleMortalityPerDay: resolveProjectedMortalityPerDay(
      placement.mortalityMaleLast7Days,
      placement.mortalityMaleFirst7Days,
      placement.ageDays,
    ),
    breedFemales: placement.breedFemales,
    breedMales: placement.breedMales,
    breedById,
    breedSpecRows,
    liveHaulEvents,
  });
  const typedProjection = splitFeedProjectionByType({
    daily: projection.daily,
    starterRemainingObligationLbs: placement.starterRemainingObligationLbs,
  });
  const windowStarterOnOrderLbs = Math.round(
    Math.max(0, feedOrdersForPlacement?.starterLbs ?? 0) +
      Math.max(0, feedOrdersForBarn?.starterLbs ?? 0) +
      Math.max(0, binSentryOrdersForBarn?.starterLbs ?? 0),
  );
  const windowGrowerOnOrderLbs = Math.round(
    Math.max(0, feedOrdersForPlacement?.growerLbs ?? 0) +
      Math.max(0, feedOrdersForBarn?.growerLbs ?? 0) +
      Math.max(0, binSentryOrdersForBarn?.growerLbs ?? 0),
  );
  const allOpenStarterOnOrderLbs = Math.round(
    Math.max(0, feedOrdersForPlacement?.allOpenStarterLbs ?? 0) +
      Math.max(0, feedOrdersForBarn?.allOpenStarterLbs ?? 0) +
      Math.max(0, binSentryOrdersForBarn?.allOpenStarterLbs ?? 0),
  );
  const windowOnOrderLbs = Math.round(
    Math.max(0, feedOrdersForPlacement?.pounds ?? 0) +
      Math.max(0, feedOrdersForBarn?.pounds ?? 0) +
      Math.max(0, binSentryOrdersForBarn?.pounds ?? 0),
  );
  const supplyLbs =
    projection.total !== null &&
    (placement.feedInventoryOnHandLbs !== null || windowOnOrderLbs !== null)
      ? (placement.feedInventoryOnHandLbs ?? 0) + windowOnOrderLbs
      : null;
  const legacyRecommended =
    projection.total !== null && supplyLbs !== null
      ? Math.max(0, Math.round(projection.total - supplyLbs))
      : null;
  const hasTypedInventoryState =
    placement.feedInventoryStarterAccessibleLbs !== null &&
    placement.feedInventoryGrowerAccessibleLbs !== null;
  const typedOrderCount = (feedOrdersForPlacement?.typedCount ?? 0) + (feedOrdersForBarn?.typedCount ?? 0);
  const untypedOrderCount = (feedOrdersForPlacement?.untypedCount ?? 0) + (feedOrdersForBarn?.untypedCount ?? 0);
  const typedOrderingAvailable =
    hasTypedInventoryState &&
    untypedOrderCount === 0 &&
    (typedOrderCount > 0 ||
      (placement.feedInventoryStarterAccessibleLbs ?? 0) > 0 ||
      (placement.feedInventoryGrowerAccessibleLbs ?? 0) > 0 ||
      typedProjection.starterTotal !== null ||
      typedProjection.growerTotal !== null);
  const starterDeliveredPlusOnOrderLbs = Math.max(
    0,
    Math.round((placement.starterDeliveredLbs ?? 0) + allOpenStarterOnOrderLbs),
  );
  const typedRecommendation = typedOrderingAvailable
    ? calculateTypedFeedRecommendations({
        daily: typedProjection.daily,
        starterAccessibleLbs: placement.feedInventoryStarterAccessibleLbs ?? 0,
        starterOnOrderLbs: windowStarterOnOrderLbs,
        growerAccessibleLbs: placement.feedInventoryGrowerAccessibleLbs ?? 0,
        growerOnOrderLbs: windowGrowerOnOrderLbs,
      })
    : null;
  const starterRecognizedSupplyLbs = Math.max(
    0,
    Math.round(
      Math.max(
        placement.starterDeliveredLbs ?? 0,
        placement.feedInventoryStarterAccessibleLbs ?? 0,
      ),
    ),
  );
  const calculatedStarterRecommendedLbs = Math.max(
    0,
    Math.round(
      (placement.starterTargetLbs ?? 0) -
        starterRecognizedSupplyLbs -
        allOpenStarterOnOrderLbs,
    ),
  );
  const starterRecommendationConvertedToGrowerLbs =
    placement.ageDays !== null &&
    placement.ageDays + FEED_ORDER_LEAD_DAYS > STARTER_FEED_MAX_AGE_DAYS
      ? calculatedStarterRecommendedLbs
      : 0;
  const starterRecommendedLbs =
    starterRecommendationConvertedToGrowerLbs > 0 ? 0 : calculatedStarterRecommendedLbs;
  const growerRecommendedLbs =
    starterRecommendationConvertedToGrowerLbs > 0
      ? (typedRecommendation?.growerRecommendedLbs ?? 0) + starterRecommendationConvertedToGrowerLbs
      : typedRecommendation?.growerRecommendedLbs ?? null;
  const typedRecommendedTotal =
    starterRecommendedLbs !== null && growerRecommendedLbs !== null
      ? starterRecommendedLbs + growerRecommendedLbs
      : null;
  const recommendedOrderLbs = Math.max(
    legacyRecommended ?? 0,
    typedRecommendedTotal ?? 0,
    starterRecommendedLbs,
  );
  const orderingMode =
    typedRecommendedTotal !== null
      ? ("typed" as const)
      : legacyRecommended !== null
        ? ("legacy" as const)
        : ("pending" as const);

  return {
    id: placement.id,
    farmName: placement.farmName,
    barnCode: placement.barnCode,
    placementCode: placement.placementCode,
    ageDays: placement.ageDays,
    statusLabel:
      placement.tileState === "scheduled"
        ? "Scheduled"
        : placement.tileState === "awaiting"
          ? "Awaiting"
          : "In Barn",
    statusTone:
      placement.tileState === "scheduled"
        ? "scheduled"
        : placement.tileState === "awaiting"
          ? "awaiting"
          : "live",
    headCount: placement.headCount,
    starterTotalLbs: placement.starterTargetLbs,
    growerTotalLbs: typedProjection.growerTotal,
    starterTargetLbs: placement.starterTargetLbs,
    starterDeliveredLbs: placement.starterDeliveredLbs,
    starterRecognizedSupplyLbs,
    starterRemainingObligationLbs: placement.starterRemainingObligationLbs,
    starterDeliveredPlusOnOrderLbs,
    starterLbsPerChick: placement.starterLbsPerChick,
    daily: windowDates.map((date) => {
      const match = typedProjection.daily.find((day) => day.date === date);
      return {
        date,
        pounds: match?.totalFeed ?? null,
      };
    }),
    totalLbs: projection.total,
    onHandLbs: placement.feedInventoryOnHandLbs,
    onOrderLbs: windowOnOrderLbs,
    recommendedOrderLbs,
    starterAccessibleLbs: placement.feedInventoryStarterAccessibleLbs,
    growerAccessibleLbs: placement.feedInventoryGrowerAccessibleLbs,
    starterQueuedLbs: placement.feedInventoryStarterQueuedLbs,
    growerQueuedLbs: placement.feedInventoryGrowerQueuedLbs,
    starterOnOrderLbs: allOpenStarterOnOrderLbs,
    growerOnOrderLbs: windowGrowerOnOrderLbs,
    starterRecommendedLbs,
    starterRecommendationConvertedToGrowerLbs,
    growerRecommendedLbs,
    orderingMode,
  };
}

function buildFeedOrderWindowMap(
  rows: FeedOrderCommitmentRow[],
  keyField: "placement_id" | "barn_id",
  windowEnd: string,
) {
  const map = new Map<string, FeedOrderWindowBucket>();

  for (const row of rows) {
    const key = String(row[keyField] ?? "").trim();
    if (!key) continue;

    const expectedDate = String(row.expected_delivery_date ?? "").trim();
    const orderedLbs = Math.max(0, row.ordered_lbs ?? 0);
    const receivedLbs = Math.max(0, row.received_lbs ?? 0);
    const remainingLbs = Math.max(0, orderedLbs - receivedLbs);
    if (remainingLbs <= 0) continue;

    const bucket = map.get(key) ?? {
      pounds: 0,
      starterLbs: 0,
      allOpenStarterLbs: 0,
      growerLbs: 0,
      typedCount: 0,
      untypedCount: 0,
      count: 0,
      nextEta: null,
    };
    const feedType = normalizeFeedType(row.feed_type);
    if (feedType === "starter") bucket.allOpenStarterLbs += remainingLbs;

    if (expectedDate && expectedDate > windowEnd) {
      map.set(key, bucket);
      continue;
    }

    bucket.pounds += remainingLbs;
    if (feedType === "starter") bucket.starterLbs += remainingLbs;
    if (feedType === "grower") bucket.growerLbs += remainingLbs;
    if (feedType) bucket.typedCount += 1;
    if (!feedType) bucket.untypedCount += 1;
    bucket.count += 1;
    if (expectedDate && (!bucket.nextEta || expectedDate < bucket.nextEta)) {
      bucket.nextEta = expectedDate;
    }
    map.set(key, bucket);
  }

  return map;
}

function buildDatabaseOnOrderRows({
  rows,
  placementById,
  placementByBarnId,
  feedBinNumberById,
}: {
  rows: FeedOrderCommitmentRow[];
  placementById: Map<string, ActivePlacementRecord>;
  placementByBarnId: Map<string, ActivePlacementRecord>;
  feedBinNumberById: Map<string, string | null>;
}) {
  const seenIds = new Set<string>();
  const orders: FeedProjectionOnOrderRow[] = [];

  for (const row of rows) {
    const id = normalizeOptionalId(row.commitment_id);
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);

    const orderedLbs = Math.max(0, row.ordered_lbs ?? 0);
    const receivedLbs = Math.max(0, row.received_lbs ?? 0);
    const remainingLbs = Math.max(0, orderedLbs - receivedLbs);
    if (remainingLbs <= 0) continue;

    const placementId = normalizeOptionalId(row.placement_id);
    const barnId = normalizeOptionalId(row.barn_id);
    const feedBinId = normalizeOptionalId(row.feed_bin_id);
    const placement =
      (placementId ? placementById.get(placementId) : null) ??
      (barnId ? placementByBarnId.get(barnId) : null) ??
      null;

    orders.push({
      id: `flocktrax:${id}`,
      source: formatOrderSource(row.source),
      farmName: placement?.farmName ?? "Unknown farm",
      barnCode: placement?.barnCode ?? "Unknown barn",
      binNumber: feedBinId ? feedBinNumberById.get(feedBinId) ?? null : null,
      placementCode: placementId ? placement?.placementCode ?? null : null,
      feedType: normalizeFeedType(row.feed_type),
      feedName: normalizeOptionalText(row.feed_name),
      status: formatOrderStatus(row.status),
      deliveryDate: normalizeOptionalText(row.expected_delivery_date),
      orderedLbs,
      receivedLbs,
      remainingLbs,
      externalOrderRef: normalizeOptionalText(row.external_order_ref),
    });
  }

  return orders;
}

function buildBinSentryOnOrderRows({
  rows,
  placementByBarnId,
}: {
  rows: BinSentryOnOrderRecord[];
  placementByBarnId: Map<string, ActivePlacementRecord>;
}) {
  return rows.map<FeedProjectionOnOrderRow>((row) => {
    const placement = placementByBarnId.get(row.barnId) ?? null;
    return {
      id: row.id,
      source: "BinSentry",
      farmName: placement?.farmName ?? "Unknown farm",
      barnCode: placement?.barnCode ?? "Unknown barn",
      binNumber: row.binNumber,
      placementCode: null,
      feedType: row.feedType,
      feedName: row.feedName,
      status: formatOrderStatus(row.status),
      deliveryDate: row.deliveryDate,
      orderedLbs: row.pounds,
      receivedLbs: 0,
      remainingLbs: row.pounds,
      externalOrderRef: row.externalOrderRef,
    };
  });
}

function compareOnOrderRows(left: FeedProjectionOnOrderRow, right: FeedProjectionOnOrderRow) {
  return (
    (left.deliveryDate ?? "9999-12-31").localeCompare(right.deliveryDate ?? "9999-12-31") ||
    left.farmName.localeCompare(right.farmName) ||
    left.barnCode.localeCompare(right.barnCode) ||
    left.source.localeCompare(right.source)
  );
}

function formatOrderSource(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  if (!normalized || normalized === "manual") return "FlockTrax";
  return `FlockTrax (${formatOrderStatus(normalized)})`;
}

function formatOrderStatus(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return "Open";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchBinSentryScheduledOrdersSafe(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  barnIds: string[],
  windowEnd: string,
) {
  if (barnIds.length === 0) {
    return emptyBinSentryScheduledOrders();
  }

  const mappingResult = await supabase
    .from("feedbins")
    .select("id,barn_id,bin_num,binsentry_bin_ref")
    .in("barn_id", barnIds)
    .not("binsentry_bin_ref", "is", null);

  if (mappingResult.error) {
    return emptyBinSentryScheduledOrders();
  }

  const rows = (mappingResult.data ?? []) as FeedBinMappingRow[];
  const binMappingByHref = new Map<string, { barnId: string; binNumber: string | null }>();
  for (const row of rows) {
    const barnId = normalizeOptionalId(row.barn_id);
    const binRef = normalizeOptionalText(row.binsentry_bin_ref);
    if (!barnId || !binRef) continue;
    const binNumber = normalizeOptionalText(String(row.bin_num ?? ""));
    for (const candidate of [binRef, buildBinSentryEntityUrl(binRef)]) {
      const key = canonicalBinSentryHref(candidate);
      if (key) binMappingByHref.set(key, { barnId, binNumber });
    }
  }

  if (binMappingByHref.size === 0) {
    return emptyBinSentryScheduledOrders();
  }

  try {
    const token = await getBinSentryAccessToken();
    const rootUrl = getBinSentryConfig().rootUrl;
    const root = await fetchBinSentrySirenEntity(rootUrl, token);
    const primaryOrganizationHref = findSirenHref(root, ["/primary-organization", "primary-organization"]);
    if (!primaryOrganizationHref) {
      return emptyBinSentryScheduledOrders();
    }

    const organization = await fetchBinSentrySirenEntity(primaryOrganizationHref, token);
    const searchOrdersHref = findSirenHref(organization, ["/search-orders", "search-orders"]);
    if (!searchOrdersHref) {
      return emptyBinSentryScheduledOrders();
    }

    const searchUrl = new URL(searchOrdersHref);
    searchUrl.searchParams.set("limit", "50");
    searchUrl.searchParams.set("sortOrder", "desc");
    searchUrl.searchParams.delete("state");
    for (const state of PENDING_BINSENTRY_ORDER_STATES) {
      searchUrl.searchParams.append("state", state);
    }

    const bucketByBarnId = new Map<string, FeedOrderWindowBucket>();
    const orders: BinSentryOnOrderRecord[] = [];
    const feedMetaByHref = new Map<string, {
      feedType: string | null;
      feedName: string | null;
      bulkDensityKgPerM3: number | null;
    }>();
    const seenOrders = new Set<string>();
    const seenPageUrls = new Set<string>();
    let nextUrl: string | null = searchUrl.toString();

    while (nextUrl && !seenPageUrls.has(nextUrl)) {
      seenPageUrls.add(nextUrl);
      const searchResults = await fetchBinSentrySirenEntity(nextUrl, token);

      for (const entity of searchResults.entities ?? []) {
        const summaryState = String(entity.properties?.state ?? "").trim().toLowerCase();
        if (summaryState && !PENDING_BINSENTRY_ORDER_STATES.has(summaryState)) continue;

        const detailedOrder =
          findSirenHref(entity as SirenEntity, ["/bin", "bin"]) && findSirenHref(entity as SirenEntity, ["/feed", "feed"])
            ? (entity as SirenEntity)
            : entity.href
              ? await fetchBinSentrySirenEntity(entity.href, token)
              : (entity as SirenEntity);
        const orderProperties = { ...(entity.properties ?? {}), ...(detailedOrder.properties ?? {}) };
        const state = String(orderProperties.state ?? "").trim().toLowerCase();
        if (!PENDING_BINSENTRY_ORDER_STATES.has(state)) continue;

        const orderKey = normalizeOptionalText(entity.href)
          ?? normalizeOptionalText(detailedOrder.href)
          ?? normalizeOptionalText(String(orderProperties.id ?? ""));
        if (orderKey && seenOrders.has(orderKey)) continue;
        if (orderKey) seenOrders.add(orderKey);

        const binHref = findSirenHref(detailedOrder, ["/bin", "bin"]);
        const binMapping = binHref ? binMappingByHref.get(canonicalBinSentryHref(binHref)) ?? null : null;
        if (!binMapping) continue;
        const { barnId, binNumber } = binMapping;

        const quantity = typeof orderProperties.quantity === "number" && Number.isFinite(orderProperties.quantity)
          ? orderProperties.quantity
          : null;
        if (quantity === null || quantity <= 0) continue;

        const deliveryDate = normalizeOptionalText(
          typeof orderProperties.deliveryDate === "string" ? orderProperties.deliveryDate.slice(0, 10) : null,
        );
        const feedHref = findSirenHref(detailedOrder, ["/feed", "feed"]);
        const feedKey = feedHref ? canonicalBinSentryHref(feedHref) : "";
        let feedMeta = feedKey ? feedMetaByHref.get(feedKey) : undefined;

        if (feedHref && feedMeta === undefined) {
          const feedEntity = await fetchBinSentrySirenEntity(feedHref, token);
          const bulkDensityKgPerM3 =
            typeof feedEntity.properties?.bulkDensity === "number" && Number.isFinite(feedEntity.properties.bulkDensity)
              ? feedEntity.properties.bulkDensity
              : null;
          feedMeta = {
            feedType: normalizeBinSentryFeedType(String(feedEntity.properties?.feedType ?? "")),
            feedName: normalizeOptionalText(
              String(feedEntity.properties?.name ?? feedEntity.properties?.feedName ?? ""),
            ),
            bulkDensityKgPerM3,
          };
          if (feedKey) feedMetaByHref.set(feedKey, feedMeta);
        }

        // BinSentry order quantities are volumes; use that order's feed density to convert to pounds.
        const pounds = feedMeta?.bulkDensityKgPerM3
          ? Math.max(0, Math.round(quantity * feedMeta.bulkDensityKgPerM3 * 2.20462))
          : 0;
        if (pounds <= 0) continue;
        const feedType = feedMeta?.feedType ?? null;
        orders.push({
          id: `binsentry:${orderKey ?? `${barnId}:${deliveryDate ?? "undated"}:${orders.length}`}`,
          barnId,
          binNumber,
          status: state,
          deliveryDate,
          feedType,
          feedName: feedMeta?.feedName ?? null,
          externalOrderRef: normalizeOptionalText(
            String(orderProperties.orderNumber ?? orderProperties.reference ?? orderProperties.id ?? ""),
          ),
          pounds,
        });

        const bucket = bucketByBarnId.get(barnId) ?? {
          pounds: 0,
          starterLbs: 0,
          allOpenStarterLbs: 0,
          growerLbs: 0,
          typedCount: 0,
          untypedCount: 0,
          count: 0,
          nextEta: null,
        };
        if (feedType === "starter") bucket.allOpenStarterLbs += pounds;

        if (deliveryDate && deliveryDate > windowEnd) {
          bucketByBarnId.set(barnId, bucket);
          continue;
        }

        bucket.pounds += pounds;
        if (feedType === "starter") bucket.starterLbs += pounds;
        if (feedType === "grower") bucket.growerLbs += pounds;
        if (feedType) bucket.typedCount += 1;
        if (!feedType) bucket.untypedCount += 1;
        bucket.count += 1;
        if (deliveryDate && (!bucket.nextEta || deliveryDate < bucket.nextEta)) {
          bucket.nextEta = deliveryDate;
        }
        bucketByBarnId.set(barnId, bucket);
      }

      nextUrl = findSirenHref(searchResults, ["next"]);
    }

    return { byBarnId: bucketByBarnId, orders };
  } catch (caught) {
    console.error(
      "Feed projection BinSentry scheduled-order lookup failed.",
      caught instanceof Error ? caught.message : caught,
    );
    return emptyBinSentryScheduledOrders();
  }
}

function emptyBinSentryScheduledOrders() {
  return {
    byBarnId: new Map<string, FeedOrderWindowBucket>(),
    orders: [] as BinSentryOnOrderRecord[],
  };
}

async function fetchBinSentrySirenEntity(url: string, token: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.siren+json, application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BinSentry request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as SirenEntity;
}

function findSirenHref(entity: SirenEntity, needles: string[]) {
  const normalize = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();
  const matches = (values: string[] | undefined) =>
    (values ?? []).some((value) => {
      const normalized = normalize(value);
      return needles.some((needle) => {
        const normalizedNeedle = needle.toLowerCase();
        return normalized === normalizedNeedle || (normalizedNeedle.includes("/") && normalized.endsWith(normalizedNeedle));
      });
    });

  const linkHref = (entity.links ?? []).find((link) => matches(link.rel) && normalizeOptionalText(link.href))?.href;
  if (linkHref) {
    return linkHref;
  }

  return (entity.entities ?? []).find((child) => matches(child.rel) && normalizeOptionalText(child.href))?.href ?? null;
}

function canonicalBinSentryHref(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized, getBinSentryConfig().rootUrl);
    url.hash = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return normalized.replace(/\/+$/, "").toLowerCase();
  }
}

function normalizeBinSentryFeedType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.includes("starter")) return "starter";
  if (normalized.includes("grower")) return "grower";
  return null;
}

function compareReportRows(left: FeedProjectionReportRow, right: FeedProjectionReportRow) {
  const farmCompare = left.farmName.localeCompare(right.farmName);
  if (farmCompare !== 0) return farmCompare;
  const barnCompare = left.barnCode.localeCompare(right.barnCode, undefined, { numeric: true });
  if (barnCompare !== 0) return barnCompare;
  return left.placementCode.localeCompare(right.placementCode, undefined, { numeric: true });
}

function clampWindowDays(value: number) {
  if (!Number.isFinite(value)) return 10;
  return Math.min(45, Math.max(1, Math.round(value)));
}

function placementBelongsInProjectionWindow({
  placement,
  windowStart,
  windowEnd,
  includeScheduled,
  includeInventoryOnly,
}: {
  placement: ActivePlacementRecord;
  windowStart: string;
  windowEnd: string;
  includeScheduled: boolean;
  includeInventoryOnly: boolean;
}) {
  if (placement.lifecycleStage === "scheduled") {
    const placedDate = normalizeOptionalText(placement.placedDate);
    return includeScheduled && placedDate !== null && placedDate >= windowStart && placedDate <= windowEnd;
  }

  if (placement.tileState === "empty" || !normalizeOptionalId(placement.placementId)) {
    return includeInventoryOnly;
  }

  const placedDate = normalizeOptionalText(placement.placedDate);
  const removedDate = normalizeOptionalText(placement.dateRemoved);
  const projectedEndDate = normalizeOptionalText(placement.projectedEndDate);
  const activeEnd = removedDate ?? projectedEndDate;

  if (placedDate && placedDate > windowEnd) {
    return false;
  }

  if (activeEnd && activeEnd < windowStart) {
    return false;
  }

  return placement.lifecycleStage === "awaiting_arrival" || placement.lifecycleStage === "in_barn_growing";
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalId(value: string | null | undefined) {
  return normalizeOptionalText(value);
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return isoDate(value);
}

function normalizeBreedText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeFeedType(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "starter" || normalized === "grower" ? normalized : null;
}

function normalizeBreedSex(value: string | null | undefined) {
  const normalized = normalizeBreedText(value);
  if (normalized.startsWith("m")) return "male";
  if (normalized.startsWith("f")) return "female";
  return normalized || null;
}

function resolveBreedDayFeedPerBird(
  breedId: string | null,
  ageDays: number | null,
  breedById: Map<string, BreedRow>,
  breedSpecRows: BreedSpecRow[],
) {
  if (!breedId || ageDays === null) return null;
  const breed = breedById.get(breedId);
  if (!breed) return null;
  const breedName = normalizeBreedText(breed.breed_name);
  const sex = normalizeBreedSex(breed.sex);
  if (!breedName) return null;

  const exactMatch = breedSpecRows.find((row) => {
    return (
      row.age === ageDays &&
      normalizeBreedText(row.geneticname) === breedName &&
      (!sex || normalizeBreedSex(row.breedid) === sex)
    );
  });
  const exactMetric = exactMatch?.dayfeedperbird;
  if (typeof exactMetric === "number" && Number.isFinite(exactMetric)) {
    return exactMetric;
  }

  const fallbackMatch = breedSpecRows.find((row) => {
    return row.age === ageDays && normalizeBreedText(row.geneticname) === breedName;
  });
  const fallbackMetric = fallbackMatch?.dayfeedperbird;
  return typeof fallbackMetric === "number" && Number.isFinite(fallbackMetric) ? fallbackMetric : null;
}

function resolveProjectedMortalityPerDay(last7Days: number, first7Days: number, ageDays: number) {
  if (last7Days > 0) return last7Days / 7;
  if (first7Days > 0) return first7Days / Math.min(7, Math.max(ageDays, 1));
  return 0;
}

function applyLiveHaulReduction(options: {
  femalePopulation: number;
  malePopulation: number;
  femaleRemoval: number;
  maleRemoval: number;
}) {
  return {
    femalePopulation: Math.max(0, options.femalePopulation - options.femaleRemoval),
    malePopulation: Math.max(0, options.malePopulation - options.maleRemoval),
  };
}

function buildFeedProjection({
  today,
  windowDays,
  ageDays,
  currentFemaleCount,
  currentMaleCount,
  projectedFemaleMortalityPerDay,
  projectedMaleMortalityPerDay,
  breedFemales,
  breedMales,
  breedById,
  breedSpecRows,
  liveHaulEvents,
}: {
  today: string;
  windowDays: number;
  ageDays: number;
  currentFemaleCount: number;
  currentMaleCount: number;
  projectedFemaleMortalityPerDay: number;
  projectedMaleMortalityPerDay: number;
  breedFemales: string | null;
  breedMales: string | null;
  breedById: Map<string, BreedRow>;
  breedSpecRows: BreedSpecRow[];
  liveHaulEvents: FeedProjectionLiveHaulEvent[];
}) {
  const scheduledLiveHaulEvents = liveHaulEvents
    .filter((value) => Boolean(value.date))
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date));
  const scheduledLiveHaulDates = scheduledLiveHaulEvents.map((event) => event.date);
  const liveHaulEventByDate = new Map(scheduledLiveHaulEvents.map((event) => [event.date, event]));
  const liveHaulIndexByDate = new Map(scheduledLiveHaulDates.map((date, index) => [date, index]));

  let femalePopulation = currentFemaleCount;
  let malePopulation = currentMaleCount;
  let firstLiveHaulFemaleRemoval: number | null = null;
  let firstLiveHaulMaleRemoval: number | null = null;
  const daily: Array<{
    date: string;
    ageDays: number;
    totalBirds: number;
    totalFeed: number | null;
    liveHaulFraction: number | null;
    liveHaulLabel: string | null;
  }> = [];

  for (const [liveHaulIndex, liveHaulEvent] of scheduledLiveHaulEvents.entries()) {
    if (liveHaulEvent.date > today) break;
    const isFinalLiveHaul = liveHaulIndex === scheduledLiveHaulDates.length - 1;
    const explicitHeadRemoval = liveHaulEvent.targetHead ?? liveHaulEvent.actualHead ?? null;

    if (explicitHeadRemoval !== null) {
      const totalPopulation = femalePopulation + malePopulation;
      const boundedRemoval = Math.min(totalPopulation, Math.max(0, explicitHeadRemoval));
      const femaleShare = totalPopulation > 0 ? femalePopulation / totalPopulation : 0.5;
      const maleShare = totalPopulation > 0 ? malePopulation / totalPopulation : 0.5;
      const femaleRemoval = boundedRemoval * femaleShare;
      const maleRemoval = boundedRemoval * maleShare;
      if (firstLiveHaulFemaleRemoval === null && firstLiveHaulMaleRemoval === null) {
        firstLiveHaulFemaleRemoval = femaleRemoval;
        firstLiveHaulMaleRemoval = maleRemoval;
      }
      const reducedPopulation = applyLiveHaulReduction({
        femalePopulation,
        malePopulation,
        femaleRemoval,
        maleRemoval,
      });
      femalePopulation = reducedPopulation.femalePopulation;
      malePopulation = reducedPopulation.malePopulation;
    } else if (isFinalLiveHaul) {
      femalePopulation = 0;
      malePopulation = 0;
    } else if (liveHaulIndex === 0) {
      firstLiveHaulFemaleRemoval = femalePopulation / 3;
      firstLiveHaulMaleRemoval = malePopulation / 3;
      const reducedPopulation = applyLiveHaulReduction({
        femalePopulation,
        malePopulation,
        femaleRemoval: firstLiveHaulFemaleRemoval,
        maleRemoval: firstLiveHaulMaleRemoval,
      });
      femalePopulation = reducedPopulation.femalePopulation;
      malePopulation = reducedPopulation.malePopulation;
    } else {
      const reducedPopulation = applyLiveHaulReduction({
        femalePopulation,
        malePopulation,
        femaleRemoval: Math.min(femalePopulation, firstLiveHaulFemaleRemoval ?? 0),
        maleRemoval: Math.min(malePopulation, firstLiveHaulMaleRemoval ?? 0),
      });
      femalePopulation = reducedPopulation.femalePopulation;
      malePopulation = reducedPopulation.malePopulation;
    }
  }

  for (let dayOffset = 1; dayOffset <= windowDays; dayOffset += 1) {
    const date = addDays(today, dayOffset);
    const projectedAgeDays = ageDays + dayOffset;
    if (projectedAgeDays > 0) {
      femalePopulation = Math.max(0, femalePopulation - projectedFemaleMortalityPerDay);
      malePopulation = Math.max(0, malePopulation - projectedMaleMortalityPerDay);
    }
    const femaleFeedPerBird = resolveBreedDayFeedPerBird(breedFemales, projectedAgeDays, breedById, breedSpecRows);
    const maleFeedPerBird = resolveBreedDayFeedPerBird(breedMales, projectedAgeDays, breedById, breedSpecRows);
    let totalFeed =
      femaleFeedPerBird === null && maleFeedPerBird === null
        ? null
        : (femaleFeedPerBird ?? 0) * femalePopulation + (maleFeedPerBird ?? 0) * malePopulation;
    const liveHaulIndex = liveHaulIndexByDate.get(date);
    const appliesLiveHaul = liveHaulIndex !== undefined;
    const isFinalLiveHaul = appliesLiveHaul && liveHaulIndex === scheduledLiveHaulDates.length - 1;
    const liveHaulEvent = liveHaulEventByDate.get(date) ?? null;
    const explicitHeadRemoval = liveHaulEvent?.targetHead ?? liveHaulEvent?.actualHead ?? null;

    daily.push({
      date,
      ageDays: projectedAgeDays,
      totalBirds: Math.round(femalePopulation + malePopulation),
      totalFeed,
      liveHaulFraction: null,
      liveHaulLabel: null,
    });

    if (appliesLiveHaul) {
      if (explicitHeadRemoval !== null) {
        const totalPopulation = femalePopulation + malePopulation;
        const boundedRemoval = Math.min(totalPopulation, Math.max(0, explicitHeadRemoval));
        const femaleShare = totalPopulation > 0 ? femalePopulation / totalPopulation : 0.5;
        const maleShare = totalPopulation > 0 ? malePopulation / totalPopulation : 0.5;
        const femaleRemoval = boundedRemoval * femaleShare;
        const maleRemoval = boundedRemoval * maleShare;

        if (firstLiveHaulFemaleRemoval === null && firstLiveHaulMaleRemoval === null) {
          firstLiveHaulFemaleRemoval = femaleRemoval;
          firstLiveHaulMaleRemoval = maleRemoval;
        }

        const reducedPopulation = applyLiveHaulReduction({
          femalePopulation,
          malePopulation,
          femaleRemoval,
          maleRemoval,
        });
        femalePopulation = reducedPopulation.femalePopulation;
        malePopulation = reducedPopulation.malePopulation;
      } else if (isFinalLiveHaul) {
        femalePopulation = 0;
        malePopulation = 0;
      } else if (liveHaulIndex === 0) {
        firstLiveHaulFemaleRemoval = femalePopulation / 3;
        firstLiveHaulMaleRemoval = malePopulation / 3;
        const reducedPopulation = applyLiveHaulReduction({
          femalePopulation,
          malePopulation,
          femaleRemoval: firstLiveHaulFemaleRemoval,
          maleRemoval: firstLiveHaulMaleRemoval,
        });
        femalePopulation = reducedPopulation.femalePopulation;
        malePopulation = reducedPopulation.malePopulation;
      } else {
        const reducedPopulation = applyLiveHaulReduction({
          femalePopulation,
          malePopulation,
          femaleRemoval: Math.min(femalePopulation, firstLiveHaulFemaleRemoval ?? 0),
          maleRemoval: Math.min(malePopulation, firstLiveHaulMaleRemoval ?? 0),
        });
        femalePopulation = reducedPopulation.femalePopulation;
        malePopulation = reducedPopulation.malePopulation;
      }
    }
  }

  const feedValues = daily
    .map((entry) => entry.totalFeed)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const total = feedValues.length > 0 ? feedValues.reduce((sum, value) => sum + value, 0) : null;

  return { total, daily };
}

function splitFeedProjectionByType({
  daily,
  starterRemainingObligationLbs,
}: {
  daily: Array<{
    date: string;
    ageDays: number;
    totalBirds: number;
    totalFeed: number | null;
    liveHaulFraction: number | null;
    liveHaulLabel: string | null;
  }>;
  starterRemainingObligationLbs: number;
}) {
  let remainingStarter = Math.max(0, starterRemainingObligationLbs);
  let starterTotal = 0;
  let growerTotal = 0;

  const typedDaily = daily.map((entry) => {
    if (entry.totalFeed === null || !Number.isFinite(entry.totalFeed)) {
      return { ...entry, starterFeed: null, growerFeed: null };
    }
    const starterFeed = Math.min(entry.totalFeed, remainingStarter);
    const growerFeed = Math.max(0, entry.totalFeed - starterFeed);
    remainingStarter = Math.max(0, remainingStarter - starterFeed);
    starterTotal += starterFeed;
    growerTotal += growerFeed;
    return { ...entry, starterFeed, growerFeed };
  });

  return {
    daily: typedDaily,
    starterTotal: typedDaily.some((entry) => entry.starterFeed !== null) ? starterTotal : null,
    growerTotal: typedDaily.some((entry) => entry.growerFeed !== null) ? growerTotal : null,
  };
}

function calculateTypedFeedRecommendations({
  daily,
  starterAccessibleLbs,
  starterOnOrderLbs,
  growerAccessibleLbs,
  growerOnOrderLbs,
}: {
  daily: Array<{
    starterFeed: number | null;
    growerFeed: number | null;
  }>;
  starterAccessibleLbs: number;
  starterOnOrderLbs: number;
  growerAccessibleLbs: number;
  growerOnOrderLbs: number;
}) {
  let remainingStarterSupply = Math.max(0, starterAccessibleLbs) + Math.max(0, starterOnOrderLbs);
  let remainingGrowerSupply = Math.max(0, growerAccessibleLbs) + Math.max(0, growerOnOrderLbs);
  let starterRecommendedLbs = 0;
  let growerRecommendedLbs = 0;

  for (const entry of daily) {
    const starterDemand = entry.starterFeed !== null && Number.isFinite(entry.starterFeed) ? Math.max(0, entry.starterFeed) : 0;
    const growerDemand = entry.growerFeed !== null && Number.isFinite(entry.growerFeed) ? Math.max(0, entry.growerFeed) : 0;

    const starterSupplyUsedForStarter = Math.min(starterDemand, remainingStarterSupply);
    remainingStarterSupply = Math.max(0, remainingStarterSupply - starterSupplyUsedForStarter);
    starterRecommendedLbs += Math.max(0, starterDemand - starterSupplyUsedForStarter);

    const starterSupplyUsedForGrower = Math.min(growerDemand, remainingStarterSupply);
    remainingStarterSupply = Math.max(0, remainingStarterSupply - starterSupplyUsedForGrower);

    let remainingGrowerDemand = Math.max(0, growerDemand - starterSupplyUsedForGrower);
    const growerSupplyUsed = Math.min(remainingGrowerDemand, remainingGrowerSupply);
    remainingGrowerSupply = Math.max(0, remainingGrowerSupply - growerSupplyUsed);
    remainingGrowerDemand = Math.max(0, remainingGrowerDemand - growerSupplyUsed);
    growerRecommendedLbs += remainingGrowerDemand;
  }

  return {
    starterRecommendedLbs: Math.round(starterRecommendedLbs),
    growerRecommendedLbs: Math.round(growerRecommendedLbs),
  };
}
