"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

function resolveGoogleCredentialsPath() {
  const explicitPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (explicitPath) {
    return explicitPath;
  }

  const candidatePaths = [
    "C:\\dev-secrets\\flocktrax-sync-e2fddb60793f.json",
    "C:\\dev\\gpc_engine\\secrets\\gpc-syncengine-02623a353a42.json",
    "C:\\dev\\gpc_engine\\secrets\\gpc-syncengine-SA.json",
    "C:\\dev\\gpc_engine\\SQL2Sheets\\gsheetssync-476008-f3b390eacd89.json",
    "C:\\Users\\Ken\\Desktop\\FlockTRAX-gCloud\\secret\\gpc-syncengine-02623a353a42.json",
    "C:\\Users\\Ken\\Desktop\\FlockTRAX\\SQL2Sheets\\gsheetssync-476008-f3b390eacd89.json",
  ];

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return "";
}

async function processGoogleSheetsOutboxViaHostedWorker(limit: number): Promise<OutboxActionResult> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return {
      ok: false,
      message: "Results: the hosted worker could not start because the Supabase function environment is incomplete.",
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/googleapis-outbox-process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const errorMessage =
        typeof payload?.error === "string" && payload.error.trim().length > 0
          ? payload.error.trim()
          : `Hosted worker request failed with status ${response.status}.`;
      return {
        ok: false,
        message: `Results: the hosted worker could not process the queue. ${errorMessage}`,
      };
    }

    return {
      ok: true,
      message:
        typeof payload.message === "string" && payload.message.trim().length > 0
          ? `Results: ${payload.message.trim()}`
          : `Results: the hosted worker processed ${payload.claimed ?? 0} queued row(s).`,
    };
  } catch {
    return {
      ok: false,
      message: "Results: the hosted worker could not be reached from the admin console.",
    };
  }
}

type RetryOutboxResult =
  | { ok: true }
  | { ok: false; reason: "not_retryable" | "other"; message: string };

export type OutboxActionResult = {
  ok: boolean;
  message: string;
};

async function replayGoogleSheetsOutbox(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  outboxId: string,
): Promise<OutboxActionResult> {
  const { data: outboxRow, error: loadError } = await admin
    .schema("platform")
    .from("sync_outbox")
    .select("id,status,endpoint_id,adapter_id,entity_type,entity_id,operation,placement_id,placement_key,log_date,payload,dedupe_key")
    .eq("id", outboxId)
    .maybeSingle();

  if (loadError || !outboxRow) {
    return {
      ok: false,
      message: `Results: that outbox row could not be loaded for replay.${loadError?.message ? ` Error: ${loadError.message}` : ""}`,
    };
  }

  const normalizedPayload =
    outboxRow.payload && typeof outboxRow.payload === "object" && !Array.isArray(outboxRow.payload)
      ? structuredClone(outboxRow.payload)
      : {};
  const replayedAt = new Date().toISOString();
  const payload = {
    ...normalizedPayload,
    replay: {
      replay_of_outbox_id: outboxRow.id,
      replayed_at: replayedAt,
    },
  };

  const replayDedupeKey = [
    String(outboxRow.dedupe_key ?? "").trim() || `googleapis-replay|${outboxRow.id}`,
    "replay",
    replayedAt,
  ].join("|");

  const { data: insertedRow, error: insertError } = await admin
    .schema("platform")
    .from("sync_outbox")
    .insert({
      endpoint_id: outboxRow.endpoint_id,
      adapter_id: outboxRow.adapter_id,
      entity_type: outboxRow.entity_type,
      entity_id: outboxRow.entity_id,
      operation: outboxRow.operation,
      placement_id: outboxRow.placement_id,
      placement_key: outboxRow.placement_key,
      log_date: outboxRow.log_date,
      payload,
      status: "pending",
      attempts: 0,
      last_error: null,
      requested_at: replayedAt,
      claimed_at: null,
      processed_at: null,
      dedupe_key: replayDedupeKey,
    })
    .select("id")
    .single();

  if (insertError || !insertedRow) {
    return {
      ok: false,
      message: `Results: that outbox row could not be replayed.${insertError?.message ? ` Error: ${insertError.message}` : ""}`,
    };
  }

  const { error: auditError } = await admin.schema("platform").from("sync_audit").insert({
    outbox_id: insertedRow.id,
    endpoint_id: outboxRow.endpoint_id,
    adapter_id: outboxRow.adapter_id,
    request_summary: {
      action: "replay_googleapis_outbox",
      replay_of_outbox_id: outboxRow.id,
      original_status: outboxRow.status,
    },
    response_summary: {
      status: "pending",
      replayed_at: replayedAt,
    },
    status_code: 202,
    status: "logged",
  });

  if (auditError) {
    return {
      ok: false,
      message: `Results: the replay row was queued, but audit logging failed. Error: ${auditError.message}`,
    };
  }

  return {
    ok: true,
    message: "Results: 1 outbox row was replayed from its stored payload and moved to pending.",
  };
}

