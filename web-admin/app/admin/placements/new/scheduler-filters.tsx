"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

type FilterOption = {
  id: string;
  label: string;
};

type SchedulerFiltersProps = {
  farms: FilterOption[];
  barns: FilterOption[];
  mode: "blocked" | "placements";
  modeDescription: string;
  selectedFarmId: string;
  selectedBarnId: string;
  selectedMonth: string;
  showBarnSelector: boolean;
};

function buildSearch(params: {
  mode: "blocked" | "placements";
  month: string;
  farm?: string | null;
  barn?: string | null;
}) {
  const query = new URLSearchParams();
  query.set("mode", params.mode);
  query.set("month", params.month);

  if (params.farm) {
    query.set("farm", params.farm);
  }

  if (params.barn) {
    query.set("barn", params.barn);
  }

  return `/admin/placements/new?${query.toString()}`;
}

export function SchedulerFilters({
  farms,
  barns,
  mode,
  modeDescription,
  selectedFarmId,
  selectedBarnId,
  selectedMonth,
  showBarnSelector,
}: SchedulerFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const barnOptions = useMemo(() => barns, [barns]);

  return (
    <div className="placement-scheduler-filter-form">
      <div className="placement-scheduler-filter-grid">
        <div className="placement-scheduler-filter-cluster placement-scheduler-filter-cluster-left">
          <div className="placement-scheduler-view-field">
          <div className="placement-scheduler-view-toggle" data-pending={isPending}>
            {[
              { value: "blocked" as const, label: "Barn View" },
              { value: "placements" as const, label: "Farm View" },
            ].map((option) => (
              <label className="placement-scheduler-view-option" data-active={mode === option.value} key={option.value}>
                <input
                  checked={mode === option.value}
                  disabled={isPending}
                  name="mode"
                  onChange={() => {
                    startTransition(() => {
                      router.push(
                        buildSearch({
                          mode: option.value,
                          month: selectedMonth,
                          farm: selectedFarmId || null,
                          barn: option.value === "blocked" ? selectedBarnId || null : null,
                        }),
                      );
                    });
                  }}
                  type="radio"
                  value={option.value}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          </div>

          <div className="placement-scheduler-mode-description">
            <span>{modeDescription}</span>
          </div>
        </div>

        <div className="placement-scheduler-filter-cluster placement-scheduler-filter-cluster-right">
          <label className="access-filter-field">
            <span>Select Farm</span>
            <select
              defaultValue={selectedFarmId}
              disabled={isPending}
              name="farm"
              onChange={(event) => {
                const nextFarmId = event.currentTarget.value || null;
                startTransition(() => {
                  router.push(
                    buildSearch({
                      mode,
                      month: selectedMonth,
                      farm: nextFarmId,
                      barn: null,
                    }),
                  );
                });
              }}
            >
              <option value="">{farms.length === 0 ? "No farms available" : "Choose a farm"}</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.label}
                </option>
              ))}
            </select>
          </label>

          {showBarnSelector ? (
            <label className="access-filter-field">
              <span>Select Barn</span>
              <select
                defaultValue={selectedBarnId}
                disabled={isPending || barnOptions.length === 0}
                name="barn"
              onChange={(event) => {
                  const nextBarnId = event.currentTarget.value || null;
                  startTransition(() => {
                    router.push(
                      buildSearch({
                      mode,
                      month: selectedMonth,
                      farm: selectedFarmId || null,
                      barn: nextBarnId,
                    }),
                  );
                });
              }}
            >
                <option value="">{barnOptions.length === 0 ? "No barns available" : "Choose a barn"}</option>
                {barnOptions.map((barn) => (
                  <option key={barn.id} value={barn.id}>
                    {barn.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

        </div>
      </div>
    </div>
  );
}
