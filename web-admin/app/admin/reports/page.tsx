import Link from "next/link";

import { ReportsFilterPanel } from "@/app/admin/reports/reports-filter-panel";
import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";
import { getMortalityReportFilterOptions } from "@/lib/mortality-report-data";

type ReportsHubPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const reportCategories = [
  {
    key: "quick_access_reports",
    label: "Quick Access Reports",
    reports: [
      { key: "at_a_glance", label: "At-a-Glance" },
      { key: "quick_placements_report", label: "Placements Report" },
      { key: "quick_livehaul_report", label: "Livehaul Report" },
    ],
  },
  {
    key: "detailed_reports",
    label: "Detailed Reports",
    reports: [
      { key: "detailed_placements_report", label: "Placements Report" },
      { key: "detailed_livehaul_report", label: "Livehaul Report" },
      { key: "detailed_mortality_report", label: "Mortality" },
    ],
  },
  {
    key: "feed_reports",
    label: "Feed Reports",
    reports: [
      { key: "ten_day_feed_requirements", label: "10-Day Feed Requirements" },
      { key: "custom_feed_projection", label: "Feed Projection (Custom Days)" },
    ],
  },
];

export default async function ReportsHubPage({ searchParams }: ReportsHubPageProps) {
  const params = (await searchParams) ?? {};
  const categoryKey = firstParam(params.category) ?? "quick_access_reports";
  const reportKey = firstParam(params.report) ?? "at_a_glance";
  const farmGroupId = firstParam(params.farmGroupId) ?? "";
  const farmId = firstParam(params.farmId) ?? "";
  const barnId = firstParam(params.barnId) ?? "";
  const flockCode = firstParam(params.flockCode) ?? "";
  const days = firstParam(params.days) ?? "14";
  const includeBinSentryOnOrderParam = firstParam(params.includeBinSentryOnOrder);
  const includeBinSentryOnOrder =
    includeBinSentryOnOrderParam === null
      ? reportKey === "ten_day_feed_requirements" || reportKey === "custom_feed_projection"
      : includeBinSentryOnOrderParam === "1";
  const reportDate = firstParam(params.reportDate) ?? new Date().toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const reportStartDate =
    firstParam(params.startDate) ??
    (categoryKey === "quick_access_reports"
      ? today
      : `${today.slice(0, 7)}-01`);
  const reportEndDate =
    firstParam(params.endDate) ??
    (categoryKey === "quick_access_reports"
      ? addDays(today, 30)
      : today);

  const [adminData, mortalityFilterOptions] = await Promise.all([
    getAdminData(),
    reportKey === "detailed_mortality_report"
      ? getMortalityReportFilterOptions()
      : Promise.resolve(null),
  ]);
  const activeFarmGroups = dedupeBy(
    adminData.activePlacements.map((placement) => ({
      id: placement.farmGroupId,
      name: placement.farmGroupName,
    })),
    (entry) => entry.id,
  ).sort((left, right) => left.name.localeCompare(right.name));

  const activeFarms = dedupeBy(
    adminData.activePlacements.map((placement) => ({
      id: placement.farmId,
      farmGroupId: placement.farmGroupId,
      name: placement.farmName,
    })),
    (entry) => entry.id,
  ).sort((left, right) => left.name.localeCompare(right.name));

  const activeBarns = dedupeBy(
    adminData.activePlacements.map((placement) => ({
      id: placement.barnId,
      farmGroupId: placement.farmGroupId,
      farmId: placement.farmId,
      label: `${placement.barnCode} · ${placement.farmName}`,
    })),
    (entry) => entry.id,
  ).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));

  const activeFlocks = dedupeBy(
    adminData.activePlacements.map((placement) => ({
      id: placement.placementId || placement.id,
      farmGroupId: placement.farmGroupId,
      farmId: placement.farmId,
      barnId: placement.barnId,
      value: placement.placementCode,
      label: `${placement.placementCode} · ${placement.barnCode} · ${placement.farmName}`,
    })),
    (entry) => entry.id,
  ).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
  const filterFarmGroups = mortalityFilterOptions?.farmGroups ?? activeFarmGroups;
  const filterFarms = mortalityFilterOptions?.farms ?? activeFarms;
  const filterBarns = mortalityFilterOptions?.barns ?? activeBarns;
  const filterFlocks = mortalityFilterOptions?.flocks ?? activeFlocks;

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
                farmGroupId,
                farmId,
                barnId,
                flockCode,
                startDate: reportStartDate,
                endDate: reportEndDate,
                includeBinSentryOnOrder,
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
                  farmGroupId,
                  farmId,
                  barnId,
                  flockCode,
                  startDate: reportStartDate,
                  endDate: reportEndDate,
                  includeBinSentryOnOrder,
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

            {selectedReport?.key === "ten_day_feed_requirements" ||
            selectedReport?.key === "custom_feed_projection" ||
            selectedReport?.key === "at_a_glance" ||
            selectedReport?.key === "quick_placements_report" ||
            selectedReport?.key === "quick_livehaul_report" ||
            selectedReport?.key === "detailed_placements_report" ||
            selectedReport?.key === "detailed_livehaul_report" ||
            selectedReport?.key === "detailed_mortality_report" ? (
              <ReportsFilterPanel
                barns={filterBarns}
                categoryKey={selectedCategory.key}
                currentBarnId={barnId}
                currentDays={days}
                currentFarmGroupId={farmGroupId}
                currentFarmId={farmId}
                currentFlockCode={flockCode}
                currentIncludeBinSentryOnOrder={includeBinSentryOnOrder}
                currentReportDate={reportDate}
                currentStartDate={reportStartDate}
                currentEndDate={reportEndDate}
                farmGroups={filterFarmGroups}
                farms={filterFarms}
                flocks={filterFlocks}
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

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildReportsHubHref({
  category,
  report,
  farmGroupId,
  farmId,
  barnId,
  flockCode,
  startDate,
  endDate,
  includeBinSentryOnOrder,
}: {
  category: string;
  report: string;
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
  startDate?: string;
  endDate?: string;
  includeBinSentryOnOrder?: boolean;
}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (report) params.set("report", report);
  if (farmGroupId) params.set("farmGroupId", farmGroupId);
  if (farmId) params.set("farmId", farmId);
  if (barnId) params.set("barnId", barnId);
  if (flockCode) params.set("flockCode", flockCode);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (includeBinSentryOnOrder) params.set("includeBinSentryOnOrder", "1");
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
