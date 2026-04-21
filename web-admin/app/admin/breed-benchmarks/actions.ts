"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserAccessBundle, resolveRoleTemplate } from "@/lib/access-control";
import { buildFamilyKey } from "@/lib/breed-benchmarks-data";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function coerce(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function coerceNullableInteger(value: FormDataEntryValue | null) {
  const normalized = coerce(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function coerceNullableNumber(value: FormDataEntryValue | null) {
  const normalized = coerce(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildReturnLocation(
  formData: FormData,
  options: {
    family?: string | null;
    entry?: string | null;
    notice?: string;
    error?: string;
  } = {},
) {
  const base = coerce(formData.get("return_to")) || "/admin/breed-benchmarks";
  const url = new URL(base, "http://localhost");

  url.searchParams.delete("notice");
  url.searchParams.delete("error");

  if (options.notice) url.searchParams.set("notice", options.notice);
  if (options.error) url.searchParams.set("error", options.error);

  if (options.family === null) {
    url.searchParams.delete("family");
  } else if (options.family) {
    url.searchParams.set("family", options.family);
  }

  if (options.entry === null) {
    url.searchParams.delete("entry");
  } else if (options.entry) {
    url.searchParams.set("entry", options.entry);
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
    bounce(formData, { error: "Supabase admin access is not configured for breed benchmarks." });
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

function canEditBreedBenchmarks(role: ReturnType<typeof resolveRoleTemplate> | null) {
  if (!role) {
    return false;
  }

  const normalizedRole = role.key.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedRole === "super_admin" || normalizedRole === "superadmin" || normalizedRole.includes("super")) {
    return true;
  }

  if (normalizedRole === "admin" || normalizedRole.includes("manager")) {
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

export async function saveBreedBenchmarkAction(formData: FormData) {
  const { admin, actorId, actorRole } = await getAdminContext(formData);
  const benchmarkId = coerce(formData.get("benchmark_id"));
  const geneticLine = coerce(formData.get("breed_code"));
  const sex = coerce(formData.get("profile_label"));
  const ageDays = coerceNullableInteger(formData.get("age_days"));
  const feedPerBird = coerceNullableNumber(formData.get("feed_per_bird"));
  const targetWeight = coerceNullableNumber(formData.get("target_weight"));
  const note = coerce(formData.get("note"));
  const isActive = coerce(formData.get("is_active")) === "on";

  if (!canEditBreedBenchmarks(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can edit breed benchmarks." });
    unreachable("Actor cannot edit breed benchmarks");
  }

  if (!geneticLine || !sex) {
    bounce(formData, { error: "Enter both a genetic line and a sex value before saving." });
    unreachable("Missing breed benchmark family fields");
  }

  if (ageDays === null || ageDays < 0) {
    bounce(formData, {
      error: "Enter a valid benchmark day.",
      family: buildFamilyKey(geneticLine, sex),
      entry: benchmarkId || null,
    });
    unreachable("Missing or invalid benchmark age");
  }

  const payload = {
    geneticname: geneticLine,
    breedid: sex,
    age: ageDays,
    dayfeedperbird: feedPerBird,
    targetweight: targetWeight,
    note,
    is_active: isActive,
    last_userid: actorId,
    last_updated: new Date().toISOString(),
    ...(benchmarkId ? {} : { created_date: new Date().toISOString() }),
  };

  const writeResult = benchmarkId
    ? await admin.from("stdbreedspec").update(payload).eq("id", benchmarkId)
    : await admin.from("stdbreedspec").insert(payload).select("id").single();

  if (writeResult.error) {
    bounce(formData, {
      error: writeResult.error.message,
      family: buildFamilyKey(geneticLine, sex),
      entry: benchmarkId || null,
    });
  }

  const resolvedEntryId = benchmarkId || ("data" in writeResult && writeResult.data ? String(writeResult.data.id) : null);
  const resolvedFamily = buildFamilyKey(geneticLine, sex);

  revalidatePath("/admin/breed-benchmarks");
  bounce(formData, {
    notice: benchmarkId ? "Benchmark entry updated." : "Benchmark entry added.",
    family: resolvedFamily,
    entry: resolvedEntryId,
  });
}

export async function deleteBreedBenchmarkAction(formData: FormData) {
  const { admin, actorRole } = await getAdminContext(formData);
  const benchmarkId = coerce(formData.get("benchmark_id"));
  const family = coerce(formData.get("family_key"));

  if (!canEditBreedBenchmarks(actorRole)) {
    bounce(formData, { error: "Only authorized admin accounts can edit breed benchmarks." });
    unreachable("Actor cannot delete breed benchmarks");
  }

  if (!benchmarkId) {
    bounce(formData, { error: "Select a benchmark entry before deleting it." });
    unreachable("Missing breed benchmark id");
  }

  const deleteResult = await admin.from("stdbreedspec").delete().eq("id", benchmarkId);

  if (deleteResult.error) {
    bounce(formData, {
      error: deleteResult.error.message,
      family: family || null,
      entry: benchmarkId,
    });
  }

  revalidatePath("/admin/breed-benchmarks");
  bounce(formData, {
    notice: "Benchmark entry deleted.",
    family: family || null,
    entry: null,
  });
}
