"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getUserAccessBundle, resolveRoleTemplate, reviewUserAccess } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function canManageUsers(role: ReturnType<typeof resolveRoleTemplate>) {
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

function coerce(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function buildReturnLocation(
  formData: FormData,
  options: {
    error?: string;
    notice?: string;
    selected?: string | null;
    mode?: string | null;
  } = {},
) {
  const base = coerce(formData.get("return_to")) || "/admin/user-access";
  const url = new URL(base, "http://localhost");

  url.searchParams.delete("error");
  url.searchParams.delete("notice");

  if (options.error) {
    url.searchParams.set("error", options.error);
  }

  if (options.notice) {
    url.searchParams.set("notice", options.notice);
  }

  if (options.selected === null) {
    url.searchParams.delete("selected");
  } else if (options.selected) {
    url.searchParams.set("selected", options.selected);
  }

  if (options.mode === null) {
    url.searchParams.delete("mode");
  } else if (options.mode) {
    url.searchParams.set("mode", options.mode);
  }

  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function bounce(formData: FormData, options: Parameters<typeof buildReturnLocation>[1]) {
  redirect(buildReturnLocation(formData, options));
}

function unreachable(message: string): never {
  throw new Error(message);
}

async function getAppOrigin() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");

  if (host) {
    return `${forwardedProto ?? "http"}://${host}`;
  }

  return "http://localhost:3000";
}

async function getWriteContext(formData: FormData) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    bounce(formData, { error: "Supabase admin access is not configured for the web app." });
    unreachable("Missing Supabase admin client");
  }

  const serverClient = await createSupabaseServerClient();
  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  const actorId = authResult?.data.user?.id ?? null;

  if (!actorId) {
    bounce(formData, { error: "Sign in again before changing user access." });
    unreachable("Missing authenticated actor");
  }

  const bundle = await getUserAccessBundle();
  const actor = bundle.users.find((user) => user.id === actorId);

  if (!actor) {
    bounce(formData, { error: "Your user record is not available in the access directory yet." });
    unreachable("Missing acting user record");
  }

  return { admin, bundle, actor };
}

async function getTargetWriteContext(formData: FormData) {
  const { admin, bundle, actor } = await getWriteContext(formData);
  const targetUserId = coerce(formData.get("target_user_id"));

  if (!targetUserId) {
    bounce(formData, { error: "Select a user before making access changes." });
    unreachable("Missing target user id");
  }

  const target = bundle.users.find((user) => user.id === targetUserId);
  if (!target) {
    bounce(formData, { error: "The selected user is no longer available in the directory." });
    unreachable("Missing target user");
  }

  const review = reviewUserAccess(actor, target, bundle.roles);
  if (!review.canEdit) {
    bounce(formData, { error: review.reason, selected: target.id });
    unreachable("Target is not editable");
  }

  return { admin, bundle, actor, target };
}

async function resolveRoleRow(admin: AdminClient, roleKey: string) {
  const rolesResult = await admin.from("roles").select("id,code");
  if (rolesResult.error) {
    return { roleId: null, roleCode: null, error: rolesResult.error.message };
  }

  const role = (rolesResult.data ?? []).find((row) => normalizeKey(String(row.code ?? "")) === normalizeKey(roleKey));
  if (!role?.code || !role?.id) {
    return { roleId: null, roleCode: null, error: "The selected role is not available in the live role catalog." };
  }

  return { roleId: String(role.id), roleCode: String(role.code), error: null };
}

async function listAllAuthUsers(admin: AdminClient) {
  const users: Array<{ id: string; email?: string | null }> = [];
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage });
    if (result.error) {
      return { data: [], error: result.error.message };
    }

    const batch = (result.data.users ?? []) as Array<{ id: string; email?: string | null }>;
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }
  }

  return { data: users, error: null };
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const usersResult = await listAllAuthUsers(admin);
  if (usersResult.error) {
    return { user: null, error: usersResult.error };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user =
    usersResult.data.find((candidate) => String(candidate.email ?? "").trim().toLowerCase() === normalizedEmail) ?? null;

  return { user, error: null };
}

async function upsertUserRole(
  admin: AdminClient,
  userId: string,
  roleId: string,
  roleCode: string,
) {
  const normalizedResult = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role_id: roleId, role: roleCode }, { onConflict: "user_id,role_id" });

  if (!normalizedResult.error) {
    return { error: null };
  }

  const legacyResult = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: roleCode }, { onConflict: "user_id,role" });

  return { error: legacyResult.error?.message ?? null };
}

