import { unstable_noStore as noStore } from "next/cache";

import { getAdminData } from "@/lib/admin-data";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AccessActionPermission,
  AccessMembership,
  AccessReview,
  AccessRoleKey,
  AccessRoleTemplate,
  AccessUserRecord,
  AccessValidationSummary,
  FarmGroupRecord,
  FarmRecord,
  UserAccessBundle,
} from "@/lib/types";

type LiveRoleRow = {
  id: string;
  code: string | null;
  description: string | null;
};

type LiveSysactionRow = {
  id: string;
  action: string | null;
};

type LivePermissionRow = {
  role_id: string;
  action_id: string;
  menu_access: boolean | null;
  createyn: boolean | null;
  readyn: boolean | null;
  updateyn: boolean | null;
  deleteyn: boolean | null;
};

type LiveAppUserRow = {
  id: string;
  email?: string | null;
  last_sign_in_at?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
    display_name?: string | null;
    [key: string]: unknown;
  } | null;
  banned_until?: string | null;
};

type LiveUserRoleRow = {
  user_id: string;
  role_id?: string | null;
  role: string | null;
};

type LiveFarmGroupMembershipRow = {
  id: string;
  user_id: string;
  farm_group_id: string;
  active: boolean | null;
};

type LiveFarmMembershipRow = {
  user_id: string;
  farm_id: string;
  is_active: boolean | null;
};

const fallbackRoleTemplates: AccessRoleTemplate[] = [
  {
    key: "super_admin",
    label: "Super Admin",
    description: "Full platform authority across every integrator, grower group, and farm.",
    rank: 500,
    homeScope: "integrator_group",
    capabilities: [
      "view dashboard",
      "manage platform options",
      "manage integrator scope",
      "manage farm groups",
      "manage farms",
      "manage flocks",
      "manage placements",
      "manage users",
      "assign local users",
      "enter weights",
      "enter grades",
    ],
    permissionRows: [],
    assignableRoles: [
      "super_admin",
      "integrator_manager",
      "grower_admin",
      "farm_manager",
      "flock_supervisor",
    ],
  },
  {
    key: "integrator_manager",
    label: "Integrator Manager",
    description: "Manages live operations and access across all grower groups inside an integrator.",
    rank: 400,
    homeScope: "integrator_group",
    capabilities: [
      "view dashboard",
      "manage farm groups",
      "manage farms",
      "manage flocks",
      "manage placements",
      "manage users",
      "assign local users",
      "enter weights",
      "enter grades",
    ],
    permissionRows: [],
    assignableRoles: ["grower_admin", "farm_manager", "flock_supervisor"],
  },
  {
    key: "grower_admin",
    label: "Grower Admin",
    description: "Owns setup and local user access inside a single farm group.",
    rank: 300,
    homeScope: "farm_group",
    capabilities: [
      "view dashboard",
      "manage farms",
      "manage flocks",
      "manage placements",
      "manage users",
      "assign local users",
      "enter weights",
      "enter grades",
    ],
    permissionRows: [],
    assignableRoles: ["farm_manager", "flock_supervisor"],
  },
  {
    key: "farm_manager",
    label: "Farm Manager",
    description: "Operates one or more farms and can manage day-to-day execution at that level.",
    rank: 200,
    homeScope: "farm",
    capabilities: ["view dashboard", "manage placements", "enter weights", "enter grades"],
    permissionRows: [],
    assignableRoles: ["flock_supervisor"],
  },
  {
    key: "flock_supervisor",
    label: "Flock Supervisor",
    description: "Specialist role for flock observations, weight entry, and grading only.",
    rank: 100,
    homeScope: "farm",
    capabilities: ["view dashboard", "enter weights", "enter grades"],
    permissionRows: [],
    assignableRoles: [],
  },
];

export async function getUserAccessBundle(): Promise<UserAccessBundle> {
  noStore();

  const adminData = await getAdminData();
  const liveRoles = await getLiveRoleTemplates();
  const actingUserId = await getActingUserId();
  const liveUsers = await getLiveAccessUsers(adminData.farmGroups, adminData.farms, liveRoles.length > 0 ? liveRoles : fallbackRoleTemplates);

  return {
    actingUserId,
    roles: liveRoles.length > 0 ? liveRoles : fallbackRoleTemplates,
    users:
      liveUsers.length > 0
        ? liveUsers
        : buildMockUsers(adminData.farmGroups, adminData.farms, liveRoles.length > 0 ? liveRoles : fallbackRoleTemplates),
  };
}

