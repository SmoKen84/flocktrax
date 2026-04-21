import Link from "next/link";

import {
  addFarmGroupMembershipAction,
  addFarmMembershipAction,
  assignUserRoleAction,
  inviteUserAccessAction,
  removeFarmGroupMembershipAction,
  removeFarmMembershipAction,
  removeUserRoleAction,
} from "@/app/admin/user-access/actions";
import { FlockTraxWordmark } from "@/components/flocktrax-wordmark";
import { getUserAccessBundle, resolveRoleTemplate, reviewUserAccess, summarizeMemberships } from "@/lib/access-control";

type UserAccessPageProps = {
  searchParams?: Promise<{
    mode?: string | string[];
    group?: string | string[];
    farm?: string | string[];
    status?: string | string[];
    selected?: string | string[];
    notice?: string | string[];
    error?: string | string[];
  }>;
};

export default async function UserAccessPage({ searchParams }: UserAccessPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const mode = readParam(params?.mode);
  const groupFilter = readParam(params?.group);
  const farmFilter = readParam(params?.farm);
  const statusFilter = readParam(params?.status);
  const selectedUserId = readParam(params?.selected);
  const notice = readParam(params?.notice);
  const error = readParam(params?.error);

  const bundle = await getUserAccessBundle();
  const actingUser = bundle.users.find((user) => user.id === bundle.actingUserId) ?? bundle.users[0];
  const reviewedUsers = bundle.users.map((user) => ({
    user,
    review: reviewUserAccess(actingUser, user, bundle.roles),
  }));

  const visibleUsers = reviewedUsers.filter(({ user, review }) => {
    if (user.id === actingUser.id) {
      return true;
    }

    if (!review.canView) {
      return false;
    }

    if (groupFilter && !user.memberships.some((membership) => membership.scopeType === "farm_group" && membership.scopeId === groupFilter)) {
      return false;
    }

    if (farmFilter && !user.memberships.some((membership) => membership.scopeType === "farm" && membership.scopeId === farmFilter)) {
      return false;
    }

    if (statusFilter && user.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const selectedTarget =
    visibleUsers.find(({ user }) => user.id === selectedUserId)?.user ??
    visibleUsers.find(({ user, review }) => user.id !== actingUser.id && review.canEdit)?.user ??
    visibleUsers.find(({ user }) => user.id === actingUser.id)?.user ??
    visibleUsers.find(({ user }) => user.id !== actingUser.id)?.user ??
    null;

  const actingRole = resolveRoleTemplate(bundle.roles, actingUser.role);
  const selectedTargetReview = selectedTarget ? reviewUserAccess(actingUser, selectedTarget, bundle.roles) : null;
  const selectedTargetRoles = selectedTarget?.assignedRoles ?? [];
  const selectedRole = resolveSelectedRole(bundle.roles, selectedTargetRoles, actingRole.key);
  const selectedRoleKey = selectedRole.key;
  const targetMembershipGroups = (selectedTarget?.memberships ?? []).filter((membership) => membership.scopeType === "farm_group");
  const targetMembershipFarms = (selectedTarget?.memberships ?? []).filter((membership) => membership.scopeType === "farm");
  const canEditCodes = actingRole.permissionRows.some(
    (permissionRow) =>
      ["platform_settings", "user_access_control", "users"].includes(permissionRow.action) &&
      (permissionRow.create || permissionRow.update),
  );
  const codesMode = canEditCodes && mode === "codes";
  const inviteMode = !codesMode && mode === "invite";
  const isSelfSelected = selectedTarget?.id === actingUser.id;
  const canManageLiveAssignments = Boolean(selectedTarget && selectedTargetReview?.canEdit && !isSelfSelected);

  const groupOptions = Array.from(
    new Map(
      bundle.users
        .flatMap((user) => user.memberships.filter((membership) => membership.scopeType === "farm_group"))
        .map((membership) => [membership.scopeId, membership.scopeLabel]),
    ).entries(),
  ).sort((left, right) => left[1].localeCompare(right[1]));

  const farmOptions = Array.from(
    new Map(
      bundle.users
        .flatMap((user) => user.memberships.filter((membership) => membership.scopeType === "farm"))
        .map((membership) => [membership.scopeId, membership.scopeLabel]),
    ).entries(),
  ).sort((left, right) => left[1].localeCompare(right[1]));

  const availableGroupOptions = groupOptions.filter(
    ([scopeId]) => !targetMembershipGroups.some((membership) => membership.scopeId === scopeId),
  );
  const availableFarmOptions = farmOptions.filter(
    ([scopeId]) => !targetMembershipFarms.some((membership) => membership.scopeId === scopeId),
  );
  const assignableRoleOptions = getAssignableRoleOptions(bundle.roles, actingRole);
  const availableAssignableRoles = assignableRoleOptions.filter(
    (role) => !selectedTargetRoles.some((assignedRole) => normalizeKey(assignedRole) === normalizeKey(role.key)),
  );
  const membershipRoleOptions = Array.from(
    new Map(
      [...selectedTargetRoles, ...assignableRoleOptions.map((role) => role.key), actingRole.key].map((roleKey) => {
        const role = resolveRoleTemplate(bundle.roles, roleKey);
        return [normalizeKey(role.key), { key: role.key, label: role.label }];
      }),
    ).values(),
  );
  const inviteRoleOptions = assignableRoleOptions.map((role) => ({
    key: role.key,
    label: role.label,
  }));
  const canInviteUsers = actorCanManageUsers(actingRole) && inviteRoleOptions.length > 0;
  const hasActiveFilters = Boolean(groupFilter || farmFilter || statusFilter);

  const buildUserAccessHref = (targetUserId?: string, overrideMode?: string | null) => {
    const query = new URLSearchParams();
    const resolvedMode = overrideMode === undefined ? mode : overrideMode;

    if (resolvedMode) query.set("mode", resolvedMode);
    if (groupFilter) query.set("group", groupFilter);
    if (farmFilter) query.set("farm", farmFilter);
    if (statusFilter) query.set("status", statusFilter);
    if (targetUserId) query.set("selected", targetUserId);

    const search = query.toString();
    return search ? `/admin/user-access?${search}` : "/admin/user-access";
  };

  const targetReturnTo = buildUserAccessHref(selectedTarget?.id ?? undefined, codesMode ? "codes" : null);
  const inviteReturnTo = buildUserAccessHref(undefined, "invite");
  const statusBannerTone = codesMode ? "staged" : "live";
  const statusBannerLabel = codesMode ? "Catalog edits are still staged" : "Assignments are live";

  return (
    <>
      <section className="panel access-hero-panel">
        <p className="hero-kicker">User Access Control</p>
        <FlockTraxWordmark compact product="Admin" tone="accent" />
        <p className="access-hero-copy">
          The users and access granted below apply to both the Admin and Mobile systems. Access authority is
          defined as roles that a user assumes in FlockTrax. The extent or scope of the granted role or roles is
          limited by the user&apos;s memberships within the groups and farms of which FlockTrax collects and reports data.
        </p>
        <div className="access-status-banner" role="note">
          <span className="access-status-pill" data-tone="live">Live data</span>
          <span className="access-status-pill" data-tone={statusBannerTone}>{statusBannerLabel}</span>
          <p className="access-status-copy">
            Directory users, role assignments, invite flow, and membership assignments now save through Supabase in
            user-grant mode. The permission matrix and role-code catalog remain read-only until we wire dedicated
            maintenance actions for them.
          </p>
        </div>
      </section>

      <section className="access-grid">
        <article className="card access-card">
          <div className="access-card-header">
            <div className="access-card-header-row">
              <div>
                <p className="access-card-title">User Directory</p>
                <p className="access-card-subtitle">
                  The listing below is filtered from live access data based on the current user&apos;s authority to review and manage assignments.
                </p>
              </div>
              {canInviteUsers ? (
                <Link className="button-secondary access-codes-button" href={buildUserAccessHref(undefined, "invite")}>
                  Invite New User
                </Link>
              ) : null}
            </div>
          </div>

          <div className="access-user-directory-meta">
            <div className="access-user-directory-legend">
              <span className="access-user-legend-pill" data-tone="edited">User Being Edited</span>
              <span className="access-user-legend-pill" data-tone="grantor">User Granting Access</span>
            </div>
            <span>{visibleUsers.length} of {bundle.users.length} users listed</span>
          </div>

          <form className="access-filter-row" method="get">
            <label className="access-filter-field">
              <span>Group</span>
              <select defaultValue={groupFilter ?? ""} name="group">
                <option value="">All groups</option>
                {groupOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="access-filter-field">
              <span>Farm</span>
              <select defaultValue={farmFilter ?? ""} name="farm">
                <option value="">All farms</option>
                {farmOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="access-filter-field">
              <span>Status</span>
              <select defaultValue={statusFilter ?? ""} name="status">
                <option value="">Any status</option>
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <div className="access-filter-actions">
              <button className="button-secondary access-filter-button" type="submit">
                Apply
              </button>
              {hasActiveFilters ? (
                <Link className="button-ghost access-filter-button" href="/admin/user-access">
                  Clear
                </Link>
              ) : null}
            </div>
          </form>

          <div className="access-user-list">
            {visibleUsers.map(({ user, review }) =>
              user.id === actingUser.id ? (
                <Link
                  className="access-user-row access-user-row-link"
                  data-active={true}
                  data-selected={user.id === selectedTarget?.id}
                  href={buildUserAccessHref(user.id, codesMode ? "codes" : null)}
                  key={user.id}
                >
                  <div>
                    <p className="access-user-name">{user.displayName}</p>
                    <p className="access-user-email">{user.email}</p>
                    <p className="access-user-meta">
                      {user.roleLabel} / {summarizeMemberships(user.memberships) || "No memberships assigned"}
                    </p>
                  </div>
                  <div className="access-user-status-block">
                    <span className="access-user-status" data-status={user.status}>
                      {user.status}
                    </span>
                    <span className="access-user-review" data-allowed="self">
                      Acting User
                    </span>
                  </div>
                </Link>
              ) : (
                <Link
                  className="access-user-row access-user-row-link"
                  data-active={false}
                  data-selected={user.id === selectedTarget?.id}
                  href={buildUserAccessHref(user.id, codesMode ? "codes" : null)}
                  key={user.id}
                >
                  <div>
                    <p className="access-user-name">{user.displayName}</p>
                    <p className="access-user-email">{user.email}</p>
                    <p className="access-user-meta">
                      {user.roleLabel} / {summarizeMemberships(user.memberships) || "No memberships assigned"}
                    </p>
                  </div>
                  <div className="access-user-status-block">
                    <span className="access-user-status" data-status={user.status}>
                      {user.status}
                    </span>
                    <span className="access-user-review" data-allowed={review.canEdit}>
                      {review.canEdit ? "Editable" : "Restricted"}
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>

          {visibleUsers.length === 1 ? (
            <p className="access-directory-help">
              No additional users are visible with the current grantor authority and filter set.
            </p>
          ) : null}

          <p className="access-directory-help">
            Select a user to review or change their live roles and membership scope.
          </p>
        </article>

        <article className="card access-card">
          <div className="access-card-header">
            <div className="access-card-header-row">
              <div>
                <p className="access-card-title">
                  {codesMode ? "Add / Edit Codes" : inviteMode ? "Invite New User" : "Grant User Access"}
                </p>
                <p className="access-card-subtitle">
                  {codesMode
                    ? "Role and permission maintenance here reflects the live catalog, but edits are not committed from this screen yet."
                    : inviteMode
                      ? "Send a real invite and seed the new user with a starter role and scope."
                      : "Roles and memberships save live from this screen. The permission matrix remains read-only."}
                </p>
              </div>
              {canEditCodes ? (
                <Link
                  className="button-secondary access-codes-button"
                  href={codesMode ? buildUserAccessHref(selectedTarget?.id ?? undefined, null) : buildUserAccessHref(selectedTarget?.id ?? undefined, "codes")}
                >
                  {codesMode ? "Back To User Grants" : "Add/Edit Codes"}
                </Link>
              ) : null}
            </div>
          </div>

          {error ? <p className="login-banner login-banner-error">{decodeURIComponent(error)}</p> : null}
          {notice ? <p className="login-banner login-banner-notice">{decodeURIComponent(notice)}</p> : null}

          {inviteMode ? (
            canInviteUsers ? (
              <form action={inviteUserAccessAction} className="access-editor-form">
                <input name="return_to" type="hidden" value={inviteReturnTo} />
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="invite-email">Email</label>
                    <input id="invite-email" name="email" placeholder="new.user@flocktrax.com" required type="email" />
                  </div>

                  <div className="field">
                    <label htmlFor="invite-name">Full Name</label>
                    <input id="invite-name" name="full_name" placeholder="New User" type="text" />
                  </div>

                  <div className="field">
                    <label htmlFor="invite-role">Role</label>
                    <select defaultValue={inviteRoleOptions[0]?.key ?? ""} id="invite-role" name="role_key" required>
                      <option disabled value="">
                        Select a role
                      </option>
                      {inviteRoleOptions.map((role) => (
                        <option key={role.key} value={role.key}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="invite-group">Farm Group</label>
                    <select defaultValue="" id="invite-group" name="farm_group_id">
                      <option value="">No farm group yet</option>
                      {groupOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field field-wide">
                    <label htmlFor="invite-farm">Farm</label>
                    <select defaultValue="" id="invite-farm" name="farm_id">
                      <option value="">No farm yet</option>
                      {farmOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="access-form-actions">
                  <Link className="button-ghost" href={buildUserAccessHref(selectedTarget?.id ?? undefined, null)}>
                    Cancel
                  </Link>
                  <button className="button" type="submit">
                    Send Invite
                  </button>
                </div>
              </form>
            ) : (
              <div className="helper-banner">
                The current grantor does not carry the live permissions needed to invite new users.
              </div>
            )
          ) : !codesMode ? (
            <>
              <div className="access-target-summary-grid">
                <div className="access-detail-panel access-detail-panel-grantor access-target-panel">
                  <div className="access-target-panel-head">
                    <div>
                      <p className="access-detail-value">{selectedTarget?.displayName ?? "No User Selected"}</p>
                      <p className="access-detail-subvalue">{selectedTarget?.email ?? "Select a user from the directory."}</p>
                    </div>
                    <span className="access-target-status">{selectedTarget?.status ?? "idle"}</span>
                  </div>
                  <div className="access-target-panel-foot">
                    <p className="access-target-login">Last selection: {selectedTarget ? selectedTarget.displayName : "none"}</p>
                    <p className="access-target-note">
                      {selectedTarget?.note ?? "Live grant details appear here when a user is selected."}
                    </p>
                  </div>
                </div>

                <div className="access-detail-panel access-detail-panel-grantor access-summary-panel">
                  <p className="access-detail-label">Access Summary</p>
                  <div className="access-summary-list">
                    <p><span>Groups:</span> {targetMembershipGroups.map((membership) => membership.scopeLabel).join(" / ") || "None selected"}</p>
                    <p><span>Farms:</span> {targetMembershipFarms.map((membership) => membership.scopeLabel).join(" / ") || "None selected"}</p>
                    <p><span>Roles:</span> {selectedTargetRoles.map((roleKey) => resolveRoleTemplate(bundle.roles, roleKey).label).join(" / ") || "None assigned"}</p>
                  </div>
                </div>
              </div>

              {!selectedTarget ? (
                <div className="helper-banner">
                  Pick a reachable user from the directory to start managing live roles and membership scope.
                </div>
              ) : isSelfSelected ? (
                <div className="helper-banner">
                  Your own account is visible here for review only. Self-edits stay blocked so you cannot accidentally
                  elevate or break your own access.
                </div>
              ) : !canManageLiveAssignments ? (
                <div className="helper-banner">
                  {selectedTargetReview?.reason ?? "This target is outside the current grantor authority."}
                </div>
              ) : (
                <>
                  <div className="access-membership-frame" data-selection-state="targeted">
                    <div className="access-membership-frame-title">Memberships</div>
                    <div className="access-editor-grid">
                      <div className="access-membership-panel">
                        <div className="access-section-head">
                          <span>Groups</span>
                        </div>
                        <div className="access-membership-list">
                          {targetMembershipGroups.length > 0 ? (
                            targetMembershipGroups.map((membership) => (
                              <div className="access-membership-chip access-editable-chip" key={`${selectedTarget.id}-${membership.id}`}>
                                <span className="access-membership-name">{membership.scopeLabel}</span>
                                <form action={removeFarmGroupMembershipAction}>
                                  <input name="return_to" type="hidden" value={targetReturnTo} />
                                  <input name="target_user_id" type="hidden" value={selectedTarget.id} />
                                  <input name="farm_group_id" type="hidden" value={membership.scopeId} />
                                  <button className="access-chip-remove" type="submit">
                                    Remove
                                  </button>
                                </form>
                              </div>
                            ))
                          ) : (
                            <p className="access-rules-copy">No group memberships assigned.</p>
                          )}
                        </div>

                        {availableGroupOptions.length > 0 ? (
                          <form action={addFarmGroupMembershipAction} className="access-inline-form">
                            <input name="return_to" type="hidden" value={targetReturnTo} />
                            <input name="target_user_id" type="hidden" value={selectedTarget.id} />
                            <label className="field">
                              <span>Add Farm Group</span>
                              <select defaultValue={availableGroupOptions[0]?.[0] ?? ""} name="farm_group_id" required>
                                {availableGroupOptions.map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Role Anchor</span>
                              <select defaultValue={membershipRoleOptions[0]?.key ?? ""} name="membership_role_key" required>
                                {membershipRoleOptions.map((role) => (
                                  <option key={role.key} value={role.key}>
                                    {role.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button className="button-secondary access-inline-submit" type="submit">
                              Add Group
                            </button>
                          </form>
                        ) : null}
                      </div>

                      <div className="access-membership-panel">
                        <div className="access-section-head">
                          <span>Farms</span>
                        </div>
                        <div className="access-membership-list">
                          {targetMembershipFarms.length > 0 ? (
                            targetMembershipFarms.map((membership) => (
                              <div className="access-membership-chip access-editable-chip" key={`${selectedTarget.id}-${membership.id}`}>
                                <span className="access-membership-name">{membership.scopeLabel}</span>
                                <form action={removeFarmMembershipAction}>
                                  <input name="return_to" type="hidden" value={targetReturnTo} />
                                  <input name="target_user_id" type="hidden" value={selectedTarget.id} />
                                  <input name="farm_id" type="hidden" value={membership.scopeId} />
                                  <button className="access-chip-remove" type="submit">
                                    Remove
                                  </button>
                                </form>
                              </div>
                            ))
                          ) : (
                            <p className="access-rules-copy">No farm memberships assigned.</p>
                          )}
                        </div>

                        {availableFarmOptions.length > 0 ? (
                          <form action={addFarmMembershipAction} className="access-inline-form">
                            <input name="return_to" type="hidden" value={targetReturnTo} />
                            <input name="target_user_id" type="hidden" value={selectedTarget.id} />
                            <label className="field">
                              <span>Add Farm</span>
                              <select defaultValue={availableFarmOptions[0]?.[0] ?? ""} name="farm_id" required>
                                {availableFarmOptions.map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field">
                              <span>Role Anchor</span>
                              <select defaultValue={membershipRoleOptions[0]?.key ?? ""} name="membership_role_key">
                                {membershipRoleOptions.map((role) => (
                                  <option key={role.key} value={role.key}>
                                    {role.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button className="button-secondary access-inline-submit" type="submit">
                              Add Farm
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                    <p className="access-frame-caption">
                      Memberships define the live scope that the user&apos;s roles apply to.
                    </p>
                  </div>

                  <div className="access-membership-panel access-role-bucket-panel" data-selection-state="targeted">
                    <div className="access-section-head">
                      <span>Roles</span>
                      <span>{selectedTargetRoles.length} assigned</span>
                    </div>
                    <div className="access-role-bucket access-role-chip-row">
                      {selectedTargetRoles.length > 0 ? (
                        selectedTargetRoles.map((roleKey) => {
                          const role = resolveRoleTemplate(bundle.roles, roleKey);

                          return (
                            <div
                              className="access-role-bucket-item access-role-chip access-editable-chip"
                              data-selected={roleKey === selectedRoleKey}
                              key={`${selectedTarget.id}-${roleKey}`}
                            >
                              <p className="access-role-bucket-name">{role.label}</p>
                              <form action={removeUserRoleAction}>
                                <input name="return_to" type="hidden" value={targetReturnTo} />
                                <input name="target_user_id" type="hidden" value={selectedTarget.id} />
                                <input name="role_key" type="hidden" value={roleKey} />
                                <button className="access-chip-remove" type="submit">
                                  Remove
                                </button>
                              </form>
                            </div>
                          );
                        })
                      ) : (
                        <p className="access-rules-copy">No roles are assigned to this user yet.</p>
                      )}
                    </div>

                    {availableAssignableRoles.length > 0 ? (
                      <form action={assignUserRoleAction} className="access-inline-form">
                        <input name="return_to" type="hidden" value={targetReturnTo} />
                        <input name="target_user_id" type="hidden" value={selectedTarget.id} />
                        <label className="field field-wide">
                          <span>Assign Role</span>
                          <select defaultValue={availableAssignableRoles[0]?.key ?? ""} name="role_key" required>
                            {availableAssignableRoles.map((role) => {
                              return (
                                <option key={role.key} value={role.key}>
                                  {role.label}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        <button className="button-secondary access-inline-submit" type="submit">
                          Save Role
                        </button>
                      </form>
                    ) : (
                      <p className="access-inline-help">
                        All roles that this grantor can assign are already present for the selected user.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="access-membership-panel access-role-bucket-panel" data-selection-state={selectedTarget ? "targeted" : "idle"}>
                <div className="access-section-head">
                  <span>Roles Catalog</span>
                  <span>{bundle.roles.length} roles</span>
                </div>
                <div className="access-role-bucket access-role-chip-row">
                  {bundle.roles.map((role) => (
                    <div
                      className="access-role-bucket-item access-role-chip"
                      data-selected={role.key === selectedRoleKey}
                      key={role.key}
                    >
                      <p className="access-role-bucket-name">{role.label}</p>
                    </div>
                  ))}
                </div>
                <p className="access-inline-help">
                  Catalog editing is the remaining staged part of this screen.
                </p>
              </div>

              <div className="access-capability-panel access-permission-matrix-panel" data-selection-state={selectedTarget ? "targeted" : "idle"}>
                <div className="access-section-head">
                  <span>Granted Permissions Catalog</span>
                  <span>{selectedRole.permissionRows.length} actions</span>
                </div>
                {selectedRole.permissionRows.length ? (
                  <div className="access-permission-table-wrap">
                    <table className="access-permission-table">
                      <thead>
                        <tr>
                          <th />
                          <th>FlockTrax Action</th>
                          <th>Menu Access</th>
                          <th>Create</th>
                          <th>Read</th>
                          <th>Update</th>
                          <th>Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRole.permissionRows.map((permissionRow) => (
                          <tr key={`${selectedRole.key}-${permissionRow.actionId}`}>
                            <td className="access-permission-marker-cell">
                              <span className="access-permission-marker" />
                            </td>
                            <td className="access-permission-action">{permissionRow.action.replaceAll("_", " ")}</td>
                            <td>{renderPermissionCell(permissionRow.menuAccess)}</td>
                            <td>{renderPermissionCell(permissionRow.create)}</td>
                            <td>{renderPermissionCell(permissionRow.read)}</td>
                            <td>{renderPermissionCell(permissionRow.update)}</td>
                            <td>{renderPermissionCell(permissionRow.delete)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="access-rules-copy">No role-action rows are loaded for the selected role yet.</p>
                )}
                <div className="access-permission-footer">
                  <p className="access-frame-caption">
                    This catalog is live-read from the selected role and current permission tables. Create and update
                    actions are still disabled here.
                  </p>
                  <div className="access-inline-actions">
                    <button className="access-inline-button" disabled type="button">+</button>
                    <button className="access-inline-button" disabled type="button">-</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {!codesMode ? (
            <div className="access-membership-panel access-grantor-scope-panel" data-selection-state="idle">
              <div className="access-section-head">
                <span>Grantor Context</span>
                <span>{actingRole.label}</span>
              </div>
              <p className="access-rules-copy">
                Current grantor: {actingUser.displayName}. Scope is {summarizeMemberships(actingUser.memberships)}.
                {selectedTargetReview ? ` ${selectedTargetReview.reason}` : ""}
              </p>
            </div>
          ) : (
            <div className="access-membership-panel access-grantor-scope-panel" data-selection-state="idle">
              <div className="access-section-head">
                <span>Codes Maintenance Context</span>
                <span>{actingRole.label}</span>
              </div>
              <p className="access-rules-copy">
                This mode is visible only because the acting user carries live permissions that imply role-code maintenance authority.
                The role and permission tables shown here are still read-only until we wire the actual create and update actions.
              </p>
            </div>
          )}
        </article>
      </section>
    </>
  );
}

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function resolveSelectedRole(
  allRoles: Array<ReturnType<typeof resolveRoleTemplate>>,
  assignedRoles: string[],
  fallbackRole: string,
) {
  if (assignedRoles.length === 0) {
    return resolveRoleTemplate(allRoles, fallbackRole);
  }

  return [...assignedRoles]
    .sort((left, right) => {
      const leftRole = resolveRoleTemplate(allRoles, left);
      const rightRole = resolveRoleTemplate(allRoles, right);

      if (leftRole.rank !== rightRole.rank) {
        return rightRole.rank - leftRole.rank;
      }

      return leftRole.label.localeCompare(rightRole.label);
    })
    .map((roleKey) => resolveRoleTemplate(allRoles, roleKey))[0];
}

function actorCanManageUsers(role: ReturnType<typeof resolveRoleTemplate>) {
  const normalizedRole = normalizeKey(role.key);

  if (
    normalizedRole === "admin" ||
    normalizedRole.includes("super") ||
    normalizedRole.includes("integrator") ||
    normalizedRole.includes("grower") ||
    normalizedRole.includes("group")
  ) {
    return true;
  }

  if (role.capabilities.some((capability) => capability.includes("manage users"))) {
    return true;
  }

  return role.permissionRows.some((permissionRow) => {
    const action = normalizeKey(permissionRow.action);
    return (
      (action === "user_access_control" || action === "users") &&
      (permissionRow.create || permissionRow.update || permissionRow.menuAccess)
    );
  });
}

function getAssignableRoleOptions(
  allRoles: Array<ReturnType<typeof resolveRoleTemplate>>,
  actingRole: ReturnType<typeof resolveRoleTemplate>,
) {
  const explicitAllowed = new Set(actingRole.assignableRoles.map((roleKey) => normalizeKey(roleKey)));
  const rankFallbackRoles = allRoles.filter((role) => {
    if (normalizeKey(role.key) === normalizeKey(actingRole.key)) {
      return false;
    }

    if (normalizeKey(actingRole.key) === "super_admin" || normalizeKey(actingRole.key) === "superadmin") {
      return role.rank < actingRole.rank;
    }

    return role.rank < actingRole.rank && role.homeScope !== "integrator_group";
  });

  const explicitlyMatchedRoles =
    explicitAllowed.size > 0
      ? rankFallbackRoles.filter((role) =>
          Array.from(explicitAllowed).some((allowedKey) => roleMatchesAssignableHint(role.key, allowedKey)),
        )
      : [];

  const rolesFromCatalog = explicitlyMatchedRoles.length > 0 ? explicitlyMatchedRoles : rankFallbackRoles;

  return rolesFromCatalog.sort((left, right) => left.rank - right.rank || left.label.localeCompare(right.label));
}

function roleMatchesAssignableHint(roleKey: string, allowedKey: string) {
  const normalizedRole = normalizeKey(roleKey);
  const normalizedAllowed = normalizeKey(allowedKey);

  if (normalizedRole === normalizedAllowed) {
    return true;
  }

  const aliasMap: Record<string, string[]> = {
    admin: ["grower_admin", "admin"],
    grower: ["grower_admin", "admin"],
    manager: ["farm_manager", "manager"],
    farmmanager: ["farm_manager", "manager"],
    tech: ["flock_supervisor", "tech"],
    farmhand: ["flock_supervisor", "farmhand", "readonly"],
    readonly: ["readonly", "flock_supervisor", "farmhand"],
  };

  return (aliasMap[normalizedRole] ?? []).includes(normalizedAllowed);
}

function renderPermissionCell(enabled: boolean) {
  return <input checked={enabled} className="access-permission-checkbox" disabled readOnly type="checkbox" />;
}
