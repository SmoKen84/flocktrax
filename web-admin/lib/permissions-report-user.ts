import type { AccessUserRecord, UserAccessBundle } from "@/lib/types";

export function resolvePermissionsReportUser(
  bundle: UserAccessBundle,
  actorId: string,
  requestedUserId?: string,
  restrictedToSelf = false,
) {
  const actor = bundle.users.find((user) => user.id === actorId);
  const verified = (user: AccessUserRecord | undefined) => {
    if (!user) return false;
    const assigned = user.assignedRoles.length ? user.assignedRoles : [user.role];
    return assigned.length > 0 && assigned.every((key) => bundle.roles.some((role) => role.key === key));
  };
  const assigned = actor ? (actor.assignedRoles.length ? actor.assignedRoles : [actor.role]) : [];
  const canSelectUser = !restrictedToSelf && verified(actor) && !actor?.isDisabled && assigned.some((key) => {
    const normalized = key.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return normalized === "super_admin" || normalized === "superadmin";
  });
  const selectedUserId = canSelectUser && requestedUserId ? requestedUserId : actorId;
  const user = verified(actor) ? bundle.users.find((candidate) => candidate.id === selectedUserId) : undefined;
  return { canSelectUser, selectedUserId, user, verified: verified(user) };
}
