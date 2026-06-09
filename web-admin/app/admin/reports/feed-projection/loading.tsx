import { PageHeader } from "@/components/page-header";

export default function FeedProjectionLoading() {
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="10 Day Feed Projection"
        body="Matrix view of projected daily feed demand for live barns plus scheduled placements that come on board inside the next 10 days."
      />

      <section className="panel card feed-projection-report-shell" aria-busy="true">
        <div className="feed-projection-report-summary-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <article className="feed-projection-report-summary-card reports-loading-card" key={index}>
              <div className="reports-loading-line" />
              <div className="reports-loading-line reports-loading-line--title" />
            </article>
          ))}
        </div>

        <div className="feed-projection-report-meta-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="reports-loading-card" key={index}>
              <div className="reports-loading-line" />
              <div className="reports-loading-line reports-loading-line--title" />
            </div>
          ))}
        </div>

        <div className="feed-projection-report-totals-strip">
          {Array.from({ length: 10 }).map((_, index) => (
            <div className="feed-projection-report-totals-pill reports-loading-card" key={index}>
              <div className="reports-loading-line" />
              <div className="reports-loading-line reports-loading-line--title" />
            </div>
          ))}
        </div>

        <div className="feed-projection-report-table-wrap reports-loading-card">
          <div className="reports-loading-table">
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <div className="reports-loading-table-row" key={rowIndex}>
                {Array.from({ length: 8 }).map((__, cellIndex) => (
                  <div className="reports-loading-table-cell" key={cellIndex} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
