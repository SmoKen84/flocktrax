import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  batchClearSheetCells,
  batchWriteSheetCells,
  loadWorksheetLayout,
  resolveSheetCellA1FromLayout,
  type GoogleSheetsWorksheetLayout,
} from "../_shared/google-sheets-read.ts";

type ClaimedJob = {
  id: string;
  endpoint_id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  placement_id: string | null;
  placement_key: string | null;
  log_date: string | null;
  payload: Record<string, unknown> | null;
  attempts: number | null;
  requested_at: string;
  spreadsheet_id: string;
  spreadsheet_name: string | null;
  header_row: number | null;
  date_header_label: string | null;
  endpoint_name: string | null;
};

type ColumnMapRow = {
  id: string;
  source_table: string;
  source_field: string;
  source_variant: string | null;
  sheet_label: string;
  value_mode: string;
  map_state: string | null;
  notes: string | null;
};

type WorkerSettings = {
  limit: number;
  batchWrites: boolean;
};

type PreparedJob = {
  job: ClaimedJob;
  requestSummary: Record<string, unknown>;
  responseSummary: Record<string, unknown>;
  updates: Array<{ rangeA1: string; value: string; sheet_label: string; source_field: string }>;
  clears: Array<{ rangeA1: string; sheet_label: string; source_field: string }>;
  skipped: Array<Record<string, unknown>>;
};

const SKIP_VALUE = Symbol("skip-value");

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
    },
  });
}

async function readBody(req: Request) {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return {} as Record<string, unknown>;
  }

  try {
    return await req.json();
  } catch {
    return {} as Record<string, unknown>;
  }
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeSettingName(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function parseBooleanSetting(value: unknown) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function parseIntegerSetting(value: unknown) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) {
    return null;
  }

  return Math.max(1, Math.min(250, Math.trunc(raw)));
}

async function getWorkerSettings(supabase: ReturnType<typeof createClient>): Promise<WorkerSettings> {
  const { data, error } = await supabase
    .schema("platform")
    .from("settings")
    .select("name,value,is_active")
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ name?: string | null; value?: unknown; is_active?: boolean | null }>;
  const settings: WorkerSettings = {
    limit: 25,
    batchWrites: true,
  };

  for (const row of rows) {
    if (row.is_active === false) {
      continue;
    }

    const name = normalizeSettingName(row.name);
    if (["googleapis_outbox_batch_limit", "googleapis_worker_batch_limit", "sync_worker_batch_limit"].includes(name)) {
      const parsed = parseIntegerSetting(row.value);
      if (parsed) {
        settings.limit = parsed;
      }
      continue;
    }

    if (["googleapis_outbox_batch_writes", "googleapis_worker_batch_writes", "sync_worker_batch_writes"].includes(name)) {
      settings.batchWrites = parseBooleanSetting(row.value);
    }
  }

  return settings;
}

