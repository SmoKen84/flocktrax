"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import {
  INTEGRATOR_FIELDS,
  INTEGRATOR_SETTINGS_GROUP,
  type IntegratorFieldKey,
} from "@/lib/integrator-data";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function coerce(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function buildReturnLocation(formData: FormData, options: { error?: string; notice?: string } = {}) {
  const base = coerce(formData.get("return_to")) || "/admin/integrator";
  const url = new URL(base, "http://localhost");

  url.searchParams.delete("error");
  url.searchParams.delete("notice");

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

type AppSettingLookupRow = {
  id: string;
  name: string | null;
  value?: string | null;
  updated_at?: string | null;
};

function hasMeaningfulValue(value: string | null | undefined) {
  return String(value ?? "").trim().length > 0;
}

function pickPreferredSettingRow(rows: AppSettingLookupRow[], preferredId: string | null = null) {
  if (preferredId) {
    const exactMatch = rows.find((row) => row.id === preferredId);
    if (exactMatch) {
      return exactMatch;
    }
  }

  return (
    [...rows].sort((left, right) => {
      const leftValueRank = hasMeaningfulValue(left.value) ? 1 : 0;
      const rightValueRank = hasMeaningfulValue(right.value) ? 1 : 0;
      if (rightValueRank !== leftValueRank) {
        return rightValueRank - leftValueRank;
      }

      const leftTime = left.updated_at ? Date.parse(left.updated_at) : 0;
      const rightTime = right.updated_at ? Date.parse(right.updated_at) : 0;

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return right.id.localeCompare(left.id);
    })[0] ?? null
  );
}

async function getAdminContext(formData: FormData) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    bounce(formData, { error: "Supabase admin access is not configured for the Integrator screen." });
    unreachable("Missing Supabase admin client");
  }

  const serverClient = await createSupabaseServerClient();
  const authResult = serverClient ? await serverClient.auth.getUser() : null;
  const actorId = authResult?.data.user?.id ?? null;

  const bundle = await getUserAccessBundle();
  const actor = actorId ? bundle.users.find((user) => user.id === actorId) ?? null : null;
  const actorRole = actor ? resolveRoleTemplate(bundle.roles, actor.role) : null;

  return { admin, actorId, actorRole };
}

function canEditIntegratorProfile(role: ReturnType<typeof resolveRoleTemplate> | null) {
  if (!role) {
    return false;
  }

  const normalizedRole = role.key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedRole === "super_admin" || normalizedRole === "superadmin" || normalizedRole.includes("super")) {
    return true;
  }

  if (normalizedRole === "admin" || normalizedRole.includes("integrator")) {
    return true;
  }

  if (role.capabilities.some((capability) => capability.includes("manage platform options"))) {
    return true;
  }

  return role.permissionRows.some((permissionRow) => {
    const action = permissionRow.action.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return action === "platform_settings" && (permissionRow.create || permissionRow.update || permissionRow.menuAccess);
  });
}

export async function saveIntegratorProfileAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);

  if (!canEditIntegratorProfile(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can edit integrator profile details." });
    unreachable("Actor cannot edit integrator profile");
  }

  const existingSettingsResult = await admin
    .from("app_settings")
    .select("id,name,value,updated_at")
    .eq("group", INTEGRATOR_SETTINGS_GROUP)
    .in(
      "name",
      INTEGRATOR_FIELDS.map((field) => field.key),
    );

  if (existingSettingsResult.error) {
    bounce(formData, { error: existingSettingsResult.error.message });
  }

  const existingSettings = ((existingSettingsResult.data ?? []) as AppSettingLookupRow[]).filter((row) => row.name);

  for (const field of INTEGRATOR_FIELDS) {
    const fieldKey = field.key as IntegratorFieldKey;
    const value = coerce(formData.get(`field__${fieldKey}`));
    const existingId = coerce(formData.get(`id__${fieldKey}`)) || null;
    const matchingRows = existingSettings.filter((row) => row.name === fieldKey);
    const canonicalRow = pickPreferredSettingRow(matchingRows, existingId);
    const canonicalId = canonicalRow?.id ?? null;

    if (canonicalId) {
      const updateResult = await admin
        .from("app_settings")
        .update({
          value,
          desc: field.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", canonicalId);

      if (updateResult.error) {
        bounce(formData, { error: updateResult.error.message });
      }
    } else {
      const insertResult = await admin.from("app_settings").insert({
        group: INTEGRATOR_SETTINGS_GROUP,
        name: fieldKey,
        value,
        desc: field.description,
        updated_at: new Date().toISOString(),
      });

      if (insertResult.error) {
        bounce(formData, { error: insertResult.error.message });
      }
    }

    const duplicateIds = matchingRows
      .map((row) => row.id)
      .filter((rowId) => rowId !== canonicalId);

    if (duplicateIds.length > 0) {
      const deleteResult = await admin.from("app_settings").delete().in("id", duplicateIds);
      if (deleteResult.error) {
        bounce(formData, { error: deleteResult.error.message });
      }
    }
  }

  revalidatePath("/admin/integrator");
  bounce(formData, { notice: "Integrator profile saved." });
}
