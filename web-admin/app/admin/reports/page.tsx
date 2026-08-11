import Link from "next/link";

import { ReportsFilterPanel } from "@/app/admin/reports/reports-filter-panel";
import { PageHeader } from "@/components/page-header";
import { getAdminData } from "@/lib/admin-data";
import { buildCloseoutQueueReportFilterOptions, getScopedCloseoutQueueItems } from "@/lib/closeout-queue-report-data";
import { getFeedDropsReportFilterOptions } from "@/lib/feed-drops-report-data";
import { getMortalityReportFilterOptions } from "@/lib/mortality-report-data";
import { canAccessFarmManagerReport, getPlacementEditorActorAccess } from "@/lib/placement-editor-access";
import { getQueuedFeedDeliveriesFilterOptions } from "@/lib/queued-feed-deliveries-report-data";

type ReportsHubPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ReportOption = { key: string; label: string; minimumRank?: number };
type ReportCategory = { key: string; label: string; reports: ReportOption[] };

const reportCategories: ReportCategory[] = [
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
    key: "closeout_reports",
    label: "Closeout Reports",
    reports: [
      { key: "closeout_queue_status", label: "Closeout Queue Status", minimumRank: 200 },
    ],
  },
  {
    key: "feed_reports",
    label: "Feed Reports",
    reports: [
      { key: "ten_day_feed_requirements", label: "10-Day Feed Requirements" },
      { key: "custom_feed_projection", label: "Feed Projection (Custom Days)" },
      { key: "feed_drops_report", label: "BinSentryAPI-Drops" },
      { key: "queued_feed_deliveries", label: "Queued Feed Deliveries Not Received" },
    ],
  },
];

