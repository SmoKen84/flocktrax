import Link from "next/link";

import { schedulePlacementAction, updatePlacementAction } from "@/app/admin/placements/new/actions";
import { SchedulerFilters } from "@/app/admin/placements/new/scheduler-filters";
import { PageHeader } from "@/components/page-header";
import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import { getPlatformScreenTextValues } from "@/lib/platform-content";
import { getPlacementSchedulerBundle } from "@/lib/placement-scheduler-data";

type NewPlacementPageProps = {
  searchParams?: Promise<{
    mode?: string | string[];
    farm?: string | string[];
    barn?: string | string[];
    placement?: string | string[];
    cleared?: string | string[];
    date?: string | string[];
    month?: string | string[];
    notice?: string | string[];
    error?: string | string[];
  }>;
};

export default async function NewPlacementPage({ searchParams }: NewPlacementPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedModeParam = readParam(params?.mode);
  const selectedFarmParam = readParam(params?.farm);
  const selectedBarnParam = readParam(params?.barn);
  const selectedPlacementParam = readParam(params?.placement);
  const clearedSelection = readParam(params?.cleared) === "1";
  const selectedDateParam = readParam(params?.date);
  const selectedMonthParam = readParam(params?.month);
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);
  const mode = selectedModeParam === "placements" ? "placements" : "blocked";
  const [bundle, accessBundle, screenTextValues] = await Promise.all([
    getPlacementSchedulerBundle(),
    getUserAccessBundle(),
    getPlatformScreenTextValues([
      "placement_wizard_title",
      "placement_wizard_desc",
      "calendar_farm_view",
      "calendar_barn_view",
    ]),
  ]);
  const actingUser = accessBundle.users.find((user) => user.id === accessBundle.actingUserId) ?? accessBundle.users[0] ?? null;
  const actingRole = actingUser ? resolveRoleTemplate(accessBundle.roles, actingUser.role) : null;
  const canSeeAllFarms = allowsGlobalSchedulerScope(actingRole?.key ?? null);
  const accessibleFarmIds = new Set(
    actingUser?.memberships
      .filter((membership) => membership.scopeType === "farm")
      .map((membership) => membership.scopeId) ?? [],
  );
  const accessibleFarmGroupIds = new Set(
    actingUser?.memberships
      .filter((membership) => membership.scopeType === "farm_group")
      .map((membership) => membership.scopeId) ?? [],
  );
  const visibleFarmsPool = canSeeAllFarms
    ? bundle.farms
    : bundle.farms.filter((farm) => accessibleFarmIds.has(farm.id) || (farm.farmGroupId && accessibleFarmGroupIds.has(farm.farmGroupId)));

  const selectedFarm = visibleFarmsPool.find((farm) => farm.id === selectedFarmParam) ?? null;
  const visibleBarns = selectedFarm ? bundle.barnsByFarmId[selectedFarm.id] ?? [] : [];
  const farmWindows = visibleBarns.flatMap((barn) => bundle.windowsByBarnId[barn.id] ?? []);
  const selectedPlacementById = farmWindows.find((window) => window.id === selectedPlacementParam) ?? null;
  const selectedBarn =
    visibleBarns.find((barn) => barn.id === selectedBarnParam) ??
    visibleBarns.find((barn) => barn.id === selectedPlacementById?.barnId) ??
    null;
  const selectedDate =
    (clearedSelection ? null : selectedDateParam) ??
    selectedPlacementById?.startDate ??
    (selectedBarn ? bundle.recommendedStartByBarnId[selectedBarn.id] ?? "" : "");
  const selectedMonth = selectedMonthParam ?? (selectedDate ? selectedDate.slice(0, 7) : new Date().toISOString().slice(0, 7));
  const windows = selectedBarn ? bundle.windowsByBarnId[selectedBarn.id] ?? [] : [];
  const recommendedStartDate = selectedBarn ? bundle.recommendedStartByBarnId[selectedBarn.id] ?? null : null;
  const calendar = buildCalendar(selectedMonth, windows, selectedDate, recommendedStartDate);
  const monthlyPlacementStarts = visibleBarns
    .flatMap((barn) =>
      (bundle.windowsByBarnId[barn.id] ?? []).map((window) => ({
        ...window,
        barnCode: barn.barnCode,
      })),
    )
    .filter((window) => window.startDate.startsWith(selectedMonth))
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.barnCode.localeCompare(right.barnCode));
  const farmCalendar = buildFarmCalendar(selectedMonth, monthlyPlacementStarts, selectedDate, selectedBarn?.id ?? null);
  const heroTitle = screenTextValues.get("placement_wizard_title") || "Schedule flock placements on a real barn calendar.";
  const heroBody =
    screenTextValues.get("placement_wizard_desc") ||
    "Choose a farm and barn, review the blocked grow-out windows, then click the next open date to create the flock and placement together.";
  const farmViewText =
    screenTextValues.get("calendar_farm_view") ||
    "Displays all placement dates for all barns on a single calendar.";
  const barnViewText =
    screenTextValues.get("calendar_barn_view") ||
    "Displays the blocked grow-out windows for the selected barn on one calendar.";
  const calendarContextTitle = mode === "placements" ? selectedFarm?.farmName ?? "No farm selected" : selectedBarn?.barnCode ?? "No barn selected";
  const calendarContextMeta =
    mode === "placements"
      ? `(${monthlyPlacementStarts.length} placement${monthlyPlacementStarts.length === 1 ? "" : "s"})`
      : `(${windows.length} scheduled window${windows.length === 1 ? "" : "s"})`;
  const nextPlaceOffsetDays = bundle.settings.nextPlaceOffsetDays;
  const allowHistoricalEntry = bundle.settings.allowHistoricalEntry;
  const buildHref = (options: {
    mode?: "blocked" | "placements";
    farm?: string | null;
    barn?: string | null;
    placement?: string | null;
    date?: string | null;
    month?: string | null;
  } = {}) => {
    const query = new URLSearchParams();
    const nextMode = options.mode ?? mode;
    const farm = options.farm === undefined ? selectedFarm?.id ?? null : options.farm;
    const barn = options.barn === undefined ? selectedBarn?.id ?? null : options.barn;
    const placement = options.placement === undefined ? selectedPlacementById?.id ?? null : options.placement;
    const date = options.date === undefined ? selectedDate || null : options.date;
    const month = options.month === undefined ? selectedMonth : options.month;

    query.set("mode", nextMode);
    if (farm) query.set("farm", farm);
    if (barn) query.set("barn", barn);
    if (placement) query.set("placement", placement);
    if (date) query.set("date", date);
    if (month) query.set("month", month);

    const search = query.toString();
    return search ? `/admin/placements/new?${search}` : "/admin/placements/new";
  };

  const selectedPlacement =
    selectedPlacementById ??
    (selectedDate && selectedBarn
      ? mode === "placements"
        ? windows.find((window) => selectedDate === window.startDate) ?? null
        : windows.find((window) => selectedDate >= window.startDate && selectedDate <= window.endDate) ?? null
      : null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedDateIsPast = Boolean(selectedDate && selectedDate < todayIso);
  const canCreateForSelectedDate = Boolean(selectedBarn && selectedDate && (!selectedDateIsPast || allowHistoricalEntry));

  const defaultProjectedEnd = selectedDate ? addDays(selectedDate, bundle.settings.growOutDays) : "";

  return (
    <>
      <PageHeader
        eyebrow="Placement Scheduler"
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

      <section className="placement-scheduler-layout" data-mode={mode}>
        <article className="card placement-scheduler-calendar-card">
          <div className="placement-scheduler-toolbar">
            <SchedulerFilters
              barns={visibleBarns.map((barn) => ({ id: barn.id, label: barn.barnCode }))}
              farms={visibleFarmsPool.map((farm) => ({ id: farm.id, label: farm.farmName }))}
              mode={mode}
              modeDescription={mode === "placements" ? farmViewText : barnViewText}
              selectedBarnId={selectedBarn?.id ?? ""}
              selectedFarmId={selectedFarm?.id ?? ""}
              selectedMonth={selectedMonth}
              showBarnSelector={mode === "blocked"}
            />
          </div>

          <div className="placement-scheduler-calendar-header">
            <Link className="button-ghost placement-scheduler-nav-button" href={buildHref({ month: calendar.previousMonth, date: null })}>
              Prev
            </Link>
            <div className="placement-scheduler-calendar-heading">
              <p className="placement-scheduler-calendar-context">{calendarContextTitle}</p>
              <p className="placement-scheduler-calendar-meta">{calendarContextMeta}</p>
              <h2>{calendar.title}</h2>
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

          {mode === "placements" ? (
            <div className="placement-scheduler-calendar-grid placement-scheduler-calendar-grid-farm">
              {farmCalendar.days.map((day) => {
                const dayContent = (
                  <>
                    <span className="placement-scheduler-day-number">{day.dayNumber}</span>
                    {day.items.length > 0 ? (
                      <div className="placement-scheduler-day-stack placement-scheduler-day-stack-farm">
                        {day.items.map((item) =>
                          day.items.length === 1 ? (
                            <span
                              className="placement-scheduler-board-code"
                              data-active={item.isActive}
                              data-tone={item.tone}
                              data-selected={selectedBarn?.id === item.barnId && selectedDate === day.date}
                              key={item.id}
                            >
                              {item.placementCode}
                            </span>
                          ) : (
                            <Link
                              className="placement-scheduler-board-code"
                              data-active={item.isActive}
                              data-tone={item.tone}
                              data-selected={selectedBarn?.id === item.barnId && selectedDate === day.date}
                              href={buildHref({
                                mode: item.isFuture ? "blocked" : "placements",
                                barn: item.barnId,
                                placement: item.id,
                                date: day.date,
                              })}
                              key={item.id}
                            >
                              {item.placementCode}
                            </Link>
                          ),
                        )}
                      </div>
                    ) : (
                      <span className="placement-scheduler-board-empty">No start</span>
                    )}
                  </>
                );

                return day.items.length === 1 ? (
                  <Link
                    className="placement-scheduler-day placement-scheduler-day-farm"
                    data-current-month={day.isCurrentMonth}
                    data-selected={day.isSelected}
                    data-blocked="true"
                    data-active={day.isActive}
                    data-tone={day.tone}
                    href={buildHref({
                      mode: day.items[0]?.isFuture ? "blocked" : "placements",
                      barn: day.items[0]?.barnId ?? null,
                      placement: day.items[0]?.id ?? null,
                      date: day.date,
                    })}
                    key={day.date}
                  >
                    {dayContent}
                  </Link>
                ) : (
                  <div
                    className="placement-scheduler-day placement-scheduler-day-farm"
                    data-current-month={day.isCurrentMonth}
                    data-selected={day.isSelected}
                    data-blocked={day.items.length > 0 ? "true" : "false"}
                    data-active={day.isActive}
                    data-tone={day.tone}
                    key={day.date}
                  >
                    {dayContent}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="placement-scheduler-calendar-grid">
              {calendar.days.map((day) => {
                const content = (
                  <>
                    <span className="placement-scheduler-day-number">{day.dayNumber}</span>
                    {day.items.length > 0 ? (
                      <div className="placement-scheduler-day-stack">
                        {day.items.slice(0, 2).map((item) => (
                          <span className="placement-scheduler-day-pill" data-active={item.isActive} data-tone={item.tone} key={item.id}>
                            {item.placementCode}
                          </span>
                        ))}
                        {day.items.length > 2 ? <span className="placement-scheduler-day-more">+{day.items.length - 2}</span> : null}
                      </div>
                    ) : day.isRecommended ? (
                      <span className="placement-scheduler-day-recommend">Recommended</span>
                    ) : (
                      <span className="placement-scheduler-day-open">Open</span>
                    )}
                  </>
                );

                return day.isBlocked ? (
                  <div
                    className="placement-scheduler-day"
                    data-current-month={day.isCurrentMonth}
                    data-selected={day.isSelected}
                    data-blocked="true"
                    data-recommended={day.isRecommended}
                    data-active={day.isActive}
                    data-tone={day.tone}
                    key={day.date}
                  >
                    {content}
                  </div>
                ) : (
                  <Link
                    className="placement-scheduler-day"
                    data-current-month={day.isCurrentMonth}
                    data-selected={day.isSelected}
                    data-blocked="false"
                    data-recommended={day.isRecommended}
                    data-active={day.isActive}
                    data-tone={day.tone}
                    href={buildHref({ date: day.date })}
                    key={day.date}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          )}
        </article>

        <article className="card placement-scheduler-side-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">{mode === "placements" ? "Farm View" : "Schedule Placement"}</p>
              <h2>{mode === "placements" ? "Farm placement editor" : selectedDate ? "Choose a date" : "Choose a date"}</h2>
            </div>
          </div>

          {mode === "placements" ? (
            <div className="placement-scheduler-mode-stack">
              {selectedPlacement ? (
                <form action={updatePlacementAction} className="placement-scheduler-form">
                  <input name="mode" type="hidden" value={mode} />
                  <input name="farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
                  <input name="barn_id" type="hidden" value={selectedBarn?.id ?? ""} />
                  <input name="placement_id" type="hidden" value={selectedPlacement.id} />
                  <input name="flock_id" type="hidden" value={selectedPlacement.flockId} />
                  <input name="flock_number" type="hidden" value={selectedPlacement.flockNumber ?? ""} />
                  <input name="date_placed" type="hidden" value={selectedPlacement.startDate} />
                  <input name="selected_date" type="hidden" value={selectedDate} />
                  <input name="month" type="hidden" value={selectedMonth} />

                  <div className="helper-banner">
                    {`Editing ${selectedPlacement.placementCode} from the farm board. You can update counts, flock dates, and actual live-haul dates without leaving this calendar.`}
                  </div>

                  <div className="form-grid">
                    <div className="placement-scheduler-identity-row">
                      <div className="placement-scheduler-identity-card">
                        <span>Placement Key</span>
                        <strong>{selectedPlacement.placementCode}</strong>
                      </div>
                      <div className="placement-scheduler-identity-card placement-scheduler-identity-card-date">
                        <span>Placed Date</span>
                        <strong>{formatDateLabel(selectedPlacement.startDate)}</strong>
                      </div>
                    </div>
                    <label className="field">
                      <span>Projected End</span>
                      <input defaultValue={selectedPlacement.endDate} name="max_date" type="date" />
                    </label>
                    <label className="field">
                      <span>Date Removed</span>
                      <input defaultValue={selectedPlacement.actualEndDate ?? ""} name="date_removed" type="date" />
                    </label>
                    <label className="field">
                      <span>Start Females</span>
                      <input defaultValue={selectedPlacement.femaleCount ?? ""} name="start_cnt_females" type="number" />
                    </label>
                    <label className="field">
                      <span>Start Males</span>
                      <input defaultValue={selectedPlacement.maleCount ?? ""} name="start_cnt_males" type="number" />
                    </label>
                    <div className="placement-scheduler-triplet">
                      <label className="field field-third">
                        <span>LH 1 Date</span>
                        <input defaultValue={selectedPlacement.lh1Date ?? ""} name="lh1_date" type="date" />
                      </label>
                      <label className="field field-third">
                        <span>LH 2 Date</span>
                        <input defaultValue={selectedPlacement.lh2Date ?? ""} name="lh2_date" type="date" />
                      </label>
                      <label className="field field-third">
                        <span>LH 3 Date</span>
                        <input defaultValue={selectedPlacement.lh3Date ?? ""} name="lh3_date" type="date" />
                      </label>
                    </div>
                    <label className="field">
                      <span>Breed Males</span>
                      <input defaultValue={selectedPlacement.breedMales ?? ""} name="breed_males" placeholder="Breed id or lookup value" />
                    </label>
                    <label className="field">
                      <span>Breed Females</span>
                      <input defaultValue={selectedPlacement.breedFemales ?? ""} name="breed_females" placeholder="Breed id or lookup value" />
                    </label>
                  </div>

                  <div className="placement-scheduler-projection">
                    <span>Placement Editor</span>
                    <strong>{`${selectedPlacement.placementCode} - ${selectedBarn?.barnCode ?? "Barn"}`}</strong>
                    <p>
                      Once the live-haul dates are entered here, we can promote them into the calendar display next so the board reads beyond simple placement starts.
                    </p>
                  </div>

                  <button className="button" type="submit">
                    Save Placement
                  </button>
                </form>
              ) : (
                <>
                  <div className="helper-banner">
                    Farm View gives you the month-at-a-glance picture. Click any placement key on the calendar to open that flock and placement in the editor here on the right.
                  </div>

                  <div className="placement-scheduler-window-list">
                    <div className="section-header">
                      <div>
                        <p className="eyebrow">Month Recap</p>
                        <h3>{selectedFarm ? `${selectedFarm.farmName} barns` : "No farm selected"}</h3>
                      </div>
                    </div>
                    <div className="placement-scheduler-recap-table">
                      <div className="placement-scheduler-recap-row placement-scheduler-recap-row-head placement-scheduler-recap-row-wide">
                        <span>Flock</span>
                        <span>Place Date</span>
                        <span>Next Place</span>
                        <span>Barn</span>
                      </div>
                      {monthlyPlacementStarts.length > 0 ? (
                        monthlyPlacementStarts.map((window) => (
                          <Link
                            className="placement-scheduler-recap-row placement-scheduler-recap-row-wide placement-scheduler-recap-link"
                            href={buildHref({
                              mode: "placements",
                              barn: window.barnId,
                              placement: window.id,
                              date: window.startDate,
                            })}
                            key={`${window.id}-farm-recap`}
                          >
                            <span>{window.placementCode}</span>
                            <span>{window.startDate}</span>
                            <span>{addDays(window.startDate, nextPlaceOffsetDays)}</span>
                            <span>{window.barnCode}</span>
                          </Link>
                        ))
                      ) : (
                        <p className="meta-copy">No placement starts fall in this month for the selected farm.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : selectedPlacement && selectedPlacement.isFuture ? (
            <form action={updatePlacementAction} className="placement-scheduler-form">
              <input name="mode" type="hidden" value={mode} />
              <input name="farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
              <input name="barn_id" type="hidden" value={selectedBarn?.id ?? ""} />
              <input name="placement_id" type="hidden" value={selectedPlacement.id} />
              <input name="flock_id" type="hidden" value={selectedPlacement.flockId} />
              <input name="flock_number" type="hidden" value={selectedPlacement.flockNumber ?? ""} />
              <input name="selected_date" type="hidden" value={selectedDate} />
              <input name="month" type="hidden" value={selectedMonth} />

              <div className="helper-banner">
                {`This flock is still scheduled for a future barn turn. Use the scheduler fields below to move the planned date or adjust the projected grow-out window before the flock goes live.`}
              </div>

              <div className="form-grid">
                <div className="placement-scheduler-identity-row">
                  <div className="placement-scheduler-identity-card">
                    <span>Placement Key</span>
                    <strong>{selectedPlacement.placementCode}</strong>
                  </div>
                  <div className="placement-scheduler-identity-card placement-scheduler-identity-card-date">
                    <span>Selected Barn</span>
                    <strong>{selectedBarn?.barnCode ?? "Barn"}</strong>
                  </div>
                </div>
                <label className="field">
                  <span>Placed Date</span>
                  <input defaultValue={selectedPlacement.startDate} name="date_placed" type="date" required />
                </label>
                <label className="field">
                  <span>Projected End</span>
                  <input defaultValue={selectedPlacement.endDate} name="max_date" type="date" />
                </label>
                <label className="field">
                  <span>Date Removed</span>
                  <input defaultValue={selectedPlacement.actualEndDate ?? ""} name="date_removed" type="date" />
                </label>
                <label className="field">
                  <span>Start Females</span>
                  <input defaultValue={selectedPlacement.femaleCount ?? ""} name="start_cnt_females" type="number" />
                </label>
                <label className="field">
                  <span>Start Males</span>
                  <input defaultValue={selectedPlacement.maleCount ?? ""} name="start_cnt_males" type="number" />
                </label>
                <div className="placement-scheduler-triplet">
                  <label className="field field-third">
                    <span>LH 1 Date</span>
                    <input defaultValue={selectedPlacement.lh1Date ?? ""} name="lh1_date" type="date" />
                  </label>
                  <label className="field field-third">
                    <span>LH 2 Date</span>
                    <input defaultValue={selectedPlacement.lh2Date ?? ""} name="lh2_date" type="date" />
                  </label>
                  <label className="field field-third">
                    <span>LH 3 Date</span>
                    <input defaultValue={selectedPlacement.lh3Date ?? ""} name="lh3_date" type="date" />
                  </label>
                </div>
                <label className="field">
                  <span>Breed Males</span>
                  <input defaultValue={selectedPlacement.breedMales ?? ""} name="breed_males" placeholder="Breed id or lookup value" />
                </label>
                <label className="field">
                  <span>Breed Females</span>
                  <input defaultValue={selectedPlacement.breedFemales ?? ""} name="breed_females" placeholder="Breed id or lookup value" />
                </label>
              </div>

              <div className="placement-scheduler-projection">
                <span>Scheduled Placement</span>
                <strong>{`${selectedPlacement.startDate} through ${selectedPlacement.endDate}`}</strong>
                <p>
                  Because this flock is still scheduled in the future, changing the planned placement date here will update the barn calendar reservation.
                </p>
              </div>

              <button className="button" type="submit">
                Update Scheduled Placement
              </button>
            </form>
          ) : selectedPlacement ? (
            <form action={updatePlacementAction} className="placement-scheduler-form">
              <input name="mode" type="hidden" value={mode} />
              <input name="farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
              <input name="barn_id" type="hidden" value={selectedBarn?.id ?? ""} />
              <input name="placement_id" type="hidden" value={selectedPlacement.id} />
              <input name="flock_id" type="hidden" value={selectedPlacement.flockId} />
              <input name="flock_number" type="hidden" value={selectedPlacement.flockNumber ?? ""} />
              <input name="date_placed" type="hidden" value={selectedPlacement.startDate} />
              <input name="selected_date" type="hidden" value={selectedDate} />
              <input name="month" type="hidden" value={selectedMonth} />

              <div className="helper-banner">
                {`Editing ${selectedPlacement.placementCode} in barn ${selectedBarn?.barnCode ?? ""}. Use this panel to update the flock profile, schedule dates, and live-haul dates.`}
              </div>

              <div className="form-grid">
                <div className="placement-scheduler-identity-row">
                  <div className="placement-scheduler-identity-card">
                    <span>Placement Key</span>
                    <strong>{selectedPlacement.placementCode}</strong>
                  </div>
                  <div className="placement-scheduler-identity-card placement-scheduler-identity-card-date">
                    <span>Placed Date</span>
                    <strong>{formatDateLabel(selectedPlacement.startDate)}</strong>
                  </div>
                </div>
                <label className="field">
                  <span>Projected End</span>
                  <input defaultValue={selectedPlacement.endDate} name="max_date" type="date" />
                </label>
                <label className="field">
                  <span>Date Removed</span>
                  <input defaultValue={selectedPlacement.actualEndDate ?? ""} name="date_removed" type="date" />
                </label>
                <label className="field">
                  <span>Start Females</span>
                  <input defaultValue={selectedPlacement.femaleCount ?? ""} name="start_cnt_females" type="number" />
                </label>
                <label className="field">
                  <span>Start Males</span>
                  <input defaultValue={selectedPlacement.maleCount ?? ""} name="start_cnt_males" type="number" />
                </label>
                <div className="placement-scheduler-triplet">
                  <label className="field field-third">
                    <span>LH 1 Date</span>
                    <input defaultValue={selectedPlacement.lh1Date ?? ""} name="lh1_date" type="date" />
                  </label>
                  <label className="field field-third">
                    <span>LH 2 Date</span>
                    <input defaultValue={selectedPlacement.lh2Date ?? ""} name="lh2_date" type="date" />
                  </label>
                  <label className="field field-third">
                    <span>LH 3 Date</span>
                    <input defaultValue={selectedPlacement.lh3Date ?? ""} name="lh3_date" type="date" />
                  </label>
                </div>
                <label className="field">
                  <span>Breed Males</span>
                  <input defaultValue={selectedPlacement.breedMales ?? ""} name="breed_males" placeholder="Breed id or lookup value" />
                </label>
                <label className="field">
                  <span>Breed Females</span>
                  <input defaultValue={selectedPlacement.breedFemales ?? ""} name="breed_females" placeholder="Breed id or lookup value" />
                </label>
              </div>

              <div className="placement-scheduler-projection">
                <span>Placement Editor</span>
                <strong>{selectedPlacement.placementCode}</strong>
                <p>
                  This placement is currently {selectedPlacement.isActive ? "live in the barn" : selectedPlacement.isFuture ? "scheduled for a future barn turn" : "part of the historical placement record"}.
                </p>
              </div>

              <button className="button" type="submit">
                Save Placement
              </button>
            </form>
          ) : canCreateForSelectedDate ? (
            <form action={schedulePlacementAction} className="placement-scheduler-form">
              <input name="farm_id" type="hidden" value={selectedFarm?.id ?? ""} />
              <input name="barn_id" type="hidden" value={selectedBarn?.id ?? ""} />
              <input name="selected_date" type="hidden" value={selectedDate} />
              <input name="month" type="hidden" value={selectedMonth} />

              <div className="helper-banner">
                {`Selected ${selectedDate} for barn ${selectedBarn?.barnCode ?? "the selected barn"}. This will create a new flock record and a linked placement together.`}
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Flock Number</span>
                  <input name="flock_number" placeholder="Enter integrator flock number" required />
                </label>
                <label className="field">
                  <span>Grow-out Days</span>
                  <input defaultValue={bundle.settings.growOutDays} name="grow_out_days" type="number" />
                </label>
                <label className="field">
                  <span>Start Females</span>
                  <input name="start_cnt_females" type="number" />
                </label>
                <label className="field">
                  <span>Start Males</span>
                  <input name="start_cnt_males" type="number" />
                </label>
              </div>

              <div className="placement-scheduler-projection">
                <span>Projected Grow-Out</span>
                <strong>{`${selectedDate} through ${defaultProjectedEnd}`}</strong>
                <p>{`This window will be blocked on the barn calendar using the current grow-out duration of ${bundle.settings.growOutDays} days.`}</p>
              </div>

              <button className="button" type="submit">
                Schedule Placement
              </button>
            </form>
          ) : (
            <div className="helper-banner">
              {selectedDateIsPast && !allowHistoricalEntry
                ? "Past open dates stay read-only here unless Historical Entry is turned on. Select a scheduled flock to edit it, or choose a current/future open date to create a new placement."
                : selectedDateIsPast && allowHistoricalEntry
                  ? "Historical Entry is on. Past open dates can be used to backfill flock and placement history."
                : "Select a farm, a barn, and then click an open date on the calendar. This first version is focused on visual scheduling and linked record creation."}
            </div>
          )}

          {mode === "blocked" ? (
            <>
              <div className="placement-scheduler-window-list">
                <div className="section-header">
                  <div>
                    <p className="eyebrow">Scheduled Windows</p>
                    <h3>{selectedBarn ? `Barn ${selectedBarn.barnCode}` : "No barn selected"}</h3>
                  </div>
                </div>
                {windows.length > 0 ? (
                  windows.map((window) => (
                    <div className="placement-scheduler-window-card" key={window.id}>
                      <p className="table-title">{window.placementCode}</p>
                      <p className="table-subtitle">{`Flock ${window.flockNumber ?? "TBD"}`}</p>
                      <p className="meta-copy">{`${window.startDate} to ${window.endDate}`}</p>
                      <span
                        className="status-pill"
                        data-tone={window.isFuture ? "warn" : window.isComplete ? "danger" : "good"}
                      >
                        {window.isFuture ? "Scheduled" : window.isComplete ? "Closed" : "Active"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="meta-copy">No placement windows exist for this barn yet.</p>
                )}
              </div>

              <div className="placement-scheduler-window-list">
                <div className="section-header">
                  <div>
                    <p className="eyebrow">Placement Recap</p>
                    <h3>Created Flocks</h3>
                  </div>
                </div>
                {windows.length > 0 ? (
                  <div className="placement-scheduler-recap-table">
                    <div className="placement-scheduler-recap-row placement-scheduler-recap-row-head">
                      <span>Flock</span>
                      <span>Place Date</span>
                      <span>Next Place</span>
                    </div>
                    {windows.slice().sort((left, right) => right.startDate.localeCompare(left.startDate)).map((window) => (
                      <div className="placement-scheduler-recap-row" key={`${window.id}-recap`}>
                        <span>{window.placementCode}</span>
                        <span>{window.startDate}</span>
                        <span>{addDays(window.startDate, nextPlaceOffsetDays)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="meta-copy">Scheduled flocks will appear here once placements are created.</p>
                )}
              </div>
            </>
          ) : null}
        </article>
      </section>
    </>
  );
}

type CalendarWindow = {
  id: string;
  barnId?: string;
  flockId: string;
  placementCode: string;
  flockNumber?: number | null;
  startDate: string;
  endDate: string;
  actualEndDate?: string | null;
  isActive?: boolean;
  headCount?: number | null;
  femaleCount?: number | null;
  maleCount?: number | null;
  breedMales?: string | null;
  breedFemales?: string | null;
  lh1Date?: string | null;
  lh2Date?: string | null;
  lh3Date?: string | null;
  isFuture?: boolean;
  tone?: number;
};

function buildCalendar(month: string, windows: CalendarWindow[], selectedDate: string, recommendedStartDate: string | null) {
  const [year, monthValue] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthValue - 1, 1));
  const firstGridDay = new Date(firstDay);
  firstGridDay.setUTCDate(firstGridDay.getUTCDate() - firstGridDay.getUTCDay());
  const tonedWindows = windows
    .slice()
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.placementCode.localeCompare(right.placementCode))
    .map((window, index) => ({
      ...window,
      tone: index % 2,
    }));

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstGridDay);
    date.setUTCDate(firstGridDay.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const items = tonedWindows.filter((window) => iso >= window.startDate && iso <= window.endDate);
    return {
      date: iso,
      dayNumber: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === firstDay.getUTCMonth(),
      isSelected: iso === selectedDate,
      isBlocked: items.length > 0,
      isRecommended: recommendedStartDate === iso,
      isActive: items.some((item) => item.isActive),
      items,
      tone: items[0]?.tone ?? 0,
    };
  });

  const previousMonthDate = new Date(Date.UTC(year, monthValue - 2, 1));
  const nextMonthDate = new Date(Date.UTC(year, monthValue, 1));

  return {
    title: firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    previousMonth: previousMonthDate.toISOString().slice(0, 7),
    nextMonth: nextMonthDate.toISOString().slice(0, 7),
    days,
  };
}

function buildFarmCalendar(
  month: string,
  windows: Array<CalendarWindow & { barnCode: string }>,
  selectedDate: string,
  selectedBarnId: string | null,
) {
  const frame = buildMonthFrame(month);
  const tonedWindows = windows
    .slice()
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.placementCode.localeCompare(right.placementCode))
    .map((window, index) => ({
      ...window,
      tone: index % 2,
    }));

  return {
    title: frame.title,
    previousMonth: frame.previousMonth,
    nextMonth: frame.nextMonth,
    days: frame.days.map((day) => {
      const items = tonedWindows.filter((window) => window.startDate === day.date);
      return {
        ...day,
        isSelected: selectedDate === day.date && items.some((item) => item.barnId === selectedBarnId),
        isActive: items.some((item) => item.isActive),
        tone: items[0]?.tone ?? 0,
        items,
      };
    }),
  };
}

function buildMonthFrame(month: string) {
  const [year, monthValue] = month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, monthValue - 1, 1));
  const firstGridDay = new Date(firstDay);
  firstGridDay.setUTCDate(firstGridDay.getUTCDate() - firstGridDay.getUTCDay());
  const previousMonthDate = new Date(Date.UTC(year, monthValue - 2, 1));
  const nextMonthDate = new Date(Date.UTC(year, monthValue, 1));

  return {
    title: firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    previousMonth: previousMonthDate.toISOString().slice(0, 7),
    nextMonth: nextMonthDate.toISOString().slice(0, 7),
    days: Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstGridDay);
      date.setUTCDate(firstGridDay.getUTCDate() + index);
      return {
        date: date.toISOString().slice(0, 10),
        dayNumber: date.getUTCDate(),
        isCurrentMonth: date.getUTCMonth() === firstDay.getUTCMonth(),
      };
    }),
  };
}

function readParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateString: string | null | undefined) {
  if (!dateString) return "Not set";

  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${month}/${day}/${year}`;
}

function allowsGlobalSchedulerScope(roleKey: string | null) {
  const normalized = String(roleKey ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (
    normalized === "super_admin" ||
    normalized === "superadmin" ||
    normalized === "admin" ||
    normalized.includes("super") ||
    normalized.includes("integrator") ||
    normalized.includes("grower") ||
    normalized.includes("group")
  );
}