async function claimJobs(supabase: ReturnType<typeof createClient>, limit: number) {
  const { data, error } = await supabase.schema("platform").rpc("claim_googleapis_outbox", {
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ClaimedJob[]);
}

async function fetchEnabledColumnMap(
  supabase: ReturnType<typeof createClient>,
  endpointId: string,
  sourceTable: string,
) {
  const { data, error } = await supabase
    .schema("platform")
    .from("sync_googleapis_sheet_columns")
    .select("id,source_table,source_field,source_variant,sheet_label,value_mode,map_state,notes,sort_order")
    .eq("endpoint_id", endpointId)
    .eq("source_table", sourceTable)
    .eq("map_state", "enabled")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ColumnMapRow[];
}

async function fetchSourceRecord(
  supabase: ReturnType<typeof createClient>,
  entityType: string,
  entityId: string,
) {
  const { data, error } = await supabase.from(entityType).select("*").eq("id", entityId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function getPayloadSourceSnapshot(payload: Record<string, unknown> | null) {
  const snapshot = payload?.source_snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  return snapshot as Record<string, unknown>;
}

function formatValue(value: unknown, valueMode: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (valueMode === "boolean_flag") {
    return Boolean(value) ? "X" : null;
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "number") {
    const text = Number.isInteger(value) ? String(value) : value.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
    return text || "0";
  }

  const text = String(value).trim();
  return text || null;
}

function resolveMappedValue(sourceRecord: Record<string, unknown>, mapRow: ColumnMapRow) {
  if (mapRow.source_variant) {
    const sourceVariant = String(sourceRecord.sex ?? "").trim().toLowerCase();
    if (sourceVariant !== mapRow.source_variant.toLowerCase()) {
      return SKIP_VALUE;
    }
  }

  return formatValue(sourceRecord[mapRow.source_field], mapRow.value_mode);
}

async function completeJob(
  supabase: ReturnType<typeof createClient>,
  input: {
    outboxId: string;
    status: "sent" | "failed" | "rejected";
    lastError: string | null;
    requestSummary: Record<string, unknown>;
    responseSummary: Record<string, unknown>;
    statusCode: number;
  },
) {
  const { error } = await supabase.schema("platform").rpc("complete_googleapis_outbox", {
    p_outbox_id: input.outboxId,
    p_status: input.status,
    p_last_error: input.lastError,
    p_request_summary: input.requestSummary,
    p_response_summary: input.responseSummary,
    p_status_code: input.statusCode,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function buildRequestSummary(job: ClaimedJob) {
  return {
    entity_type: job.entity_type,
    entity_id: job.entity_id,
    operation: job.operation,
    placement_key: job.placement_key,
    log_date: job.log_date,
    endpoint_id: job.endpoint_id,
    endpoint_name: job.endpoint_name,
    spreadsheet_id: job.spreadsheet_id,
    spreadsheet_name: job.spreadsheet_name,
  };
}

async function rejectJob(
  supabase: ReturnType<typeof createClient>,
  job: ClaimedJob,
  reason: string,
  statusCode = 422,
) {
  await completeJob(supabase, {
    outboxId: job.id,
    status: "rejected",
    lastError: reason,
    requestSummary: buildRequestSummary(job),
    responseSummary: { reason },
    statusCode,
  });
  return "rejected" as const;
}

async function failJob(
  supabase: ReturnType<typeof createClient>,
  job: ClaimedJob,
  message: string,
) {
  await completeJob(supabase, {
    outboxId: job.id,
    status: "failed",
    lastError: message,
    requestSummary: buildRequestSummary(job),
    responseSummary: { exception: message },
    statusCode: 500,
  });
  return "failed" as const;
}

async function prepareJob(
  supabase: ReturnType<typeof createClient>,
  job: ClaimedJob,
  caches: {
    columnMaps: Map<string, ColumnMapRow[]>;
    sourceRecords: Map<string, Record<string, unknown> | null>;
    layouts: Map<string, GoogleSheetsWorksheetLayout>;
  },
) {
  try {
    if (!job.placement_key || !job.log_date) {
      return await rejectJob(supabase, job, "Outbox row is missing placement_key or log_date.");
    }

    const sourceTable = `public.${job.entity_type}`;
    const mapCacheKey = `${job.endpoint_id}|${sourceTable}`;
    let mapRows = caches.columnMaps.get(mapCacheKey);
    if (!mapRows) {
      mapRows = await fetchEnabledColumnMap(supabase, job.endpoint_id, sourceTable);
      caches.columnMaps.set(mapCacheKey, mapRows);
    }

    if (mapRows.length === 0) {
      return await rejectJob(supabase, job, "No enabled column-map rows exist for this source table.");
    }

    const payloadSourceSnapshot = getPayloadSourceSnapshot(job.payload);
    const sourceCacheKey = `${job.entity_type}|${job.entity_id}`;
    let sourceRecord = payloadSourceSnapshot ?? caches.sourceRecords.get(sourceCacheKey);
    if (sourceRecord === undefined) {
      sourceRecord = await fetchSourceRecord(supabase, job.entity_type, job.entity_id) as Record<string, unknown> | null;
      caches.sourceRecords.set(sourceCacheKey, sourceRecord);
    }

    if (!sourceRecord) {
      return await rejectJob(supabase, job, "Source record no longer exists.", 404);
    }

    const layoutCacheKey =
      `${job.spreadsheet_id}|${job.placement_key}|${job.header_row ?? 6}|${job.date_header_label?.trim() || "DATE"}`;
    let layout = caches.layouts.get(layoutCacheKey);
    if (!layout) {
      layout = await loadWorksheetLayout(
        job.spreadsheet_id,
        job.placement_key,
        job.header_row ?? 6,
        job.date_header_label?.trim() || "DATE",
      );
      caches.layouts.set(layoutCacheKey, layout);
    }

    const updates: PreparedJob["updates"] = [];
    const clears: PreparedJob["clears"] = [];
    const skipped: PreparedJob["skipped"] = [];

    for (const mapRow of mapRows) {
      const value = resolveMappedValue(sourceRecord, mapRow);
      if (value === SKIP_VALUE) {
        skipped.push({
          sheet_label: mapRow.sheet_label,
          source_field: mapRow.source_field,
          reason: "variant_mismatch",
        });
        continue;
      }

      const rangeA1 = resolveSheetCellA1FromLayout(layout, job.log_date, mapRow.sheet_label);
      if (value === null) {
        clears.push({
          rangeA1,
          sheet_label: mapRow.sheet_label,
          source_field: mapRow.source_field,
        });
        continue;
      }

      updates.push({
        rangeA1,
        value,
        sheet_label: mapRow.sheet_label,
        source_field: mapRow.source_field,
      });
    }

    const prepared: PreparedJob = {
      job,
      requestSummary: buildRequestSummary(job),
      responseSummary: {
        worksheet: job.placement_key,
        write_count: updates.length,
        clear_count: clears.length,
        skip_count: skipped.length,
        writes: updates.map(({ sheet_label, source_field, value }) => ({ sheet_label, source_field, value })),
        clears: clears.map(({ sheet_label, source_field }) => ({ sheet_label, source_field })),
        skipped,
      },
      updates,
      clears,
      skipped,
    };

    return prepared;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return await failJob(supabase, job, message);
  }
}

async function flushPreparedGroup(
  supabase: ReturnType<typeof createClient>,
  preparedJobs: PreparedJob[],
) {
  if (preparedJobs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const spreadsheetId = preparedJobs[0].job.spreadsheet_id;
  const updates = preparedJobs.flatMap((job) => job.updates.map(({ rangeA1, value }) => ({ rangeA1, value })));
  const clears = preparedJobs.flatMap((job) => job.clears.map(({ rangeA1 }) => rangeA1));

  try {
    if (updates.length > 0) {
      await batchWriteSheetCells(spreadsheetId, updates);
    }

    if (clears.length > 0) {
      await batchClearSheetCells(spreadsheetId, clears);
    }

    for (const prepared of preparedJobs) {
      await completeJob(supabase, {
        outboxId: prepared.job.id,
        status: "sent",
        lastError: null,
        requestSummary: prepared.requestSummary,
        responseSummary: prepared.responseSummary,
        statusCode: 200,
      });
    }

    return { sent: preparedJobs.length, failed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const prepared of preparedJobs) {
      await completeJob(supabase, {
        outboxId: prepared.job.id,
        status: "failed",
        lastError: message,
        requestSummary: prepared.requestSummary,
        responseSummary: {
          ...prepared.responseSummary,
          batch_error: message,
        },
        statusCode: 500,
      });
    }

    return { sent: 0, failed: preparedJobs.length };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await readBody(req);
    const supabase = getAdminClient();
    const settings = await getWorkerSettings(supabase);
    const requestedLimit = Number(body.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(250, Math.trunc(requestedLimit)))
      : settings.limit;
    const jobs = await claimJobs(supabase, limit);

    if (jobs.length === 0) {
      return json(req, {
        ok: true,
        claimed: 0,
        sent: 0,
        failed: 0,
        rejected: 0,
        batched: settings.batchWrites,
        message: "No pending googleapis-sheets outbox rows found.",
      });
    }

    const caches = {
      columnMaps: new Map<string, ColumnMapRow[]>(),
      sourceRecords: new Map<string, Record<string, unknown> | null>(),
      layouts: new Map<string, GoogleSheetsWorksheetLayout>(),
    };

    const groups = new Map<string, PreparedJob[]>();
    const counts = { sent: 0, failed: 0, rejected: 0 };

    for (const job of jobs) {
      const prepared = await prepareJob(supabase, job, caches);
      if (prepared === "failed") {
        counts.failed += 1;
        continue;
      }

      if (prepared === "rejected") {
        counts.rejected += 1;
        continue;
      }

      const groupKey = `${job.spreadsheet_id}|${job.placement_key}|${job.header_row ?? 6}|${job.date_header_label?.trim() || "DATE"}`;
      const bucket = groups.get(groupKey) ?? [];
      bucket.push(prepared);
      groups.set(groupKey, bucket);
    }

    if (settings.batchWrites) {
      for (const preparedJobs of groups.values()) {
        const result = await flushPreparedGroup(supabase, preparedJobs);
        counts.sent += result.sent;
        counts.failed += result.failed;
      }
    } else {
      for (const preparedJobs of groups.values()) {
        for (const prepared of preparedJobs) {
          const result = await flushPreparedGroup(supabase, [prepared]);
          counts.sent += result.sent;
          counts.failed += result.failed;
        }
      }
    }

    return json(req, {
      ok: true,
      claimed: jobs.length,
      ...counts,
      batched: settings.batchWrites,
      message: settings.batchWrites
        ? `Processed ${jobs.length} queued row${jobs.length === 1 ? "" : "s"} with grouped Google Sheets batch writes.`
        : `Processed ${jobs.length} queued row${jobs.length === 1 ? "" : "s"} in single-row mode.`,
    });
  } catch (error) {
    return json(req, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
