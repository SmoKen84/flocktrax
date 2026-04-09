"use client";

import { useMemo, useState } from "react";

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

export function ActivePlacementDashboard({
  placements,
  farmGroups,
  farms,
}: ActivePlacementDashboardProps) {
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

  return (
    <section className="panel card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Live Dashboard</p>
          <h2>Active placements by barn</h2>
          <p className="meta-copy">
            Each tile represents the active placement assigned to a barn and can be filtered by company, farm,
            and daily submission status.
          </p>
        </div>
        <div className="dashboard-count">{filteredPlacements.length} showing</div>
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
        {filteredPlacements.map((placement) => {
          const startedTotal = placement.startedMaleCount + placement.startedFemaleCount;
          const mortalityTotal = placement.mortalityMaleTotal + placement.mortalityFemaleTotal;
          const currentTotal = placement.currentMaleCount + placement.currentFemaleCount;
          const first7Total = placement.mortalityMaleFirst7Days + placement.mortalityFemaleFirst7Days;
          const last7Total = placement.mortalityMaleLast7Days + placement.mortalityFemaleLast7Days;

          return (
            <article className="placement-tile" key={placement.id}>
              <div className="placement-tile-header">
                <div>
                  <p className="placement-tile-barn">{placement.barnCode}</p>
                  <h3 className="placement-tile-farm">{placement.farmName}</h3>
                  <p className="placement-kicker">{placement.farmGroupName}</p>
                </div>
                <span
                  className="status-pill"
                  data-tone={placement.dashboardStatusTone}
                >
                  {placement.dashboardStatusLabel}
                </span>
              </div>

              <div className="placement-summary-grid">
                <div>
                  <p className="stat-label">Placement</p>
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
                  <div className="tile-mortality-header">Mortality</div>
                  <div className="tile-mortality-header">Current</div>
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
                  <span className="tile-chip">Current {formatCount(currentTotal)}</span>
                  <span className="tile-chip">Last 7 days {formatCount(last7Total)}</span>
                </div>
              </section>

              <div className="placement-subpanel-grid">
                <section className="tile-subpanel">
                  <h4>Live Haul</h4>
                  <dl className="tile-subpanel-list">
                    <div>
                      <dt>Estimated</dt>
                      <dd>{placement.estimatedFirstCatch || "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Flock</dt>
                      <dd>{placement.flockCode}</dd>
                    </div>
                    <div>
                      <dt>Placement ID</dt>
                      <dd className="tile-subpanel-code">{placement.placementId}</dd>
                    </div>
                  </dl>
                </section>

                <section className="tile-subpanel">
                  <h4>Weights</h4>
                  <dl className="tile-subpanel-list">
                    <div>
                      <dt>Male Avg</dt>
                      <dd>{formatWeight(placement.latestMaleWeight)}</dd>
                    </div>
                    <div>
                      <dt>Female Avg</dt>
                      <dd>{formatWeight(placement.latestFemaleWeight)}</dd>
                    </div>
                    <div>
                      <dt>Weighed</dt>
                      <dd>
                        M {placement.latestMaleWeightCount ?? 0} / F {placement.latestFemaleWeightCount ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt>As Of</dt>
                      <dd>{placement.latestMaleWeightDate ?? placement.latestFemaleWeightDate ?? "No scale data yet"}</dd>
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
        })}
      </div>

      {filteredPlacements.length === 0 ? (
        <div className="helper-banner" style={{ marginTop: 18 }}>
          No active placements match the current filter set.
        </div>
      ) : null}
    </section>
  );
}
