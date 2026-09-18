"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { seedDemoDocuments } from "@/lib/demo-document-seed";

import { hasEnvironmentControlAccess } from "@/lib/environment-control";
import { evaluateEnvironmentSafety } from "@/lib/environment-safety";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function returnToEnvironmentControl(options: { notice?: string; error?: string }): never {
  const params = new URLSearchParams();
  if (options.notice) params.set("notice", options.notice);
  if (options.error) params.set("error", options.error);
  redirect(`/admin/environment-control?${params.toString()}`);
}

export async function resetDemoShowcaseAction(formData: FormData) {
  if (!(await hasEnvironmentControlAccess())) {
    returnToEnvironmentControl({ error: "Owner-level Environment Control access is required." });
  }

  const confirmation = String(formData.get("confirmation") ?? "").trim().toUpperCase();
  if (confirmation !== "RESET DEMO") {
    returnToEnvironmentControl({ error: "Enter RESET DEMO exactly to confirm the showcase reset." });
  }

  const safety = evaluateEnvironmentSafety();
  if (!safety.isDemo) {
    returnToEnvironmentControl({ error: "Reset refused because this deployment is not explicitly labeled demo." });
  }
  if (safety.issues.length > 0) {
    returnToEnvironmentControl({ error: `Reset refused: ${safety.issues.join(" ")}` });
  }
  if (safety.outboundMode !== "disabled") {
    returnToEnvironmentControl({ error: "Reset requires outbound integrations to be fully disabled." });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    returnToEnvironmentControl({ error: "The demo service credential is not configured." });
  }

  const evaluatorSnapshot = await admin.from("demo_evaluators").select("user_id,farm_id,role_code,disabled_at,expires_at");
  if (evaluatorSnapshot.error && evaluatorSnapshot.error.code !== "42P01" && evaluatorSnapshot.error.code !== "PGRST205") {
    returnToEnvironmentControl({ error: "Could not preserve evaluator access before reset." });
  }

  const archivesResult = await admin
    .from("document_archives")
    .select("storage_bucket,storage_path");
  if (archivesResult.error) {
    returnToEnvironmentControl({ error: `Unable to inventory demo documents: ${archivesResult.error.message}` });
  }

  const archivePaths = (archivesResult.data ?? [])
    .filter((row) => row.storage_bucket === "flocktrax-document-archive" && typeof row.storage_path === "string")
    .map((row) => row.storage_path as string);

  for (let index = 0; index < archivePaths.length; index += 100) {
    const removeResult = await admin.storage
      .from("flocktrax-document-archive")
      .remove(archivePaths.slice(index, index + 100));
    if (removeResult.error) {
      returnToEnvironmentControl({ error: `Unable to clear demo documents: ${removeResult.error.message}` });
    }
  }

  const resetResult = await admin.rpc("reset_demo_showcase_data");
  if (resetResult.error) {
    returnToEnvironmentControl({ error: `Demo reset failed: ${resetResult.error.message}` });
  }
  for (const evaluator of evaluatorSnapshot.data ?? []) {
    if (evaluator.role_code === "integrator_manager") continue;
    const role = await admin.from("roles").select("id").eq("code", evaluator.role_code).single();
    if (role.error) returnToEnvironmentControl({ error: "Demo reset completed, but evaluator role restoration needs owner review." });
    const restored = await admin.from("farm_memberships").upsert({
      user_id: evaluator.user_id, farm_id: evaluator.farm_id, role_id: role.data.id,
      is_active: !evaluator.disabled_at && Date.parse(evaluator.expires_at) > Date.now(),
    }, { onConflict: "user_id,farm_id" });
    if (restored.error) returnToEnvironmentControl({ error: "Demo reset completed, but evaluator farm access needs owner review." });
  }


  try {
    await seedDemoDocuments(admin, process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  } catch (error) {
    returnToEnvironmentControl({ error: `Demo data reset, but sample documents need restoration: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
  const statusResult = await admin.rpc("get_demo_showcase_status");
  const status = statusResult.data as { ok?: unknown } | null;
  if (statusResult.error || status?.ok !== true) {
    returnToEnvironmentControl({
      error: statusResult.error?.message ?? "The reset completed but the baseline verification did not pass.",
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/environment-control");
  returnToEnvironmentControl({ notice: "Synthetic demo data was reset and verified. Outbound queues are empty." });
}
