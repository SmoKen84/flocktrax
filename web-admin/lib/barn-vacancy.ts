export type VacancyPlacement = {
  barnId: string;
  startDate: string | null;
  lifecycleStage: string | null;
  removedDate: string | null;
};

export type VacancyInterval = { startDate: string; endDate: string };

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function vacancyDateRange(start: string | null | undefined, end: string | null | undefined, today: string) {
  let startDate = isDateKey(start) && start >= today ? start : today;
  let endDate = isDateKey(end) && end >= today ? end : addCalendarDays(startDate, 60);
  if (endDate < startDate) [startDate, endDate] = [endDate, startDate];
  // Keep a manually edited URL from requesting an unbounded calendar.
  endDate = endDate > addCalendarDays(startDate, 365) ? addCalendarDays(startDate, 365) : endDate;
  return { startDate, endDate };
}

/** Occupancy is [start, start + 43): day 43 is the first projected vacant day.
 * Only actual, already recorded removals before the report window retire a placement.
 * Future vacancies always use the requested 43-day rule, not projected livehaul fields.
 */
export function buildBarnVacancies(placements: VacancyPlacement[], startDate: string, endDate: string) {
  const relevant = placements.filter((row) =>
    row.lifecycleStage !== "canceled" && row.lifecycleStage !== "unassigned" &&
    !(isDateKey(row.removedDate) && row.removedDate <= startDate),
  );
  if (relevant.some((row) => !isDateKey(row.startDate))) {
    return { intervals: [] as VacancyInterval[], unknown: true };
  }

  const occupied = relevant.map((row) => ({
    start: row.startDate!,
    end: addCalendarDays(row.startDate!, 43),
  })).filter((row) => row.end > startDate && row.start <= endDate)
    .sort((a, b) => a.start.localeCompare(b.start));

  const intervals: VacancyInterval[] = [];
  let cursor = startDate;
  for (const row of occupied) {
    if (row.start > cursor) intervals.push({ startDate: cursor, endDate: addCalendarDays(row.start, -1) });
    if (row.end > cursor) cursor = row.end;
    if (cursor > endDate) break;
  }
  if (cursor <= endDate) intervals.push({ startDate: cursor, endDate });
  return { intervals, unknown: false };
}

export function clipVacancy(interval: VacancyInterval, start: string, end: string): VacancyInterval | null {
  const startDate = interval.startDate > start ? interval.startDate : start;
  const endDate = interval.endDate < end ? interval.endDate : end;
  return startDate <= endDate ? { startDate, endDate } : null;
}

export function vacancyColor(barnId: string) {
  let hash = 0;
  for (const character of barnId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 65% 34%)`;
}
