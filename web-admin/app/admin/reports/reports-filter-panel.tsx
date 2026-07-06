"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

const CUSTOM_DAY_PRESETS = ["14", "21", "28"];

type FarmGroupOption = {
  id: string;
  name: string;
};

type FarmOption = {
  id: string;
  farmGroupId: string;
  name: string;
};

type BarnOption = {
  id: string;
  farmGroupId: string;
  farmId: string;
  label: string;
};

type FlockOption = {
  id: string;
  farmGroupId: string;
  farmId: string;
  barnId: string;
  value: string;
  label: string;
};

type ReportsFilterPanelProps = {
  categoryKey: string;
  reportKey: string;
  currentFarmGroupId: string;
  currentBarnId: string;
  currentFarmId: string;
  currentFlockCode: string;
  currentDays: string;
  currentReportDate: string;
  currentStartDate: string;
  currentEndDate: string;
  currentIncludeBinSentryOnOrder: boolean;
  farmGroups: FarmGroupOption[];
  farms: FarmOption[];
  barns: BarnOption[];
  flocks: FlockOption[];
};

export function ReportsFilterPanel({
  categoryKey,
  reportKey,
  currentFarmGroupId,
  currentBarnId,
  currentFarmId,
  currentFlockCode,
  currentDays,
  currentReportDate,
  currentStartDate,
  currentEndDate,
  currentIncludeBinSentryOnOrder,
  farmGroups,
  farms,
  barns,
  flocks,
}: ReportsFilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [farmGroupId, setFarmGroupId] = useState(currentFarmGroupId);
  const [farmId, setFarmId] = useState(currentFarmId);
  const [barnId, setBarnId] = useState(currentBarnId);
  const [flockCode, setFlockCode] = useState(currentFlockCode);
  const [days, setDays] = useState(currentDays);
  const [reportDate, setReportDate] = useState(currentReportDate);
  const [startDate, setStartDate] = useState(currentStartDate);
  const [endDate, setEndDate] = useState(currentEndDate);
  const [includeBinSentryOnOrder, setIncludeBinSentryOnOrder] = useState(currentIncludeBinSentryOnOrder);
  const showDaysField = reportKey === "custom_feed_projection";
  const showDateField = reportKey === "at_a_glance";
  const showDateRangeField = [
    "quick_placements_report",
    "quick_livehaul_report",
    "detailed_placements_report",
    "detailed_livehaul_report",
  ].includes(reportKey);
  const showBinSentryOnOrderToggle =
    reportKey === "ten_day_feed_requirements" || reportKey === "custom_feed_projection";
  const limitToTodayForward = categoryKey === "quick_access_reports" && showDateRangeField;

  const filteredFarms = useMemo(
    () => farms.filter((farm) => !farmGroupId || farm.farmGroupId === farmGroupId),
    [farmGroupId, farms],
  );

  const filteredBarns = useMemo(
    () =>
      barns.filter((barn) => {
        if (farmGroupId && barn.farmGroupId !== farmGroupId) return false;
        if (farmId && barn.farmId !== farmId) return false;
        return true;
      }),
    [barns, farmGroupId, farmId],
  );

  const filteredFlocks = useMemo(
    () =>
      flocks.filter((flock) => {
        if (farmGroupId && flock.farmGroupId !== farmGroupId) return false;
        if (farmId && flock.farmId !== farmId) return false;
        if (barnId && flock.barnId !== barnId) return false;
        return true;
      }),
    [barnId, farmGroupId, farmId, flocks],
  );

  function pushFilters(
    nextFarmGroupId: string,
    nextFarmId: string,
    nextBarnId: string,
    nextFlockCode: string,
    nextDays: string,
    nextReportDate: string,
    nextStartDate: string,
    nextEndDate: string,
    nextIncludeBinSentryOnOrder: boolean,
  ) {
    const params = new URLSearchParams();
    params.set("category", categoryKey);
    params.set("report", reportKey);
    if (nextFarmGroupId) params.set("farmGroupId", nextFarmGroupId);
    if (nextFarmId) params.set("farmId", nextFarmId);
    if (nextBarnId) params.set("barnId", nextBarnId);
    if (nextFlockCode) params.set("flockCode", nextFlockCode);
    if (showDaysField && nextDays) params.set("days", nextDays);
    if (showDateField && nextReportDate) params.set("reportDate", nextReportDate);
    if (showDateRangeField && nextStartDate) params.set("startDate", nextStartDate);
    if (showDateRangeField && nextEndDate) params.set("endDate", nextEndDate);
    if (showBinSentryOnOrderToggle && nextIncludeBinSentryOnOrder) params.set("includeBinSentryOnOrder", "1");

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function handleFarmGroupChange(nextFarmGroupId: string) {
    const nextFarmId = farms.some((farm) => farm.id === farmId && (!nextFarmGroupId || farm.farmGroupId === nextFarmGroupId))
      ? farmId
      : "";
    const nextBarnId = barns.some(
      (barn) =>
        barn.id === barnId &&
        (!nextFarmGroupId || barn.farmGroupId === nextFarmGroupId) &&
        (!nextFarmId || barn.farmId === nextFarmId),
    )
      ? barnId
      : "";
    const nextFlockCode = flocks.some(
      (flock) =>
        flock.value === flockCode &&
        (!nextFarmGroupId || flock.farmGroupId === nextFarmGroupId) &&
        (!nextFarmId || flock.farmId === nextFarmId) &&
        (!nextBarnId || flock.barnId === nextBarnId),
    )
      ? flockCode
      : "";

    setFarmGroupId(nextFarmGroupId);
    setFarmId(nextFarmId);
    setBarnId(nextBarnId);
    setFlockCode(nextFlockCode);
    pushFilters(nextFarmGroupId, nextFarmId, nextBarnId, nextFlockCode, days, reportDate, startDate, endDate, includeBinSentryOnOrder);
  }

  function handleFarmChange(nextFarmId: string) {
    const nextBarnId = barns.some(
      (barn) =>
        barn.id === barnId &&
        (!farmGroupId || barn.farmGroupId === farmGroupId) &&
        (!nextFarmId || barn.farmId === nextFarmId),
    )
      ? barnId
      : "";
    const nextFlockCode = flocks.some(
      (flock) =>
        flock.value === flockCode &&
        (!farmGroupId || flock.farmGroupId === farmGroupId) &&
        (!nextFarmId || flock.farmId === nextFarmId) &&
        (!nextBarnId || flock.barnId === nextBarnId),
    )
      ? flockCode
      : "";

    setFarmId(nextFarmId);
    setBarnId(nextBarnId);
    setFlockCode(nextFlockCode);
    pushFilters(farmGroupId, nextFarmId, nextBarnId, nextFlockCode, days, reportDate, startDate, endDate, includeBinSentryOnOrder);
  }

  function handleBarnChange(nextBarnId: string) {
    const nextFlockCode = flocks.some(
      (flock) =>
        flock.value === flockCode &&
        (!farmGroupId || flock.farmGroupId === farmGroupId) &&
        (!farmId || flock.farmId === farmId) &&
        (!nextBarnId || flock.barnId === nextBarnId),
    )
      ? flockCode
      : "";

    setBarnId(nextBarnId);
    setFlockCode(nextFlockCode);
    pushFilters(farmGroupId, farmId, nextBarnId, nextFlockCode, days, reportDate, startDate, endDate, includeBinSentryOnOrder);
  }

  function handleFlockChange(nextFlockCode: string) {
    setFlockCode(nextFlockCode);
    pushFilters(farmGroupId, farmId, barnId, nextFlockCode, days, reportDate, startDate, endDate, includeBinSentryOnOrder);
  }

  function handleDaysChange(nextDays: string) {
    setDays(nextDays);
    pushFilters(farmGroupId, farmId, barnId, flockCode, nextDays, reportDate, startDate, endDate, includeBinSentryOnOrder);
  }

  function handlePresetClick(nextDays: string) {
    setDays(nextDays);
    pushFilters(farmGroupId, farmId, barnId, flockCode, nextDays, reportDate, startDate, endDate, includeBinSentryOnOrder);
  }

  function handleReportDateChange(nextReportDate: string) {
    setReportDate(nextReportDate);
    pushFilters(farmGroupId, farmId, barnId, flockCode, days, nextReportDate, startDate, endDate, includeBinSentryOnOrder);
  }

  function handleStartDateChange(nextStartDate: string) {
    const normalized = normalizeDateRange(nextStartDate, endDate, limitToTodayForward);
    setStartDate(normalized.startDate);
    setEndDate(normalized.endDate);
    pushFilters(farmGroupId, farmId, barnId, flockCode, days, reportDate, normalized.startDate, normalized.endDate, includeBinSentryOnOrder);
  }

  function handleEndDateChange(nextEndDate: string) {
    const normalized = normalizeDateRange(startDate, nextEndDate, limitToTodayForward);
    setStartDate(normalized.startDate);
    setEndDate(normalized.endDate);
    pushFilters(farmGroupId, farmId, barnId, flockCode, days, reportDate, normalized.startDate, normalized.endDate, includeBinSentryOnOrder);
  }

  function handleIncludeBinSentryOnOrderChange(nextValue: boolean) {
    setIncludeBinSentryOnOrder(nextValue);
    pushFilters(farmGroupId, farmId, barnId, flockCode, days, reportDate, startDate, endDate, nextValue);
  }

  const clearHref = buildReportsHubHref({
    category: categoryKey,
    report: reportKey,
  });
  const previewHref = buildFeedProjectionPreviewHref({
    farmGroupId,
    farmId,
    barnId,
    flockCode,
    days,
    reportDate,
    startDate,
    endDate,
    includeBinSentryOnOrder,
    reportKey,
  });

  return (
    <div className="reports-hub-filter-form">
      <label>
        <span>Farm Group</span>
        <select onChange={(event) => handleFarmGroupChange(event.target.value)} value={farmGroupId}>
          <option value="">All farm groups</option>
          {farmGroups.map((farmGroup) => (
            <option key={farmGroup.id} value={farmGroup.id}>
              {farmGroup.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Farm</span>
        <select onChange={(event) => handleFarmChange(event.target.value)} value={farmId}>
          <option value="">All farms</option>
          {filteredFarms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Barn</span>
        <select onChange={(event) => handleBarnChange(event.target.value)} value={barnId}>
          <option value="">All barns</option>
          {filteredBarns.map((barn) => (
            <option key={barn.id} value={barn.id}>
              {barn.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Flock Code</span>
        <select onChange={(event) => handleFlockChange(event.target.value)} value={flockCode}>
          <option value="">All flocks</option>
          {filteredFlocks.map((flock) => (
            <option key={flock.id} value={flock.value}>
              {flock.label}
            </option>
          ))}
        </select>
      </label>

      {showDateField ? (
        <label>
          <span>Select Date</span>
          <input
            onChange={(event) => handleReportDateChange(event.target.value)}
            type="date"
            value={reportDate}
          />
        </label>
      ) : null}

      {showDateRangeField ? (
        <>
          <label>
            <span>From Date</span>
            <input
              min={limitToTodayForward ? todayDateKey() : undefined}
              onChange={(event) => handleStartDateChange(event.target.value)}
              type="date"
              value={startDate}
            />
          </label>

          <label>
            <span>To Date</span>
            <input
              min={limitToTodayForward ? todayDateKey() : undefined}
              onChange={(event) => handleEndDateChange(event.target.value)}
              type="date"
              value={endDate}
            />
          </label>
        </>
      ) : null}

      {showDaysField ? (
        <label>
          <span>Days</span>
          <input
            max={45}
            min={1}
            onChange={(event) => handleDaysChange(event.target.value)}
            type="number"
            value={days}
          />
          <div className="reports-hub-days-presets">
            {CUSTOM_DAY_PRESETS.map((preset) => (
              <button
                className="button-secondary reports-hub-days-preset"
                data-active={days === preset}
                key={preset}
                onClick={() => handlePresetClick(preset)}
                type="button"
              >
                {preset} Days
              </button>
            ))}
          </div>
        </label>
      ) : null}

      {showBinSentryOnOrderToggle ? (
        <label className="reports-hub-checkbox-field">
          <input
            checked={includeBinSentryOnOrder}
            onChange={(event) => handleIncludeBinSentryOnOrderChange(event.target.checked)}
            type="checkbox"
          />
          <div>
            <span>Include BinSentry Scheduled Orders</span>
            <small>Use BinSentry Order Manager orders in the Scheduled state as called-in feed for the On Order totals and recommendation math.</small>
          </div>
        </label>
      ) : null}

      <div className="reports-hub-filter-actions">
        <Link className="button-secondary" href={clearHref} scroll={false}>
          Clear
        </Link>
        <Link className="button-secondary" href={previewHref} scroll={false}>
          Preview
        </Link>
      </div>
    </div>
  );
}

function buildReportsHubHref({
  category,
  report,
  farmGroupId,
  farmId,
  barnId,
  flockCode,
  reportDate,
  startDate,
  endDate,
  includeBinSentryOnOrder,
}: {
  category: string;
  report: string;
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
  reportDate?: string;
  startDate?: string;
  endDate?: string;
  includeBinSentryOnOrder?: boolean;
}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (report) params.set("report", report);
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  if (reportDate) params.set("reportDate", reportDate);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (includeBinSentryOnOrder) params.set("includeBinSentryOnOrder", "1");
  const query = params.toString();
  return query ? `/admin/reports?${query}` : "/admin/reports";
}

function buildFeedProjectionPreviewHref({
  farmGroupId,
  farmId,
  barnId,
  flockCode,
  days,
  reportDate,
  startDate,
  endDate,
  includeBinSentryOnOrder,
  reportKey,
}: {
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
  days?: string;
  reportDate?: string;
  startDate?: string;
  endDate?: string;
  includeBinSentryOnOrder?: boolean;
  reportKey: string;
}) {
  const params = new URLSearchParams();
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  if (reportKey === "custom_feed_projection" && days) params.set("days", days);
  if ((reportKey === "custom_feed_projection" || reportKey === "ten_day_feed_requirements") && includeBinSentryOnOrder) {
    params.set("includeBinSentryOnOrder", "1");
  }
  if (reportKey === "at_a_glance" && reportDate) params.set("reportDate", reportDate);
  if (["quick_placements_report", "quick_livehaul_report", "detailed_placements_report", "detailed_livehaul_report"].includes(reportKey)) {
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
  }
  const query = params.toString();
  const pathname =
    reportKey === "custom_feed_projection"
      ? "/admin/reports/feed-projection-custom"
      : reportKey === "at_a_glance"
        ? "/admin/reports/today-at-a-glance"
        : reportKey === "quick_placements_report"
          ? "/admin/reports/placements-quick-access"
          : reportKey === "quick_livehaul_report"
            ? "/admin/reports/livehaul-quick-access"
            : reportKey === "detailed_placements_report"
              ? "/admin/reports/placements-detailed"
              : reportKey === "detailed_livehaul_report"
                ? "/admin/reports/livehaul-detailed"
        : "/admin/reports/feed-projection";
  return query ? `${pathname}?${query}` : pathname;
}

function normalizeDateRange(startDate: string, endDate: string, limitToTodayForward: boolean) {
  const today = todayDateKey();
  let nextStart = startDate;
  let nextEnd = endDate;

  if (limitToTodayForward) {
    if (nextStart && nextStart < today) nextStart = today;
    if (nextEnd && nextEnd < today) nextEnd = today;
  }

  if (!nextStart && nextEnd) nextStart = nextEnd;
  if (!nextEnd && nextStart) nextEnd = nextStart;
  if (nextStart && nextEnd && nextStart > nextEnd) {
    return { startDate: nextEnd, endDate: nextStart };
  }

  return { startDate: nextStart, endDate: nextEnd };
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}
