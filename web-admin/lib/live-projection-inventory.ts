import type { FeedInventoryReportRow } from "@/lib/feed-inventory-report-data";

export const MAX_PROJECTION_READING_AGE_HOURS = 24;

export function summarizeLiveProjectionInventory(rows: FeedInventoryReportRow[], now: number, simulated = false) {
  const problems: string[] = [];
  if (!rows.length) problems.push("No feed bins are configured.");
  let starter = 0;
  let grower = 0;
  for (const row of rows) {
    const time = row.capturedAt ? Date.parse(row.capturedAt) : NaN;
    const label = `Bin ${row.binNumber}`;
    if (row.status !== "current" || row.onHandLbs === null || !Number.isFinite(row.onHandLbs)) {
      problems.push(`${label}: current inventory unavailable.`);
      continue;
    }
    if (!simulated && (!Number.isFinite(time) || time > now + 5 * 60_000 || now - time > MAX_PROJECTION_READING_AGE_HOURS * 3_600_000)) {
      problems.push(`${label}: measurement time missing, invalid, or older than ${MAX_PROJECTION_READING_AGE_HOURS} hours.`);
      continue;
    }
    const type = row.feedType.toLowerCase();
    if (row.onHandLbs > 0 && type !== "starter" && type !== "grower") {
      problems.push(`${label}: feed type is unknown.`);
      continue;
    }
    if (type === "starter") starter += Math.max(0, row.onHandLbs);
    if (type === "grower") grower += Math.max(0, row.onHandLbs);
  }
  const available = problems.length === 0;
  return {
    available, problems,
    starter: available ? Math.round(starter) : null,
    grower: available ? Math.round(grower) : null,
    total: available ? Math.round(starter) + Math.round(grower) : null,
  };
}

// An on-hand-only warning: scheduled deliveries are deliberately not counted.
export function firstOnHandShortfall(daily: Array<{ date: string; pounds: number | null }>, onHand: number | null | undefined) {
  if (onHand == null) return null;
  let remaining = onHand;
  for (const [index, day] of daily.entries()) {
    if (day.pounds === null) return null;
    if (day.pounds > remaining) return { date: day.date, days: index + remaining / day.pounds };
    remaining -= day.pounds;
  }
  return null;
}