export function resolveRoleTemplate(roles: AccessRoleTemplate[], role: AccessRoleKey) {
  const normalizedRole = normalizeKey(role);

  return (
    roles.find((template) => normalizeKey(template.key) === normalizedRole) ??
    fallbackRoleTemplates.find((template) => normalizeKey(template.key) === normalizedRole) ??
    fallbackRoleTemplates[0]
  );
}

export function reviewUserAccess(
  actor: AccessUserRecord,
  target: AccessUserRecord,
  roles: AccessRoleTemplate[] = fallbackRoleTemplates,
): AccessReview {
  const actorRole = resolveRoleTemplate(roles, actor.role);
  const targetRole = resolveRoleTemplate(roles, target.role);
  const hasScopeOverlap = membershipsOverlap(actor.memberships, target.memberships);
  const actorIsSuperAdmin = isSuperAdminRole(actorRole);
  const actorCanManageUsers = canManageUsers(actorRole);

  if (actor.id === target.id) {
    return {
      canView: true,
      canEdit: false,
      canAssignRole: false,
      reason: "Users should not elevate or restructure their own access from this screen.",
    };
  }

  if (actorRole.rank <= targetRole.rank && !actorIsSuperAdmin) {
    return {
      canView: hasScopeOverlap,
      canEdit: false,
      canAssignRole: false,
      reason: "This target role is equal to or higher than the acting user.",
    };
  }

  if (!hasScopeOverlap && !actorIsSuperAdmin) {
    return {
      canView: false,
      canEdit: false,
      canAssignRole: false,
      reason: "This target user sits outside the acting user's membership scope.",
    };
  }

  return {
    canView: true,
    canEdit: actorCanManageUsers,
    canAssignRole: actorRole.assignableRoles.some((roleKey) => normalizeKey(roleKey) === normalizeKey(target.role)),
    reason: actorRole.assignableRoles.some((roleKey) => normalizeKey(roleKey) === normalizeKey(target.role))
      ? "Actor can manage this user inside the current membership boundary."
      : "Actor can view this user but cannot grant or change the assigned role.",
  };
}

function isSuperAdminRole(role: AccessRoleTemplate) {
  const normalized = normalizeKey(role.key);
  return (
    normalized === "super_admin" ||
    normalized === "superadmin" ||
    normalized.includes("super")
  );
}

