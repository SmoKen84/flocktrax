"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  const resetResult = await admin.rpc("reset_demo_showcase_data");
  if (resetResult.error) {
    returnToEnvironmentControl({ error: `Demo reset failed: ${resetResult.error.message}` });
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
