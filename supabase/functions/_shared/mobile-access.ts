import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type MobilePermissionAction =
  | "daily_logs"
  | "log_mortality"
  | "weight_samples"
  | "feed_tickets"
  | "grade_birds";

export type MobilePermissionSet = Record<MobilePermissionAction, boolean>;

export type MobileAccessContext = {
  userId: string;
  role: string | null;
  permissions: MobilePermissionSet;
};

type FarmMembershipRow = {
  farm_id: string | null;
  role_id: string | null;
  is_active: boolean | null;
};

type FarmGroupMembershipRow = {
  farm_group_id: string | null;
  role_id: string | null;
  active: boolean | null;
};

type RoleRow = {
  id: string;
  code: string | null;
};

type SysactionRow = {
  id: string;
  action: string | null;
};

type PermissionRow = {
  role_id: string;
  action_id: string;
  createyn: boolean | null;
  updateyn: boolean | null;
};

const EMPTY_PERMISSIONS: MobilePermissionSet = {
  daily_logs: false,
  log_mortality: false,
  weight_samples: false,
  feed_tickets: false,
  grade_birds: false,
};

export async function getAuthenticatedUserId(
  supabase: ReturnType<typeof createClient>,
) {
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  const userId = authData.user?.id ?? null;
  if (!userId) {
    throw new Error("Unable to resolve authenticated user");
  }

  return userId;
}

export async function getMobileAccessContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  targetFarmId?: string | null,
): Promise<MobileAccessContext> {
  const { data: isAdminData, error: isAdminError } = await supabase.rpc("is_admin");
  if (isAdminError) {
    throw new Error(isAdminError.message);
  }

  if (isAdminData === true) {
    return {
      userId,
      role: "admin",
      permissions: {
        daily_logs: true,
        log_mortality: true,
        weight_samples: true,
        feed_tickets: true,
        grade_birds: true,
      },
    };
  }

  const [farmMembershipsResult, farmGroupMembershipsResult] = await Promise.all([
    supabase
      .from("farm_memberships")
      .select("farm_id,role_id,is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("farm_group_memberships")
      .select("farm_group_id,role_id,active")
      .eq("user_id", userId)
      .eq("active", true),
  ]);

  if (farmMembershipsResult.error) {
    throw new Error(farmMembershipsResult.error.message);
  }
  if (farmGroupMembershipsResult.error) {
    throw new Error(farmGroupMembershipsResult.error.message);
  }

  const farmMemberships = (farmMembershipsResult.data ?? []) as FarmMembershipRow[];
  const farmGroupMemberships = (farmGroupMembershipsResult.data ?? []) as FarmGroupMembershipRow[];

  let targetFarmGroupId: string | null = null;
  if (targetFarmId) {
    const { data: farmRows, error: farmError } = await supabase
      .from("farms")
      .select("id,farm_group_id")
      .eq("id", targetFarmId)
      .limit(1);

    if (farmError) {
      throw new Error(farmError.message);
    }

    targetFarmGroupId =
      typeof farmRows?.[0]?.farm_group_id === "string" ? farmRows[0].farm_group_id : null;
  }

  const allRoleIds = Array.from(
    new Set(
      [
        ...farmMemberships.map((row) => row.role_id),
        ...farmGroupMemberships.map((row) => row.role_id),
      ].filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  if (allRoleIds.length === 0) {
    return {
      userId,
      role: null,
      permissions: { ...EMPTY_PERMISSIONS },
    };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("roles")
    .select("id,code")
    .in("id", allRoleIds);

  if (roleError) {
    throw new Error(roleError.message);
  }

  const roles = (roleRows ?? []) as RoleRow[];
  const roleCodeById = new Map(
    roles
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id, typeof row.code === "string" ? row.code : null]),
  );

  const relevantRoleIds = targetFarmId
    ? Array.from(
        new Set(
          [
            ...farmMemberships
              .filter((row) => row.farm_id === targetFarmId)
              .map((row) => row.role_id),
            ...farmGroupMemberships
              .filter((row) => row.farm_group_id === targetFarmGroupId)
              .map((row) => row.role_id),
          ].filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      )
    : allRoleIds;

  const highestRole = roles
    .map((row) => row.code)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .sort((left, right) => rankRole(right) - rankRole(left) || left.localeCompare(right))[0] ?? null;

  if (relevantRoleIds.length === 0) {
    return {
      userId,
      role: highestRole,
      permissions: { ...EMPTY_PERMISSIONS },
    };
  }

  const [sysactionsResult, permissionsResult] = await Promise.all([
    supabase.from("sysactions").select("id,action"),
    supabase
      .from("roles_actions_permissions")
      .select("role_id,action_id,createyn,updateyn")
      .in("role_id", relevantRoleIds),
  ]);

  if (sysactionsResult.error) {
    throw new Error(sysactionsResult.error.message);
  }
  if (permissionsResult.error) {
    throw new Error(permissionsResult.error.message);
  }

  const actionById = new Map(
    ((sysactionsResult.data ?? []) as SysactionRow[])
      .filter((row) => typeof row.id === "string" && typeof row.action === "string")
      .map((row) => [row.id, normalizeCode(row.action as string)]),
  );

  const permissions = { ...EMPTY_PERMISSIONS };
  for (const row of (permissionsResult.data ?? []) as PermissionRow[]) {
    const action = actionById.get(row.action_id);
    if (!action || !isWriteAllowed(row)) {
      continue;
    }

    if (action in permissions) {
      permissions[action as MobilePermissionAction] = true;
    }
  }

  return {
    userId,
    role: highestRole ?? highestRoleFromRoleIds(relevantRoleIds, roleCodeById),
    permissions,
  };
}

function isWriteAllowed(row: PermissionRow) {
  return row.createyn === true || row.updateyn === true;
}

function highestRoleFromRoleIds(roleIds: string[], roleCodeById: Map<string, string | null>) {
  return roleIds
    .map((roleId) => roleCodeById.get(roleId))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .sort((left, right) => rankRole(right) - rankRole(left) || left.localeCompare(right))[0] ?? null;
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function rankRole(value: string) {
  const normalized = normalizeCode(value);
  if (normalized === "super_admin" || normalized === "superadmin") return 500;
  if (normalized.includes("integrator")) return 400;
  if (normalized === "admin" || normalized.includes("grower")) return 300;
  if (normalized.includes("manager")) return 200;
  if (normalized.includes("tech") || normalized.includes("supervisor")) return 100;
  if (normalized.includes("readonly")) return 10;
  return 50;
}
