"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function coerce(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function coerceNullableNumber(value: FormDataEntryValue | null) {
  const normalized = coerce(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRoleKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function buildReturnLocation(formData: FormData, options: { code?: string | null; error?: string; notice?: string } = {}) {
  const base = coerce(formData.get("return_to")) || "/admin/issues/types";
  const url = new URL(base, "http://localhost");

  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("notice");

  const selectedCode = options.code === undefined ? coerce(formData.get("selected_code")) || null : options.code;

  if (selectedCode) url.searchParams.set("code", selectedCode);
  if (options.error) url.searchParams.set("error", options.error);
  if (options.notice) url.searchParams.set("notice", options.notice);

  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function bounce(formData: FormData, options: Parameters<typeof buildReturnLocation>[1]) {
  redirect(buildReturnLocation(formData, options));
}

function unreachable(message: string): never {
  throw new Error(message);
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

async function getAdminContext(formData: FormData) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    bounce(formData, { error: "Supabase admin access is not configured for action-type maintenance." });
    unreachable("Missing Supabase admin client");
  }

  const serverClient = await createSupabaseServerClient();
  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  const actorId = authResult?.data.user?.id ?? null;

  const bundle = await getUserAccessBundle();
  const actor = actorId ? bundle.users.find((user) => user.id === actorId) ?? null : null;
  const actorRole = actor ? resolveRoleTemplate(bundle.roles, actor.role) : null;

  return { admin, actorRole };
}

function revalidateActionTypes() {
  revalidatePath("/admin/issues");
  revalidatePath("/admin/issues/types");
}

export async function saveIssueTypeAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  if (!canManageActionTypes(actorRole)) {
    bounce(formData, { error: "Only farm-member admins or super admins can maintain action types." });
    unreachable("Actor cannot manage action types");
  }

  const originalCode = coerce(formData.get("original_code"));
  const code = coerce(formData.get("code")).toLowerCase().replace(/[\s-]+/g, "_");
  const label = coerce(formData.get("label"));
  const entityType = coerce(formData.get("entity_type"));
  const sortOrder = coerceNullableNumber(formData.get("sort_order"));
  const severityDefault = coerce(formData.get("severity_default"));
  const reportGroup = coerce(formData.get("report_group"));
  const isActive = formData.get("is_active") === "on";

  if (!code) {
    bounce(formData, { error: "Enter a code for this action type." });
  }
  if (!label) {
    bounce(formData, { code, error: "Enter a label for this action type." });
  }
  if (entityType !== "barn" && entityType !== "placement") {
    bounce(formData, { code, error: "Choose whether this action type belongs to a barn or placement." });
  }

  const payload = {
    code,
    label,
    entity_type: entityType,
    is_active: isActive,
    sort_order: sortOrder ?? 100,
    severity_default: severityDefault || null,
    report_group: reportGroup || null,
  };

  if (originalCode && originalCode !== code) {
    const { error } = await admin
      .from("issue_types")
      .update(payload)
      .eq("code", originalCode);

    if (error) {
      bounce(formData, { code: originalCode, error: error.message });
    }
  } else {
    const { error } = await admin.from("issue_types").upsert(payload, { onConflict: "code" });

    if (error) {
      bounce(formData, { code, error: error.message });
    }
  }

  revalidateActionTypes();
  bounce(formData, { code, notice: "Action type saved." });
}

export async function deactivateIssueTypeAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  if (!canManageActionTypes(actorRole)) {
    bounce(formData, { error: "Only farm-member admins or super admins can maintain action types." });
    unreachable("Actor cannot manage action types");
  }

  const code = coerce(formData.get("code"));
  if (!code) {
    bounce(formData, { error: "Select an action type before deactivating it." });
  }

  const { error } = await admin
    .from("issue_types")
    .update({ is_active: false })
    .eq("code", code);

  if (error) {
    bounce(formData, { code, error: error.message });
  }

  revalidateActionTypes();
  bounce(formData, { notice: "Action type deactivated." });
}
