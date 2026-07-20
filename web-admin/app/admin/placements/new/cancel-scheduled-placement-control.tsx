"use client";

import { useEffect, useState } from "react";

type CancellationTarget = {
  id: string;
  placementCode: string;
  farmName: string;
  barnCode: string;
  startDate: string;
};

type CancelScheduledPlacementControlProps = {
  action: (formData: FormData) => Promise<void>;
  feedDropCount: number;
  feedDropLbs: number;
  feedOrderCount: number;
  feedOrderLbs: number;
  placementCode: string;
  suggestedTargetId: string | null;
  targets: CancellationTarget[];
};

export function CancelScheduledPlacementControl({
  action,
  feedDropCount,
  feedDropLbs,
  feedOrderCount,
  feedOrderLbs,
  placementCode,
  suggestedTargetId,
  targets,
}: CancelScheduledPlacementControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasFeed = feedDropCount > 0 || feedOrderCount > 0;

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button className="button button-ghost placement-cancel-open" onClick={() => setIsOpen(true)} type="button">
        Cancel Scheduled Flock
      </button>

      {isOpen ? (
        <div aria-modal="true" className="placement-cancel-shell" role="dialog">
          <div className="placement-cancel-panel">
            <div className="placement-cancel-header">
              <div>
                <p className="eyebrow">Cancel Placement</p>
                <h3>{placementCode}</h3>
              </div>
              <button aria-label="Close cancellation popup" className="button-ghost" onClick={() => setIsOpen(false)} type="button">
                Close
              </button>
            </div>

            {hasFeed ? (
              <>
                <div className="placement-cancel-warning">
                  <strong>Feed is associated with this flock.</strong>
                  <p>
                    Choose the scheduled flock that should receive the feed before {placementCode} is canceled.
                    The selection is checked again when you confirm.
                  </p>
                </div>
                <div className="placement-cancel-feed-grid">
                  <div>
                    <span>Delivered / Queued</span>
                    <strong>{formatFeedSummary(feedDropCount, feedDropLbs)}</strong>
                  </div>
                  <div>
                    <span>Open Orders</span>
                    <strong>{formatFeedSummary(feedOrderCount, feedOrderLbs)}</strong>
                  </div>
                </div>
                {targets.length > 0 ? (
                  <label className="field">
                    <span>Move Feed To</span>
                    <select defaultValue={suggestedTargetId ?? ""} name="cancel_target_placement_id" required>
                      <option value="">Select destination flock</option>
                      {targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {`${target.placementCode} | ${target.farmName} | Barn ${target.barnCode} | ${formatDate(target.startDate)}${target.id === suggestedTargetId ? " | Suggested" : ""}`}
                        </option>
                      ))}
                    </select>
                    {suggestedTargetId ? (
                      <small>The nearest logical scheduled flock is suggested, but you control the final destination.</small>
                    ) : null}
                  </label>
                ) : (
                  <p className="placement-cancel-blocked">
                    No eligible destination flock is available. Add or correct the replacement schedule before canceling this flock.
                  </p>
                )}
              </>
            ) : (
              <div className="placement-cancel-clear">
                <strong>No feed is associated with {placementCode}.</strong>
                <p>The flock can be marked Canceled without moving any feed records.</p>
              </div>
            )}

            <div className="placement-cancel-actions">
              <button className="button-secondary" onClick={() => setIsOpen(false)} type="button">
                Keep Scheduled
              </button>
              <button className="button placement-cancel-confirm" disabled={hasFeed && targets.length === 0} formAction={action} type="submit">
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatFeedSummary(count: number, pounds: number) {
  if (count <= 0) return "None";
  return `${count} record${count === 1 ? "" : "s"} | ${Math.round(pounds).toLocaleString()} lbs`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${month}/${day}/${year}` : value;
}
