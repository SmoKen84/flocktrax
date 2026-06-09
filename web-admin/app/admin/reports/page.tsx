import Link from "next/link";

import { ReportsFilterPanel } from "@/app/admin/reports/reports-filter-panel";
import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";

type ReportsHubPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const reportCategories = [
  {
    key: "feed_reports",
    label: "Feed Reports",
    reports: [{ key: "ten_day_feed_requirements", label: "10-Day Feed Requirements" }],
  },
];

export default async function ReportsHubPage({ searchParams }: ReportsHubPageProps) {
  const params = (await searchParams) ?? {};
  const categoryKey = firstParam(params.category) ?? "feed_reports";
  const reportKey = firstParam(params.report) ?? "ten_day_feed_requirements";
  const farmId = firstParam(params.farmId) ?? "";
  const barnId = firstParam(params.barnId) ?? "";
  const flockCode = firstParam(params.flockCode) ?? "";

  const adminData = await getAdminData();
  const activeFarms = dedupeBy(
    adminData.activePlacements.map((placement) => ({
      id: placement.farmId,
      name: placement.farmName,
    })),
    (entry) => entry.id,
  ).sort((left, right) => left.name.localeCompare(right.name));

  const activeBarns = dedupeBy(
    adminData.activePlacements.map((placement) => ({
      id: placement.barnId,
      farmId: placement.farmId,
      label: `${placement.barnCode} · ${placement.farmName}`,
    })),
    (entry) => entry.id,
  ).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));

  const activeFlocks = dedupeBy(
    adminData.activePlacements.map((placement) => ({
      id: placement.placementId || placement.id,
      farmId: placement.farmId,
      barnId: placement.barnId,
      value: placement.placementCode,
      label: `${placement.placementCode} · ${placement.barnCode} · ${placement.farmName}`,
    })),
    (entry) => entry.id,
  ).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));

  const selectedCategory =
    reportCategories.find((category) => category.key === categoryKey) ?? reportCategories[0];
  const selectedReport =
    selectedCategory.reports.find((report) => report.key === reportKey) ?? selectedCategory.reports[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Operations Console"
        title="Reports"
        body="Operational reports and filters"
        actions={
          <Link className="button-secondary" href="/admin/overview">
            <span aria-hidden="true">←</span>
            <span>Back</span>
          </Link>
        }
      />

      <section className="reports-hub-shell">
        <div className="reports-hub-category-card panel card">
          <div className="reports-hub-section-header">
            <div>
              <p className="eyebrow">Select Report Category</p>
            </div>
          </div>

          <div className="reports-hub-category-grid">
            {reportCategories.map((category) => {
              const isSelected = category.key === selectedCategory.key;
              const categoryHref = buildReportsHubHref({
                category: category.key,
                report: category.reports[0]?.key ?? "",
                farmId,
                barnId,
                flockCode,
              });

              return (
                <Link
                  className="reports-hub-link"
                  data-active={isSelected}
                  href={categoryHref}
                  key={category.key}
                  scroll={false}
                >
                  {category.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="reports-hub-grid">
          <section className="reports-hub-list-card panel card">
            <div className="reports-hub-section-header">
              <div>
                <p className="eyebrow">Report List</p>
                <h2>{selectedCategory.label}</h2>
              </div>
            </div>

            <div className="reports-hub-report-list">
              {selectedCategory.reports.map((report) => {
                const href = buildReportsHubHref({
                  category: selectedCategory.key,
                  report: report.key,
                  farmId,
                  barnId,
                  flockCode,
                });

                return (
                  <Link
                    className="reports-hub-link"
                    data-active={selectedReport?.key === report.key}
                    href={href}
                    key={report.key}
                    scroll={false}
                  >
                    {report.label}
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="reports-hub-filter-card panel card">
            <div className="reports-hub-section-header">
              <div>
                <p className="eyebrow">Filters</p>
                <h2>{selectedReport?.label ?? "Report Filters"}</h2>
              </div>
            </div>

            {selectedReport?.key === "ten_day_feed_requirements" ? (
              <ReportsFilterPanel
                barns={activeBarns}
                categoryKey={selectedCategory.key}
                currentBarnId={barnId}
                currentFarmId={farmId}
                currentFlockCode={flockCode}
                farms={activeFarms}
                flocks={activeFlocks}
                reportKey={selectedReport.key}
              />
            ) : null}
          </section>
        </div>
      </section>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildReportsHubHref({
  category,
  report,
  farmId,
  barnId,
  flockCode,
}: {
  category: string;
  report: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (report) params.set("report", report);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  const query = params.toString();
  return query ? `/admin/reports?${query}` : "/admin/reports";
}

function dedupeBy<T>(rows: T[], getKey: (row: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const row of rows) {
    const key = getKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}