export default async function ReportsHubPage({ searchParams }: ReportsHubPageProps) {
  const params = (await searchParams) ?? {};
  const requestedCategoryKey = firstParam(params.category) ?? "quick_access_reports";
  const requestedReportKey = firstParam(params.report) ?? "at_a_glance";
  const returnTo = firstParam(params.returnTo) === "closeout" ? "closeout" : "";
  const actor = await getPlacementEditorActorAccess();
  const canViewCloseoutReport = canAccessFarmManagerReport(actor);
  const availableCategories = reportCategories
    .map((category) => ({
      ...category,
      reports: category.reports.filter((report) => !report.minimumRank || canViewCloseoutReport),
    }))
    .filter((category) => category.reports.length > 0);
  const selectedCategory =
    availableCategories.find((category) => category.key === requestedCategoryKey) ?? availableCategories[0];
  const selectedReport =
    selectedCategory.reports.find((report) => report.key === requestedReportKey) ?? selectedCategory.reports[0] ?? null;
  const categoryKey = selectedCategory.key;
  const reportKey = selectedReport?.key ?? "at_a_glance";
  const farmGroupId = firstParam(params.farmGroupId) ?? "";
  const farmId = firstParam(params.farmId) ?? "";
  const barnId = firstParam(params.barnId) ?? "";
  const flockCode = firstParam(params.flockCode) ?? "";
  const days = firstParam(params.days) ?? "14";
  const includeBinSentryOnOrderParam = firstParam(params.includeBinSentryOnOrder);
  const requestedSortOrder = firstParam(params.sortOrder) ?? "date";
  const sortOrder = reportKey === "closeout_queue_status" && !["date", "placement", "state"].includes(requestedSortOrder)
    ? "date"
    : requestedSortOrder;
  const useDefaultTypeDensity = firstParam(params.useDefaultTypeDensity) === "1";
  const includeRollupSummary = firstParam(params.includeRollupSummary) === "1";
  const feedMill = firstParam(params.feedMill) ?? "";
  const includeBinSentryOnOrder =
    includeBinSentryOnOrderParam === null
      ? reportKey === "ten_day_feed_requirements" || reportKey === "custom_feed_projection"
      : includeBinSentryOnOrderParam === "1";
  const reportDate = firstParam(params.reportDate) ?? new Date().toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const reportStartDate =
    firstParam(params.startDate) ??
    (reportKey === "closeout_queue_status"
      ? ""
      : categoryKey === "quick_access_reports"
      ? today
      : `${today.slice(0, 7)}-01`);
  const reportEndDate =
    firstParam(params.endDate) ??
    (reportKey === "closeout_queue_status"
      ? ""
      : categoryKey === "quick_access_reports"
      ? addDays(today, 30)
      : today);

  const [adminData, mortalityFilterOptions, feedDropsFilterOptions, queuedFeedFilterOptions, closeoutQueueItems] = await Promise.all([
    getAdminData(),
    reportKey === "detailed_mortality_report"
      ? getMortalityReportFilterOptions()
      : Promise.resolve(null),
    reportKey === "feed_drops_report"
      ? getFeedDropsReportFilterOptions()
      : Promise.resolve(null),
    reportKey === "queued_feed_deliveries"
      ? getQueuedFeedDeliveriesFilterOptions()
      : Promise.resolve(null),
    reportKey === "closeout_queue_status"
      ? getScopedCloseoutQueueItems(actor)
      : Promise.resolve(null),
  ]);
  const closeoutFilterOptions = closeoutQueueItems ? buildCloseoutQueueReportFilterOptions(closeoutQueueItems) : null;
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
  const filterFarmGroups = closeoutFilterOptions?.farmGroups ?? queuedFeedFilterOptions?.farmGroups ?? feedDropsFilterOptions?.farmGroups ?? mortalityFilterOptions?.farmGroups ?? activeFarmGroups;
  const filterFarms = closeoutFilterOptions?.farms ?? queuedFeedFilterOptions?.farms ?? feedDropsFilterOptions?.farms ?? mortalityFilterOptions?.farms ?? activeFarms;
  const filterBarns = closeoutFilterOptions?.barns ?? queuedFeedFilterOptions?.barns ?? feedDropsFilterOptions?.barns ?? mortalityFilterOptions?.barns ?? activeBarns;
  const filterFlocks = closeoutFilterOptions?.flocks ?? queuedFeedFilterOptions?.flocks ?? feedDropsFilterOptions?.flocks ?? mortalityFilterOptions?.flocks ?? activeFlocks;
  const filterFeedMills = queuedFeedFilterOptions?.feedMills ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Operations Console"
        title="Reports"
        body="Operational reports and filters"
        actions={
          <Link className="button-secondary" href={returnTo === "closeout" ? "/admin/flock-closeout" : "/admin/overview"}>
            <span aria-hidden="true">←</span>
            <span>{returnTo === "closeout" ? "Return To Closeout Queue" : "Back"}</span>
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
            {availableCategories.map((category) => {
              const isSelected = category.key === selectedCategory.key;
              const isCloseoutCategory = category.key === "closeout_reports";
              const categoryHref = buildReportsHubHref({
                category: category.key,
                report: category.reports[0]?.key ?? "",
                farmGroupId,
                farmId,
                barnId,
                flockCode,
                startDate: isCloseoutCategory ? "" : reportStartDate,
                endDate: isCloseoutCategory ? "" : reportEndDate,
                sortOrder: isCloseoutCategory ? "date" : sortOrder,
                useDefaultTypeDensity: isCloseoutCategory ? false : useDefaultTypeDensity,
                includeRollupSummary: isCloseoutCategory ? false : includeRollupSummary,
                feedMill,
                includeBinSentryOnOrder,
                returnTo,
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
                  sortOrder,
                  useDefaultTypeDensity,
                  includeRollupSummary,
                  feedMill,
                  includeBinSentryOnOrder,
                  returnTo,
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
            selectedReport?.key === "detailed_mortality_report" ||
            selectedReport?.key === "closeout_queue_status" ||
            selectedReport?.key === "feed_drops_report" ||
            selectedReport?.key === "queued_feed_deliveries" ? (
              <ReportsFilterPanel
                barns={filterBarns}
                categoryKey={selectedCategory.key}
                currentBarnId={barnId}
                currentDays={days}
                currentFarmGroupId={farmGroupId}
                currentFarmId={farmId}
                currentFeedMill={feedMill}
                currentFlockCode={flockCode}
                currentIncludeBinSentryOnOrder={includeBinSentryOnOrder}
                currentReportDate={reportDate}
                currentSortOrder={sortOrder}
                currentUseDefaultTypeDensity={useDefaultTypeDensity}
                currentIncludeRollupSummary={includeRollupSummary}
                currentStartDate={reportStartDate}
                currentEndDate={reportEndDate}
                farmGroups={filterFarmGroups}
                farms={filterFarms}
                feedMills={filterFeedMills}
                flocks={filterFlocks}
                key={selectedReport.key}
                reportKey={selectedReport.key}
                returnTo={returnTo}
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
  sortOrder,
  useDefaultTypeDensity,
  includeRollupSummary,
  feedMill,
  includeBinSentryOnOrder,
  returnTo,
}: {
  category: string;
  report: string;
  farmGroupId?: string;
  farmId?: string;
  barnId?: string;
  flockCode?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: string;
  useDefaultTypeDensity?: boolean;
  includeRollupSummary?: boolean;
  feedMill?: string;
  includeBinSentryOnOrder?: boolean;
  returnTo?: string;
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
  if (sortOrder) params.set("sortOrder", sortOrder);
  if (useDefaultTypeDensity) params.set("useDefaultTypeDensity", "1");
  if (includeRollupSummary) params.set("includeRollupSummary", "1");
  if (feedMill) params.set("feedMill", feedMill);
  if (includeBinSentryOnOrder) params.set("includeBinSentryOnOrder", "1");
  if (returnTo === "closeout") params.set("returnTo", "closeout");
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
