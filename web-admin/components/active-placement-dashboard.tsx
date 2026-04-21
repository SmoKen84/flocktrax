"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  makePlacementCurrentAction,
  markBarnEmptyAction,
  markChicksArrivedAction,
  savePlacementLhDatesAction,
  type LhDateActionResult,
} from "@/app/admin/overview/actions";
import type { ActivePlacementRecord, FarmGroupRecord, FarmRecord } from "@/lib/types";

type ActivePlacementDashboardProps = {
  placements: ActivePlacementRecord[];
  farmGroups: FarmGroupRecord[];
  farms: FarmRecord[];
};

type SubmissionFilter = "all" | ActivePlacementRecord["submissionStatus"];

function formatCount(value: number) {
  return value.toLocaleString();
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function safePercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function formatWeight(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Pending";
  }

  return value.toFixed(2);
}

function formatSampleCount(value: number | null) {
  return value ?? 0;
}

function getOperationalAction(placement: ActivePlacementRecord) {
  if (placement.tileState === "scheduled" && !placement.placementIsActive) {
    return {
      kind: "current" as const,
      label: "Make Current",
    };
  }

  if (placement.placementIsActive && !placement.flockIsInBarn) {
    return {
      kind: "arrival" as const,
      label: "Chicks Arrived",
    };
  }

  if (placement.placementIsActive && placement.flockIsInBarn && placement.canMarkBarnEmpty) {
    return {
      kind: "empty" as const,
      label: "Barn Empty",
    };
  }

  return null;
}

function needsLhDates(placement: ActivePlacementRecord) {
  return placement.ageDays >= 42 && (!placement.lh1Date || !placement.lh3Date);
}

function getPassiveTileActionLabel(placement: ActivePlacementRecord) {
  if (placement.tileState === "scheduled") {
    return "Scheduled";
  }

  if (placement.tileState === "empty") {
    return "No Flock";
  }

  return placement.ageDays < 0 ? "Placed Ok" : "Schedule Live Haul";
}