async function retryGoogleSheetsOutboxViaFallback(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  outboxId: string,
): Promise<RetryOutboxResult> {
  const { data: outboxRow, error: loadError } = await admin
    .schema("platform")
    .from("sync_outbox")
    .select("id,status,endpoint_id,adapter_id,attempts")
    .eq("id", outboxId)
    .maybeSingle();

  if (loadError || !outboxRow) {
    return {
      ok: false,
      reason: "other",
      message: loadError?.message || `Outbox row ${outboxId} was not found.`,
    };
  }

  if (outboxRow.status !== "failed" && outboxRow.status !== "rejected") {
    return {
      ok: false,
      reason: "not_retryable",
      message: `Only failed or rejected outbox rows can be retried. Current status: ${outboxRow.status}`,
    };
  }

  const { error: updateError } = await admin
    .schema("platform")
    .from("sync_outbox")
    .update({
      status: "pending",
      last_error: null,
      claimed_at: null,
      processed_at: null,
    })
    .eq("id", outboxId)
    .in("status", ["failed", "rejected"]);

  if (updateError) {
    return {
      ok: false,
      reason: "other",
      message: updateError.message,
    };
  }

  const { error: auditError } = await admin.schema("platform").from("sync_audit").insert({
    outbox_id: outboxRow.id,
    endpoint_id: outboxRow.endpoint_id,
    adapter_id: outboxRow.adapter_id,
    request_summary: {
      action: "retry_googleapis_outbox_fallback",
      previous_status: outboxRow.status,
      attempts: outboxRow.attempts ?? 0,
    },
    response_summary: {
      status: "pending",
      reason: "manual_retry",
    },
    status_code: 202,
    status: "logged",
  });

  if (auditError) {
    return {
      ok: false,
      reason: "other",
      message: auditError.message,
    };
  }

  return { ok: true };
}

async function retryGoogleSheetsOutbox(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  outboxId: string,
): Promise<RetryOutboxResult> {
  const { error } = await admin.schema("platform").rpc("retry_googleapis_outbox", {
    p_outbox_id: outboxId,
  });

  if (!error) {
    return { ok: true };
  }

  if (error.message.includes("Could not find the function platform.retry_googleapis_outbox")) {
    return retryGoogleSheetsOutboxViaFallback(admin, outboxId);
  }

  if (isNoLongerRetryableError(error.message)) {
    return {
      ok: false,
      reason: "not_retryable",
      message: error.message,
    };
  }

  return {
    ok: false,
    reason: "other",
    message: error.message,
  };
}

