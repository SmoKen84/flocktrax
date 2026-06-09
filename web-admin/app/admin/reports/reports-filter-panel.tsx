"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

type FarmOption = {
  id: string;
  name: string;
};

type BarnOption = {
  id: string;
  farmId: string;
  label: string;
};

type FlockOption = {
  id: string;
  farmId: string;
  barnId: string;
  value: string;
  label: string;
};

type ReportsFilterPanelProps = {
  categoryKey: string;
  reportKey: string;
  currentBarnId: string;
  currentFarmId: string;
  currentFlockCode: string;
  farms: FarmOption[];
  barns: BarnOption[];
  flocks: FlockOption[];
};

export function ReportsFilterPanel({
  categoryKey,
  reportKey,
  currentBarnId,
  currentFarmId,
  currentFlockCode,
  farms,
  barns,
  flocks,
}: ReportsFilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [farmId, setFarmId] = useState(currentFarmId);
  const [barnId, setBarnId] = useState(currentBarnId);
  const [flockCode, setFlockCode] = useState(currentFlockCode);

  const filteredBarns = useMemo(
    () => barns.filter((barn) => !farmId || barn.farmId === farmId),
    [barns, farmId],
  );

  const filteredFlocks = useMemo(
    () =>
      flocks.filter((flock) => {
        if (farmId && flock.farmId !== farmId) return false;
        if (barnId && flock.barnId !== barnId) return false;
        return true;
      }),
    [barnId, farmId, flocks],
  );

  function pushFilters(nextFarmId: string, nextBarnId: string, nextFlockCode: string) {
    const params = new URLSearchParams();
    params.set("category", categoryKey);
    params.set("report", reportKey);
    if (nextFarmId) params.set("farmId", nextFarmId);
    if (nextBarnId) params.set("barnId", nextBarnId);
    if (nextFlockCode) params.set("flockCode", nextFlockCode);

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function handleFarmChange(nextFarmId: string) {
    const nextBarnId = barns.some((barn) => barn.id === barnId && (!nextFarmId || barn.farmId === nextFarmId))
      ? barnId
      : "";
    const nextFlockCode = flocks.some(
      (flock) =>
        flock.value === flockCode &&
        (!nextFarmId || flock.farmId === nextFarmId) &&
        (!nextBarnId || flock.barnId === nextBarnId),
    )
      ? flockCode
      : "";

    setFarmId(nextFarmId);
    setBarnId(nextBarnId);
    setFlockCode(nextFlockCode);
    pushFilters(nextFarmId, nextBarnId, nextFlockCode);
  }

  function handleBarnChange(nextBarnId: string) {
    const nextFlockCode = flocks.some(
      (flock) =>
        flock.value === flockCode &&
        (!farmId || flock.farmId === farmId) &&
        (!nextBarnId || flock.barnId === nextBarnId),
    )
      ? flockCode
      : "";

    setBarnId(nextBarnId);
    setFlockCode(nextFlockCode);
    pushFilters(farmId, nextBarnId, nextFlockCode);
  }

  function handleFlockChange(nextFlockCode: string) {
    setFlockCode(nextFlockCode);
    pushFilters(farmId, barnId, nextFlockCode);
  }

  const clearHref = buildReportsHubHref({
    category: categoryKey,
    report: reportKey,
  });
  const previewHref = buildFeedProjectionPreviewHref({
    farmId,
    barnId,
    flockCode,
  });

  return (
    <div className="reports-hub-filter-form">
      <label>
        <span>Farm</span>
        <select onChange={(event) => handleFarmChange(event.target.value)} value={farmId}>
          <option value="">All farms</option>
          {farms.map((farm) => (
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
  farmId,
  barnId,
  flockCode,
}: {
  category: string;
  report: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (report) params.set("report", report);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  const query = params.toString();
  return query ? `/admin/reports?${query}` : "/admin/reports";
}

function buildFeedProjectionPreviewHref({
  farmId,
  barnId,
  flockCode,
}: {
  farmId?: string;
  barnId?: string;
  flockCode?: string;
}) {
  const params = new URLSearchParams();
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  const query = params.toString();
  return query ? `/admin/reports/feed-projection?${query}` : "/admin/reports/feed-projection";
}