function canManageUsers(role: AccessRoleTemplate) {
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

export function summarizeMemberships(memberships: AccessMembership[]) {
  return memberships.map((membership) => membership.scopeLabel).join(" / ");
}

export function buildAccessValidationSummary(
  user: AccessUserRecord,
  roles: AccessRoleTemplate[] = fallbackRoleTemplates,
): AccessValidationSummary {
  const effectiveRoles = resolveAssignedRoles(user, roles);
  const roleLabels = effectiveRoles.map((role) => role.label);
  const scopeLabels = user.memberships.map((membership) => membership.scopeLabel);
  const allActivityCatalog = buildActivityCatalog(roles);
  const allowedActivities = new Set<string>();

  for (const role of effectiveRoles) {
    for (const capability of role.capabilities) {
      const formatted = formatCapability(capability);
      if (formatted) {
        allowedActivities.add(formatted);
      }
    }

    for (const permissionRow of role.permissionRows) {
      for (const activity of expandPermissionActivities(permissionRow)) {
        allowedActivities.add(activity);
      }
    }
  }

  const can = Array.from(allowedActivities).sort((left, right) => left.localeCompare(right));
  const cannot = allActivityCatalog.filter((activity) => !allowedActivities.has(activity));

  return {
    roleLabels,
    scopeLabels,
    can,
    cannot,
  };
}

function membershipsOverlap(actorMemberships: AccessMembership[], targetMemberships: AccessMembership[]) {
  return actorMemberships.some((actorMembership) =>
    targetMemberships.some(
      (targetMembership) =>
        actorMembership.scopeType === targetMembership.scopeType &&
        actorMembership.scopeId === targetMembership.scopeId,
    ),
  );
}

function resolveAssignedRoles(user: AccessUserRecord, roles: AccessRoleTemplate[]) {
  const assigned = user.assignedRoles.length > 0 ? user.assignedRoles : [user.role];
  const seen = new Set<string>();
  const resolved: AccessRoleTemplate[] = [];

  for (const roleKey of assigned) {
    const role = resolveRoleTemplate(roles, roleKey);
    const normalized = normalizeKey(role.key);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    resolved.push(role);
  }

  return resolved.sort((left, right) => right.rank - left.rank || left.label.localeCompare(right.label));
}

function buildActivityCatalog(roles: AccessRoleTemplate[]) {
  const values = new Set<string>();

  for (const role of roles) {
    for (const capability of role.capabilities) {
      const formatted = formatCapability(capability);
      if (formatted) {
        values.add(formatted);
      }
    }

    for (const permissionRow of role.permissionRows) {
      for (const activity of expandPermissionActivities(permissionRow)) {
        values.add(activity);
      }
    }
  }

  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function expandPermissionActivities(permissionRow: AccessActionPermission) {
  const actionLabel = humanizePermissionAction(permissionRow.action);
  const values: string[] = [];

  if (permissionRow.menuAccess) values.push(`Open ${actionLabel}`);
  if (permissionRow.create) values.push(`Create ${actionLabel}`);
  if (permissionRow.read) values.push(`Read ${actionLabel}`);
  if (permissionRow.update) values.push(`Update ${actionLabel}`);
  if (permissionRow.delete) values.push(`Delete ${actionLabel}`);

  return values;
}

function humanizePermissionAction(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCapability(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function getLiveRoleTemplates(): Promise<AccessRoleTemplate[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return [];
  }

  const [rolesResult, sysactionsResult, permissionsResult] = await Promise.all([
    supabase.from("roles").select("id,code,description").order("code"),
    supabase.from("sysactions").select("id,action").order("action"),
    supabase
      .from("roles_actions_permissions")
      .select("role_id,action_id,menu_access,createyn,readyn,updateyn,deleteyn"),
  ]);

  if (rolesResult.error || sysactionsResult.error || permissionsResult.error) {
    return [];
  }

  const roles = (rolesResult.data ?? []) as LiveRoleRow[];
  const sysactions = (sysactionsResult.data ?? []) as LiveSysactionRow[];
  const permissions = (permissionsResult.data ?? []) as LivePermissionRow[];
  const actionById = new Map(sysactions.map((row) => [row.id, row.action ?? "unknown_action"]));

  return roles
    .filter((row) => typeof row.code === "string" && row.code.trim().length > 0)
    .map((role) => {
      const fallback = fallbackRoleTemplates.find((template) => normalizeKey(template.key) === normalizeKey(role.code ?? ""));
      const capabilitySet = new Set<string>();

      permissions
        .filter((permission) => permission.role_id === role.id)
        .forEach((permission) => {
          const actionName = actionById.get(permission.action_id) ?? "unknown_action";
          if (permission.menu_access) {
            capabilitySet.add(`access ${actionName}`);
          }
          if (permission.createyn) {
            capabilitySet.add(`create ${actionName}`);
          }
          if (permission.readyn) {
            capabilitySet.add(`read ${actionName}`);
          }
          if (permission.updateyn) {
            capabilitySet.add(`update ${actionName}`);
          }
          if (permission.deleteyn) {
            capabilitySet.add(`delete ${actionName}`);
          }
        });

      return {
        key: role.code ?? "unknown_role",
        label: fallback?.label ?? humanizeCode(role.code ?? "unknown_role"),
        description:
          role.description ??
          fallback?.description ??
          "Live role imported from the security tables.",
        rank: fallback?.rank ?? inferRank(role.code ?? ""),
        homeScope: fallback?.homeScope ?? inferHomeScope(role.code ?? ""),
        capabilities: Array.from(capabilitySet).sort((left, right) => left.localeCompare(right)),
        permissionRows: permissions
          .filter((permission) => permission.role_id === role.id)
          .map((permission) => toPermissionRow(permission, actionById))
          .sort((left, right) => left.action.localeCompare(right.action)),
        assignableRoles: fallback?.assignableRoles ?? inferAssignableRoles(role.code ?? ""),
      } satisfies AccessRoleTemplate;
    });
}

async function getLiveAccessUsers(
  farmGroups: FarmGroupRecord[],
  farms: FarmRecord[],
  roleTemplates: AccessRoleTemplate[],
): Promise<AccessUserRecord[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return [];
  }

  const [userRolesResult, farmGroupMembershipsResult, farmMembershipsResult, authUsersResult] = await Promise.all([
    getLiveUserRoles(supabase),
    supabase.from("farm_group_memberships").select("id,user_id,farm_group_id,active"),
    supabase.from("farm_memberships").select("user_id,farm_id,is_active"),
    listAllAuthUsers(supabase),
  ]);

  if (userRolesResult.error || farmGroupMembershipsResult.error || farmMembershipsResult.error || authUsersResult.error) {
    return [];
  }

  const appUsers = (authUsersResult.data.users ?? []) as LiveAppUserRow[];
  const userRoles = (userRolesResult.data ?? []) as LiveUserRoleRow[];
  const farmGroupMemberships = (farmGroupMembershipsResult.data ?? []) as LiveFarmGroupMembershipRow[];
  const farmMemberships = (farmMembershipsResult.data ?? []) as LiveFarmMembershipRow[];

  if (appUsers.length === 0) {
    return [];
  }

  const users = appUsers.map((appUser) => {
    const assignedRoles = userRoles
      .filter((row) => row.user_id === appUser.id && typeof row.role === "string" && row.role.trim().length > 0)
      .map((row) => row.role as string);
    const primaryRole = choosePrimaryRole(assignedRoles, roleTemplates);
    const memberships = [
      ...farmGroupMemberships
        .filter((membership) => membership.user_id === appUser.id && membership.active !== false)
        .map((membership) => toLiveFarmGroupMembership(membership, farmGroups)),
      ...farmMemberships
        .filter((membership) => membership.user_id === appUser.id && membership.is_active !== false)
        .map((membership) => toLiveFarmMembership(membership, farms)),
    ];
    const resolvedRole = resolveRoleTemplate(roleTemplates, primaryRole);

    return {
      id: appUser.id,
      displayName: deriveDisplayName(appUser),
      email: appUser.email?.trim() || "No email on file",
      role: primaryRole,
      assignedRoles,
      roleLabel: resolvedRole.label,
      status: deriveUserStatus(appUser),
      memberships,
      note: memberships.length > 0
        ? appUser.last_sign_in_at
          ? `Last active ${formatLastSeen(appUser.last_sign_in_at)}.`
          : "Authenticated in Supabase. No recent sign-in has been recorded yet."
        : "Authenticated in Supabase, but no FlockTrax memberships have been assigned yet.",
    } satisfies AccessUserRecord;
  });

  return users.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function choosePrimaryRole(assignedRoles: string[], roleTemplates: AccessRoleTemplate[]) {
  if (assignedRoles.length === 0) {
    return "farmhand";
  }

  return [...assignedRoles]
    .sort((left, right) => {
      const leftRole = resolveRoleTemplate(roleTemplates, left);
      const rightRole = resolveRoleTemplate(roleTemplates, right);

      if (leftRole.rank !== rightRole.rank) {
        return rightRole.rank - leftRole.rank;
      }

      return leftRole.label.localeCompare(rightRole.label);
    })[0];
}

async function listAllAuthUsers(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const users: LiveAppUserRow[] = [];
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage });
    if (result.error) {
      return result;
    }

    const batch = (result.data.users ?? []) as LiveAppUserRow[];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }
  }

  return {
    data: { users },
    error: null,
  };
}

