import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { buildBinSentryEntityUrl, fetchBinSentryEntity, normalizeBinSentryValue } from "@/lib/binsentry-http";

type BinSentryFeedBinMapping = {
  id: string;
  farm_id: string | null;
  barn_id: string | null;
  bin_num: number | null;
  binsentry_bin_ref: string | null;
  accessible_feed_type?: string | null;
  accessible_feed_lbs?: number | null;
  queued_feed_type?: string | null;
  queued_feed_lbs?: number | null;
  feed_state_effective_at?: string | null;
  feed_state_source?: string | null;
};

type BinSentryInventorySnapshotWrite = {
  farmId: string | null;
  barnId: string;
  feedBinId: string;
  feedName: string | null;
  inventoryLbs: number;
  capturedAt: string;
  rawPayload: unknown;
  accessibleFeedType: string | null;
  queuedFeedType: string | null;
};

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: Array<{ rel?: string[]; href?: string }>;
  entities?: Array<{ rel?: string[]; href?: string; properties?: Record<string, unknown>; entities?: Array<{ rel?: string[]; href?: string }> }>;
};

function normalize(value: string | null | undefined) {
  return normalizeBinSentryValue(value);
}

function normalizeFeedType(value: string | null | undefined) {
  const normalized = normalize(value).toLowerCase();
  if (normalized === "starter" || normalized === "grower") {
    return normalized;
  }

  if (normalized.includes("starter")) {
    return "starter";
  }

  if (normalized.includes("grower")) {
    return "grower";
  }

  return null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = coerceNumber(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function pickFirstNumberEntry(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = coerceNumber(source[key]);
    if (value !== null) {
      return { key, value };
    }
  }

  return null;
}

function pickFirstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function relMatches(relValues: string[] | undefined, needles: string[]) {
  return (relValues ?? []).some((relValue) => {
    const normalized = normalize(relValue).toLowerCase();
    return needles.some((needle) => {
      const normalizedNeedle = needle.toLowerCase();
      if (normalized === normalizedNeedle) {
        return true;
      }

      return normalizedNeedle.includes("/") ? normalized.endsWith(normalizedNeedle) : false;
    });
  });
}

function findHrefByRel(entity: SirenEntity, needles: string[]) {
  const linkHref = (entity.links ?? []).find((link) => relMatches(link.rel, needles) && normalize(link.href))?.href;
  if (linkHref) {
    return linkHref;
  }

  return (entity.entities ?? []).find((child) => relMatches(child.rel, needles) && normalize(child.href))?.href ?? null;
}

async function fetchBestInventoryPayload(entityUrl: string) {
  const binPayload = (await fetchBinSentryEntity(entityUrl)) as SirenEntity | Record<string, unknown>;
  if (!("entities" in binPayload) && !("links" in binPayload)) {
    return binPayload;
  }

  const sirenPayload = binPayload as SirenEntity;
  const latestLevelUrl =
    findHrefByRel(sirenPayload, ["/bin-level-latest-valid", "bin-level-latest-valid"]) ??
    findHrefByRel(sirenPayload, ["/bin-level-latest", "bin-level-latest"]);

  if (!latestLevelUrl) {
    return binPayload;
  }

  return await fetchBinSentryEntity(latestLevelUrl);
}

async function fetchCurrentFeedTypeFromOrderHistory(entityUrl: string) {
  const binPayload = (await fetchBinSentryEntity(entityUrl)) as SirenEntity;
  const ordersUrl = findHrefByRel(binPayload, ["/v2/orders", "v2/orders", "/orders", "orders"]);
  if (!ordersUrl) {
    return null;
  }

  const collectionUrl = new URL(ordersUrl);
  collectionUrl.searchParams.set("limit", "10");
  const ordersPayload = (await fetchBinSentryEntity(collectionUrl.toString())) as SirenEntity;
  const candidates = (ordersPayload.entities ?? [])
    .map((entity) => {
      const properties = entity.properties ?? {};
      const state = normalize(properties.state as string | null | undefined).toLowerCase();
      const feedHref = findHrefByRel(entity as SirenEntity, ["/feed", "feed"]);
      const deliveryDate = normalize(properties.deliveryDate as string | null | undefined);
      const updatedAt = normalize(properties.updatedAt as string | null | undefined);

      return {
        state,
        feedHref,
        sortValue: deliveryDate || updatedAt,
      };
    })
    .filter((entry) => entry.feedHref && (entry.state === "delivered" || entry.state === "closed"))
    .sort((left, right) => right.sortValue.localeCompare(left.sortValue));

  for (const candidate of candidates) {
    const feedPayload = (await fetchBinSentryEntity(candidate.feedHref!)) as SirenEntity;
    const feedType = normalizeFeedType(feedPayload.properties?.feedType as string | null | undefined);
    if (feedType) {
      return feedType;
    }
  }

  return null;
}

async function extractInventorySnapshot(
  payload: SirenEntity | Record<string, unknown>,
  mapping: BinSentryFeedBinMapping,
  entityUrl: string,
): Promise<BinSentryInventorySnapshotWrite | null> {
  const properties =
    "properties" in payload && payload.properties && typeof payload.properties === "object"
      ? (payload.properties as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  const poundsEntry = pickFirstNumberEntry(properties, [
      "inventory_lbs",
      "inventoryLbs",
      "current_inventory_lbs",
      "currentInventoryLbs",
      "pounds_on_hand",
      "poundsOnHand",
      "estimated_weight_lbs",
      "estimatedWeightLbs",
      "weight_lbs",
      "weightLbs",
    ]);
  const kilogramEntry = pickFirstNumberEntry(properties, ["estimatedWeight", "weight"]);
  const tonsEntry = pickFirstNumber(properties, ["inventory_tons", "inventoryTons", "current_inventory_tons", "currentInventoryTons"]);

  const inventoryLbs =
    poundsEntry?.value ??
    (kilogramEntry ? kilogramEntry.value * 2.20462 : null) ??
    (tonsEntry !== null ? tonsEntry * 2000 : null);

  if (inventoryLbs === null || !mapping.barn_id) {
    return null;
  }

  const capturedAt =
    pickFirstString(properties, [
      "captured_at",
      "capturedAt",
      "last_reading_at",
      "lastReadingAt",
      "measured_at",
      "measuredAt",
      "updated_at",
      "updatedAt",
    ]) ?? new Date().toISOString();

  const feedName = pickFirstString(properties, ["feed_name", "feedName", "ration_name", "rationName", "product_name", "productName"]);
  const currentOrderFeedType = await fetchCurrentFeedTypeFromOrderHistory(entityUrl);
  const accessibleFeedType =
    currentOrderFeedType ?? normalizeFeedType(mapping.accessible_feed_type) ?? normalizeFeedType(feedName);

  return {
    farmId: mapping.farm_id,
    barnId: mapping.barn_id,
    feedBinId: mapping.id,
    feedName,
    inventoryLbs: Math.max(0, inventoryLbs),
    capturedAt,
    rawPayload: payload,
    accessibleFeedType,
    queuedFeedType: normalizeFeedType(mapping.queued_feed_type),
  };
}

function buildFeedBinSyncUpdate(snapshot: BinSentryInventorySnapshotWrite, mapping: BinSentryFeedBinMapping) {
  const accessibleFeedType = snapshot.accessibleFeedType;
  const queuedFeedType = normalizeFeedType(mapping.queued_feed_type);
  const hasQueuedLayer =
    queuedFeedType !== null ||
    (typeof mapping.queued_feed_lbs === "number" && Number.isFinite(mapping.queued_feed_lbs) && mapping.queued_feed_lbs > 0);
  const feedStateSource =
    accessibleFeedType && !hasQueuedLayer
      ? normalize(mapping.accessible_feed_type)
        ? normalize(mapping.feed_state_source) || "binsentry_sync"
        : "binsentry_feed_name"
      : mapping.feed_state_source ?? null;

  return {
    binsentry_last_sync_at: snapshot.capturedAt,
    binsentry_last_inventory_lbs: snapshot.inventoryLbs,
    binsentry_sync_note: `Inventory synced from BinSentry (${Math.round(snapshot.inventoryLbs).toLocaleString()} lbs).`,
    accessible_feed_type: accessibleFeedType ?? mapping.accessible_feed_type ?? null,
    accessible_feed_lbs: accessibleFeedType && !hasQueuedLayer ? snapshot.inventoryLbs : mapping.accessible_feed_lbs ?? null,
    feed_state_effective_at: accessibleFeedType && !hasQueuedLayer ? snapshot.capturedAt : mapping.feed_state_effective_at ?? null,
    feed_state_source: feedStateSource,
  };
}

export async function syncBinSentryInventoryForBarn(barnId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false as const, message: "Supabase admin access is not configured." };
  }

  const { data, error } = await admin
    .from("feedbins")
    .select(
      "id,farm_id,barn_id,bin_num,binsentry_bin_ref,accessible_feed_type,accessible_feed_lbs,queued_feed_type,queued_feed_lbs,feed_state_effective_at,feed_state_source",
    )
    .eq("barn_id", barnId)
    .order("bin_num", { ascending: true });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  const mappings = ((data ?? []) as BinSentryFeedBinMapping[]).filter((row) => normalize(row.binsentry_bin_ref));
  if (mappings.length === 0) {
    return { ok: false as const, message: "No BinSentry bin mappings are saved for this barn yet." };
  }

  const snapshots: BinSentryInventorySnapshotWrite[] = [];
  const syncErrors: string[] = [];

  for (const mapping of mappings) {
    const binRef = normalize(mapping.binsentry_bin_ref);
    const entityUrl = buildBinSentryEntityUrl(binRef);

    try {
      const payload = await fetchBestInventoryPayload(entityUrl);
      const snapshot = await extractInventorySnapshot(payload, mapping, entityUrl);
      if (!snapshot) {
        syncErrors.push(`Bin ${mapping.bin_num ?? "?"}: inventory pounds were not found in the BinSentry payload.`);
        await admin
          .from("feedbins")
          .update({
            binsentry_last_sync_at: new Date().toISOString(),
            binsentry_sync_note: "Latest BinSentry payload did not expose an inventory pounds value.",
          })
          .eq("id", mapping.id);
        continue;
      }

      snapshots.push(snapshot);
      await admin
        .from("feedbins")
        .update(buildFeedBinSyncUpdate(snapshot, mapping))
        .eq("id", mapping.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BinSentry request failed.";
      syncErrors.push(`Bin ${mapping.bin_num ?? "?"}: ${message}`);
      await admin
        .from("feedbins")
        .update({
          binsentry_last_sync_at: new Date().toISOString(),
          binsentry_sync_note: message,
        })
        .eq("id", mapping.id);
    }
  }

  if (snapshots.length > 0) {
    const insertResult = await admin.from("feed_inventory_snapshots").insert(
      snapshots.map((snapshot) => ({
        farm_id: snapshot.farmId,
        barn_id: snapshot.barnId,
        feed_bin_id: snapshot.feedBinId,
        source: "binsentry",
        captured_at: snapshot.capturedAt,
        inventory_lbs: snapshot.inventoryLbs,
        accessible_feed_type: snapshot.accessibleFeedType,
        queued_feed_type: snapshot.queuedFeedType,
        feed_name: snapshot.feedName,
        raw_payload: snapshot.rawPayload,
      })),
    );

    if (insertResult.error) {
      return { ok: false as const, message: insertResult.error.message };
    }
  }

  if (snapshots.length === 0) {
    return {
      ok: false as const,
      message: syncErrors[0] ?? "No BinSentry inventory snapshots were written.",
    };
  }

  return {
    ok: true as const,
    message:
      syncErrors.length > 0
        ? `Synced ${snapshots.length} mapped bin${snapshots.length === 1 ? "" : "s"} with ${syncErrors.length} warning${syncErrors.length === 1 ? "" : "s"}.`
        : `Synced ${snapshots.length} mapped bin${snapshots.length === 1 ? "" : "s"} from BinSentry.`,
  };
}
