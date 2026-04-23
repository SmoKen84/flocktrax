"use client";

import { useMemo, useState } from "react";

import { schedulePlacementAction } from "@/app/admin/placements/new/actions";

type SchedulePlacementFormProps = {
  barnCode: string | null;
  defaultGrowOutDays: number;
  farmId: string;
  month: string;
  selectedBarnId: string;
  selectedDate: string;
};

export function SchedulePlacementForm({
  barnCode,
  defaultGrowOutDays,
  farmId,
  month,
  selectedBarnId,
  selectedDate,
}: SchedulePlacementFormProps) {
  const [growOutDays, setGrowOutDays] = useState(String(defaultGrowOutDays));

  const projectedEndDate = useMemo(() => {
    const parsed = Number.parseInt(growOutDays, 10);
    const safeDays = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultGrowOutDays;
    return addDays(selectedDate, safeDays);
  }, [defaultGrowOutDays, growOutDays, selectedDate]);

  return (
    <form action={schedulePlacementAction} className="placement-scheduler-form">
      <input name="farm_id" type="hidden" value={farmId} />
      <input name="barn_id" type="hidden" value={selectedBarnId} />
      <input name="selected_date" type="hidden" value={selectedDate} />
      <input name="month" type="hidden" value={month} />

      <div className="helper-banner">
        {`Selected ${selectedDate} for barn ${barnCode ?? "the selected barn"}. This will create a new flock record and a linked placement together.`}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Flock Number</span>
          <input name="flock_number" placeholder="Enter integrator flock number" required />
        </label>
        <label className="field">
          <span>Grow-out Days</span>
          <input
            min="1"
            name="grow_out_days"
            onChange={(event) => setGrowOutDays(event.target.value)}
            type="number"
            value={growOutDays}
          />
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
        <strong>{`${selectedDate} through ${projectedEndDate}`}</strong>
        <p>{`This window will be blocked on the barn calendar using the current grow-out duration of ${growOutDays || defaultGrowOutDays} days.`}</p>
      </div>

      <button className="button" type="submit">
        Schedule Placement
      </button>
    </form>
  );
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