async function getLiveUserRoles(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const normalizedResult = await supabase
    .from("user_roles")
    .select("user_id,role_id");

  if (!normalizedResult.error) {
    const rolesResult = await supabase.from("roles").select("id,code");

    if (!rolesResult.error) {
      const rolesById = new Map(
        (rolesResult.data ?? [])
          .filter((row) => typeof row.id === "string" && typeof row.code === "string")
          .map((row) => [row.id as string, row.code as string]),
      );

      return {
        data: ((normalizedResult.data ?? []) as Array<{ user_id: string; role_id: string | null }>).map((row) => ({
          user_id: row.user_id,
          role_id: row.role_id,
          role: row.role_id ? (rolesById.get(row.role_id) ?? null) : null,
        })),
        error: null,
      };
    }
  }

  const legacyResult = await supabase.from("user_roles").select("user_id,role");

  return {
    data: (legacyResult.data ?? []) as LiveUserRoleRow[],
    error: legacyResult.error,
  };
}

async function getActingUserId() {
  const serverClient = await createSupabaseServerClient();
  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  return authResult?.data.user?.id ?? null;
}

function buildMockUsers(
  farmGroups: FarmGroupRecord[],
  farms: FarmRecord[],
  roleTemplates: AccessRoleTemplate[],
): AccessUserRecord[] {
  const primaryFarmGroup = farmGroups[0];
  const secondaryFarmGroup = farmGroups[1] ?? farmGroups[0];
  const primaryFarm = farms.find((farm) => farm.farmGroupId === primaryFarmGroup?.id) ?? farms[0];
  const secondaryFarm =
    farms.find((farm) => farm.farmGroupId === secondaryFarmGroup?.id) ?? farms[1] ?? farms[0];

  const integratorMembership: AccessMembership = {
    id: "membership-int-pilgrims",
    scopeType: "integrator_group",
    scopeId: "integrator-pilgrims",
    scopeLabel: "Pilgrim's Live Operations",
  };

  const secondaryIntegratorMembership: AccessMembership = {
    id: "membership-int-tyson",
    scopeType: "integrator_group",
    scopeId: "integrator-tyson",
    scopeLabel: "Tyson Live Operations",
  };

  const primaryFarmGroupMembership = toFarmGroupMembership(primaryFarmGroup);
  const secondaryFarmGroupMembership = toFarmGroupMembership(secondaryFarmGroup);
  const primaryFarmMembership = toFarmMembership(primaryFarm);
  const secondaryFarmMembership = toFarmMembership(secondaryFarm);

  const labelForRole = (role: string) => resolveRoleTemplate(roleTemplates, role).label;

  return [
    {
      id: "user-ken",
      displayName: "Ken Smotherman",
      email: "ken@flocktrax.com",
      role: "super_admin",
      assignedRoles: ["super_admin"],
      roleLabel: labelForRole("super_admin"),
      status: "active",
      memberships: [integratorMembership, secondaryIntegratorMembership],
      note: "Platform owner with full visibility and system authority.",
    },
    {
      id: "user-julia",
      displayName: "Julia Mercer",
      email: "julia@pilgrims.example",
      role: "integrator_manager",
      assignedRoles: ["integrator_manager"],
      roleLabel: labelForRole("integrator_manager"),
      status: "active",
      memberships: [integratorMembership],
      note: "Corporate live operations manager across one integrator group.",
    },
    {
      id: "user-maria",
      displayName: "Maria Reyes",
      email: "maria@smothermanfarms.example",
      role: "grower_admin",
      assignedRoles: ["grower_admin"],
      roleLabel: labelForRole("grower_admin"),
      status: "active",
      memberships: [primaryFarmGroupMembership],
      note: "Grower-side owner/admin responsible for farms inside a single farm group.",
    },
    {
      id: "user-jon",
      displayName: "Jon Brown",
      email: "jon@sulakfarm.example",
      role: "farm_manager",
      assignedRoles: ["farm_manager"],
      roleLabel: labelForRole("farm_manager"),
      status: "active",
      memberships: [primaryFarmMembership],
      note: "Farm manager limited to assigned farm operations and local execution.",
    },
    {
      id: "user-ella",
      displayName: "Ella Watkins",
      email: "ella@pilgrims.example",
      role: "flock_supervisor",
      assignedRoles: ["flock_supervisor"],
      roleLabel: labelForRole("flock_supervisor"),
      status: "invited",
      memberships: [primaryFarmMembership, secondaryFarmMembership].filter(Boolean) as AccessMembership[],
      note: "Specialist restricted to weights and grading across assigned farms.",
    },
    {
      id: "user-miguel",
      displayName: "Miguel Torres",
      email: "miguel@southcreek.example",
      role: "grower_admin",
      assignedRoles: ["grower_admin"],
      roleLabel: labelForRole("grower_admin"),
      status: "active",
      memberships: [secondaryFarmGroupMembership],
      note: "Separate grower admin that should stay isolated from other farm groups.",
    },
  ];
}

