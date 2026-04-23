"use client";

import { startTransition, useState } from "react";

import { ActivePlacementDashboard } from "@/components/active-placement-dashboard";
import type { ActivePlacementRecord, FarmGroupRecord, FarmRecord } from "@/lib/types";

type LiveDashboardPanelProps = {
  farmGroups: FarmGroupRecord[];
  farms: FarmRecord[];
  placements: ActivePlacementRecord[];
};

type DashboardPayload = LiveDashboardPanelProps;

export function LiveDashboardPanel({
  farmGroups: initialFarmGroups,
  farms: initialFarms,
  placements: initialPlacements,
}: LiveDashboardPanelProps) {
  const [farmGroups, setFarmGroups] = useState(initialFarmGroups);
  const [farms, setFarms] = useState(initialFarms);
  const [placements, setPlacements] = useState(initialPlacements);
  const [refreshPending, setRefreshPending] = useState(false);

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

      <ActivePlacementDashboard farmGroups={farmGroups} farms={farms} placements={placements} />
    </div>
  );
}
