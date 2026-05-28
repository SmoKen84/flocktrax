import { ActionItemsReportActions } from "@/app/admin/issues/action-items-report-actions";
import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { getUserAccessBundle } from "@/lib/access-control";
import { getAdminData } from "@/lib/admin-data";
import { getDefaultIssueTypes, getIssueLabel, type IssueTypeRecord } from "@/lib/issues";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ActionItemsReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type IssueStatus = "open" | "resolved";
type IssueSortKey = "date_opened" | "farm_barn" | "title" | "status";

type IssueRow = {
  id: string;
  entity_type: "barn" | "placement";
  entity_id: string;
  issue_type: string | null;
  title: string | null;
  description: string | null;
  status: IssueStatus;
  related_placement_id: string | null;
  reported_log_date: string | null;
  opened_at: string | null;
  opened_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
};

type IssueTypeRow = {
  code: string;
  label: string;
  entity_type: "barn" | "placement";
  is_active: boolean | null;
  sort_order: number | null;
  severity_default: string | null;
  report_group: string | null;
};

type IssueUpdateRow = {
  id: string;
  issue_id: string;
  entry_type: string | null;
  entry_text: string | null;
  effective_date: string | null;
  created_at: string | null;
  created_by: string | null;
};

type EnrichedIssue = IssueRow & {
  typeDefinition: IssueTypeRecord | null;
  placementContext: (Awaited<ReturnType<typeof getAdminData>>)["activePlacements"][number] | null;
  updates: IssueUpdateRow[];
};

