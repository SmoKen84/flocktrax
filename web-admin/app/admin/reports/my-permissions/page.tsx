import { MembershipHierarchy } from "./membership-hierarchy";
import { PermissionsPrintActions } from "./print-actions";
import { redirect } from "next/navigation";
import { buildAccessValidationSummary, getUserAccessBundle } from "@/lib/access-control";
import { resolvePermissionsReportUser } from "@/lib/permissions-report-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export const metadata = { title: "My Permissions | FlockTrax" };

type PageProps = { searchParams?: Promise<{ userId?: string | string[] }> };
export default async function MyPermissionsPage({ searchParams }: PageProps) {
  const client = await createSupabaseServerClient();
  if (!client) redirect("/login");
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) redirect("/login");
  const bundle = await getUserAccessBundle();
  const params = (await searchParams) ?? {};
  const requestedUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const { canSelectUser, selectedUserId, user, verified } = resolvePermissionsReportUser(
    bundle, auth.user.id, requestedUserId, auth.user.app_metadata?.demo_evaluator === true,
  );
  const summary = user && verified ? buildAccessValidationSummary(user, bundle.roles) : null;

  return <section className="panel card permissions-report-page">
    <header className="permissions-report-header">
      <p className="eyebrow">FlockTrax · User Access</p>
      <h1>My Permissions</h1>
      <p className="permissions-report-generated">Generated {new Date().toLocaleString("en-US", { timeZone: "America/Chicago", timeZoneName: "short" })}</p>
      {summary && <PermissionsPrintActions />}
    </header>
    {canSelectUser && <form method="get" className="permissions-user-filter" style={{ marginBottom: "1rem" }}>
      <div className="field">
        <label htmlFor="permissions-user">Report for user</label>
        <select id="permissions-user" name="userId" defaultValue={selectedUserId} key={selectedUserId}>
          {!user && <option value={selectedUserId} disabled>User not found — select a configured user</option>}
          {bundle.users.map((candidate) => <option key={candidate.id} value={candidate.id}>
            {candidate.displayName} — {candidate.email} ({candidate.roleLabel}{candidate.status !== "active" ? `, ${candidate.status}` : ""})
          </option>)}
        </select>
      </div>
      <button type="submit" className="button">Run Report</button>
    </form>}
    {user && summary ? <>
      <p><strong>Permissions for: {user.displayName}</strong> · {user.email}</p>
      <p>Roles: {summary.roleLabels.join(", ")} · Account: {user.status}</p>
      <p>Within this user’s assigned access, based on their current role permissions.</p>
      <MembershipHierarchy memberships={user.memberships} groups={bundle.farmGroups} farms={bundle.farms}/>
      <div className="access-validation-grid">
        <section className="access-validation-block" aria-labelledby="permissions-dos">
          <h3 id="permissions-dos">Dos</h3>
          <ul className="access-validation-list">{summary.can.length ? summary.can.map(item => <li key={item}>{item}</li>) : <li>No allowed actions are listed.</li>}</ul>
        </section>
        <section className="access-validation-block access-validation-block-muted" aria-labelledby="permissions-cant-dos">
          <h3 id="permissions-cant-dos">Can’t Dos</h3>
          <ul className="access-validation-list">{summary.cannot.length ? summary.cannot.map(item => <li key={item}>{item}</li>) : <li>No blocked actions are listed in the permission catalog.</li>}</ul>
        </section>
      </div>
    </> : <p role="alert">{canSelectUser ? "The selected user’s permissions could not be verified. Select another user or review their role assignments." : "Your permissions could not be verified. Please contact your administrator."}</p>}
  </section>;
}
