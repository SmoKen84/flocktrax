import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { buildBinSentryEntityUrl, fetchBinSentryEntity, normalizeBinSentryValue } from "@/lib/binsentry-http";

type BinSentryFeedBinMapping = {
  id: string;
  farm_id: string | null;
  barn_id: string | null;
  bin_num: number | null;
  binsentry_bin_ref: string | null;
};

type BinSentryInventorySnapshotWrite = {
  farmId: string | null;
  barnId: string;
  feedBinId: string;
  feedName: string | null;
  inventoryLbs: number;
  capturedAt: string;
  rawPayload: unknown;
};

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: Array<{ rel?: string[]; href?: string }>;
  entities?: Array<{ rel?: string[]; href?: string }>;
};

function normalize(value: string | null | undefined) {
  return normalizeBinSentryValue(value);
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

function extractInventorySnapshot(
  payload: SirenEntity | Record<string, unknown>,
  mapping: BinSentryFeedBinMapping,
): BinSentryInventorySnapshotWrite | null {
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

  return {
    farmId: mapping.farm_id,
    barnId: mapping.barn_id,
    feedBinId: mapping.id,
    feedName,
    inventoryLbs: Math.max(0, inventoryLbs),
    capturedAt,
    rawPayload: payload,
  };
}

export async function syncBinSentryInventoryForBarn(barnId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false as const, message: "Supabase admin access is not configured." };
  }

  const { data, error } = await admin
    .from("feedbins")
    .select("id,farm_id,barn_id,bin_num,binsentry_bin_ref")
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
      const snapshot = extractInventorySnapshot(payload, mapping);
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
        .update({
          binsentry_last_sync_at: snapshot.capturedAt,
          binsentry_last_inventory_lbs: snapshot.inventoryLbs,
          binsentry_sync_note: `Inventory synced from BinSentry (${Math.round(snapshot.inventoryLbs).toLocaleString()} lbs).`,
        })
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