function toPermissionRow(
  permission: LivePermissionRow,
  actionById: Map<string, string>,
): AccessActionPermission {
  return {
    actionId: permission.action_id,
    action: actionById.get(permission.action_id) ?? "unknown_action",
    menuAccess: permission.menu_access ?? false,
    create: permission.createyn ?? false,
    read: permission.readyn ?? false,
    update: permission.updateyn ?? false,
    delete: permission.deleteyn ?? false,
  };
}

function toLiveFarmGroupMembership(
  membership: LiveFarmGroupMembershipRow,
  farmGroups: FarmGroupRecord[],
): AccessMembership {
  const farmGroup = farmGroups.find((row) => row.id === membership.farm_group_id);

  return {
    id: membership.id,
    scopeType: "farm_group",
    scopeId: membership.farm_group_id,
    scopeLabel: farmGroup?.groupName ?? "Assigned Farm Group",
  };
}

function toLiveFarmMembership(
  membership: LiveFarmMembershipRow,
  farms: FarmRecord[],
): AccessMembership {
  const farm = farms.find((row) => row.id === membership.farm_id);

  return {
    id: `membership-farm-${membership.user_id}-${membership.farm_id}`,
    scopeType: "farm",
    scopeId: membership.farm_id,
    scopeLabel: farm?.farmName ?? "Assigned Farm",
  };
}

