// Generic bin createdAt/updatedAt describe configuration, not sensor freshness.
export function binSentryReadingTime(properties: Record<string, unknown>, isReadingEntity: boolean): string | null {
  const keys = ["captured_at", "capturedAt", "last_reading_at", "lastReadingAt", "measured_at", "measuredAt",
    ...(isReadingEntity ? ["createdAt", "created_at", "publishedAt", "published_at", "updatedAt", "updated_at"] : [])];
  for (const key of keys) {
    const value = properties[key];
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value.trim())) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}
