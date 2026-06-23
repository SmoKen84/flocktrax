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
  const showDaysField = reportKey === "custom_feed_projection";

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
  ) {
    const params = new URLSearchParams();
    params.set("category", categoryKey);
    params.set("report", reportKey);
    if (nextFarmGroupId) params.set("farmGroupId", nextFarmGroupId);
    if (nextFarmId) params.set("farmId", nextFarmId);
    if (nextBarnId) params.set("barnId", nextBarnId);
    if (nextFlockCode) params.set("flockCode", nextFlockCode);
    if (showDaysField && nextDays) params.set("days", nextDays);

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
    pushFilters(nextFarmGroupId, nextFarmId, nextBarnId, nextFlockCode, days);
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
    pushFilters(farmGroupId, nextFarmId, nextBarnId, nextFlockCode, days);
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
    pushFilters(farmGroupId, farmId, nextBarnId, nextFlockCode, days);
  }

  function handleFlockChange(nextFlockCode: string) {
    setFlockCode(nextFlockCode);
    pushFilters(farmGroupId, farmId, barnId, nextFlockCode, days);
  }

  function handleDaysChange(nextDays: string) {
    setDays(nextDays);
    pushFilters(farmGroupId, farmId, barnId, flockCode, nextDays);
  }

  function handlePresetClick(nextDays: string) {
    setDays(nextDays);
    pushFilters(farmGroupId, farmId, barnId, flockCode, nextDays);
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
}: {
  category: string;
  report: string;
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (report) params.set("report", report);
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  const query = params.toString();
  return query ? `/admin/reports?${query}` : "/admin/reports";
}

function buildFeedProjectionPreviewHref({
  farmGroupId,
  farmId,
  barnId,
  flockCode,
  days,
  reportKey,
}: {
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
  days?: string;
  reportKey: string;
}) {
  const params = new URLSearchParams();
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  if (reportKey === "custom_feed_projection" && days) params.set("days", days);
  const query = params.toString();
  const pathname =
    reportKey === "custom_feed_projection"
      ? "/admin/reports/feed-projection-custom"
      : "/admin/reports/feed-projection";
  return query ? `${pathname}?${query}` : pathname;
}