function PlacementTile({
  placement,
  editingPlacementId,
  onBeginEdit,
  onEndEdit,
}: {
  placement: ActivePlacementRecord;
  editingPlacementId: string | null;
  onBeginEdit: (placementId: string) => void;
  onEndEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lh1DateValue, setLh1DateValue] = useState(placement.lh1Date ?? "");
  const [lh3DateValue, setLh3DateValue] = useState(placement.lh3Date ?? "");
  const [savedLh1Date, setSavedLh1Date] = useState(placement.lh1Date ?? "");
  const [savedLh3Date, setSavedLh3Date] = useState(placement.lh3Date ?? "");
  const [actionState, setActionState] = useState<LhDateActionResult>({
    status: "idle",
    message: "",
  });

  const isEditingLhDates = editingPlacementId === placement.id;
  const anotherTileIsEditing = editingPlacementId !== null && editingPlacementId !== placement.id;

  useEffect(() => {
    setLh1DateValue(placement.lh1Date ?? "");
    setLh3DateValue(placement.lh3Date ?? "");
  }, [placement.lh1Date, placement.lh3Date]);

  useEffect(() => {
    setSavedLh1Date(placement.lh1Date ?? "");
    setSavedLh3Date(placement.lh3Date ?? "");
  }, [placement.lh1Date, placement.lh3Date]);

  const startedTotal = placement.startedMaleCount + placement.startedFemaleCount;
  const mortalityTotal = placement.mortalityMaleTotal + placement.mortalityFemaleTotal;
  const currentTotal = placement.currentMaleCount + placement.currentFemaleCount;
  const first7Total = placement.mortalityMaleFirst7Days + placement.mortalityFemaleFirst7Days;
  const last7Total = placement.mortalityMaleLast7Days + placement.mortalityFemaleLast7Days;
  const operationalAction = getOperationalAction(placement);
  const lhDatesNeeded = needsLhDates(placement);
  const canEditLhDates = placement.placementIsActive && placement.ageDays >= 42;

  function beginEdit() {
    if (!canEditLhDates || anotherTileIsEditing) {
      return;
    }

    setActionState({ status: "idle", message: "" });
    setLh1DateValue(savedLh1Date);
    setLh3DateValue(savedLh3Date);
    onBeginEdit(placement.id);
  }

  function cancelEdit() {
    setActionState({ status: "idle", message: "" });
    setLh1DateValue(savedLh1Date);
    setLh3DateValue(savedLh3Date);
    onEndEdit();
  }

  function saveDates() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("placement_id", placement.id);
      formData.set("lh1_date", lh1DateValue);
      formData.set("lh3_date", lh3DateValue);

      const result = await savePlacementLhDatesAction(formData);
      setActionState(result);

      if (result.status === "success") {
        setSavedLh1Date(lh1DateValue);
        setSavedLh3Date(lh3DateValue);
        onEndEdit();
        router.refresh();
      }
    });
  }

  function runOperationalAction() {
    if (!operationalAction) {
      return;
    }

    startTransition(async () => {
      const result =
        operationalAction.kind === "current"
          ? await makePlacementCurrentAction(placement.id)
          : operationalAction.kind === "arrival"
            ? await markChicksArrivedAction(placement.id)
            : await markBarnEmptyAction(placement.barnId);

      setActionState(result);

      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <article className="placement-tile" data-state={placement.tileState}>
      <div className="placement-tile-header">
        <div>
          <p className="placement-tile-barn">{placement.barnCode}</p>
          <h3 className="placement-tile-farm">{placement.farmName}</h3>
          <p className="placement-kicker">{placement.farmGroupName}</p>
        </div>
        <span className="status-pill" data-tone={placement.dashboardStatusTone}>
          {placement.dashboardStatusLabel}
        </span>
      </div>

      <div className="placement-summary-grid">
        <div>
          <p className="stat-label">Flock</p>
          <p className="tile-value">{placement.placementCode}</p>
        </div>
        <div>
          <p className="stat-label">Placed</p>
          <p className="tile-value">{placement.placedDate || "Pending"}</p>
        </div>
        <div>
          <p className="stat-label">Age</p>
          <p className="tile-value">{placement.ageDays} days</p>
        </div>
      </div>

      <section className="tile-mortality-card">
        <div className="tile-mortality-table">
          <div className="tile-mortality-header" />
          <div className="tile-mortality-header">Started</div>
          <div className="tile-mortality-header">Dead</div>
          <div className="tile-mortality-header">Now</div>
          <div className="tile-mortality-header">Loss %</div>

          <div className="tile-mortality-label">Males</div>
          <div>{formatCount(placement.startedMaleCount)}</div>
          <div>{formatCount(placement.mortalityMaleTotal)}</div>
          <div>{formatCount(placement.currentMaleCount)}</div>
          <div>{formatPercent(safePercent(placement.mortalityMaleTotal, placement.startedMaleCount))}</div>

          <div className="tile-mortality-label">Females</div>
          <div>{formatCount(placement.startedFemaleCount)}</div>
          <div>{formatCount(placement.mortalityFemaleTotal)}</div>
          <div>{formatCount(placement.currentFemaleCount)}</div>
          <div>{formatPercent(safePercent(placement.mortalityFemaleTotal, placement.startedFemaleCount))}</div>

          <div className="tile-mortality-label tile-mortality-total">Total</div>
          <div className="tile-mortality-total">{formatCount(startedTotal)}</div>
          <div className="tile-mortality-total">{formatCount(mortalityTotal)}</div>
          <div className="tile-mortality-total">{formatCount(currentTotal)}</div>
          <div className="tile-mortality-total">{formatPercent(safePercent(mortalityTotal, startedTotal))}</div>
        </div>

        <div className="tile-chip-row">
          <span className="tile-chip">
            First 7 days {formatPercent(safePercent(first7Total, startedTotal))}
          </span>
          <span className="tile-chip">Last 7 days {formatCount(last7Total)}</span>
        </div>
      </section>

      <div className="tile-action-row">
        {isEditingLhDates ? (
          <button
            className="tile-action-button"
            disabled={isPending}
            onClick={saveDates}
            type="button"
          >
            {isPending ? "Saving..." : "Save Dates"}
          </button>
        ) : lhDatesNeeded ? (
          <button
            className="tile-action-button"
            disabled={isPending || anotherTileIsEditing}
            onClick={beginEdit}
            type="button"
          >
            LH Dates
          </button>
        ) : operationalAction ? (
          <button
            className="tile-action-button"
            disabled={isPending || anotherTileIsEditing}
            onClick={runOperationalAction}
            type="button"
          >
            {isPending ? "Saving..." : operationalAction.label}
          </button>
        ) : canEditLhDates ? (
          <button
            className="tile-action-button"
            disabled={isPending || anotherTileIsEditing}
            onClick={beginEdit}
            type="button"
          >
            LH Dates
          </button>
        ) : (
          <div className="tile-action-button">{getPassiveTileActionLabel(placement)}</div>
        )}
        {isEditingLhDates ? (
          <button
            className="tile-action-button tile-action-button--secondary"
            disabled={isPending}
            onClick={cancelEdit}
            type="button"
          >
            Cancel
          </button>
        ) : lhDatesNeeded && operationalAction ? (
          <button
            className="tile-action-button tile-action-button--secondary"
            disabled={isPending || anotherTileIsEditing}
            onClick={runOperationalAction}
            type="button"
          >
            {operationalAction.label}
          </button>
        ) : operationalAction && canEditLhDates ? (
          <button
            className="tile-action-button tile-action-button--secondary"
            disabled={isPending || anotherTileIsEditing}
            onClick={beginEdit}
            type="button"
          >
            LH Dates
          </button>
        ) : (
          <div aria-hidden="true" className="tile-action-button tile-action-button--ghost" />
        )}
      </div>

      <div className="placement-subpanel-grid">
          <section className="tile-subpanel tile-subpanel--haul">
            <h4>Live Haul</h4>
            <dl className="tile-subpanel-list">
              <div className="tile-subpanel-item">
                <dt>Estimated</dt>
                <dd className="tile-subpanel-value">{placement.estimatedFirstCatch || "Pending"}</dd>
              </div>
              <div className="tile-subpanel-item">
                <dt>First LH Date</dt>
                <dd>
                  {isEditingLhDates ? (
                    <input
                      className="tile-subpanel-input"
                      onChange={(event) => setLh1DateValue(event.target.value)}
                      type="date"
                      value={lh1DateValue}
                    />
                  ) : (
                    <span className="tile-subpanel-value">{savedLh1Date}</span>
                  )}
                </dd>
              </div>
              <div className="tile-subpanel-item">
                <dt>Last LH Date</dt>
                <dd>
                  {isEditingLhDates ? (
                    <input
                      className="tile-subpanel-input"
                      onChange={(event) => setLh3DateValue(event.target.value)}
                      type="date"
                      value={lh3DateValue}
                    />
                  ) : (
                    <span className="tile-subpanel-value">{savedLh3Date}</span>
                  )}
                </dd>
              </div>
            </dl>
            {actionState.status === "error" ? (
              <p className="tile-subpanel-feedback">{actionState.message}</p>
            ) : null}
          </section>

          <section className="tile-subpanel tile-subpanel--weight">
            <h4>Weight</h4>
            <dl className="tile-subpanel-list">
              <div className="tile-subpanel-item">
                <dt>Male Avg</dt>
                <dd className="tile-subpanel-value tile-subpanel-value--accent">
                  {formatWeight(placement.latestMaleWeight)}
                </dd>
              </div>
              <div className="tile-subpanel-item">
                <dt>Female Avg</dt>
                <dd className="tile-subpanel-value tile-subpanel-value--accent">
                  {formatWeight(placement.latestFemaleWeight)}
                </dd>
              </div>
              <div className="tile-subpanel-item">
                <dt>Sample Size</dt>
                <dd className="tile-subpanel-value tile-subpanel-value--accent">
                  {formatSampleCount(placement.latestMaleWeightCount)} / {formatSampleCount(placement.latestFemaleWeightCount)}
                </dd>
              </div>
              <div className="tile-subpanel-item">
                <dt>As Of</dt>
                <dd className="tile-subpanel-value tile-subpanel-value--accent">
                  {placement.latestMaleWeightDate ?? placement.latestFemaleWeightDate ?? "No scale data yet"}
                </dd>
              </div>
            </dl>
          </section>
      </div>

      <div className="progress-block">
        <div className="progress-copy">
          <span>Today&apos;s packet completion</span>
          <strong>{placement.completionPercent}%</strong>
        </div>
        <div aria-hidden="true" className="progress-track">
          <div className="progress-fill" style={{ width: `${placement.completionPercent}%` }} />
        </div>
      </div>
    </article>
  );
}

export function ActivePlacementDashboard({
  placements,
  farmGroups,
  farms,
}: ActivePlacementDashboardProps) {
  const [editingPlacementId, setEditingPlacementId] = useState<string | null>(null);
  const [farmGroupId, setFarmGroupId] = useState("all");
  const [farmId, setFarmId] = useState("all");
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>("all");
  const [search, setSearch] = useState("");

  const visibleFarms = useMemo(() => {
    if (farmGroupId === "all") {
      return farms;
    }

    return farms.filter((farm) => farm.farmGroupId === farmGroupId);
  }, [farmGroupId, farms]);

  const filteredPlacements = useMemo(() => {
    return placements.filter((placement) => {
      const matchesFarmGroup = farmGroupId === "all" || placement.farmGroupId === farmGroupId;
      const matchesFarm = farmId === "all" || placement.farmId === farmId;
      const matchesSubmission =
        submissionFilter === "all" || placement.submissionStatus === submissionFilter;
      const normalizedSearch = search.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        placement.placementCode.toLowerCase().includes(normalizedSearch) ||
        placement.farmName.toLowerCase().includes(normalizedSearch) ||
        placement.barnCode.toLowerCase().includes(normalizedSearch) ||
        placement.flockCode.toLowerCase().includes(normalizedSearch);

      return matchesFarmGroup && matchesFarm && matchesSubmission && matchesSearch;
    });
  }, [farmGroupId, farmId, placements, search, submissionFilter]);

  const alertCount = useMemo(
    () =>
      placements.filter(
        (placement) => placement.dashboardStatusTone === "danger" || placement.dashboardStatusTone === "warn",
      ).length,
    [placements],
  );

  return (
    <section className="panel card live-dashboard-panel">
      <div className="live-dashboard-header">
        <div className="live-dashboard-title-block">
          <p className="eyebrow">Live Dashboard</p>
          <div className="live-dashboard-wordmark">
            <span className="flocktrax-wordmark-line">
              <span className="flocktrax-wordmark-brand">FlockTrax</span>
              <span className="flocktrax-wordmark-divider" aria-hidden="true">
                -
              </span>
              <span className="flocktrax-wordmark-product">
                Live
                <sup className="flocktrax-wordmark-tm">TM</sup>
              </span>
            </span>
          </div>
        </div>
        <div className="live-dashboard-summary">
          <span className="live-dashboard-summary-label">Barns with Alerts</span>
          <strong>{alertCount > 0 ? alertCount : "none"}</strong>
        </div>
      </div>

      <div className="filters-grid">
        <div className="field">
          <label htmlFor="overview-farm-group">Farm Group</label>
          <select
            id="overview-farm-group"
            onChange={(event) => {
              setFarmGroupId(event.target.value);
              setFarmId("all");
            }}
            value={farmGroupId}
          >
            <option value="all">All farm groups</option>
            {farmGroups.map((farmGroup) => (
              <option key={farmGroup.id} value={farmGroup.id}>
                {farmGroup.legalName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="overview-farm">Farm</label>
          <select id="overview-farm" onChange={(event) => setFarmId(event.target.value)} value={farmId}>
            <option value="all">All farms</option>
            {visibleFarms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.farmName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="overview-submission">Submission</label>
          <select
            id="overview-submission"
            onChange={(event) => setSubmissionFilter(event.target.value as SubmissionFilter)}
            value={submissionFilter}
          >
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="pending">Pending</option>
            <option value="attention">Needs attention</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="overview-search">Search</label>
          <input
            id="overview-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Farm, barn, placement, or flock"
            type="text"
            value={search}
          />
        </div>
      </div>

      <div className="tile-grid" style={{ marginTop: 22 }}>
        {filteredPlacements.map((placement) => (
          <PlacementTile
            editingPlacementId={editingPlacementId}
            key={placement.id}
            onBeginEdit={setEditingPlacementId}
            onEndEdit={() => setEditingPlacementId(null)}
            placement={placement}
          />
        ))}
      </div>

      {filteredPlacements.length === 0 ? (
        <div className="helper-banner" style={{ marginTop: 18 }}>
          No barn tiles match the current filter set.
        </div>
      ) : null}
    </section>
  );
}
