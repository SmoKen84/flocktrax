import Link from "next/link";

import { LivehaulFilterForm } from "@/app/admin/placements/livehaul/livehaul-filter-form";
import { LivehaulMonthPicker } from "@/app/admin/placements/livehaul/livehaul-month-picker";
import { LivehaulCreateForm, LivehaulScheduleEditor } from "@/app/admin/placements/livehaul/livehaul-scheduler-forms";
import { PageHeader } from "@/components/page-header";
import { getLivehaulSchedulerBundle, type LivehaulScheduleRow } from "@/lib/livehaul-scheduler-data";
import { getPlatformScreenTextValues } from "@/lib/platform-content";

type LivehaulSchedulerPageProps = {
  searchParams?: Promise<{
    farm?: string | string[];
    barn?: string | string[];
    date?: string | string[];
    month?: string | string[];
    placement?: string | string[];
    notice?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LivehaulSchedulerPage({ searchParams }: LivehaulSchedulerPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedFarmParam = readParam(params?.farm);
  const selectedBarnParam = readParam(params?.barn);
  const selectedDateParam = readParam(params?.date);
  const selectedMonthParam = readParam(params?.month);
  const selectedPlacementParam = readParam(params?.placement);
  const clearedSelection = readParam((params as { cleared?: string | string[] } | undefined)?.cleared) === "1";
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);

  const [bundle, screenText] = await Promise.all([
    getLivehaulSchedulerBundle({
      selectedFarmId: selectedFarmParam,
      selectedBarnId: selectedBarnParam,
    }),
    getPlatformScreenTextValues(["lh_scheduler_title", "lh_scheduler_desc"]),
  ]);
  const heroTitle =
    screenText.get("lh_scheduler_title") || "Plan and adjust livehaul events by placement.";
  const heroBody =
    screenText.get("lh_scheduler_desc") ||
    "Use the same barn-first planning rhythm as placements, but record flexible livehaul nights as real schedule rows that can later carry closeout detail and actual load results.";
  const selectedFarm = bundle.farms.find((farm) => farm.id === selectedFarmParam) ?? null;
  const visibleBarns = selectedFarm ? bundle.barnsByFarmId[selectedFarm.id] ?? [] : [];
  const selectedBarn = visibleBarns.find((barn) => barn.id === selectedBarnParam) ?? null;
  const selectedMonth = selectedMonthParam ?? selectedDateParam?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const selectedDate = (clearedSelection ? null : selectedDateParam) ?? null;
  const schedules = selectedBarn
    ? bundle.schedulesByBarnId[selectedBarn.id] ?? []
    : selectedFarm
      ? visibleBarns.flatMap((barn) => bundle.schedulesByBarnId[barn.id] ?? [])
      : [];
  const placements = selectedBarn
    ? bundle.placementsByBarnId[selectedBarn.id] ?? []
    : selectedFarm
      ? visibleBarns.flatMap((barn) => bundle.placementsByBarnId[barn.id] ?? [])
      : [];
  const calendar = buildCalendar(selectedMonth, schedules, selectedDate);
  const selectedDateSchedules = selectedDate ? schedules.filter((row) => row.lhDate === selectedDate) : [];
  const selectedPlacementId =
    selectedPlacementParam ??
    selectedDateSchedules[0]?.placementId ??
    placements[0]?.id ??
    "";
  const selectedPlacement =
    placements.find((placement) => placement.id === selectedPlacementId) ??
    placements[0] ??
    null;
  const monthSchedules = schedules.filter((row) => row.lhDate.startsWith(selectedMonth));
  const returnToRecapHref = buildClearSelectionHref({
    farmId: selectedFarm?.id ?? null,
    barnId: selectedBarn?.id ?? null,
    month: selectedMonth,
    placementId: selectedPlacement?.id ?? selectedPlacementParam,
  });

  const buildHref = (options: {
    farm?: string | null;
    barn?: string | null;
    date?: string | null;
    month?: string | null;
    placement?: string | null;
  } = {}) => {
    const query = new URLSearchParams();
    const farmId = options.farm === undefined ? selectedFarm?.id ?? null : options.farm;
    const barnId = options.barn === undefined ? selectedBarn?.id ?? null : options.barn;
    const date = options.date === undefined ? selectedDate : options.date;
    const month = options.month === undefined ? selectedMonth : options.month;
    const placementId =
      options.placement === undefined ? selectedPlacement?.id ?? selectedPlacementParam : options.placement;
    if (farmId) query.set("farm", farmId);
    if (barnId) query.set("barn", barnId);
    if (date) query.set("date", date);
    if (month) query.set("month", month);
    if (placementId) query.set("placement", placementId);
    const search = query.toString();
    return search ? `/admin/placements/livehaul?${search}` : "/admin/placements/livehaul";
  };

  return (
    <>
      <PageHeader
        eyebrow="Livehaul Scheduler"
        title={heroTitle}
        body={heroBody}
      />

      {error ? (
        <div className="placement-scheduler-feedback" data-tone="danger">
          <span className="status-pill" data-tone="danger">Error</span>
          <p>{decodeURIComponent(error)}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="placement-scheduler-feedback" data-tone="good">
          <span className="status-pill" data-tone="good">Saved</span>
          <p>{decodeURIComponent(notice)}</p>
        </div>
      ) : null}

      <section className="panel card livehaul-summary-strip" aria-label="Livehaul summary">
        <span className="livehaul-summary-pill">
          <span className="livehaul-summary-pill-label">Visible Hauls</span>
          <strong>{schedules.length.toLocaleString()}</strong>
        </span>
        <span className="livehaul-summary-pill">
          <span className="livehaul-summary-pill-label">This Month</span>
          <strong>{monthSchedules.length.toLocaleString()}</strong>
        </span>
        <span className="livehaul-summary-pill">
          <span className="livehaul-summary-pill-label">Completed</span>
          <strong>{schedules.filter((row) => row.status === "completed").length.toLocaleString()}</strong>
        </span>
        <span className="livehaul-summary-pill">
          <span className="livehaul-summary-pill-label">Loads Recorded</span>
          <strong>{schedules.reduce((sum, row) => sum + row.loadCount, 0).toLocaleString()}</strong>
        </span>
      </section>

      <section className="placement-scheduler-layout">
        <article className="card placement-scheduler-calendar-card livehaul-scheduler-calendar-card">
          <div className="placement-scheduler-toolbar">
            <LivehaulFilterForm
              barns={visibleBarns}
              farms={bundle.farms}
              selectedBarnId={selectedBarn?.id ?? null}
              selectedFarmId={selectedFarm?.id ?? null}
              selectedMonth={selectedMonth}
            />
          </div>

          <div className="placement-scheduler-calendar-header">
            <Link className="button-ghost placement-scheduler-nav-button" href={buildHref({ month: calendar.previousMonth, date: null })}>
              Prev
            </Link>
            <div className="placement-scheduler-calendar-heading">
              <p className="placement-scheduler-calendar-context">{selectedFarm?.farmName ?? "No farm selected"}</p>
              <p className="placement-scheduler-calendar-meta">
                {selectedBarn ? `Barn ${selectedBarn.barnCode}` : selectedFarm ? "All Barns" : "No barn selected"} | {monthSchedules.length} scheduled haul{monthSchedules.length === 1 ? "" : "s"}
              </p>
              <div className="livehaul-calendar-title-row">
                <h2>{calendar.title}</h2>
                <LivehaulMonthPicker
                  barnId={selectedBarn?.id ?? null}
                  date={selectedDate}
                  farmId={selectedFarm?.id ?? null}
                  month={selectedMonth}
                  placementId={selectedPlacement?.id ?? selectedPlacementParam}
                />
              </div>
            </div>
            <Link className="button-ghost placement-scheduler-nav-button" href={buildHref({ month: calendar.nextMonth, date: null })}>
              Next
            </Link>
          </div>

          <div className="placement-scheduler-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="placement-scheduler-calendar-grid">
            {calendar.days.map((day) => {
              const daySchedules = schedules.filter((row) => row.lhDate === day.date);
              return (
                <Link
                  className="placement-scheduler-day"
                  data-current-month={day.isCurrentMonth}
                  data-selected={day.isSelected}
                  data-blocked={daySchedules.length > 0 ? "true" : "false"}
                  data-active={daySchedules.some((row) => row.status === "completed")}
                  data-tone={daySchedules.some((row) => row.status === "completed") ? "1" : "0"}
                  href={buildHref({
                    date: day.date,
                    placement: daySchedules[0]?.placementId ?? selectedPlacement?.id ?? selectedPlacementParam,
                  })}
                  key={day.date}
                >
                  <span className="placement-scheduler-day-number">{day.dayNumber}</span>
                  {daySchedules.length > 0 ? (
                    <div className="placement-scheduler-day-stack">
                      {daySchedules.slice(0, 2).map((row) => (
                        <span
                          className="placement-scheduler-day-pill placement-scheduler-day-pill-detail"
                          data-active={row.status === "completed"}
                          data-tone={row.status === "completed" ? "1" : "0"}
                          key={row.livehaulId}
                        >
                          <strong>{row.flockCode}</strong>
                          <small>{row.barnCode}</small>
                          {row.headTarget !== null && !Number.isNaN(row.headTarget) ? (
                            <small>{row.headTarget.toLocaleString()}</small>
                          ) : null}
                        </span>
                      ))}
                      {daySchedules.length > 2 ? <span className="placement-scheduler-day-more">+{daySchedules.length - 2}</span> : null}
                    </div>
                  ) : (
                    <span className="placement-scheduler-day-open">Open</span>
                  )}
                </Link>
              );
            })}
          </div>
        </article>

        <article className="card placement-scheduler-side-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">{selectedDate ? "Selected Day" : "Month Recap"}</p>
              <h2>{selectedDate ? formatDate(selectedDate) : "Choose a livehaul to edit"}</h2>
            </div>
          </div>

          {selectedFarm && selectedDateSchedules.length > 0 ? (
            <div className="placement-scheduler-mode-stack">
              <div className="placement-scheduler-window-list">
                {selectedDateSchedules.map((row) => (
                  <LivehaulScheduleEditor key={row.livehaulId} month={selectedMonth} returnHref={returnToRecapHref} row={row} />
                ))}
              </div>
            </div>
          ) : selectedFarm && selectedDate && selectedBarn ? (
            <div className="placement-scheduler-mode-stack">
              <LivehaulCreateForm
                barnCode={selectedBarn.barnCode}
                barnId={selectedBarn.id}
                farmId={selectedFarm?.id ?? ""}
                month={selectedMonth}
                placements={placements}
                returnHref={returnToRecapHref}
                selectedDate={selectedDate}
                selectedPlacementId={selectedPlacement?.id ?? ""}
              />
            </div>
          ) : selectedFarm && selectedDate ? (
            <div className="placement-scheduler-projection">
              <span>Choose a barn line</span>
              <strong>This date has farm-wide livehaul visibility, but creating a new row still needs a specific barn context.</strong>
              <p>Select a scheduled row below to edit it, or choose a single barn from the filter first to add a new livehaul on this date.</p>
            </div>
          ) : (
            <div className="placement-scheduler-projection">
              <span>Month recap</span>
              <strong>Select a date from the calendar or a row from the recap list.</strong>
              <p>The right-hand panel switches into livehaul create or edit mode only while a specific day is selected.</p>
            </div>
          )}

          {selectedFarm ? (
            <div className="placement-scheduler-window-list">
              <div className="placement-scheduler-recap-table">
                <div className="placement-scheduler-recap-row placement-scheduler-recap-row-head">
                  <span>Date</span>
                  <span>Barn</span>
                  <span>Seq</span>
                  <span>Placement</span>
                  <span>Status</span>
                </div>
                {monthSchedules.length > 0 ? (
                  monthSchedules.map((row) => (
                    <Link
                      className="placement-scheduler-recap-row placement-scheduler-recap-link"
                      data-state={row.status === "completed" ? "active" : row.status === "cancelled" ? "closed" : row.status === "legacy_migrated" ? "interim" : "scheduled"}
                      href={buildHref({ date: row.lhDate, placement: row.placementId })}
                      key={`recap-${row.livehaulId}`}
                    >
                      <span>{formatDateCompact(row.lhDate)}</span>
                      <span>{row.barnCode}</span>
                      <span>{row.sequenceNum ?? "--"}</span>
                      <span className="placement-scheduler-recap-flock-cell">
                        <strong>{row.placementCode}</strong>
                        <small>{`Flock ${row.flockCode}`}</small>
                        <small>{formatHeadTarget(row.headTarget)}</small>
                      </span>
                      <span className="placement-scheduler-recap-state">{formatStatus(row.status)}</span>
                    </Link>
                  ))
                ) : (
                  <div className="placement-scheduler-recap-row">
                    <span>{selectedBarn ? `No livehaul rows scheduled for this barn in ${calendar.title}.` : `No livehaul rows scheduled for this farm in ${calendar.title}.`}</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </>
  );
}

function readParam(value: string | string[] | undefined) {
  const resolved = Array.isArray(value) ? value[0] ?? null : value ?? null;
  return resolved && resolved.trim().length > 0 ? resolved : null;
}

function buildCalendar(selectedMonth: string, schedules: LivehaulScheduleRow[], selectedDate: string | null) {
  const [year, month] = selectedMonth.split("-").map((value) => Number(value));
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const title = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
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
      isSelected: iso === selectedDate,
      count: schedules.filter((row) => row.lhDate === iso).length,
    };
  });

  return {
    title,
    days,
    previousMonth: addMonths(selectedMonth, -1),
    nextMonth: addMonths(selectedMonth, 1),
  };
}

function addMonths(monthValue: string, offset: number) {
  const [year, month] = monthValue.split("-").map((value) => Number(value));
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateCompact(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function formatStage(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStatus(value: string) {
  if (value === "legacy_migrated") return "Legacy Migrated";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildClearSelectionHref(options: {
  farmId: string | null;
  barnId: string | null;
  month: string;
  placementId?: string | null;
}) {
  const query = new URLSearchParams();
  if (options.farmId) query.set("farm", options.farmId);
  if (options.barnId) query.set("barn", options.barnId);
  query.set("month", options.month);
  if (options.placementId) query.set("placement", options.placementId);
  query.set("cleared", "1");
  return `/admin/placements/livehaul?${query.toString()}`;
}

function formatHeadTarget(value: number | null) {
  if (value === null || Number.isNaN(value)) return "Heads TBD";
  return value.toLocaleString();
}

