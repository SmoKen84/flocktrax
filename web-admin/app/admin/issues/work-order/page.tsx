import { notFound } from "next/navigation";

import { ActionItemWorkOrderActions } from "@/app/admin/issues/action-item-work-order-actions";
import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { getUserAccessBundle } from "@/lib/access-control";
import { getAdminData } from "@/lib/admin-data";
import { getDefaultIssueTypes, getIssueLabel, type IssueTypeRecord } from "@/lib/issues";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ActionItemWorkOrderPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type IssueStatus = "open" | "resolved";

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

export default async function ActionItemWorkOrderPage({ searchParams }: ActionItemWorkOrderPageProps) {
  const params = (await searchParams) ?? {};
  const issueId = firstParam(params.issueId);

  if (!issueId) {
    notFound();
  }

  const adminClient = createSupabaseAdminClient();
  const [data, accessBundle] = await Promise.all([getAdminData(), getUserAccessBundle()]);

  if (!adminClient) {
    throw new Error("Admin work-order report could not connect to Supabase.");
  }

  const userDisplayNameById = new Map(accessBundle.users.map((user) => [user.id, user.displayName]));

  const [issueResult, issueTypesResult, issueUpdatesResult] = await Promise.all([
    adminClient
      .from("issues")
      .select(
        "id,entity_type,entity_id,issue_type,title,description,status,related_placement_id,reported_log_date,opened_at,opened_by,resolved_at,resolution_note",
      )
      .eq("id", issueId)
      .maybeSingle(),
    adminClient
      .from("issue_types")
      .select("code,label,entity_type,is_active,sort_order,severity_default,report_group")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminClient
      .from("issue_updates")
      .select("id,issue_id,entry_type,entry_text,effective_date,created_at,created_by")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true }),
  ]);

  if (issueResult.error) {
    throw new Error(issueResult.error.message);
  }
  if (issueTypesResult.error && issueTypesResult.error.code !== "42P01") {
    throw new Error(issueTypesResult.error.message);
  }
  if (issueUpdatesResult.error && issueUpdatesResult.error.code !== "42P01") {
    throw new Error(issueUpdatesResult.error.message);
  }

  const issueRow = (issueResult.data as IssueRow | null) ?? null;
  if (!issueRow) {
    notFound();
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
  const updates = ((issueUpdatesResult.data ?? []) as IssueUpdateRow[]).sort(compareIssueUpdatesAscending);
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

  const placementContext =
    issueRow.entity_type === "placement"
      ? placementById.get(issueRow.entity_id) ?? null
      : issueRow.related_placement_id
        ? placementById.get(issueRow.related_placement_id) ?? barnPlacementByBarnId.get(issueRow.entity_id) ?? null
        : barnPlacementByBarnId.get(issueRow.entity_id) ?? null;

  const issue: EnrichedIssue = {
    ...issueRow,
    typeDefinition: issueTypeByCode.get(issueRow.issue_type ?? "") ?? null,
    placementContext,
    updates,
  };

  const openingUpdate =
    issue.updates.find((update) => (update.entry_type ?? "").trim().toLowerCase() === "opened") ?? null;
  const repairHistoryUpdates =
    openingUpdate ? issue.updates.filter((update) => update.id !== openingUpdate.id) : issue.updates;
  const problemSummary = openingUpdate?.entry_text?.trim() || issue.description?.trim() || "No description was entered for this action item.";
  const locationLine = [issue.placementContext?.farmName, issue.placementContext?.barnCode, issue.placementContext?.placementCode]
    .filter(Boolean)
    .join(" / ");

  return (
    <>
      <section className="action-item-work-order-page">
        <div className="action-item-work-order-masthead">
          <div className="action-item-work-order-brand">
            <p className="action-item-work-order-eyebrow">Operations</p>
            <FlockTraxWordmark compact product="Admin" tone="accent" />
            <h1 className="action-item-work-order-page-title">Action Item Work Order</h1>
          </div>
          <div className="action-item-work-order-badge-block">
            <span className={`action-item-work-order-status${issue.status === "resolved" ? " is-resolved" : ""}`}>
              {issue.status === "resolved" ? "Closed" : "Open"}
            </span>
            <strong className="action-item-work-order-id">{issue.id.slice(0, 8).toUpperCase()}</strong>
          </div>
        </div>

        <div className="action-item-work-order-screen-actions">
          <ActionItemWorkOrderActions />
        </div>

        <div className="action-item-work-order-intro-panel">
          <div className="action-item-work-order-intro-card action-item-work-order-intro-card--primary">
            <span>Work Order</span>
            <strong>{issue.title || getIssueLabel(issue.issue_type)}</strong>
            <p className="action-item-work-order-location">{locationLine || "Location not available"}</p>
          </div>
          <div className="action-item-work-order-intro-card">
            <span>Action Type</span>
            <strong>{issue.typeDefinition?.label || getIssueLabel(issue.issue_type)}</strong>
          </div>
          <div className="action-item-work-order-intro-card action-item-work-order-intro-card--meta">
            <div>
              <span>Reported</span>
              <strong>{formatDate(issue.reported_log_date ?? issue.opened_at)}</strong>
            </div>
            <div>
              <span>Opened</span>
              <strong>{formatActor(issue.opened_by, userDisplayNameById, issue)}</strong>
            </div>
          </div>
        </div>

        <div className="action-item-work-order-sections">
          <section className="action-item-work-order-section">
            <div className="action-item-work-order-section-header">
              <h3>Problem Summary</h3>
            </div>
            <div className="action-item-work-order-copy-card">
              <p>{problemSummary}</p>
            </div>
          </section>

          <section className="action-item-work-order-section">
            <div className="action-item-work-order-section-header">
              <h3>Repair History / Notes</h3>
              <p>Listed oldest to newest so the farm hand can see the full trail.</p>
            </div>
            {repairHistoryUpdates.length > 0 ? (
              <div className="action-item-work-order-update-list">
                {repairHistoryUpdates.map((update, index) => (
                  <article className="action-item-work-order-update" key={update.id}>
                    <div className="action-item-work-order-update-meta">
                      <strong>{`${index + 1}. ${formatEntryType(update.entry_type)}`}</strong>
                      <span>{formatDate(update.effective_date ?? update.created_at)}</span>
                      <span>{formatActor(update.created_by, userDisplayNameById)}</span>
                    </div>
                    <p>{formatText(update.entry_text)}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="action-item-work-order-copy-card">
                <p>No updates have been posted yet.</p>
              </div>
            )}
          </section>

          <section className="action-item-work-order-section action-item-work-order-section--field">
            <div className="action-item-work-order-section-header">
              <h3>Field Completion</h3>
              <p>Handwritten completion area for the person doing the work.</p>
            </div>
            <div className="action-item-work-order-field-grid">
              <div className="action-item-work-order-field-card">
                <span>Work Performed</span>
                <div className="action-item-work-order-lines action-item-work-order-lines--tall" />
              </div>
              <div className="action-item-work-order-field-card">
                <span>Parts / Materials Used</span>
                <div className="action-item-work-order-lines" />
              </div>
              <div className="action-item-work-order-signoff-grid">
                <div className="action-item-work-order-field-card">
                  <span>Completed By</span>
                  <div className="action-item-work-order-sign-line" />
                </div>
                <div className="action-item-work-order-field-card">
                  <span>Completion Date</span>
                  <div className="action-item-work-order-sign-line" />
                </div>
                <div className="action-item-work-order-field-card">
                  <span>Verified By</span>
                  <div className="action-item-work-order-sign-line" />
                </div>
                <div className="action-item-work-order-field-card">
                  <span>Follow-Up Needed</span>
                  <div className="action-item-work-order-checks">
                    <label><input type="checkbox" /> Yes</label>
                    <label><input type="checkbox" /> No</label>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
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

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
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
