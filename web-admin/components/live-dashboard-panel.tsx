"use client";

import { startTransition, useEffect, useState } from "react";

import { ActivePlacementDashboard } from "@/components/active-placement-dashboard";
import type { ActivePlacementRecord, BreedOptionRecord, FarmGroupRecord, FarmRecord } from "@/lib/types";

type LiveDashboardPanelProps = {
  breedOptions: BreedOptionRecord[];
  farmGroups: FarmGroupRecord[];
  farms: FarmRecord[];
  placements: ActivePlacementRecord[];
  historyReportLabel: string;
};

type DashboardPayload = LiveDashboardPanelProps;

export function LiveDashboardPanel({
  breedOptions: initialBreedOptions,
  farmGroups: initialFarmGroups,
  farms: initialFarms,
  historyReportLabel,
  placements: initialPlacements,
}: LiveDashboardPanelProps) {
  const [breedOptions, setBreedOptions] = useState(initialBreedOptions);
  const [farmGroups, setFarmGroups] = useState(initialFarmGroups);
  const [farms, setFarms] = useState(initialFarms);
  const [placements, setPlacements] = useState(initialPlacements);
  const [refreshPending, setRefreshPending] = useState(false);

  useEffect(() => {
    setBreedOptions(initialBreedOptions);
  }, [initialBreedOptions]);

  useEffect(() => {
    setFarmGroups(initialFarmGroups);
  }, [initialFarmGroups]);

  useEffect(() => {
    setFarms(initialFarms);
  }, [initialFarms]);

  useEffect(() => {
    setPlacements(initialPlacements);
  }, [initialPlacements]);

  async function refreshDashboard() {
    setRefreshPending(true);

    try {
      const response = await fetch("/api/admin-overview-dashboard", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as DashboardPayload;
      startTransition(() => {
        setBreedOptions(payload.breedOptions);
        setFarmGroups(payload.farmGroups);
        setFarms(payload.farms);
        setPlacements(payload.placements);
      });
    } finally {
      setRefreshPending(false);
    }
  }

  return (
    <div className="live-dashboard-refresh-shell">
      <div className="live-dashboard-refresh-row">
        <button className="button-secondary" disabled={refreshPending} onClick={refreshDashboard} type="button">
          {refreshPending ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <ActivePlacementDashboard
        breedOptions={breedOptions}
        farmGroups={farmGroups}
        farms={farms}
        historyReportLabel={historyReportLabel}
        placements={placements}
      />
    </div>
  );
}
