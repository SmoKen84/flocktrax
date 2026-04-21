"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

function coerce(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function coerceNullableInteger(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildReturnLocation(
  formData: FormData,
  options: {
    error?: string;
    notice?: string;
    group?: string | null;
    setting?: string | null;
    task?: string | null;
    screen?: string | null;
  } = {},
) {
  const base = coerce(formData.get("return_to")) || "/admin/settings";
  const url = new URL(base, "http://localhost");

  url.searchParams.delete("error");
  url.searchParams.delete("notice");

  if (options.error) url.searchParams.set("error", options.error);
  if (options.notice) url.searchParams.set("notice", options.notice);

  if (options.group === null) {
    url.searchParams.delete("group");
  } else if (options.group) {
    url.searchParams.set("group", options.group);
  }

  if (options.setting === null) {
    url.searchParams.delete("setting");
  } else if (options.setting) {
    url.searchParams.set("setting", options.setting);
  }

  if (options.task === null) {
    url.searchParams.delete("task");
  } else if (options.task) {
    url.searchParams.set("task", options.task);
  }

  if (options.screen === null) {
    url.searchParams.delete("screen");
  } else if (options.screen) {
    url.searchParams.set("screen", options.screen);
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

async function getAdminContext(formData: FormData) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    bounce(formData, { error: "Supabase admin access is not configured for settings." });
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

function canEditPlatformContent(role: ReturnType<typeof resolveRoleTemplate> | null) {
  if (!role) {
    return false;
  }

  const normalizedRole = role.key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedRole === "super_admin" || normalizedRole === "superadmin" || normalizedRole.includes("super")) {
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

export async function updateAppSettingAction(formData: FormData) {
  const { admin } = await getAdminContext(formData);
  const settingId = coerce(formData.get("setting_id"));
  const settingGroup = coerce(formData.get("setting_group"));
  const settingName = coerce(formData.get("setting_name"));
  const value = coerce(formData.get("value"));

  if (!settingId || !settingGroup || !settingName) {
    bounce(formData, { error: "Select a live setting before saving changes." });
    unreachable("Missing app setting context");
  }

  const updateResult = await admin
    .from("app_settings")
    .update({
      value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settingId);

  if (updateResult.error) {
    bounce(formData, {
      error: updateResult.error.message,
      group: settingGroup,
      setting: settingName,
    });
  }

  revalidatePath("/admin/settings");
  bounce(formData, {
    notice: `${settingName} saved.`,
    group: settingGroup,
    setting: settingName,
  });
}

export async function saveDailyAgeTaskAction(formData: FormData) {
  const { admin } = await getAdminContext(formData);
  const taskId = coerce(formData.get("task_id"));
  const taskLabel = coerce(formData.get("task_label"));
  const minAgeDays = coerceNullableInteger(formData.get("min_age_days"));
  const maxAgeDays = coerceNullableInteger(formData.get("max_age_days"));
  const displayOrder = coerceNullableInteger(formData.get("display_order")) ?? 0;
  const isActive = coerce(formData.get("is_active")) === "on";

  if (!taskLabel) {
    bounce(formData, { error: "Enter a reminder task before saving." });
    unreachable("Missing daily age task label");
  }

  if (minAgeDays !== null && maxAgeDays !== null && minAgeDays > maxAgeDays) {
    bounce(formData, {
      error: "First day cannot be greater than last day.",
      task: taskId || "new",
    });
    unreachable("Invalid task age range");
  }

  const payload = {
    task_label: taskLabel,
    min_age_days: minAgeDays,
    max_age_days: maxAgeDays,
    display_order: displayOrder,
    is_active: isActive,
  };

  const writeResult = taskId
    ? await admin.from("daily_age_tasks").update(payload).eq("id", taskId)
    : await admin.from("daily_age_tasks").insert(payload).select("id").single();

  if (writeResult.error) {
    bounce(formData, {
      error: writeResult.error.message,
      task: taskId || "new",
    });
  }

  const resolvedTaskId = taskId || ("data" in writeResult && writeResult.data ? String(writeResult.data.id) : null);

  revalidatePath("/admin/settings");
  bounce(formData, {
    notice: taskId ? "Reminder task updated." : "Reminder task added.",
    task: resolvedTaskId,
  });
}

export async function deleteDailyAgeTaskAction(formData: FormData) {
  const { admin } = await getAdminContext(formData);
  const taskId = coerce(formData.get("task_id"));

  if (!taskId) {
    bounce(formData, { error: "Select a reminder task before deleting it." });
    unreachable("Missing daily age task id");
  }

  const deleteResult = await admin.from("daily_age_tasks").delete().eq("id", taskId);

  if (deleteResult.error) {
    bounce(formData, {
      error: deleteResult.error.message,
      task: taskId,
    });
  }

  revalidatePath("/admin/settings");
  bounce(formData, {
    notice: "Reminder task deleted.",
    task: null,
  });
}

export async function updateScreenTextAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  const screenId = coerce(formData.get("screen_id"));
  const screenName = coerce(formData.get("screen_name"));
  const display = coerce(formData.get("display"));
  const note = coerce(formData.get("note"));
  const location = coerce(formData.get("screen_location"));

  if (!canEditPlatformContent(actorRole)) {
    bounce(formData, { error: "Only platform-maintainer accounts can edit managed screen text." });
    unreachable("Actor cannot edit platform content");
  }

  if (!screenId || !screenName) {
    bounce(formData, { error: "Select a managed screen text record before saving." });
    unreachable("Missing screen text context");
  }

  const updateResult = await admin
    .schema("platform")
    .from("screen_txt")
    .update({
      display,
      note,
    })
    .eq("id", Number(screenId));

  if (updateResult.error) {
    bounce(formData, {
      error: updateResult.error.message,
      screen: screenName,
    });
  }

  revalidatePath("/admin/settings");
  bounce(formData, {
    notice: `${screenName} saved.`,
    screen: screenName,
    group: null,
    setting: null,
    task: null,
  });
}
