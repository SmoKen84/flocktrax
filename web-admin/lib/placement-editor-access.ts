import { unstable_noStore as noStore } from "next/cache";

import { getUserAccessBundle } from "@/lib/access-control";
import type { ActivePlacementRecord, PlacementEditorAccessRecord } from "@/lib/types";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type ActorPlacementAccess = {
  actorId: string | null;
  roleCodes: string[];
  permissionRows: Array<{
    action: string;
    menuAccess: boolean;
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  }>;
  farmGroupIds: Set<string>;
  farmIds: Set<string>;
  isSuperUser: boolean;
  bypassScope: boolean;
  hasDashboardView: boolean;
};

type UserRoleRow = {
  role_id?: string | null;
  role?: string | null;
};

type RoleCodeRow = {
  id: string;
  code: string | null;
};

type PermissionRow = {
  role_id: string;
  action_id: string;
  menu_access: boolean | null;
  createyn: boolean | null;
  readyn: boolean | null;
  updateyn: boolean | null;
  deleteyn: boolean | null;
};

type SysactionRow = {
  id: string;
  action: string | null;
};

function normalizeKey(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function hasPermission(
  actor: ActorPlacementAccess,
  actions: string[],
  modes: Array<"menuAccess" | "create" | "read" | "update" | "delete">,
) {
  const actionSet = new Set(actions.map((action) => normalizeKey(action)));
  return actor.permissionRows.some((permissionRow) => {
    if (!actionSet.has(normalizeKey(permissionRow.action))) {
      return false;
    }

    return modes.some((mode) => permissionRow[mode] === true);
  });
}

function canViewDashboard(actor: ActorPlacementAccess) {
  if (actor.roleCodes.some((roleCode) => normalizeKey(roleCode).includes("super"))) {
    return true;
  }

  if (
    actor.roleCodes.some((roleCode) => {
      const normalized = normalizeKey(roleCode);
      return (
        normalized === "admin" ||
        normalized.includes("integrator") ||
        normalized.includes("grower") ||
        normalized.includes("manager") ||
        normalized.includes("supervisor")
      );
    })
  ) {
    return true;
  }

  return hasPermission(
    actor,
    ["overview", "dashboard", "placements", "placement_wizard", "flocks"],
    ["menuAccess", "read", "update", "create"],
  );
}

function canEditFlockFields(actor: ActorPlacementAccess) {
  if (
    actor.roleCodes.some((roleCode) => {
      const normalized = normalizeKey(roleCode);
      return (
        normalized.includes("super") ||
        normalized === "admin" ||
        normalized.includes("integrator") ||
        normalized.includes("grower") ||
        normalized.includes("manager")
      );
    })
  ) {
    return true;
  }

  return hasPermission(actor, ["flocks", "placements", "placement_wizard"], ["update", "create"]);
}

function canEditPlacementFields(actor: ActorPlacementAccess) {
  if (
    actor.roleCodes.some((roleCode) => {
      const normalized = normalizeKey(roleCode);
      return (
        normalized.includes("super") ||
        normalized === "admin" ||
        normalized.includes("integrator") ||
        normalized.includes("grower") ||
        normalized.includes("manager")
      );
    })
  ) {
    return true;
  }

  return hasPermission(actor, ["placements", "placement_wizard"], ["update", "create"]);
}

function hasScopeAccess(actor: ActorPlacementAccess, placement: Pick<ActivePlacementRecord, "farmGroupId" | "farmId">) {
  if (actor.bypassScope || actor.isSuperUser) {
    return true;
  }

  return actor.farmIds.has(placement.farmId) || actor.farmGroupIds.has(placement.farmGroupId);
}

export function buildPlacementEditorAccess(
  actor: ActorPlacementAccess,
  placement: Pick<ActivePlacementRecord, "placementId" | "tileState" | "farmGroupId" | "farmId">,
): PlacementEditorAccessRecord {
  if (!placement.placementId || placement.tileState === "empty") {
    return {
      canOpen: true,
      canView: false,
      canEditFlockFields: false,
      canEditPlacementFields: false,
      message: "This barn tile does not have a placement record attached to edit.",
    };
  }

  if (!actor.actorId) {
    return {
      canOpen: true,
      canView: false,
      canEditFlockFields: false,
      canEditPlacementFields: false,
      message: "You must be signed in to open the placement editor.",
    };
  }

  if (!actor.hasDashboardView) {
    return {
      canOpen: true,
      canView: false,
      canEditFlockFields: false,
      canEditPlacementFields: false,
      message: "Your account does not have permission to view placement details from the dashboard.",
    };
  }

  if (!hasScopeAccess(actor, placement)) {
    return {
      canOpen: true,
      canView: false,
      canEditFlockFields: false,
      canEditPlacementFields: false,
      message: "Your account does not have viewing access for this placement.",
    };
  }

  const flockFieldAccess = canEditFlockFields(actor);
  const placementFieldAccess = canEditPlacementFields(actor);

  if (!flockFieldAccess && !placementFieldAccess) {
    return {
      canOpen: true,
      canView: true,
      canEditFlockFields: false,
      canEditPlacementFields: false,
      message: "This placement is visible, but your access is read-only.",
    };
  }

  if (!flockFieldAccess || !placementFieldAccess) {
    return {
      canOpen: true,
      canView: true,
      canEditFlockFields: flockFieldAccess,
      canEditPlacementFields: placementFieldAccess,
      message: "Some placement fields are locked because your role does not have edit access to every section.",
    };
  }

  return {
    canOpen: true,
    canView: true,
    canEditFlockFields: true,
    canEditPlacementFields: true,
    message: null,
  };
}

export async function getPlacementEditorActorAccess(): Promise<ActorPlacementAccess> {
  noStore();

  const admin = createSupabaseAdminClient();
  const serverClient = await createSupabaseServerClient();
  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  const actorId = authResult?.data.user?.id ?? null;

  if (!admin || !actorId) {
    return {
      actorId,
      roleCodes: [],
      permissionRows: [],
      farmGroupIds: new Set<string>(),
      farmIds: new Set<string>(),
      isSuperUser: false,
      bypassScope: false,
      hasDashboardView: false,
    };
  }

  const accessBundle = await getUserAccessBundle();
  const bundledActor = accessBundle.users.find((user) => user.id === actorId) ?? null;
  const bundledRoleCodes = bundledActor
    ? Array.from(
        new Set(
          [bundledActor.role, ...bundledActor.assignedRoles].filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0,
          ),
        ),
      )
    : [];

  const directUserRolesResult = await admin.from("user_roles").select("role_id,role").eq("user_id", actorId);
  let roleCodes: string[] = [];
  let roleIds: string[] = [];

  if (!directUserRolesResult.error) {
    const rows = (directUserRolesResult.data ?? []) as UserRoleRow[];
    roleIds = rows.map((row) => row.role_id).filter((value): value is string => typeof value === "string" && value.length > 0);
    roleCodes = rows.map((row) => row.role).filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (roleIds.length > 0 && roleCodes.length === 0) {
      const rolesResult = await admin.from("roles").select("id,code").in("id", roleIds);
      if (!rolesResult.error) {
        roleCodes = ((rolesResult.data ?? []) as RoleCodeRow[])
          .map((row) => row.code)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      }
    }
  }

  if (roleIds.length === 0 && roleCodes.length > 0) {
    const rolesResult = await admin.from("roles").select("id,code").in("code", roleCodes);
    if (!rolesResult.error) {
      roleIds = ((rolesResult.data ?? []) as RoleCodeRow[])
        .map((row) => row.id)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      roleCodes = ((rolesResult.data ?? []) as RoleCodeRow[])
        .map((row) => row.code)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    }
  }

  if (bundledRoleCodes.length > 0) {
    roleCodes = Array.from(new Set([...roleCodes, ...bundledRoleCodes]));
  }

  const [farmGroupMembershipsResult, farmMembershipsResult, sysactionsResult, permissionsResult] = await Promise.all([
    admin.from("farm_group_memberships").select("farm_group_id,active").eq("user_id", actorId).eq("active", true),
    admin.from("farm_memberships").select("farm_id,is_active").eq("user_id", actorId).eq("is_active", true),
    admin.from("sysactions").select("id,action"),
    roleIds.length
      ? admin
          .from("roles_actions_permissions")
          .select("role_id,action_id,menu_access,createyn,readyn,updateyn,deleteyn")
          .in("role_id", roleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const actionById = new Map(
    ((sysactionsResult.data ?? []) as SysactionRow[])
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id, row.action ?? "unknown_action"]),
  );

  const permissionRows = ((permissionsResult.data ?? []) as PermissionRow[]).map((permissionRow) => ({
    action: actionById.get(permissionRow.action_id) ?? "unknown_action",
    menuAccess: permissionRow.menu_access === true,
    create: permissionRow.createyn === true,
    read: permissionRow.readyn === true,
    update: permissionRow.updateyn === true,
    delete: permissionRow.deleteyn === true,
  }));

  const normalizedRoleCodes = roleCodes.map((roleCode) => normalizeKey(roleCode));
  const isSuperUser = normalizedRoleCodes.some((roleCode) => roleCode.includes("super"));
  const bypassScope =
    isSuperUser ||
    normalizedRoleCodes.some((roleCode) => roleCode === "admin" || roleCode.includes("integrator"));

  const actor: ActorPlacementAccess = {
    actorId,
    roleCodes,
    permissionRows,
    farmGroupIds: new Set(
      [
        ...(farmGroupMembershipsResult.data ?? [])
          .map((row) => row.farm_group_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
        ...(bundledActor?.memberships ?? [])
          .filter((membership) => normalizeKey(membership.scopeType) === "farm_group")
          .map((membership) => membership.scopeId)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ],
    ),
    farmIds: new Set(
      [
        ...(farmMembershipsResult.data ?? [])
          .map((row) => row.farm_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
        ...(bundledActor?.memberships ?? [])
          .filter((membership) => normalizeKey(membership.scopeType) === "farm")
          .map((membership) => membership.scopeId)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ],
    ),
    isSuperUser,
    bypassScope,
    hasDashboardView: false,
  };

  actor.hasDashboardView = canViewDashboard(actor);

  return actor;
}

export async function applyPlacementEditorAccess(placements: ActivePlacementRecord[]) {
  const actor = await getPlacementEditorActorAccess();
  return placements.map((placement) => ({
    ...placement,
    placementEditorAccess: buildPlacementEditorAccess(actor, placement),
  }));
}