async function deleteUserRole(
  admin: AdminClient,
  userId: string,
  roleId: string,
  roleCode: string,
) {
  const normalizedResult = await admin.from("user_roles").delete().eq("user_id", userId).eq("role_id", roleId);

  if (!normalizedResult.error) {
    return { error: null };
  }

  const legacyResult = await admin.from("user_roles").delete().eq("user_id", userId).eq("role", roleCode);
  return { error: legacyResult.error?.message ?? null };
}

function ensureAssignableRole(
  actorRole: ReturnType<typeof resolveRoleTemplate>,
  roleKey: string,
  allRoles: Array<ReturnType<typeof resolveRoleTemplate>>,
) {
  const normalizedRole = normalizeKey(roleKey);
  const explicitAllowed = actorRole.assignableRoles.map((candidate) => normalizeKey(candidate));

  if (explicitAllowed.some((candidate) => candidate === normalizedRole || roleMatchesAssignableHint(normalizedRole, candidate))) {
    return true;
  }

  const actorNormalized = normalizeKey(actorRole.key);

  if (actorNormalized === "super_admin" || actorNormalized === "superadmin") {
    return true;
  }

  const targetRole = resolveRoleTemplate(allRoles, roleKey);
  return targetRole.rank < actorRole.rank && targetRole.homeScope !== "integrator_group";
}

function roleMatchesAssignableHint(roleKey: string, allowedKey: string) {
  const aliasMap: Record<string, string[]> = {
    admin: ["grower_admin", "admin"],
    grower: ["grower_admin", "admin"],
    manager: ["farm_manager", "manager"],
    farmmanager: ["farm_manager", "manager"],
    tech: ["flock_supervisor", "tech"],
    farmhand: ["flock_supervisor", "farmhand", "readonly"],
    readonly: ["readonly", "flock_supervisor", "farmhand"],
  };

  return (aliasMap[roleKey] ?? []).includes(allowedKey);
}

export async function assignUserRoleAction(formData: FormData) {
  const { admin, bundle, actor, target } = await getTargetWriteContext(formData);
  const roleKey = coerce(formData.get("role_key"));

  if (!roleKey) {
    bounce(formData, { error: "Choose a role before saving it.", selected: target.id });
    unreachable("Missing role key");
  }

  const actorRole = resolveRoleTemplate(bundle.roles, actor.role);
  if (!ensureAssignableRole(actorRole, roleKey, bundle.roles)) {
    bounce(formData, { error: "That role is outside the current grantor authority.", selected: target.id });
    unreachable("Role outside actor authority");
  }

  const selectedRole = resolveRoleTemplate(bundle.roles, roleKey);
  if (selectedRole.rank >= actorRole.rank && normalizeKey(actor.role) !== "super_admin") {
    bounce(formData, { error: "Grantors cannot assign a role equal to or higher than their own.", selected: target.id });
    unreachable("Role rank violation");
  }

  const roleRow = await resolveRoleRow(admin, roleKey);
  if (roleRow.error || !roleRow.roleId || !roleRow.roleCode) {
    bounce(formData, { error: roleRow.error ?? "Unable to resolve the selected role.", selected: target.id });
    unreachable("Unable to resolve role row");
  }

  const writeResult = await upsertUserRole(admin, target.id, roleRow.roleId, roleRow.roleCode);
  if (writeResult.error) {
    bounce(formData, { error: writeResult.error, selected: target.id });
  }

  revalidatePath("/admin/user-access");
  bounce(formData, { notice: `${selectedRole.label} assigned to ${target.displayName}.`, selected: target.id });
}

export async function removeUserRoleAction(formData: FormData) {
  const { admin, bundle, actor, target } = await getTargetWriteContext(formData);
  const roleKey = coerce(formData.get("role_key"));

  if (!roleKey) {
    bounce(formData, { error: "Choose a role to remove.", selected: target.id });
    unreachable("Missing role key");
  }

  const actorRole = resolveRoleTemplate(bundle.roles, actor.role);
  if (!ensureAssignableRole(actorRole, roleKey, bundle.roles) && normalizeKey(actor.role) !== "super_admin") {
    bounce(formData, { error: "That role is outside the current grantor authority.", selected: target.id });
    unreachable("Role outside actor authority");
  }

  const roleRow = await resolveRoleRow(admin, roleKey);
  if (roleRow.error || !roleRow.roleId || !roleRow.roleCode) {
    bounce(formData, { error: roleRow.error ?? "Unable to resolve the selected role.", selected: target.id });
    unreachable("Unable to resolve role row");
  }

  const deleteResult = await deleteUserRole(admin, target.id, roleRow.roleId, roleRow.roleCode);
  if (deleteResult.error) {
    bounce(formData, { error: deleteResult.error, selected: target.id });
  }

  revalidatePath("/admin/user-access");
  bounce(formData, { notice: `${resolveRoleTemplate(bundle.roles, roleKey).label} removed from ${target.displayName}.`, selected: target.id });
}

