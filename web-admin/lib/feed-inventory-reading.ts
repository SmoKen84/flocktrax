type InventoryReading = {
  inventory_lbs: number | null;
  accessible_feed_type?: string | null;
};

type BinReading = {
  binsentry_last_inventory_lbs: number | null;
  accessible_feed_lbs?: number | null;
  accessible_feed_type?: string | null;
};

// Keep the typed breakdown on the same reading as the reported on-hand total.
// A zero reading is authoritative, and must not resurrect an old bin quantity.
export function resolveFeedInventoryReading(snapshot: InventoryReading | undefined, bin: BinReading) {
  const pounds = snapshot
    ? snapshot.inventory_lbs
    : bin.binsentry_last_inventory_lbs ?? bin.accessible_feed_lbs;
  return {
    pounds: typeof pounds === "number" && Number.isFinite(pounds) ? Math.max(0, pounds) : 0,
    feedType: snapshot?.accessible_feed_type ?? bin.accessible_feed_type ?? null,
  };
}
