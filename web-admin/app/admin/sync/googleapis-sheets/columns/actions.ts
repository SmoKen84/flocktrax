"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ColumnMapState = "enabled" | "audit_log_only" | "paused";
type ValueMode = "direct" | "boolean_flag" | "note" | "derived";

export type GoogleSheetsColumnMapRowInput = {
  id: string;
  sheetLabel: string;
  valueMode: ValueMode;
  mapState: ColumnMapState;
  notes: string;
};

export async function saveGoogleSheetsColumnMapBatchAction(input: {
  endpointId: string;
  rows: GoogleSheetsColumnMapRowInput[];
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false as const, error: "sync_db_unavailable" };
  }

  const endpointId = String(input.endpointId ?? "").trim();
  const rows = Array.isArray(input.rows) ? input.rows : [];

  if (!endpointId || rows.length === 0) {
    return { ok: false as const, error: "invalid_column_map" };
  }

  for (const row of rows) {
    if (
      !row?.id ||
      !String(row.sheetLabel ?? "").trim() ||
      !["direct", "boolean_flag", "note", "derived"].includes(String(row.valueMode ?? "")) ||
      !["enabled", "audit_log_only", "paused"].includes(String(row.mapState ?? ""))
    ) {
      return { ok: false as const, error: "invalid_column_map" };
    }
  }

  const { data: existingRows, error: existingError } = await admin
    .schema("platform")
    .from("sync_googleapis_sheet_columns")
    .select("id,endpoint_id")
    .eq("endpoint_id", endpointId);

  if (existingError) {
    return { ok: false as const, error: "column_map_lookup_failed" };
  }

  const allowedIds = new Set((existingRows ?? []).map((row) => row.id));
  if (rows.some((row) => !allowedIds.has(row.id))) {
    return { ok: false as const, error: "column_map_scope_mismatch" };
  }

  for (const row of rows) {
    const { error } = await admin
      .schema("platform")
      .from("sync_googleapis_sheet_columns")
      .update({
        sheet_label: row.sheetLabel.trim(),
        value_mode: row.valueMode,
        map_state: row.mapState,
        is_enabled: row.mapState === "enabled",
        notes: row.notes.trim() || null,
      })
      .eq("id", row.id);

    if (error) {
      return { ok: false as const, error: "column_map_save_failed" };
    }
  }

  revalidatePath("/admin/sync/googleapis-sheets/columns");
  revalidatePath("/admin/sync/googleapis-sheets/outbox");
  return { ok: true as const };
}