export async function saveGoogleSheetsConfigAction(formData: FormData) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    redirect("/admin/sync/googleapis-sheets/config?error=sync_db_unavailable");
  }

  const farmId = String(formData.get("farmId") ?? "").trim();
  const spreadsheetId = String(formData.get("spreadsheetId") ?? "").trim();
  const spreadsheetName = String(formData.get("spreadsheetName") ?? "").trim();
  const endpointName = String(formData.get("endpointName") ?? "").trim();
  const dateHeaderLabel = String(formData.get("dateHeaderLabel") ?? "DATE").trim() || "DATE";
  const notes = String(formData.get("notes") ?? "").trim();
  const workbookNotes = String(formData.get("workbookNotes") ?? "").trim();
  const copyFromEndpointId = String(formData.get("copyFromEndpointId") ?? "").trim();
  const isEnabled = String(formData.get("isEnabled") ?? "").trim() === "true";
  const headerRowRaw = String(formData.get("headerRow") ?? "6").trim();
  const headerRow = Number.parseInt(headerRowRaw, 10);

  if (!farmId || !spreadsheetId || !Number.isFinite(headerRow) || headerRow < 1) {
    redirect("/admin/sync/googleapis-sheets/config?error=invalid_sync_config");
  }

  const { data: adapter, error: adapterError } = await admin
    .schema("platform")
    .from("sync_adapters")
    .select("id")
    .eq("adapter_key", "googleapis-sheets")
    .maybeSingle();

  if (adapterError || !adapter) {
    redirect("/admin/sync/googleapis-sheets/config?error=missing_google_adapter");
  }

  const { data: farm, error: farmError } = await admin
    .from("farms_ui")
    .select("id,farm_name,farm_group_id")
    .eq("id", farmId)
    .maybeSingle();

  if (farmError || !farm) {
    redirect("/admin/sync/googleapis-sheets/config?error=unknown_farm");
  }

  const { data: existingEndpoint, error: endpointLookupError } = await admin
    .schema("platform")
    .from("sync_endpoints")
    .select("id")
    .eq("adapter_id", adapter.id)
    .eq("farm_id", farmId)
    .maybeSingle();

  if (endpointLookupError) {
    redirect("/admin/sync/googleapis-sheets/config?error=endpoint_lookup_failed");
  }

  let endpointId = existingEndpoint?.id ?? null;

  if (!endpointId) {
    const { data: insertedEndpoint, error: endpointInsertError } = await admin
      .schema("platform")
      .from("sync_endpoints")
      .insert({
        adapter_id: adapter.id,
        farm_id: farmId,
        farm_group_id: farm.farm_group_id ?? null,
        endpoint_name: endpointName || farm.farm_name || "Farm Workbook",
        is_enabled: isEnabled,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (endpointInsertError || !insertedEndpoint) {
      redirect("/admin/sync/googleapis-sheets/config?error=endpoint_insert_failed");
    }

    endpointId = insertedEndpoint.id;
  } else {
    const { error: endpointUpdateError } = await admin
      .schema("platform")
      .from("sync_endpoints")
      .update({
        endpoint_name: endpointName || farm.farm_name || "Farm Workbook",
        is_enabled: isEnabled,
        notes: notes || null,
      })
      .eq("id", endpointId);

    if (endpointUpdateError) {
      redirect("/admin/sync/googleapis-sheets/config?error=endpoint_update_failed");
    }
  }

  const { error: sheetsUpsertError } = await admin.schema("platform").from("sync_googleapis_sheets").upsert({
    endpoint_id: endpointId,
    spreadsheet_id: spreadsheetId,
    spreadsheet_name: spreadsheetName || null,
    header_row: headerRow,
    date_header_label: dateHeaderLabel,
    workbook_notes: workbookNotes || null,
  });

  if (sheetsUpsertError) {
    redirect("/admin/sync/googleapis-sheets/config?error=sheets_config_save_failed");
  }

  const { error: columnSeedError } = await admin.schema("platform").rpc("ensure_googleapis_sheet_columns", {
    p_endpoint_id: endpointId,
  });

  if (columnSeedError) {
    redirect("/admin/sync/googleapis-sheets/config?error=column_seed_failed");
  }

  if (copyFromEndpointId && copyFromEndpointId !== endpointId) {
    const { data: sourceEndpoint, error: sourceEndpointError } = await admin
      .schema("platform")
      .from("sync_endpoints")
      .select("id,adapter_id")
      .eq("id", copyFromEndpointId)
      .eq("adapter_id", adapter.id)
      .maybeSingle();

    if (sourceEndpointError || !sourceEndpoint) {
      redirect("/admin/sync/googleapis-sheets/config?error=copy_source_missing");
    }

    const { data: sourceRows, error: sourceRowsError } = await admin
      .schema("platform")
      .from("sync_googleapis_sheet_columns")
      .select("source_table,source_field,source_variant,sheet_label,value_mode,map_state,is_enabled,sort_order,notes")
      .eq("endpoint_id", copyFromEndpointId);

    if (sourceRowsError) {
      redirect("/admin/sync/googleapis-sheets/config?error=copy_source_lookup_failed");
    }

    if ((sourceRows ?? []).length === 0) {
      redirect("/admin/sync/googleapis-sheets/config?error=copy_source_empty");
    }

    const { error: copyDeleteError } = await admin
      .schema("platform")
      .from("sync_googleapis_sheet_columns")
      .delete()
      .eq("endpoint_id", endpointId);

    if (copyDeleteError) {
      redirect("/admin/sync/googleapis-sheets/config?error=copy_target_clear_failed");
    }

    const { error: copyInsertError } = await admin.schema("platform").from("sync_googleapis_sheet_columns").insert(
      (sourceRows ?? []).map((row) => ({
        endpoint_id: endpointId,
        source_table: row.source_table,
        source_field: row.source_field,
        source_variant: row.source_variant,
        sheet_label: row.sheet_label,
        value_mode: row.value_mode,
        map_state: row.map_state ?? (row.is_enabled ? "enabled" : "paused"),
        is_enabled: row.map_state ? row.map_state === "enabled" : row.is_enabled === true,
        sort_order: row.sort_order,
        notes: row.notes,
      })),
    );

    if (copyInsertError) {
      redirect("/admin/sync/googleapis-sheets/config?error=copy_target_insert_failed");
    }
  }

  revalidatePath("/admin/sync/googleapis-sheets");
  revalidatePath("/admin/sync/googleapis-sheets/config");
  revalidatePath("/admin/sync/googleapis-sheets/columns");
  redirect("/admin/sync/googleapis-sheets/config?saved=1");
}

export async function retryGoogleSheetsOutboxAction(outboxId: string): Promise<OutboxActionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      message: "Results: sync database is unavailable for the retry request.",
    };
  }

  const normalizedOutboxId = String(outboxId ?? "").trim();
  if (!normalizedOutboxId) {
    return {
      ok: false,
      message: "Results: the retry request did not include an outbox id.",
    };
  }

  const result = await retryGoogleSheetsOutbox(admin, normalizedOutboxId);
  if (!result.ok) {
    if (result.reason === "not_retryable") {
      return {
        ok: false,
        message: "Results: that outbox row is no longer in failed/rejected status, so it could not be requeued.",
      };
    }

    return {
      ok: false,
      message: `Results: that outbox row could not be moved back to pending. Error: ${result.message}`,
    };
  }

  revalidatePath("/admin/sync/googleapis-sheets/outbox");
  return {
    ok: true,
    message: "Results: 1 outbox row was moved back to pending and is ready for the worker to claim.",
  };
}

