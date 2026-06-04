"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import type { LivehaulSchedulerBarn, LivehaulSchedulerFarm } from "@/lib/livehaul-scheduler-data";

type LivehaulFilterFormProps = {
  barns: LivehaulSchedulerBarn[];
  farms: LivehaulSchedulerFarm[];
  selectedBarnId: string | null;
  selectedFarmId: string | null;
  selectedMonth: string;
};

export function LivehaulFilterForm({
  barns,
  farms,
  selectedBarnId,
  selectedFarmId,
  selectedMonth,
}: LivehaulFilterFormProps) {
  const router = useRouter();
  const [farmId, setFarmId] = useState(selectedFarmId ?? "");
  const [barnId, setBarnId] = useState(selectedBarnId ?? "");

  const navigate = (nextFarmId: string, nextBarnId: string) => {
    const query = new URLSearchParams();
    if (nextFarmId) query.set("farm", nextFarmId);
    if (nextBarnId) query.set("barn", nextBarnId);
    if (selectedMonth) query.set("month", selectedMonth);
    const search = query.toString();
    startTransition(() => {
      router.push(search ? `/admin/placements/livehaul?${search}` : "/admin/placements/livehaul");
    });
  };

  return (
    <form
      action="/admin/placements/livehaul"
      className="placement-scheduler-filter-form"
      method="get"
    >
      <div className="placement-scheduler-filter-grid">
        <label className="field">
          <span>Farm</span>
          <select
            name="farm"
            value={farmId}
            onChange={(event) => {
              const nextFarmId = event.target.value;
              setFarmId(nextFarmId);
              setBarnId("");
              navigate(nextFarmId, "");
            }}
          >
            <option value="">Select farm</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.farmName}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Barn</span>
          <select
            disabled={!farmId}
            name="barn"
            value={barnId}
            onChange={(event) => {
              const nextBarnId = event.target.value;
              setBarnId(nextBarnId);
              navigate(farmId, nextBarnId);
            }}
          >
            <option value="">{farmId ? "All Barns" : "Select farm first"}</option>
            {barns.map((barn) => (
              <option key={barn.id} value={barn.id}>
                {barn.barnCode}
              </option>
            ))}
          </select>
        </label>

        <input name="month" type="hidden" value={selectedMonth} />

        <div className="placement-scheduler-filter-actions">
          <button className="button" type="submit">Refresh</button>
          <a className="button-secondary" href="/admin/placements/livehaul">Clear</a>
        </div>
      </div>
    </form>
  );
}
