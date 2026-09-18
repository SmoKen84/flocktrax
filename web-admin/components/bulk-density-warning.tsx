import Link from "next/link";
import { MIXED_FEED_DENSITY_WARNING, mixedDensityFeedTypes } from "@/lib/bulk-density-validation";

export function BulkDensityWarning({ rows }: { rows: Parameters<typeof mixedDensityFeedTypes>[0] }) {
  if (mixedDensityFeedTypes(rows).size === 0) return null;
  return <div className="feed-inventory-warning" role="status">
    <Link href="/admin/reports/bulk-density-verification">{MIXED_FEED_DENSITY_WARNING}</Link>
  </div>;
}