export async function addFarmGroupMembershipAction(formData: FormData) {
  const { admin, bundle, target } = await getTargetWriteContext(formData);
  const farmGroupId = coerce(formData.get("farm_group_id"));
  const roleKey = coerce(formData.get("membership_role_key"));

  if (!farmGroupId || !roleKey) {
    bounce(formData, { error: "Choose both a farm group and a role anchor before saving.", selected: target.id });
    unreachable("Missing farm group or role key");
  }

  const roleRow = await resolveRoleRow(admin, roleKey);
  if (roleRow.error || !roleRow.roleId) {
    bounce(formData, { error: roleRow.error ?? "Unable to resolve the selected role.", selected: target.id });
    unreachable("Unable to resolve role row");
  }

  const upsertResult = await admin
    .from("farm_group_memberships")
    .upsert(
      {
        user_id: target.id,
        farm_group_id: farmGroupId,
        role_id: roleRow.roleId,
        active: true,
      },
      { onConflict: "user_id,farm_group_id" },
    );

  if (upsertResult.error) {
    bounce(formData, { error: upsertResult.error.message, selected: target.id });
  }

  revalidatePath("/admin/user-access");
  const groupName = target.memberships.find((membership) => membership.scopeId === farmGroupId)?.scopeLabel ??
    bundle.users.flatMap((user) => user.memberships).find((membership) => membership.scopeType === "farm_group" && membership.scopeId === farmGroupId)?.scopeLabel ??
    "farm group";
  bounce(formData, { notice: `${target.displayName} added to ${groupName}.`, selected: target.id });
}

export async function removeFarmGroupMembershipAction(formData: FormData) {
  const { admin, target } = await getTargetWriteContext(formData);
  const farmGroupId = coerce(formData.get("farm_group_id"));

  if (!farmGroupId) {
    bounce(formData, { error: "Choose a farm group to remove.", selected: target.id });
    unreachable("Missing farm group id");
  }

  const deleteResult = await admin
    .from("farm_group_memberships")
    .delete()
    .eq("user_id", target.id)
    .eq("farm_group_id", farmGroupId);

  if (deleteResult.error) {
    bounce(formData, { error: deleteResult.error.message, selected: target.id });
  }

  revalidatePath("/admin/user-access");
  bounce(formData, { notice: `Farm group membership removed for ${target.displayName}.`, selected: target.id });
}

