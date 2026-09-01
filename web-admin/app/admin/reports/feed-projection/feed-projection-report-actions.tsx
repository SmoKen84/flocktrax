"use client";

export function FeedProjectionReportActions() {
  const printReport = () => {
    window.dispatchEvent(new Event("flocktrax:prepare-feed-projection-print"));
    window.print();
  };

  return (
    <div className="feed-ticket-report-screen-actions">
      <button className="button" onClick={printReport} type="button">
        Print / Save PDF
      </button>
      <button className="button-secondary" onClick={() => window.close()} type="button">
        Close Window
      </button>
    </div>
  );
}
