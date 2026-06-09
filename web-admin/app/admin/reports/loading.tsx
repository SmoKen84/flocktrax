import { PageHeader } from "@/components/page-header";

export default function ReportsLoading() {
  return (
    <>
      <PageHeader
        eyebrow="Operations Console"
        title="Reports"
        body="Operational reports and filters"
      />

      <section className="reports-hub-shell" aria-busy="true">
        <div className="reports-hub-category-card panel card reports-loading-card">
          <div className="reports-loading-line reports-loading-line--title" />
          <div className="reports-loading-pill-row">
            <div className="reports-loading-pill" />
          </div>
        </div>

        <div className="reports-hub-grid">
          <section className="reports-hub-list-card panel card reports-loading-card">
            <div className="reports-loading-line reports-loading-line--title" />
            <div className="reports-loading-stack">
              <div className="reports-loading-line" />
              <div className="reports-loading-line" />
            </div>
          </section>

          <section className="reports-hub-filter-card panel card reports-loading-card">
            <div className="reports-loading-line reports-loading-line--title" />
            <div className="reports-loading-stack">
              <div className="reports-loading-input" />
              <div className="reports-loading-input" />
              <div className="reports-loading-input" />
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
