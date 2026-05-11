import Link from "next/link";
import { redirect } from "next/navigation";

import { deactivateIssueTypeAction, saveIssueTypeAction } from "@/app/admin/issues/types/actions";
import { PageHeader } from "@/components/page-header";
import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type ActionTypesPageProps = {
  searchParams?: Promise<{
    code?: string | string[];
    notice?: string | string[];
    error?: string | string[];
  }>;
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

type PlatformHelperRow = {
  display: string | null;
};

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRoleKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function canManageActionTypes(role: ReturnType<typeof resolveRoleTemplate> | null) {
  if (!role) {
    return false;
  }

  const normalized = normalizeRoleKey(role.key);
  if (normalized === "admin" || normalized.includes("super") || normalized.includes("admin")) {
    return true;
  }

  return role.permissionRows.some((permissionRow) => {
    const action = normalizeRoleKey(permissionRow.action);
    return action === "platform_settings" && (permissionRow.create || permissionRow.update || permissionRow.menuAccess);
  });
}

export default async function ActionTypesPage({ searchParams }: ActionTypesPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedCode = readParam(params?.code);
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);

  const adminClient = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const bundle = await getUserAccessBundle();
  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  const actorId = authResult?.data.user?.id ?? null;
  const actingUser = actorId ? bundle.users.find((candidate) => candidate.id === actorId) ?? null : null;
  const actingRole = actingUser ? resolveRoleTemplate(bundle.roles, actingUser.role) : null;

  if (!canManageActionTypes(actingRole)) {
    redirect("/admin/issues?error=Only%20farm-member%20admins%20or%20super%20admins%20can%20maintain%20action%20types.");
  }

  if (!adminClient) {
    throw new Error("Supabase admin access is not configured for action-type maintenance.");
  }

  const [{ data, error: loadError }, { data: helperRow, error: helperError }] = await Promise.all([
    adminClient
      .from("issue_types")
      .select("code,label,entity_type,is_active,sort_order,severity_default,report_group")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    adminClient
      .schema("platform")
      .from("screen_txt")
      .select("display")
      .eq("name", "action_type_helper")
      .maybeSingle(),
  ]);

  if (loadError) {
    throw new Error(loadError.message);
  }
  if (helperError && helperError.code !== "PGRST116") {
    throw new Error(helperError.message);
  }

  const rows = ((data ?? []) as IssueTypeRow[]).sort((left, right) => {
    const sortCompare = (left.sort_order ?? 100) - (right.sort_order ?? 100);
    return sortCompare !== 0 ? sortCompare : left.label.localeCompare(right.label);
  });
  const helperText =
    (((helperRow as PlatformHelperRow | null)?.display ?? "").trim()) ||
    "Use this space to explain what each field on the action-type editor means and how staff should use it. Managed copy can be maintained from platform.screen_txt under the key action_type_helper.";

  const selectedRowCandidate =
    selectedCode === "new" ? null : rows.find((row) => row.code === selectedCode) ?? null;
  const selectedRow = selectedRowCandidate ?? (selectedCode ? null : rows[0] ?? null);

  const buildHref = (code?: string | null) => {
    const query = new URLSearchParams();
    if (code) {
      query.set("code", code);
    }
    const search = query.toString();
    return search ? `/admin/issues/types?${search}` : "/admin/issues/types";
  };

  return (
    <>
      <PageHeader
        eyebrow="Action Types"
        title="Maintain the list of action-item types available to the field and office."
        body="These type definitions drive the action-type choices used when a barn or placement problem is logged. Keep the list practical, readable, and limited to the types your staff actually uses."
        actions={
          <div className="page-header-actions">
            <Link className="button-secondary" href="/admin/issues">
              Back to Action Items
            </Link>
            <Link className="button" href={buildHref("new")}>
              New Action Type
            </Link>
          </div>
        }
      />

      <section className="breed-benchmark-grid">
        <article className="panel breed-benchmark-panel">
          <div className="section-header breed-benchmark-header">
            <div>
              <p className="eyebrow">Available Types</p>
              <h2>Configured action-item types</h2>
            </div>
          </div>

          <p className="breed-benchmark-copy">
            Keep barn-owned repair types separate from placement-owned flock-cycle types. These definitions become the choices shown when staff logs a new action item.
          </p>

          <div className="breed-benchmark-family-list">
            {rows.length > 0 ? (
              rows.map((row) => (
                <Link
                  className="breed-benchmark-family-item"
                  data-active={row.code === selectedRow?.code}
                  href={buildHref(row.code)}
                  key={row.code}
                >
                  <div>
                    <p className="breed-benchmark-family-title">{row.label}</p>
                    <p className="breed-benchmark-family-subtitle">
                      {row.code} · {row.entity_type}
                    </p>
                  </div>
                  <div className="breed-benchmark-family-meta">
                    <span>Sort {(row.sort_order ?? 100).toString()}</span>
                    <span>{row.report_group || "general"}</span>
                    <span>{row.is_active === false ? "inactive" : "active"}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="settings-empty-state">No action types are configured yet.</p>
            )}
          </div>
        </article>

        <article className="panel breed-benchmark-panel breed-benchmark-editor-panel">
          <div className="section-header breed-benchmark-header">
            <div>
              <p className="eyebrow">Action Type Editor</p>
              <h2>
                {selectedCode === "new"
                  ? "Add a new action type"
                  : selectedRow
                    ? `Edit ${selectedRow.label}`
                    : "Select a type"}
              </h2>
            </div>
          </div>

          {notice ? <p className="login-banner login-banner-notice">{decodeURIComponent(notice)}</p> : null}
          {error ? <p className="login-banner login-banner-error">{decodeURIComponent(error)}</p> : null}

          <form
            action={saveIssueTypeAction}
            className="breed-benchmark-form"
            key={selectedRow?.code ?? selectedCode ?? "new"}
          >
            <input name="return_to" type="hidden" value="/admin/issues/types" />
            <input name="selected_code" type="hidden" value={selectedRow?.code ?? ""} />
            <input name="original_code" type="hidden" value={selectedRow?.code ?? ""} />

            <div className="form-grid">
              <div className="field">
                <label htmlFor="type-code">Code</label>
                <input
                  defaultValue={selectedRow?.code ?? ""}
                  id="type-code"
                  name="code"
                  placeholder="feedlines"
                />
              </div>

              <div className="field">
                <label htmlFor="type-label">Label</label>
                <input
                  defaultValue={selectedRow?.label ?? ""}
                  id="type-label"
                  name="label"
                  placeholder="Feedlines"
                />
              </div>

              <div className="field">
                <label htmlFor="entity-type">Belongs To</label>
                <select defaultValue={selectedRow?.entity_type ?? "barn"} id="entity-type" name="entity_type">
                  <option value="barn">Barn</option>
                  <option value="placement">Placement</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="sort-order">Sort Order</label>
                <input
                  defaultValue={selectedRow?.sort_order ?? 100}
                  id="sort-order"
                  name="sort_order"
                  placeholder="100"
                  type="number"
                />
              </div>

              <div className="field">
                <label htmlFor="severity-default">Default Tone</label>
                <input
                  defaultValue={selectedRow?.severity_default ?? ""}
                  id="severity-default"
                  name="severity_default"
                  placeholder="warn"
                />
              </div>

              <div className="field">
                <label htmlFor="report-group">Report Group</label>
                <input
                  defaultValue={selectedRow?.report_group ?? ""}
                  id="report-group"
                  name="report_group"
                  placeholder="repairs"
                />
              </div>

              <label className="settings-toggle breed-benchmark-toggle">
                <input
                  defaultChecked={selectedRow ? selectedRow.is_active !== false : true}
                  name="is_active"
                  type="checkbox"
                />
                <span>Active action type</span>
              </label>
            </div>

            <div className="breed-benchmark-help">
              <p>
                Codes should stay short and stable because they become the stored key used by action items.
              </p>
              <p>
                Use <strong>barn</strong> for repairs and facilities issues. Use <strong>placement</strong> for flock-cycle problems that should travel with placement history.
              </p>
            </div>

            <div className="settings-action-row">
              <Link className="button-secondary settings-action-button" href={buildHref("new")}>
                Clear
              </Link>
              {selectedRow ? (
                <button
                  className="button-secondary settings-action-button"
                  formAction={deactivateIssueTypeAction}
                  name="code"
                  type="submit"
                  value={selectedRow.code}
                >
                  Deactivate
                </button>
              ) : null}
              <button className="button settings-action-button" type="submit">
                {selectedRow ? "Save Type" : "Add Type"}
              </button>
            </div>
          </form>
        </article>

        <aside className="action-type-helper-pane" aria-label="Action type helper text">
          <p className="action-type-helper-copy">{helperText}</p>
        </aside>
      </section>
    </>
  );
}
