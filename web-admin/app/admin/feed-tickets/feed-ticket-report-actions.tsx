"use client";

export function FeedTicketReportActions() {
  return (
    <div className="feed-ticket-report-screen-actions">
      <button className="button" onClick={() => window.print()} type="button">
        Print Report
      </button>
      <button className="button-secondary" onClick={() => window.close()} type="button">
        Close Window
      </button>
    </div>
  );
}

