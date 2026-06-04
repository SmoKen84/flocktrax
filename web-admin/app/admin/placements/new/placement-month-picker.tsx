"use client";

import { startTransition, useRef } from "react";
import { useRouter } from "next/navigation";

type PlacementMonthPickerProps = {
  barnId?: string | null;
  date?: string | null;
  farmId?: string | null;
  mode: "blocked" | "placements";
  month: string;
  placementId?: string | null;
};

type MonthInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

export function PlacementMonthPicker({
  barnId,
  date,
  farmId,
  mode,
  month,
  placementId,
}: PlacementMonthPickerProps) {
  const inputRef = useRef<MonthInputWithPicker>(null);
  const router = useRouter();

  const navigateToMonth = (nextMonth: string) => {
    const query = new URLSearchParams();
    query.set("mode", mode);
    if (farmId) query.set("farm", farmId);
    if (barnId) query.set("barn", barnId);
    if (date) query.set("date", date);
    if (nextMonth) query.set("month", nextMonth);
    if (placementId) query.set("placement", placementId);
    const search = query.toString();
    startTransition(() => {
      router.push(search ? `/admin/placements/new?${search}` : "/admin/placements/new");
    });
  };

  return (
    <div className="livehaul-month-picker-form">
      <input
        aria-label="Choose calendar month"
        className="livehaul-month-picker-input"
        defaultValue={month}
        onChange={(event) => navigateToMonth(event.target.value)}
        ref={inputRef}
        type="month"
      />
      <button
        aria-label="Choose month"
        className="livehaul-month-picker-trigger"
        onClick={() => {
          inputRef.current?.showPicker?.();
          inputRef.current?.click();
          inputRef.current?.focus();
        }}
        type="button"
      >
        <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
          <path
            d="M8 2v3M16 2v3M3.5 9.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7A1.5 1.5 0 0 1 5 5.5Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
      </button>
    </div>
  );
}
