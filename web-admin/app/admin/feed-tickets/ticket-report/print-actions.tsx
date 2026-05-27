"use client";

export function FeedTicketPrintActions() {
  return (
    <div className="feed-ticket-print-screen-actions">
      <button className="button" onClick={() => window.print()} type="button">
        Print Ticket
      </button>
      <button className="button-secondary" onClick={() => window.close()} type="button">
        Close Window
      </button>
    </div>
  );
}
