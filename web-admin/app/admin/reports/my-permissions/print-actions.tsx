"use client";

export function PermissionsPrintActions() {
  return <div className="feed-ticket-report-screen-actions">
    <button className="button" type="button" onClick={() => window.print()}>Print / Save PDF</button>
  </div>;
}