export default async function ActionItemsReportPage({ searchParams }: ActionItemsReportPageProps) {
  const params = (await searchParams) ?? {};
  const filters = {
    farmId: firstParam(params.farmId),
    barnId: firstParam(params.barnId),
    flockCode: firstParam(params.flockCode),
    issueType: firstParam(params.issueType),
    dateStart: firstParam(params.dateStart),
    dateEnd: firstParam(params.dateEnd),
    statuses: paramArray(params.status),
    sortBy: parseIssueSortKey(firstParam(params.sortBy)),
  };

  const adminClient = createSupabaseAdminClient();
  const [data, accessBundle] = await Promise.all([getAdminData(), getUserAccessBundle()]);

  if (!adminClient) {
    throw new Error("Admin action-items report could not connect to Supabase.");
  }

  const userDisplayNameById = new Map(accessBundle.users.map((user) => [user.id, user.displayName]));

  const [issuesResult, issueTypesResult, issueUpdatesResult] = await Promise.all([
    adminClient
      .from("issues")
      .select(
        "id,entity_type,entity_id,issue_type,title,description,status,related_placement_id,reported_log_date,opened_at,opened_by,resolved_at,resolution_note",
      )
      .order("opened_at", { ascending: false })
      .limit(1000),
    adminClient
      .from("issue_types")
      .select("code,label,entity_type,is_active,sort_order,severity_default,report_group")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminClient
      .from("issue_updates")
      .select("id,issue_id,entry_type,entry_text,effective_date,created_at,created_by")
      .order("created_at", { ascending: false })
      .limit(4000),
  ]);

  if (issuesResult.error) {
    throw new Error(issuesResult.error.message);
  }
  if (issueTypesResult.error && issueTypesResult.error.code !== "42P01") {
    throw new Error(issueTypesResult.error.message);
  }
  if (issueUpdatesResult.error && issueUpdatesResult.error.code !== "42P01") {
    throw new Error(issueUpdatesResult.error.message);
  }

  const issueTypeRows: IssueTypeRecord[] =
    issueTypesResult.data && issueTypesResult.data.length > 0
      ? (issueTypesResult.data as IssueTypeRow[]).map((row) => ({
          code: row.code,
          label: row.label,
          entityType: row.entity_type,
          isActive: row.is_active ?? true,
          sortOrder: row.sort_order,
          severityDefault: row.severity_default,
          reportGroup: row.report_group,
        }))
      : getDefaultIssueTypes();

  const issueTypeByCode = new Map(issueTypeRows.map((row) => [row.code, row]));
  const issueRows = (issuesResult.data ?? []) as IssueRow[];
  const issueUpdates = (issueUpdatesResult.data ?? []) as IssueUpdateRow[];
  const issueUpdatesByIssueId = new Map<string, IssueUpdateRow[]>();

  for (const update of issueUpdates) {
    const existing = issueUpdatesByIssueId.get(update.issue_id) ?? [];
    existing.push(update);
    issueUpdatesByIssueId.set(update.issue_id, existing);
  }

  const placements = [...data.activePlacements].sort((left, right) =>
    `${left.farmName} ${left.barnCode}`.localeCompare(`${right.farmName} ${right.barnCode}`),
  );
  const placementById = new Map(placements.map((placement) => [placement.placementId, placement]));
  const barnPlacementByBarnId = new Map<string, (typeof placements)[number]>();

  for (const placement of placements) {
    if (!barnPlacementByBarnId.has(placement.barnId)) {
      barnPlacementByBarnId.set(placement.barnId, placement);
    }
  }

  const allIssues: EnrichedIssue[] = issueRows.map((issue) => {
    const placementContext =
      issue.entity_type === "placement"
        ? placementById.get(issue.entity_id) ?? null
        : issue.related_placement_id
          ? placementById.get(issue.related_placement_id) ?? barnPlacementByBarnId.get(issue.entity_id) ?? null
          : barnPlacementByBarnId.get(issue.entity_id) ?? null;

    return {
      ...issue,
      typeDefinition: issueTypeByCode.get(issue.issue_type ?? "") ?? null,
      placementContext,
      updates: [...(issueUpdatesByIssueId.get(issue.id) ?? [])].sort(compareIssueUpdatesAscending),
    };
  });

  const filteredIssues = allIssues
    .filter((issue) => {
      const context = issue.placementContext;
      if (filters.farmId && context?.farmId !== filters.farmId) return false;
      if (filters.barnId && context?.barnId !== filters.barnId) return false;
      if (filters.flockCode) {
        const flockNeedle = filters.flockCode.toLowerCase();
        const flockText = `${context?.placementCode ?? ""} ${context?.flockCode ?? ""}`.toLowerCase();
        if (!flockText.includes(flockNeedle)) return false;
      }
      if (filters.issueType && issue.issue_type !== filters.issueType) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(issue.status)) return false;
      if (filters.dateStart && issue.reported_log_date && issue.reported_log_date < filters.dateStart) return false;
      if (filters.dateEnd && issue.reported_log_date && issue.reported_log_date > filters.dateEnd) return false;
      return true;
    })
    .sort((left, right) => compareIssuesForSort(left, right, filters.sortBy));

  const openCount = filteredIssues.filter((issue) => issue.status === "open").length;
  const resolvedCount = filteredIssues.filter((issue) => issue.status === "resolved").length;
  const generatedAt = new Date().toISOString();
  const scopeLabel = buildScopeLabel(filters, placements);

  return (
    <>
      <section className="action-items-report-page">
        <div className="action-items-report-masthead">
          <div className="action-items-report-brand">
            <p className="action-items-report-eyebrow">Operations</p>
            <FlockTraxWordmark compact product="Admin" tone="accent" />
            <h1 className="action-items-report-page-title">Action Items Report</h1>
          </div>
          <div className="action-items-report-screen-actions">
            <ActionItemsReportActions />
          </div>
        </div>

        <section className="action-items-report-shell">
        <div className="action-items-report-summary-grid">
          <div className="action-items-report-summary-card">
            <span>Total Items</span>
            <strong>{formatWhole(filteredIssues.length)}</strong>
          </div>
          <div className="action-items-report-summary-card">
            <span>Open</span>
            <strong>{formatWhole(openCount)}</strong>
          </div>
          <div className="action-items-report-summary-card">
            <span>Completed</span>
            <strong>{formatWhole(resolvedCount)}</strong>
          </div>
          <div className="action-items-report-summary-card">
            <span>Scope</span>
            <strong>{scopeLabel}</strong>
          </div>
          <div className="action-items-report-summary-card">
            <span>Generated</span>
            <strong>{formatTimestamp(generatedAt)}</strong>
          </div>
        </div>

        <div className="action-items-report-filter-table" role="table" aria-label="Applied filters">
          <div className="action-items-report-filter-row" role="row">
            <div className="action-items-report-filter-cell" role="cell">
              <span>Farm</span>
              <strong>{resolveFarmLabel(filters.farmId, placements) || "All farms"}</strong>
            </div>
            <div className="action-items-report-filter-cell" role="cell">
              <span>Barn</span>
              <strong>{resolveBarnLabel(filters.barnId, placements) || "All barns"}</strong>
            </div>
            <div className="action-items-report-filter-cell" role="cell">
              <span>Flock Code</span>
              <strong>{filters.flockCode || "All flocks"}</strong>
            </div>
            <div className="action-items-report-filter-cell" role="cell">
              <span>Action Type</span>
              <strong>{issueTypeByCode.get(filters.issueType ?? "")?.label || "All action types"}</strong>
            </div>
            <div className="action-items-report-filter-cell" role="cell">
              <span>Date Range</span>
              <strong>{formatDateRange(filters.dateStart, filters.dateEnd)}</strong>
            </div>
            <div className="action-items-report-filter-cell" role="cell">
              <span>Status</span>
              <strong>{formatStatusFilter(filters.statuses)}</strong>
            </div>
            <div className="action-items-report-filter-cell" role="cell">
              <span>Sort By</span>
              <strong>{getIssueSortLabel(filters.sortBy)}</strong>
            </div>
          </div>
        </div>

        <div className="action-items-report-sections">
          <section className="action-items-report-section">
            <div className="action-items-report-section-header">
              <h2>Filtered Action Items</h2>
              <p>{scopeLabel}</p>
            </div>

            {filteredIssues.length > 0 ? (
              <div className="action-items-report-list">
                {filteredIssues.map((issue) => {
                  const latestUpdate = issue.updates[issue.updates.length - 1] ?? null;
                  const secondLine =
                    formatCompactDetail(
                      latestUpdate
                        ? `${formatEntryType(latestUpdate.entry_type)} ${formatText(latestUpdate.entry_text)}`
                        : issue.description,
                    ) || "No detail entered yet.";

                  return (
                    <article className="action-items-report-row" data-status={issue.status} key={issue.id}>
                      <div className="action-items-report-row-top">
                        <span className={`action-items-report-row-status action-items-report-row-status--${issue.status}`}>
                          {formatStatus(issue.status)}
                        </span>
                        <strong className="action-items-report-row-title">
                          {issue.title || getIssueLabel(issue.issue_type)}
                        </strong>
                        <span className="action-items-report-row-type">
                          {issue.typeDefinition?.label || getIssueLabel(issue.issue_type)}
                        </span>
                        <span className="action-items-report-row-location">
                          {formatIssueLocation(issue)}
                        </span>
                        <span className="action-items-report-row-date">
                          {formatDate(issue.reported_log_date ?? issue.opened_at)}
                        </span>
                        <span className="action-items-report-row-opened-by">
                          {formatActor(issue.opened_by, userDisplayNameById, issue)}
                        </span>
                      </div>
                      <p className="action-items-report-row-detail">{secondLine}</p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="helper-banner">No action items matched the current filters.</div>
            )}
          </section>
        </div>
        </section>
      </section>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function paramArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? [value] : [];
}

function compareIssueUpdatesAscending(left: IssueUpdateRow, right: IssueUpdateRow) {
  const leftDate = left.effective_date ?? left.created_at ?? "";
  const rightDate = right.effective_date ?? right.created_at ?? "";
  const leftTime = leftDate ? new Date(leftDate).getTime() : 0;
  const rightTime = rightDate ? new Date(rightDate).getTime() : 0;
  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  const leftCreated = left.created_at ? new Date(left.created_at).getTime() : 0;
  const rightCreated = right.created_at ? new Date(right.created_at).getTime() : 0;
  return leftCreated - rightCreated;
}

function compareIssuesAscending(left: EnrichedIssue, right: EnrichedIssue) {
  const leftFarm = `${left.placementContext?.farmName ?? ""} ${left.placementContext?.barnCode ?? ""}`;
  const rightFarm = `${right.placementContext?.farmName ?? ""} ${right.placementContext?.barnCode ?? ""}`;
  const byContext = leftFarm.localeCompare(rightFarm, undefined, { numeric: true });
  if (byContext !== 0) {
    return byContext;
  }

  const leftPlacement = left.placementContext?.placementCode ?? "";
  const rightPlacement = right.placementContext?.placementCode ?? "";
  const byPlacement = leftPlacement.localeCompare(rightPlacement, undefined, { numeric: true });
  if (byPlacement !== 0) {
    return byPlacement;
  }

  const leftDate = left.reported_log_date ?? left.opened_at ?? "";
  const rightDate = right.reported_log_date ?? right.opened_at ?? "";
  const leftTime = leftDate ? new Date(leftDate).getTime() : 0;
  const rightTime = rightDate ? new Date(rightDate).getTime() : 0;
  return leftTime - rightTime;
}

function formatWhole(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${formatDate(start)} to ${formatDate(end)}`;
  if (start) return `${formatDate(start)} forward`;
  if (end) return `Through ${formatDate(end)}`;
  return "All dates";
}

function formatStatusFilter(statuses: string[]) {
  if (statuses.length === 0) return "All statuses";
  return statuses.map((status) => (status === "resolved" ? "Completed" : "Open")).join(", ");
}

function buildScopeLabel(
  filters: {
    farmId: string | null;
    barnId: string | null;
    flockCode: string | null;
    issueType: string | null;
    dateStart: string | null;
    dateEnd: string | null;
    statuses: string[];
  },
  placements: Awaited<ReturnType<typeof getAdminData>>["activePlacements"],
) {
  if (filters.barnId) {
    return `Barn ${resolveBarnLabel(filters.barnId, placements) || filters.barnId}`;
  }
  if (filters.farmId) {
    return resolveFarmLabel(filters.farmId, placements) || "Single farm";
  }
  if (filters.flockCode) {
    return `Flock ${filters.flockCode}`;
  }
  return "Filtered scope";
}

const ISSUE_SORT_LABELS: Record<IssueSortKey, string> = {
  date_opened: "Date Opened",
  farm_barn: "Farm / Barn",
  title: "Title",
  status: "Status",
};

function parseIssueSortKey(value: string | null): IssueSortKey {
  switch (value) {
    case "farm_barn":
    case "title":
    case "status":
    case "date_opened":
      return value;
    default:
      return "date_opened";
  }
}

function getIssueSortLabel(value: IssueSortKey) {
  return ISSUE_SORT_LABELS[value];
}

function formatEntryType(value: string | null) {
  switch (value) {
    case "opened":
      return "Opened";
    case "resolved":
      return "Resolved";
    case "parts_ordered":
      return "Parts Ordered";
    case "progress":
      return "Progress";
    default:
      return "Update";
  }
}

function formatStatus(value: IssueStatus) {
  return value === "resolved" ? "Completed" : "Open";
}

function compareIssuesForSort(left: EnrichedIssue, right: EnrichedIssue, sortBy: IssueSortKey) {
  switch (sortBy) {
    case "farm_barn": {
      const byContext = compareText(
        `${left.placementContext?.farmName ?? ""} ${left.placementContext?.barnCode ?? ""} ${left.placementContext?.placementCode ?? ""}`,
        `${right.placementContext?.farmName ?? ""} ${right.placementContext?.barnCode ?? ""} ${right.placementContext?.placementCode ?? ""}`,
      );
      return byContext || compareIssuesAscending(left, right);
    }
    case "title": {
      const byTitle = compareText(left.title || getIssueLabel(left.issue_type), right.title || getIssueLabel(right.issue_type));
      return byTitle || compareIssuesAscending(left, right);
    }
    case "status": {
      const byStatus = compareText(left.status, right.status);
      return byStatus || compareIssuesAscending(left, right);
    }
    case "date_opened":
    default: {
      const leftOpened = resolveIssueOpenedSortDate(left);
      const rightOpened = resolveIssueOpenedSortDate(right);
      const byDate = compareDateValue(leftOpened, rightOpened);
      return byDate || compareIssuesAscending(left, right);
    }
  }
}

function formatIssueLocation(issue: EnrichedIssue) {
  const parts = [
    issue.placementContext?.farmName,
    issue.placementContext?.barnCode,
    issue.placementContext?.placementCode || issue.placementContext?.flockCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : issue.entity_type === "barn" ? "Barn linked" : "Placement linked";
}

function formatCompactDetail(value: string | null | undefined) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
}

function resolveIssueOpenedSortDate(issue: EnrichedIssue) {
  const openingUpdate = issue.updates[0] ?? null;
  return openingUpdate?.effective_date ?? openingUpdate?.created_at ?? issue.reported_log_date ?? issue.opened_at ?? "";
}

function compareDateValue(left: string, right: string) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return leftTime - rightTime;
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
}

function formatActor(
  value: string | null,
  userDisplayNameById: Map<string, string>,
  issue?: Pick<IssueRow, "description"> | null,
) {
  if (!value) {
    if ((issue?.description ?? "").startsWith("Auto-derived:")) {
      return "FlockTrax";
    }
    return "Unknown";
  }
  const displayName = userDisplayNameById.get(value);
  if (displayName) return displayName;
  return value.length > 10 ? `${value.slice(0, 6)}...` : value;
}

function formatText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized || "--";
}

function hasVisibleText(value: string | null | undefined) {
  return String(value ?? "").trim().length > 0;
}

function resolveFarmLabel(
  farmId: string | null,
  placements: Awaited<ReturnType<typeof getAdminData>>["activePlacements"],
) {
  if (!farmId) return null;
  return placements.find((placement) => placement.farmId === farmId)?.farmName ?? farmId;
}

function resolveBarnLabel(
  barnId: string | null,
  placements: Awaited<ReturnType<typeof getAdminData>>["activePlacements"],
) {
  if (!barnId) return null;
  return placements.find((placement) => placement.barnId === barnId)?.barnCode ?? barnId;
}