export async function addFarmMembershipAction(formData: FormData) {
  const { admin, target } = await getTargetWriteContext(formData);
  const farmId = coerce(formData.get("farm_id"));
  const roleKey = coerce(formData.get("membership_role_key"));

  if (!farmId) {
    bounce(formData, { error: "Choose a farm before saving.", selected: target.id });
    unreachable("Missing farm id");
  }

  let roleId: string | null = null;
  if (roleKey) {
    const roleRow = await resolveRoleRow(admin, roleKey);
    if (roleRow.error) {
      bounce(formData, { error: roleRow.error, selected: target.id });
      unreachable("Unable to resolve farm membership role row");
    }
    roleId = roleRow.roleId;
  }

  const upsertResult = await admin
    .from("farm_memberships")
    .upsert(
      {
        user_id: target.id,
        farm_id: farmId,
        role_id: roleId,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,farm_id" },
    );

  if (upsertResult.error) {
    bounce(formData, { error: upsertResult.error.message, selected: target.id });
  }

  revalidatePath("/admin/user-access");
  bounce(formData, { notice: `Farm membership saved for ${target.displayName}.`, selected: target.id });
}

export async function removeFarmMembershipAction(formData: FormData) {
  const { admin, target } = await getTargetWriteContext(formData);
  const farmId = coerce(formData.get("farm_id"));

  if (!farmId) {
    bounce(formData, { error: "Choose a farm to remove.", selected: target.id });
    unreachable("Missing farm id");
  }

  const deleteResult = await admin
    .from("farm_memberships")
    .delete()
    .eq("user_id", target.id)
    .eq("farm_id", farmId);

  if (deleteResult.error) {
    bounce(formData, { error: deleteResult.error.message, selected: target.id });
  }

  revalidatePath("/admin/user-access");
  bounce(formData, { notice: `Farm membership removed for ${target.displayName}.`, selected: target.id });
}

export async function inviteUserAccessAction(formData: FormData) {
  const { admin, bundle, actor } = await getWriteContext(formData);
  const email = coerce(formData.get("email")).toLowerCase();
  const fullName = coerce(formData.get("full_name"));
  const roleKey = coerce(formData.get("role_key"));
  const farmGroupId = coerce(formData.get("farm_group_id"));
  const farmId = coerce(formData.get("farm_id"));

  if (!email || !roleKey) {
    bounce(formData, { error: "Enter an email address and choose a role for the invite.", mode: "invite" });
    unreachable("Missing invite email or role");
  }

  const actorRole = resolveRoleTemplate(bundle.roles, actor.role);
  if (!canManageUsers(actorRole) || !ensureAssignableRole(actorRole, roleKey, bundle.roles)) {
    bounce(formData, { error: "The current grantor cannot send that invite.", mode: "invite" });
    unreachable("Invite not allowed");
  }

  const existingUserResult = await findAuthUserByEmail(admin, email);
  if (existingUserResult.error) {
    bounce(formData, { error: existingUserResult.error, mode: "invite" });
    unreachable("Unable to inspect existing auth users");
  }

  let userId = existingUserResult.user?.id ?? null;
  let inviteNotice = `Invitation sent to ${email}.`;

  if (!userId) {
    const appOrigin = await getAppOrigin();
    const inviteResult = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appOrigin}/auth/callback?next=/reset-password`,
      data: {
        full_name: fullName || email.split("@")[0],
        name: fullName || email.split("@")[0],
        display_name: fullName || email.split("@")[0],
        role: roleKey,
      },
    });

    if (inviteResult.error) {
      bounce(formData, { error: inviteResult.error.message, mode: "invite" });
      unreachable("Invite failed");
    }

    userId = inviteResult.data.user?.id ?? null;

    if (!userId) {
      const persistedUserResult = await findAuthUserByEmail(admin, email);
      if (persistedUserResult.error) {
        bounce(formData, { error: persistedUserResult.error, mode: "invite" });
        unreachable("Unable to verify invited auth user");
      }

      userId = persistedUserResult.user?.id ?? null;
    }

    if (!userId) {
      bounce(formData, {
        error: `Supabase did not return or persist an auth user for ${email}. The invite email may not have been created.`,
        mode: "invite",
      });
      unreachable("Invite was not persisted");
    }
  } else {
    inviteNotice = `${email} already exists in Supabase Auth. Access assignments were updated instead of sending a new invite.`;
  }

  const roleRow = await resolveRoleRow(admin, roleKey);
  if (roleRow.error || !roleRow.roleId || !roleRow.roleCode) {
    bounce(formData, { error: roleRow.error ?? "Unable to resolve the selected role.", mode: "invite" });
    unreachable("Unable to resolve invite role row");
  }

  const roleWrite = await upsertUserRole(admin, userId, roleRow.roleId, roleRow.roleCode);
  if (roleWrite.error) {
    bounce(formData, { error: roleWrite.error, mode: "invite" });
  }

  if (farmGroupId) {
    const groupResult = await admin.from("farm_group_memberships").upsert(
      {
        user_id: userId,
        farm_group_id: farmGroupId,
        role_id: roleRow.roleId,
        active: true,
      },
      { onConflict: "user_id,farm_group_id" },
    );

    if (groupResult.error) {
      bounce(formData, { error: groupResult.error.message, mode: "invite" });
    }
  }

  if (farmId) {
    const farmResult = await admin.from("farm_memberships").upsert(
      {
        user_id: userId,
        farm_id: farmId,
        role_id: roleRow.roleId,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,farm_id" },
    );

    if (farmResult.error) {
      bounce(formData, { error: farmResult.error.message, mode: "invite" });
    }
  }

  revalidatePath("/admin/user-access");
  bounce(formData, {
    notice: inviteNotice,
    selected: userId,
    mode: null,
  });
}
