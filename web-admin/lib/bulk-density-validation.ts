export const MIXED_FEED_DENSITY_WARNING = "MIXED FEED DENSITIES FOUND, run Bulk Density Verification Report for more info";

type DensityRow = { feedBinId: string; feedType: string | null; bulkDensityLbPerFt3: number | null };

export function mixedDensityFeedTypes(rows: DensityRow[]): Set<string> {
  const groups = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const feed = row.feedType?.trim().toUpperCase();
    const density = row.bulkDensityLbPerFt3;
    if (!feed || ["UNKNOWN", "UNSPECIFIED", "--", "MIXED"].includes(feed) ||
        density === null || !Number.isFinite(density) || density <= 0) continue;
    const bins = groups.get(feed) ?? new Map<string, number>();
    bins.set(row.feedBinId, density);
    groups.set(feed, bins);
  }
  // Compare at the report's displayed precision to ignore conversion noise.
  return new Set([...groups].filter(([, bins]) =>
    bins.size > 1 && new Set([...bins.values()].map(value => value.toFixed(2))).size > 1
  ).map(([feed]) => feed));
}