export async function replayGoogleSheetsOutboxAction(outboxId: string): Promise<OutboxActionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      message: "Results: sync database is unavailable for the replay request.",
    };
  }

  const normalizedOutboxId = String(outboxId ?? "").trim();
  if (!normalizedOutboxId) {
    return {
      ok: false,
      message: "Results: the replay request did not include an outbox id.",
    };
  }

  const result = await replayGoogleSheetsOutbox(admin, normalizedOutboxId);
  if (result.ok) {
    revalidatePath("/admin/sync/googleapis-sheets/outbox");
  }

  return result;
}

export async function retryGoogleSheetsOutboxBulkAction(input: {
  status?: string | null;
  farmId?: string | null;
  entityType?: string | null;
}): Promise<OutboxActionResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      message: "Results: sync database is unavailable for the bulk retry request.",
    };
  }

  const requestedStatus = String(input.status ?? "").trim();
  const farmId = String(input.farmId ?? "").trim();
  const entityType = String(input.entityType ?? "").trim();

  const eligibleStatuses =
    requestedStatus === "failed" || requestedStatus === "rejected"
      ? [requestedStatus]
      : ["failed", "rejected"];

  let endpointIds: string[] | null = null;
  if (farmId) {
    const { data: endpoints, error: endpointError } = await admin
      .schema("platform")
      .from("sync_endpoints")
      .select("id")
      .eq("farm_id", farmId);

    if (endpointError) {
      return {
        ok: false,
        message: "Results: the bulk retry could not resolve the selected farm endpoints.",
      };
    }

    endpointIds = (endpoints ?? []).map((row) => row.id).filter(Boolean);
    if (endpointIds.length === 0) {
      return {
        ok: false,
        message: "Results: no retryable outbox rows matched the current bulk selection.",
      };
    }
  }

  let query = admin
    .schema("platform")
    .from("sync_outbox")
    .select("id")
    .in("status", eligibleStatuses)
    .order("requested_at", { ascending: true })
    .limit(150);

  if (endpointIds) {
    query = query.in("endpoint_id", endpointIds);
  }

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data: rows, error: rowsError } = await query;
  if (rowsError) {
    return {
      ok: false,
      message: "Results: the bulk retry query failed before any rows were updated.",
    };
  }

  const outboxIds = (rows ?? []).map((row) => row.id).filter(Boolean);
  if (outboxIds.length === 0) {
    return {
      ok: false,
      message: "Results: no retryable outbox rows matched the current bulk selection.",
    };
  }

  let retriedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let firstFailureReason = "";
  for (const outboxId of outboxIds) {
    const result = await retryGoogleSheetsOutbox(admin, outboxId);

    if (!result.ok) {
      if (result.reason === "not_retryable") {
        skippedCount += 1;
      } else {
        failedCount += 1;
        if (!firstFailureReason) {
          firstFailureReason = result.message;
        }
      }
      continue;
    }

    retriedCount += 1;
  }

  if (retriedCount === 0) {
    if (failedCount > 0) {
      return {
        ok: false,
        message: `Results: no outbox rows were requeued. ${failedCount} ${failedCount === 1 ? "selected row failed" : "selected rows failed"} during retry.${firstFailureReason ? ` First error: ${firstFailureReason}` : ""}`,
      };
    }

    return {
      ok: false,
      message: `Results: no outbox rows were requeued. ${skippedCount > 0 ? `${skippedCount} ${skippedCount === 1 ? "selected row was" : "selected rows were"} already no longer retryable.` : "The selected rows were no longer retryable."}`,
    };
  }

  revalidatePath("/admin/sync/googleapis-sheets/outbox");
  if (failedCount > 0) {
    return {
      ok: true,
      message: `Results: ${retriedCount} outbox ${retriedCount === 1 ? "row was" : "rows were"} moved back to pending. ${failedCount} ${failedCount === 1 ? "row failed" : "rows failed"} to requeue.${firstFailureReason ? ` First error: ${firstFailureReason}` : ""}`,
    };
  }

  if (skippedCount > 0) {
    return {
      ok: true,
      message: `Results: ${retriedCount} outbox ${retriedCount === 1 ? "row was" : "rows were"} moved back to pending. ${skippedCount} ${skippedCount === 1 ? "row was" : "rows were"} skipped because ${skippedCount === 1 ? "it was" : "they were"} no longer retryable.`,
    };
  }

  return {
    ok: true,
    message:
      retriedCount === 1
        ? "Results: 1 outbox row was moved back to pending and is ready for the worker to claim."
        : `Results: ${retriedCount} outbox rows were moved back to pending and are ready for the worker to claim.`,
  };
}

