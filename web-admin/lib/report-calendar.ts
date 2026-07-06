export type CalendarBadge = {
  label: string;
  tone?: "neutral" | "good" | "warn" | "danger";
};

export type CalendarDay = {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  badges: CalendarBadge[];
};

export type CalendarMonthSection = {
  monthKey: string;
  title: string;
  days: CalendarDay[];
};

export function buildMonthSections(
  monthKeys: string[],
  badgesByDate: Map<string, CalendarBadge[]>,
): CalendarMonthSection[] {
  return monthKeys.map((monthKey) => buildMonthSection(monthKey, badgesByDate));
}

export function buildMonthSection(
  monthKey: string,
  badgesByDate: Map<string, CalendarBadge[]>,
): CalendarMonthSection {
  const [year, month] = monthKey.split("-").map((value) => Number(value));
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const title = firstOfMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const firstCalendarDate = new Date(firstOfMonth);
  firstCalendarDate.setUTCDate(firstCalendarDate.getUTCDate() - firstOfMonth.getUTCDay());

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCalendarDate);
    date.setUTCDate(firstCalendarDate.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    return {
      date: iso,
      dayNumber: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === month - 1,
      badges: badgesByDate.get(iso) ?? [],
    };
  });

  return {
    monthKey,
    title,
    days,
  };
}

export function collectMonthKeys(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [] as string[];
  }

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const monthKeys: string[] = [];

  while (cursor <= endCursor) {
    monthKeys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return monthKeys;
}

export function clampDateRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) {
    return { startDate: "", endDate: "" };
  }

  if (!startDate) {
    return { startDate: endDate, endDate };
  }

  if (!endDate) {
    return { startDate, endDate: startDate };
  }

  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
}
