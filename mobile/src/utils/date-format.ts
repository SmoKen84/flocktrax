function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tokenParts(date: Date) {
  return {
    ddd: date.toLocaleDateString("en-US", { weekday: "short" }),
    mmm: date.toLocaleDateString("en-US", { month: "short" }),
    mm: date.toLocaleDateString("en-US", { month: "2-digit" }),
    dd: date.toLocaleDateString("en-US", { day: "2-digit" }),
    yy: date.toLocaleDateString("en-US", { year: "2-digit" }),
  };
}

export function formatDateByPattern(
  value: string | null | undefined,
  pattern: string | null | undefined,
  fallback = "--",
) {
  if (!value) return fallback;

  const date = parseIsoDate(value);
  if (!date) return value;

  const normalizedPattern = (pattern ?? "").trim().toLowerCase();
  const activePattern = normalizedPattern.length > 0 ? normalizedPattern : "ddd mmm dd";
  const parts = tokenParts(date);

  return activePattern.replace(/ddd|mmm|mm|dd|yy/g, (token) => {
    return parts[token as keyof typeof parts];
  });
}

export function formatShortDate(
  value: string | null | undefined,
  pattern: string | null | undefined,
  fallback = "--",
) {
  return formatDateByPattern(value, pattern ?? "mm/dd/yy", fallback);
}
