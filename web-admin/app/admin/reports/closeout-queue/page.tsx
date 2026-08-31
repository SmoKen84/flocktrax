import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { PageHeader } from "@/components/page-header";
import {
  formatQueueStage,
  getCloseoutQueueReportData,
} from "@/lib/closeout-queue-report-data";
import { canAccessFarmManagerReport, getPlacementEditorActorAccess } from "@/lib/placement-editor-access";

export const metadata: Metadata = {
  title: "Closeout Queue Status | FlockTrax Admin",
};

type CloseoutQueueReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CloseoutQueueReportPage({ searchParams }: CloseoutQueueReportPageProps) {
  const params = (await searchParams) ?? {};
  const actor = await getPlacementEditorActorAccess();
  if (!canAccessFarmManagerReport(actor)) {
    redirect("/admin/reports");
  }

  const filters = {
    farmGroupId: firstParam(params.farmGroupId),
    farmId: firstParam(params.farmId),
    barnId: firstParam(params.barnId),
    flockCode: firstParam(params.flockCode),
    startDate: firstParam(params.startDate),
    endDate: firstParam(params.endDate),
    sortOrder: firstParam(params.sortOrder),
  };
  const returnTo = firstParam(params.returnTo) === "closeout" ? "closeout" : "reports";
  const report = await getCloseoutQueueReportData(actor, filters);
  const closeHref = returnTo === "closeout" ? "/admin/flock-closeout" : buildReportsHref(report.filters);
  const farmGroupNames = [...new Set(report.rows.map((row) => row.farmGroupName).filter(Boolean))];
  const farmGroupLabel = farmGroupNames.length > 0 ? farmGroupNames.join(", ") : "No matching farm group";

  return (
    <div className="closeout-queue-report-page">
      <PageHeader
        eyebrow="Reports"
        title="Closeout Queue Status"
        body="Current queue position and closeout milestone status for placements awaiting final closeout or settlement."
        actions={
          <>
            <FeedProjectionReportActions />
            <Link className="button-secondary" href={closeHref}>
              Close Report
            </Link>
          </>
        }
      />

      <section className="panel card closeout-queue-report-shell">
        <div className="closeout-queue-report-summary-grid">
          <SummaryCard label="Queue Total" value={report.totals.all} />
          <SummaryCard label="Waiting" value={report.totals.waiting} />
          <SummaryCard label="Submitted" value={report.totals.submitted} />
          <SummaryCard label="Settlement Received" value={report.totals.settlementReceived} />
        </div>

        <div className="closeout-queue-report-meta">
          <div><span>Farm Group</span><strong>{farmGroupLabel}</strong></div>
          <div><span>Date Range</span><strong>{formatRange(report.filters.startDate, report.filters.endDate)}</strong></div>
          <div><span>Sort</span><strong>{formatSort(report.filters.sortOrder)}</strong></div>
          <div><span>Generated</span><strong>{formatTimestamp(new Date())}</strong></div>
        </div>

        <div className="closeout-queue-report-table-wrap">
          <table className="closeout-queue-report-table">
            <thead>
              <tr>
                <th>Removed</th>
                <th>Farm</th>
                <th>Barn</th>
                <th className="closeout-queue-report-flock">Flock</th>
                <th>Queue Status</th>
                <th>Current Closeout State</th>
                <th>Progress</th>
                <th>LH</th>
                <th>Feed</th>
                <th>Inv</th>
                <th>Sent</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.length > 0 ? report.rows.map((row) => (
                <tr key={row.placementId}>
                  <td>{formatDate(row.removedDate)}</td>
                  <td>{row.farmName}</td>
                  <td>{row.barnCode}</td>
                  <td className="closeout-queue-report-flock">
                    <Link className="closeout-queue-report-placement" href={`/admin/flock-closeout/${row.placementId}`}>
                      {row.placementCode}
                    </Link>
                  </td>
                  <td><span className="status-pill" data-tone={row.lifecycleStage === "waiting_closeout" ? "warn" : "good"}>{formatQueueStage(row)}</span></td>
                  <td><strong>{row.workflowState}</strong></td>
                  <td>{`${row.completedMilestones} of ${row.totalMilestones}`}</td>
                  <td>{renderMilestone(row.queueTasks.livehaulComplete)}</td>
                  <td>{renderMilestone(row.queueTasks.feedVerified)}</td>
                  <td>{renderMilestone(row.queueTasks.invoiceCreated)}</td>
                  <td>{renderMilestone(row.queueTasks.submitted)}</td>
                  <td>{renderMilestone(row.queueTasks.settlementReceived)}</td>
                </tr>
              )) : (
                <tr><td className="closeout-queue-report-empty" colSpan={12}>No closeout queue placements match the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="closeout-queue-report-legend">
          <strong>Milestones:</strong>
          <span>LH = Livehaul Complete</span>
          <span>Feed = Feed Verified</span>
          <span>Inv = Invoice Created</span>
          <span>Sent = Closeout Submitted</span>
          <span>Paid = Settlement Received</span>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <article><span>{label}</span><strong>{value.toLocaleString()}</strong></article>;
}

function renderMilestone(complete: boolean) {
  return <span className="closeout-queue-report-mark" data-complete={complete ? "true" : "false"}>{complete ? "Yes" : "--"}</span>;
}

function formatDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

function formatRange(startDate: string, endDate: string) {
  if (!startDate && !endDate) return "All queue removal dates";
  return `${formatDate(startDate || null)} through ${formatDate(endDate || null)}`;
}

function formatSort(value: string) {
  if (value === "placement") return "Flock / Placement";
  if (value === "state") return "Current Closeout State";
  return "Removal Date";
}

function formatTimestamp(value: Date) {
  return value.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildReportsHref(filters: {
  farmGroupId: string;
  farmId: string;
  barnId: string;
  flockCode: string;
  startDate: string;
  endDate: string;
  sortOrder: string;
}) {
  const params = new URLSearchParams({ category: "closeout_reports", report: "closeout_queue_status" });
  if (filters.farmGroupId) params.set("farmGroupId", filters.farmGroupId);
  if (filters.farmId) params.set("farmId", filters.farmId);
  if (filters.barnId) params.set("barnId", filters.barnId);
  if (filters.flockCode) params.set("flockCode", filters.flockCode);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);
  return `/admin/reports?${params.toString()}`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