function toFarmGroupMembership(farmGroup: FarmGroupRecord | undefined): AccessMembership {
  return {
    id: `membership-group-${farmGroup?.id ?? "default"}`,
    scopeType: "farm_group",
    scopeId: farmGroup?.id ?? "farm-group-default",
    scopeLabel: farmGroup?.groupName ?? "Assigned Farm Group",
  };
}

function toFarmMembership(farm: FarmRecord | undefined): AccessMembership {
  return {
    id: `membership-farm-${farm?.id ?? "default"}`,
    scopeType: "farm",
    scopeId: farm?.id ?? "farm-default",
    scopeLabel: farm?.farmName ?? "Assigned Farm",
  };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function fallbackNameFromEmail(email: string | null) {
  if (!email) {
    return "";
  }

  return email.split("@")[0] ?? "";
}

function deriveDisplayName(user: LiveAppUserRow) {
  return (
    user.user_metadata?.full_name?.trim() ||
    user.user_metadata?.name?.trim() ||
    user.user_metadata?.display_name?.trim() ||
    fallbackNameFromEmail(user.email ?? null) ||
    "Unnamed User"
  );
}

function deriveUserStatus(user: LiveAppUserRow): AccessUserRecord["status"] {
  if (user.banned_until && user.banned_until !== "none") {
    return "inactive";
  }

  if (!user.last_sign_in_at) {
    return "invited";
  }

  return "active";
}

function formatLastSeen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanizeCode(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferRank(roleCode: string) {
  const normalized = normalizeKey(roleCode);
  if (normalized.includes("super")) return 500;
  if (normalized === "admin") return 300;
  if (normalized.includes("integrator")) return 400;
  if (normalized.includes("grower")) return 300;
  if (normalized.includes("manager")) return 200;
  if (normalized.includes("supervisor") || normalized.includes("tech")) return 100;
  return 50;
}

function inferHomeScope(roleCode: string): AccessRoleTemplate["homeScope"] {
  const normalized = normalizeKey(roleCode);
  if (normalized.includes("integrator") || normalized.includes("super")) {
    return "integrator_group";
  }
  if (normalized === "admin") {
    return "farm_group";
  }
  if (normalized.includes("grower") || normalized.includes("group")) {
    return "farm_group";
  }
  return "farm";
}

function inferAssignableRoles(roleCode: string): AccessRoleKey[] {
  const normalized = normalizeKey(roleCode);

  if (normalized === "super_admin" || normalized === "superadmin") {
    return ["super_admin", "integrator_manager", "grower_admin", "farm_manager", "flock_supervisor"];
  }

  if (normalized.includes("integrator")) {
    return ["grower_admin", "farm_manager", "flock_supervisor"];
  }

  if (normalized === "admin" || normalized.includes("grower") || normalized.includes("group")) {
    return ["farm_manager", "flock_supervisor"];
  }

  if (normalized.includes("manager")) {
    return ["flock_supervisor"];
  }

  return [];
}