export async function processGoogleSheetsOutboxAction(limitInput: number): Promise<OutboxActionResult> {
  const limitRaw = String(limitInput ?? 10).trim();
  const limit = Number.parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    return {
      ok: false,
      message: "Results: batch size must be between 1 and 100 rows.",
    };
  }

  const hostedResult = await processGoogleSheetsOutboxViaHostedWorker(limit);
  if (hostedResult.ok) {
    revalidatePath("/admin/sync/googleapis-sheets/outbox");
    return hostedResult;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return hostedResult;
  }

  const credentialsPath = resolveGoogleCredentialsPath();
  if (!credentialsPath) {
    return hostedResult;
  }

  const workerDir = path.resolve(process.cwd(), "..", "toolkit", "sync_engine");
  const pythonCommand = process.env.PYTHON_SYNC_WORKER?.trim() || "python";

  try {
    const child = spawn(pythonCommand, ["worker.py", "--limit", String(limit)], {
      cwd: workerDir,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        GOOGLE_APPLICATION_CREDENTIALS: credentialsPath,
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      },
      windowsHide: true,
    });

    child.unref();
  } catch {
    return {
      ok: false,
      message: "Results: the local worker process could not be launched from the Outbox page.",
    };
  }

  revalidatePath("/admin/sync/googleapis-sheets/outbox");
  return {
    ok: true,
    message: `Results: the hosted worker was unavailable, so the local sync worker was launched for up to ${limit} queued rows. Checking queue progress now...`,
  };
}

function isNoLongerRetryableError(message: string) {
  return message.includes("Only failed or rejected outbox rows can be retried.");
}
