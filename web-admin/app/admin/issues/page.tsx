import Link from "next/link";

import {
  addIssueUpdateAction,
  createIssueAction,
  resolveIssueAction,
  updateIssueAction,
} from "@/app/admin/issues/actions";
import { IssuesBackButton } from "@/app/admin/issues/back-button";
import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import { getAdminData } from "@/lib/admin-data";
import { getDefaultIssueTypes, getIssueLabel, type IssueTypeRecord } from "@/lib/issues";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type IssuesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type IssueStatus = "open" | "resolved";
type PanelMode = "detail" | "create" | "edit" | "update" | "resolve";

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

export default async function IssuesPage({ searchParams }: IssuesPageProps) {
  const params = (await searchParams) ?? {};
  const notice = firstParam(params.notice);
  const error = firstParam(params.error);
  const selectedPlacementId = firstParam(params.placementId);
  const selectedIssueId = firstParam(params.issueId);
  const selectedUpdateId = firstParam(params.updateId);
  const panelMode = parsePanelMode(firstParam(params.mode));

  const filters = {
    farmId: firstParam(params.farmId),
    barnId: firstParam(params.barnId),
    flockCode: firstParam(params.flockCode),
    issueType: firstParam(params.issueType),
    dateStart: firstParam(params.dateStart),
    dateEnd: firstParam(params.dateEnd),
    statuses: paramArray(params.status),
  };

  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const [data, accessBundle] = await Promise.all([getAdminData(), getUserAccessBundle()]);

  if (!adminClient) {
    throw new Error("Admin action-items console could not connect to Supabase.");
  }

  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  const actorId = authResult?.data.user?.id ?? null;
  const actingUser = actorId ? accessBundle.users.find((candidate) => candidate.id === actorId) ?? null : null;
  const actingRole = actingUser ? resolveRoleTemplate(accessBundle.roles, actingUser.role) : null;
  const canMaintainActionTypes = canManageActionTypes(actingRole);
  const userDisplayNameById = new Map(accessBundle.users.map((user) => [user.id, user.displayName]));

  const [issuesResult, issueTypesResult, issueUpdatesResult] = await Promise.all([
    adminClient
      .from("issues")
      .select(
        "id,entity_type,entity_id,issue_type,title,description,status,related_placement_id,reported_log_date,opened_at,opened_by,resolved_at,resolution_note",
      )
      .order("opened_at", { ascending: false })
      .limit(300),
    adminClient
      .from("issue_types")
      .select("code,label,entity_type,is_active,sort_order,severity_default,report_group")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    adminClient
      .from("issue_updates")
      .select("id,issue_id,entry_type,entry_text,effective_date,created_at,created_by")
      .order("created_at", { ascending: false })
      .limit(1000),
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

  const filteredIssues = allIssues.filter((issue) => {
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
  });

  const selectedIssue =
    (selectedIssueId ? filteredIssues.find((issue) => issue.id === selectedIssueId) : null) ??
    filteredIssues[0] ??
    null;

  const selectedPlacement =
    (selectedPlacementId ? placementById.get(selectedPlacementId) : null) ??
    selectedIssue?.placementContext ??
    placements[0] ??
    null;

  const selectedUpdate =
    (selectedUpdateId ? selectedIssue?.updates.find((update) => update.id === selectedUpdateId) ?? null : null) ??
    selectedIssue?.updates[selectedIssue.updates.length - 1] ??
    null;

  const counts = {
    open: filteredIssues.filter((issue) => issue.status === "open").length,
    resolved: filteredIssues.filter((issue) => issue.status === "resolved").length,
    inProgress: 0,
    waiting: 0,
    total: filteredIssues.length,
  };

  const farms = dedupeBy(
    placements.map((placement) => ({
      id: placement.farmId,
      label: placement.farmName,
    })),
    (item) => item.id,
  ).sort((left, right) => left.label.localeCompare(right.label));

  const barns = dedupeBy(
    placements
      .filter((placement) => !filters.farmId || placement.farmId === filters.farmId)
      .map((placement) => ({
        id: placement.barnId,
        label: placement.barnCode,
      })),
    (item) => item.id,
  ).sort((left, right) => left.label.localeCompare(right.label));

  const selectedContext = selectedIssue?.placementContext ?? selectedPlacement;
  const detailMode = selectedIssue ? panelMode : "create";

  return (
    <>
      <section className="panel hero-panel action-items-hero-panel">
        <div className="action-items-hero-copy">
          <p className="hero-kicker">Operations</p>
          <div className="action-items-hero-brand">
            <FlockTraxWordmark compact product="Admin" tone="accent" />
          </div>
          <h1 className="hero-title action-items-hero-title">Action Items Console</h1>
          <p className="hero-body action-items-hero-body">
            Create, track and monitor the progress of any task related to a farm, barn or flock placement from
            start to completion.
          </p>
        </div>
        <div className="action-items-hero-actions">
          <IssuesBackButton className="action-items-back-button" />
        </div>
        {canMaintainActionTypes ? (
          <Link className="action-items-manage-link" href="/admin/issues/types">
            Manage Action Types
          </Link>
        ) : null}
      </section>

      {notice ? <p className="issues-console-feedback issues-console-feedback--success">{notice}</p> : null}
      {error ? <p className="issues-console-feedback issues-console-feedback--error">{error}</p> : null}

      <section className="panel action-items-filter-band">
        <article className="action-items-filter-panel">
          <div className="action-items-panel-header">
            <h2>Action Items Filter:</h2>
          </div>

          <form className="action-items-filter-form action-items-filter-form--band" method="get">
            <input name="issueId" type="hidden" value={selectedIssue?.id ?? ""} />
            <input name="updateId" type="hidden" value={selectedUpdate?.id ?? ""} />
            <input name="mode" type="hidden" value={selectedIssue ? detailMode : "create"} />

            <label className="sync-engine-field">
              <span>Farm:</span>
              <select defaultValue={filters.farmId ?? ""} name="farmId">
                <option value="">All farms</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sync-engine-field">
              <span>Barn:</span>
              <select defaultValue={filters.barnId ?? ""} name="barnId">
                <option value="">All barns</option>
                {barns.map((barn) => (
                  <option key={barn.id} value={barn.id}>
                    {barn.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sync-engine-field">
              <span>Flock Code:</span>
              <input defaultValue={filters.flockCode ?? ""} name="flockCode" type="text" />
            </label>

            <label className="sync-engine-field">
              <span>Action Type:</span>
              <select defaultValue={filters.issueType ?? ""} name="issueType">
                <option value="">All action types</option>
                {issueTypeRows.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="sync-engine-field action-items-filter-date-field">
              <span>Date Start:</span>
              <input defaultValue={filters.dateStart ?? ""} name="dateStart" type="date" />
            </label>

            <label className="sync-engine-field action-items-filter-date-field">
              <span>Date End:</span>
              <input defaultValue={filters.dateEnd ?? ""} name="dateEnd" type="date" />
            </label>

            <fieldset className="action-items-status-box action-items-status-box--band">
              <legend>Status:</legend>
              <label>
                <input defaultChecked={filters.statuses.includes("open")} name="status" type="checkbox" value="open" />
                <span>Open</span>
              </label>
              <label>
                <input
                  defaultChecked={filters.statuses.includes("resolved")}
                  name="status"
                  type="checkbox"
                  value="resolved"
                />
                <span>Completed</span>
              </label>
              <label>
                <input disabled type="checkbox" />
                <span>In-Progress</span>
              </label>
              <label>
                <input disabled type="checkbox" />
                <span>Waiting</span>
              </label>
              <label>
                <input disabled type="checkbox" />
                <span>Pending Approval</span>
              </label>
            </fieldset>

            <div className="action-items-filter-buttons action-items-filter-buttons--band">
              <button className="button" type="submit">
                Apply
              </button>
              <Link className="button" href="/admin/issues">
                Clear
              </Link>
            </div>
          </form>
        </article>
      </section>

      <section className="action-items-workspace action-items-workspace--dual">
        <article className="panel action-items-list-panel action-items-list-panel--primary">
          <div className="action-items-panel-header action-items-list-header">
            <div className="action-items-panel-title-stack">
              <h2>Action Items</h2>
              <p className="action-items-panel-context">
                <span className="action-items-context-farm">{selectedContext?.farmName ?? "Current Farm"}</span>
                <span className="action-items-context-label">Barn:</span>
                <span className="action-items-context-barn">{selectedContext?.barnCode ?? "—"}</span>
              </p>
            </div>

            <Link
              className="action-items-create-button"
              href={buildIssuesHref(params, {
                issueId: null,
                updateId: null,
                placementId: selectedContext?.placementId ?? selectedPlacement?.placementId ?? null,
                mode: "create",
              })}
            >
              +
            </Link>
          </div>

          <div className="action-items-table-shell">
            <table className="action-items-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Flock</th>
                  <th>Opened By</th>
                  <th>Resolved Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.length > 0 ? (
                  filteredIssues.map((issue) => {
                    const context = issue.placementContext;
                    const href = buildIssuesHref(params, {
                      issueId: issue.id,
                      updateId: issue.updates[issue.updates.length - 1]?.id ?? null,
                      placementId: context?.placementId ?? selectedPlacement?.placementId ?? null,
                      mode: selectedIssue?.id === issue.id ? detailMode : "detail",
                    });

                    return (
                      <tr
                        className={selectedIssue?.id === issue.id ? "is-selected" : undefined}
                        data-status={issue.status}
                        key={issue.id}
                      >
                        <td>
                          <Link className="action-items-row-link" href={href}>
                            {formatShortDate(issue.reported_log_date ?? issue.opened_at)}
                          </Link>
                        </td>
                        <td>
                          <Link className="action-items-row-link action-items-status-link" href={href}>
                            <span>{formatStatusLabel(issue.status)}</span>
                            <strong>{formatLinkedTargetValue(issue)}</strong>
                          </Link>
                        </td>
                        <td>
                          <Link className="action-items-row-link action-items-row-description" href={href}>
                            <strong>{issue.title || getIssueLabel(issue.issue_type)}</strong>
                            <em className="action-items-row-update-preview">
                              {issue.updates.length > 0
                                ? `${formatShortDate(
                                    issue.updates[issue.updates.length - 1]?.effective_date ??
                                      issue.updates[issue.updates.length - 1]?.created_at,
                                  )} ${formatEntryType(issue.updates[issue.updates.length - 1]?.entry_type)} ${
                                    issue.updates[issue.updates.length - 1]?.entry_text || "Update"
                                  }`
                                : issue.description || "No description entered yet."}
                            </em>
                          </Link>
                        </td>
                        <td>{context?.placementCode ?? "—"}</td>
                        <td>{formatActor(issue.opened_by, userDisplayNameById)}</td>
                        <td>{issue.status === "resolved" ? "Complete" : "Waiting"}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <p className="table-subtitle">No action items matched the current filter set.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel action-items-list-panel action-items-list-panel--updates">
          <div className="action-items-panel-header action-items-list-header">
            <h2>Update History:</h2>
          </div>

          <div className="action-items-table-shell action-items-table-shell--updates">
            <table className="action-items-table action-items-table--updates">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {selectedIssue && selectedIssue.updates.length > 0 ? (
                  selectedIssue.updates.map((update) => {
                    const href = buildIssuesHref(params, {
                      issueId: selectedIssue.id,
                      updateId: update.id,
                      placementId: selectedIssue.placementContext?.placementId ?? null,
                      mode: detailMode,
                    });

                    return (
                      <tr className={selectedUpdate?.id === update.id ? "is-selected" : undefined} key={update.id}>
                        <td>
                          <Link className="action-items-row-link" href={href}>
                            {formatShortDate(update.effective_date ?? update.created_at)}
                          </Link>
                        </td>
                        <td>{formatEntryType(update.entry_type)}</td>
                        <td>
                          <Link className="action-items-row-link action-items-update-row-link" href={href}>
                            {update.entry_text || "No update text entered."}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3}>
                      <p className="table-subtitle">Select an action item to review its update thread.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="action-items-list-footer">
            <div className="action-items-list-actions">
              {selectedIssue ? (
                <>
                  {selectedIssue.status === "open" ? (
                    <>
                      <Link
                        className="button"
                        href={buildIssuesHref(params, {
                          issueId: selectedIssue.id,
                          updateId: selectedUpdate?.id ?? null,
                          placementId: selectedIssue.placementContext?.placementId ?? null,
                          mode: "edit",
                        })}
                      >
                        Edit
                      </Link>
                      <Link
                        className="button"
                        href={buildIssuesHref(params, {
                          issueId: selectedIssue.id,
                          updateId: selectedUpdate?.id ?? null,
                          placementId: selectedIssue.placementContext?.placementId ?? null,
                          mode: "update",
                        })}
                      >
                        Update
                      </Link>
                      <Link
                        className="button"
                        href={buildIssuesHref(params, {
                          issueId: selectedIssue.id,
                          updateId: selectedUpdate?.id ?? null,
                          placementId: selectedIssue.placementContext?.placementId ?? null,
                          mode: "resolve",
                        })}
                      >
                        Resolve
                      </Link>
                    </>
                  ) : (
                    <span className="action-items-closed-note">Resolved items are read-only.</span>
                  )}
                </>
              ) : null}
            </div>

            <div className="action-items-count-summary">
              <p>
                Open <strong>{counts.open}</strong>
              </p>
              <p>
                In-Progress <strong>{counts.inProgress}</strong>
              </p>
              <p>
                Waiting <strong>{counts.waiting}</strong>
              </p>
              <p>
                Completed <strong>{counts.resolved}</strong>
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="panel action-items-detail-panel">
        {detailMode === "create" ? (
          <form action={createIssueAction} className="action-items-detail-editor">
            <div className="action-items-detail-main">
              <div className="action-items-detail-fields">
                <label className="sync-engine-field">
                  <span>Live placement</span>
                  <select defaultValue={selectedPlacement?.placementId ?? ""} name="placement_id" required>
                    {placements.map((placement) => (
                      <option key={placement.placementId} value={placement.placementId}>
                        {placement.farmName} · Barn {placement.barnCode} · {placement.placementCode}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sync-engine-field">
                  <span>Action Type</span>
                  <select name="issue_type" required>
                    {issueTypeRows.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sync-engine-field">
                  <span>Title</span>
                  <input name="title" placeholder="Short action title" type="text" />
                </label>
                <label className="sync-engine-field">
                  <span>Date</span>
                  <input defaultValue={todayIso()} name="reported_log_date" type="date" />
                </label>
              </div>
              <label className="sync-engine-field action-items-detail-copy-field">
                <span>Description</span>
                <textarea
                  className="issues-console-textarea"
                  name="description"
                  placeholder="Describe what, where, and when."
                  rows={4}
                />
              </label>
            </div>

            <aside className="action-items-detail-meta">
              <div className="action-items-detail-meta-row">
                <span>Entry By:</span>
                <strong>Current User</strong>
              </div>
              <div className="action-items-detail-meta-row">
                <span>Date:</span>
                <strong>{todayIso()}</strong>
              </div>
              <div className="action-items-detail-meta-row">
                <span>Status Change?:</span>
                <strong>Opened</strong>
              </div>
              <div className="action-items-detail-meta-row">
                <span>Is Resolved?:</span>
                <strong>No</strong>
              </div>
              <button className="button" type="submit">
                Create Action Item
              </button>
            </aside>
          </form>
        ) : selectedIssue ? (
          <div className="action-items-detail-editor">
            <div className="action-items-detail-main">
              {detailMode === "detail" ? (
                <div className="action-items-detail-copy-block">
                  <p className="action-items-detail-copy">
                    {selectedIssue.description || "No description has been entered for this action item yet."}
                  </p>
                </div>
              ) : null}

              {detailMode === "edit" ? (
                <form action={updateIssueAction} className="action-items-inline-editor">
                  <input name="issue_id" type="hidden" value={selectedIssue.id} />
                  <input name="placement_id" type="hidden" value={selectedIssue.placementContext?.placementId ?? ""} />
                  <div className="action-items-detail-fields">
                    <label className="sync-engine-field">
                      <span>Action Type</span>
                      <select defaultValue={selectedIssue.issue_type ?? ""} name="issue_type">
                        {issueTypeRows.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="sync-engine-field">
                      <span>Title</span>
                      <input defaultValue={selectedIssue.title ?? ""} name="title" type="text" />
                    </label>
                    <label className="sync-engine-field">
                      <span>Date</span>
                      <input defaultValue={selectedIssue.reported_log_date ?? todayIso()} name="reported_log_date" type="date" />
                    </label>
                    <div className="action-items-linked-display">
                      <span className="action-items-linked-label">Linked to:</span>
                      <strong className="action-items-linked-value">{formatLinkedTargetValue(selectedIssue)}</strong>
                    </div>
                  </div>
                  <label className="sync-engine-field action-items-detail-copy-field">
                    <span>Description</span>
                    <textarea
                      className="issues-console-textarea"
                      defaultValue={selectedIssue.description ?? ""}
                      name="description"
                      rows={4}
                    />
                  </label>
                  <button className="button" type="submit">
                    Save Edit
                  </button>
                </form>
              ) : null}

              {detailMode === "update" ? (
                <form action={addIssueUpdateAction} className="action-items-inline-editor">
                  <input name="issue_id" type="hidden" value={selectedIssue.id} />
                  <input name="placement_id" type="hidden" value={selectedIssue.placementContext?.placementId ?? ""} />
                  <div className="action-items-detail-fields">
                    <label className="sync-engine-field">
                      <span>Update Type</span>
                      <select defaultValue="progress" name="entry_type">
                        <option value="note">Update</option>
                        <option value="progress">Progress</option>
                        <option value="parts_ordered">Parts Ordered</option>
                      </select>
                    </label>
                    <label className="sync-engine-field">
                      <span>Date</span>
                      <input defaultValue={todayIso()} name="effective_date" type="date" />
                    </label>
                  </div>
                  <label className="sync-engine-field action-items-detail-copy-field">
                    <span>Update Entry</span>
                    <textarea
                      className="issues-console-textarea"
                      name="entry_text"
                      placeholder="Describe what happened next."
                      rows={4}
                    />
                  </label>
                  <button className="button" type="submit">
                    Add Update
                  </button>
                </form>
              ) : null}

              {detailMode === "resolve" ? (
                <form action={resolveIssueAction} className="action-items-inline-editor">
                  <input name="issue_id" type="hidden" value={selectedIssue.id} />
                  <input name="placement_id" type="hidden" value={selectedIssue.placementContext?.placementId ?? ""} />
                  <label className="sync-engine-field action-items-detail-copy-field">
                    <span>Resolution Note</span>
                    <textarea
                      className="issues-console-textarea"
                      name="resolution_note"
                      placeholder="Describe the completed repair or resolution."
                      rows={4}
                    />
                  </label>
                  <button className="button" type="submit">
                    Resolve Item
                  </button>
                </form>
              ) : null}
            </div>

            <aside className="action-items-detail-meta">
              <div className="action-items-detail-meta-row">
                <span>Entry By:</span>
                <strong>{formatActor(selectedIssue.opened_by, userDisplayNameById)}</strong>
              </div>
              <div className="action-items-detail-meta-row">
                <span>Date:</span>
                <strong>{formatShortDate(selectedIssue.reported_log_date ?? selectedIssue.opened_at)}</strong>
              </div>
              <div className="action-items-detail-meta-row">
                <span>Status Change?:</span>
                <strong>
                  {detailMode === "resolve"
                    ? "Resolving Now"
                    : detailMode === "update"
                      ? "Updating"
                      : detailMode === "edit"
                        ? "Editing"
                        : formatStatusLabel(selectedIssue.status)}
                </strong>
              </div>
              <div className="action-items-detail-meta-row">
                <span>Is Resolved?:</span>
                <strong>{selectedIssue.status === "resolved" ? "Yes" : "No"}</strong>
              </div>
              {detailMode === "detail" || detailMode === "edit" ? (
                <div className="action-items-detail-meta-row action-items-detail-meta-row--linked">
                  <span>Linked to:</span>
                  <strong className="action-items-linked-value">{formatLinkedTargetValue(selectedIssue)}</strong>
                </div>
              ) : null}
            </aside>
          </div>
        ) : (
          <div className="action-items-detail-empty">
            <p className="eyebrow">Action Item Detail</p>
            <h2>Select an action item</h2>
            <p className="hero-body">Pick one from the upper list or click `+` to create a new one.</p>
          </div>
        )}
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

function paramArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return value ? [value] : [];
}

function parsePanelMode(value: string | null): PanelMode {
  if (value === "create" || value === "edit" || value === "update" || value === "resolve") {
    return value;
  }
  return "detail";
}

function todayIso() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function formatShortDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}`.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    timeZone: "America/Chicago",
  });
}

function formatEntryType(value: string | null) {
  switch (value) {
    case "opened":
      return "Opened";
    case "note":
      return "Update";
    case "progress":
      return "Update";
    case "parts_ordered":
      return "Update";
    case "resolved":
      return "Resolved";
    default:
      return "Update";
  }
}

function formatStatusLabel(value: IssueStatus) {
  return value === "resolved" ? "Closed" : "Open";
}

function formatActor(value: string | null, userDisplayNameById: Map<string, string>) {
  if (!value) return "Unknown";
  const displayName = userDisplayNameById.get(value);
  if (displayName) return displayName;
  return value.length > 10 ? `${value.slice(0, 6)}...` : value;
}

function formatLinkedTargetValue(issue: EnrichedIssue) {
  if (issue.entity_type === "barn") {
    return issue.placementContext?.barnCode ?? "Unknown Barn";
  }

  return issue.placementContext?.flockCode ?? issue.placementContext?.placementCode ?? "Unknown Flock";
}

function compareIssueUpdatesAscending(left: IssueUpdateRow, right: IssueUpdateRow) {
  const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
  const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
  return leftTime - rightTime;
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildIssuesHref(
  params: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | null>,
) {
  const search = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    if (key === "status") continue;
    const value = Array.isArray(rawValue) ? rawValue[0] ?? null : rawValue ?? null;
    if (!value) continue;
    search.set(key, value);
  }

  for (const value of paramArray(params.status)) {
    search.append("status", value);
  }

  for (const [key, value] of Object.entries(overrides)) {
    search.delete(key);
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `/admin/issues?${query}` : "/admin/issues";
}

function canManageActionTypes(role: ReturnType<typeof resolveRoleTemplate> | null) {
  if (!role) {
    return false;
  }

  const normalized = role.key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "admin" || normalized.includes("super") || normalized.includes("admin")) {
    return true;
  }

  return role.permissionRows.some((permissionRow) => {
    const action = permissionRow.action.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return action === "platform_settings" && (permissionRow.create || permissionRow.update || permissionRow.menuAccess);
  });
}
