import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type GoogleSheetsSyncConfigRecord = {
  endpointId: string | null;
  farmId: string;
  farmName: string;
  farmGroupId: string | null;
  farmGroupName: string | null;
  endpointName: string | null;
  isEnabled: boolean;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  headerRow: number;
  dateHeaderLabel: string;
  notes: string | null;
  workbookNotes: string | null;
  hasColumnMap: boolean;
};

export type GoogleSheetsOutboxRecord = {
  id: string;
  status: string;
  operation: string;
  entityType: string;
  endpointId: string;
  farmId: string | null;
  placementId: string | null;
  placementKey: string | null;
  logDate: string | null;
  requestedAt: string;
  processedAt: string | null;
  attempts: number;
  lastError: string | null;
  endpointName: string;
  farmName: string | null;
  spreadsheetName: string | null;
  spreadsheetId: string | null;
};

export type GoogleSheetsCurrentOperation = {
  item: GoogleSheetsOutboxRecord | null;
  totalInProgress: number;
};

export type GoogleSheetsOutboxStats = {
  total: number;
  pending: number;
  inProgress: number;
  failed: number;
  sent: number;
  rejected: number;
};

export type GoogleSheetsOutboxFilters = {
  status?: string | null;
  farmId?: string | null;
  entityType?: string | null;
  search?: string | null;
};

export type GoogleSheetsColumnMapRecord = {
  id: string;
  endpointId: string;
  farmId: string;
  farmName: string;
  farmGroupName: string | null;
  sourceTable: string;
  sourceField: string;
  sourceVariant: string | null;
  sheetLabel: string;
  valueMode: string;
  mapState: "enabled" | "audit_log_only" | "paused";
  sortOrder: number;
  notes: string | null;
};

type SyncAdapterRow = {
  id: string;
  adapter_key: string;
  adapter_name: string;
  description: string | null;
  config_screen_slug: string | null;
  outbox_screen_slug: string | null;
};

type SyncEndpointRow = {
  id: string;
  farm_id: string | null;
  farm_group_id: string | null;
  endpoint_name: string;
  is_enabled: boolean | null;
  notes: string | null;
};

type GoogleSheetsConfigRow = {
  endpoint_id: string;
  spreadsheet_id: string;
  spreadsheet_name: string | null;
  header_row: number | null;
  date_header_label: string | null;
  workbook_notes: string | null;
};

type SyncOutboxRow = {
  id: string;
  status: string;
  operation: string;
  entity_type: string;
  placement_id: string | null;
  placement_key: string | null;
  log_date: string | null;
  requested_at: string;
  processed_at: string | null;
  attempts: number | null;
  last_error: string | null;
  endpoint_id: string;
};

type GoogleSheetsColumnRow = {
  id: string;
  endpoint_id: string;
  source_table: string;
  source_field: string;
  source_variant: string;
  sheet_label: string;
  value_mode: string;
  map_state: "enabled" | "audit_log_only" | "paused" | null;
  sort_order: number | null;
  notes: string | null;
};

type FarmRow = {
  id: string;
  farm_name: string | null;
  farm_group_id: string | null;
  farm_group_name: string | null;
};

export async function getGoogleSheetsSyncBundle() {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Sync data could not connect to Supabase.");
  }

  const [adapterResult, farmsResult, endpointsResult, sheetsResult, columnMapResult] = await Promise.all([
    admin
      .schema("platform")
      .from("sync_adapters")
      .select("id,adapter_key,adapter_name,description,config_screen_slug,outbox_screen_slug")
      .eq("adapter_key", "googleapis-sheets")
      .maybeSingle(),
    admin.from("farms_ui").select("id,farm_name,farm_group_id,farm_group_name").order("farm_name"),
    admin.schema("platform").from("sync_endpoints").select("id,farm_id,farm_group_id,endpoint_name,is_enabled,notes"),
    admin
      .schema("platform")
      .from("sync_googleapis_sheets")
      .select("endpoint_id,spreadsheet_id,spreadsheet_name,header_row,date_header_label,workbook_notes"),
    admin.schema("platform").from("sync_googleapis_sheet_columns").select("endpoint_id"),
  ]);

  if (adapterResult.error || farmsResult.error || endpointsResult.error || sheetsResult.error || columnMapResult.error) {
    throw new Error(
      adapterResult.error?.message ||
        farmsResult.error?.message ||
        endpointsResult.error?.message ||
        sheetsResult.error?.message ||
        columnMapResult.error?.message ||
        "Unknown sync data error",
    );
  }

  const adapter = (adapterResult.data ?? null) as SyncAdapterRow | null;
  const farms = ((farmsResult.data ?? []) as FarmRow[]).sort((left, right) =>
    String(left.farm_name ?? "").localeCompare(String(right.farm_name ?? ""), undefined, { numeric: true }),
  );
  const endpoints = ((endpointsResult.data ?? []) as SyncEndpointRow[]).filter((row) => row.farm_id);
  const googleSheets = new Map(
    ((sheetsResult.data ?? []) as GoogleSheetsConfigRow[]).map((row) => [row.endpoint_id, row]),
  );
  const mappedEndpointIds = new Set(((columnMapResult.data ?? []) as Array<{ endpoint_id: string }>).map((row) => row.endpoint_id));

  const configs: GoogleSheetsSyncConfigRecord[] = farms.map((farm) => {
    const endpoint = endpoints.find((item) => item.farm_id === farm.id) ?? null;
    const sheetConfig = endpoint ? googleSheets.get(endpoint.id) ?? null : null;

    return {
      endpointId: endpoint?.id ?? null,
      farmId: farm.id,
      farmName: farm.farm_name ?? "Unnamed Farm",
      farmGroupId: farm.farm_group_id ?? null,
      farmGroupName: farm.farm_group_name ?? null,
      endpointName: endpoint?.endpoint_name ?? null,
      isEnabled: endpoint?.is_enabled === true,
      spreadsheetId: sheetConfig?.spreadsheet_id ?? null,
      spreadsheetName: sheetConfig?.spreadsheet_name ?? null,
      headerRow: sheetConfig?.header_row ?? 6,
      dateHeaderLabel: sheetConfig?.date_header_label ?? "DATE",
      notes: endpoint?.notes ?? null,
      workbookNotes: sheetConfig?.workbook_notes ?? null,
      hasColumnMap: endpoint ? mappedEndpointIds.has(endpoint.id) : false,
    };
  });

  return {
    adapter,
    configs,
  };
}

export async function getGoogleSheetsOutboxBundle(filters: GoogleSheetsOutboxFilters = {}) {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Sync outbox could not connect to Supabase.");
  }

  const outboxQuery = admin
    .schema("platform")
    .from("sync_outbox")
    .select("id,status,operation,entity_type,placement_id,placement_key,log_date,requested_at,processed_at,attempts,last_error,endpoint_id")
    .order("requested_at", { ascending: false })
    .limit(150);

  if (filters.status) {
    outboxQuery.eq("status", filters.status);
  }

  if (filters.entityType) {
    outboxQuery.eq("entity_type", filters.entityType);
  }

  const [adapterResult, endpointsResult, sheetsResult, outboxResult, farmsResult, currentInProgressResult, totalCountResult, pendingCountResult, inProgressCountResult, failedCountResult, sentCountResult, rejectedCountResult] = await Promise.all([
    admin
      .schema("platform")
      .from("sync_adapters")
      .select("id,adapter_key,adapter_name,description,config_screen_slug,outbox_screen_slug")
      .eq("adapter_key", "googleapis-sheets")
      .maybeSingle(),
    admin.schema("platform").from("sync_endpoints").select("id,farm_id,endpoint_name"),
    admin
      .schema("platform")
      .from("sync_googleapis_sheets")
      .select("endpoint_id,spreadsheet_id,spreadsheet_name,header_row,date_header_label,workbook_notes"),
    outboxQuery,
    admin.from("farms_ui").select("id,farm_name").order("farm_name"),
    admin
      .schema("platform")
      .from("sync_outbox")
      .select("id,status,operation,entity_type,placement_id,placement_key,log_date,requested_at,processed_at,attempts,last_error,endpoint_id")
      .eq("status", "in_progress")
      .order("claimed_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin.schema("platform").from("sync_outbox").select("*", { count: "exact", head: true }),
    admin.schema("platform").from("sync_outbox").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.schema("platform").from("sync_outbox").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
    admin.schema("platform").from("sync_outbox").select("*", { count: "exact", head: true }).eq("status", "failed"),
    admin.schema("platform").from("sync_outbox").select("*", { count: "exact", head: true }).eq("status", "sent"),
    admin.schema("platform").from("sync_outbox").select("*", { count: "exact", head: true }).eq("status", "rejected"),
  ]);

  if (
    adapterResult.error ||
    endpointsResult.error ||
    sheetsResult.error ||
    outboxResult.error ||
    farmsResult.error ||
    currentInProgressResult.error ||
    totalCountResult.error ||
    pendingCountResult.error ||
    inProgressCountResult.error ||
    failedCountResult.error ||
    sentCountResult.error ||
    rejectedCountResult.error
  ) {
    throw new Error(
      adapterResult.error?.message ||
        endpointsResult.error?.message ||
        sheetsResult.error?.message ||
        outboxResult.error?.message ||
        farmsResult.error?.message ||
        currentInProgressResult.error?.message ||
        totalCountResult.error?.message ||
        pendingCountResult.error?.message ||
        inProgressCountResult.error?.message ||
        failedCountResult.error?.message ||
        sentCountResult.error?.message ||
        rejectedCountResult.error?.message ||
        "Unknown sync outbox error",
    );
  }

  const adapter = (adapterResult.data ?? null) as SyncAdapterRow | null;
  const endpoints = new Map(
    ((endpointsResult.data ?? []) as Array<{ id: string; farm_id: string | null; endpoint_name: string }>).map((row) => [row.id, row]),
  );
  const sheets = new Map(
    ((sheetsResult.data ?? []) as GoogleSheetsConfigRow[]).map((row) => [row.endpoint_id, row]),
  );
  const farms = new Map(
    ((farmsResult.data ?? []) as Array<{ id: string; farm_name: string | null }>).map((row) => [row.id, row.farm_name ?? null]),
  );

  const rawItems: GoogleSheetsOutboxRecord[] = ((outboxResult.data ?? []) as SyncOutboxRow[]).map((row) => {
    const endpoint = endpoints.get(row.endpoint_id);
    const sheet = sheets.get(row.endpoint_id);
    const farmName = endpoint?.farm_id ? farms.get(endpoint.farm_id) ?? null : null;

    return {
      id: row.id,
      status: row.status,
      operation: row.operation,
      entityType: row.entity_type,
      endpointId: row.endpoint_id,
      farmId: endpoint?.farm_id ?? null,
      placementId: row.placement_id,
      placementKey: row.placement_key,
      logDate: row.log_date,
      requestedAt: row.requested_at,
      processedAt: row.processed_at,
      attempts: row.attempts ?? 0,
      lastError: row.last_error,
      endpointName: endpoint?.endpoint_name ?? "Unknown endpoint",
      farmName,
      spreadsheetName: sheet?.spreadsheet_name ?? null,
      spreadsheetId: sheet?.spreadsheet_id ?? null,
    };
  });

  const currentInProgressRow = (currentInProgressResult.data ?? null) as SyncOutboxRow | null;
  const currentOperationItem: GoogleSheetsOutboxRecord | null = currentInProgressRow
    ? {
        id: currentInProgressRow.id,
        status: currentInProgressRow.status,
        operation: currentInProgressRow.operation,
        entityType: currentInProgressRow.entity_type,
        endpointId: currentInProgressRow.endpoint_id,
        farmId: endpoints.get(currentInProgressRow.endpoint_id)?.farm_id ?? null,
        placementId: currentInProgressRow.placement_id,
        placementKey: currentInProgressRow.placement_key,
        logDate: currentInProgressRow.log_date,
        requestedAt: currentInProgressRow.requested_at,
        processedAt: currentInProgressRow.processed_at,
        attempts: currentInProgressRow.attempts ?? 0,
        lastError: currentInProgressRow.last_error,
        endpointName: endpoints.get(currentInProgressRow.endpoint_id)?.endpoint_name ?? "Unknown endpoint",
        farmName: endpoints.get(currentInProgressRow.endpoint_id)?.farm_id
          ? farms.get(endpoints.get(currentInProgressRow.endpoint_id)?.farm_id ?? "") ?? null
          : null,
        spreadsheetName: sheets.get(currentInProgressRow.endpoint_id)?.spreadsheet_name ?? null,
        spreadsheetId: sheets.get(currentInProgressRow.endpoint_id)?.spreadsheet_id ?? null,
      }
    : null;

  const normalizedSearch = String(filters.search ?? "")
    .trim()
    .toLowerCase();

  const items = rawItems.filter((item) => {
    if (filters.farmId) {
      if (item.farmId !== filters.farmId) {
        return false;
      }
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack = [
      item.farmName,
      item.endpointName,
      item.placementKey,
      item.entityType,
      item.operation,
      item.spreadsheetName,
      item.spreadsheetId,
      item.lastError,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  return {
    adapter,
    items,
    filters: {
      status: filters.status ?? "",
      farmId: filters.farmId ?? "",
      entityType: filters.entityType ?? "",
      search: filters.search ?? "",
    },
    stats: {
      total: totalCountResult.count ?? 0,
      pending: pendingCountResult.count ?? 0,
      inProgress: inProgressCountResult.count ?? 0,
      failed: failedCountResult.count ?? 0,
      sent: sentCountResult.count ?? 0,
      rejected: rejectedCountResult.count ?? 0,
    } satisfies GoogleSheetsOutboxStats,
    currentOperation: {
      item: currentOperationItem,
      totalInProgress: inProgressCountResult.count ?? 0,
    } satisfies GoogleSheetsCurrentOperation,
    filterOptions: {
      farms: Array.from(farms.entries())
        .map(([id, farmName]) => ({ id, farmName: farmName ?? "Unnamed Farm" }))
        .sort((left, right) => left.farmName.localeCompare(right.farmName, undefined, { numeric: true })),
      entityTypes: Array.from(
        new Set(((outboxResult.data ?? []) as SyncOutboxRow[]).map((row) => row.entity_type).filter(Boolean)),
      ).sort(),
      statuses: ["pending", "in_progress", "failed", "sent", "rejected"],
    },
  };
}

export async function getGoogleSheetsColumnMapBundle() {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Sync column map could not connect to Supabase.");
  }

  const [adapterResult, endpointsResult, sheetsResult, farmsResult, columnsResult] = await Promise.all([
    admin
      .schema("platform")
      .from("sync_adapters")
      .select("id,adapter_key,adapter_name,description,config_screen_slug,outbox_screen_slug")
      .eq("adapter_key", "googleapis-sheets")
      .maybeSingle(),
    admin.schema("platform").from("sync_endpoints").select("id,farm_id,endpoint_name,is_enabled"),
    admin.schema("platform").from("sync_googleapis_sheets").select("endpoint_id,spreadsheet_id,spreadsheet_name"),
    admin.from("farms_ui").select("id,farm_name,farm_group_name").order("farm_name"),
    admin
      .schema("platform")
      .from("sync_googleapis_sheet_columns")
      .select("id,endpoint_id,source_table,source_field,source_variant,sheet_label,value_mode,map_state,sort_order,notes")
      .order("sort_order", { ascending: true }),
  ]);

  if (adapterResult.error || endpointsResult.error || sheetsResult.error || farmsResult.error || columnsResult.error) {
    throw new Error(
      adapterResult.error?.message ||
        endpointsResult.error?.message ||
        sheetsResult.error?.message ||
        farmsResult.error?.message ||
        columnsResult.error?.message ||
        "Unknown sync column map error",
    );
  }

  const adapter = (adapterResult.data ?? null) as SyncAdapterRow | null;
  const endpoints = new Map(
    ((endpointsResult.data ?? []) as Array<{ id: string; farm_id: string | null; endpoint_name: string; is_enabled: boolean | null }>).map(
      (row) => [row.id, row],
    ),
  );
  const sheets = new Map(
    ((sheetsResult.data ?? []) as Array<{ endpoint_id: string; spreadsheet_id: string; spreadsheet_name: string | null }>).map((row) => [
      row.endpoint_id,
      row,
    ]),
  );
  const farms = new Map(
    ((farmsResult.data ?? []) as Array<{ id: string; farm_name: string | null; farm_group_name: string | null }>).map((row) => [row.id, row]),
  );

  const rows: GoogleSheetsColumnMapRecord[] = ((columnsResult.data ?? []) as GoogleSheetsColumnRow[])
    .map((row) => {
      const endpoint = endpoints.get(row.endpoint_id);
      if (!endpoint?.farm_id) return null;
      const farm = farms.get(endpoint.farm_id);
      if (!farm) return null;

      return {
        id: row.id,
        endpointId: row.endpoint_id,
        farmId: endpoint.farm_id,
        farmName: farm.farm_name ?? "Unnamed Farm",
        farmGroupName: farm.farm_group_name ?? null,
        sourceTable: row.source_table,
        sourceField: row.source_field,
        sourceVariant: row.source_variant || null,
        sheetLabel: row.sheet_label,
        valueMode: row.value_mode,
        mapState: row.map_state ?? "enabled",
        sortOrder: row.sort_order ?? 100,
        notes: row.notes,
      };
    })
    .filter((row): row is GoogleSheetsColumnMapRecord => row !== null);

  const farmsWithEndpoints = Array.from(endpoints.values())
    .filter((endpoint) => endpoint.farm_id)
    .map((endpoint) => {
      const farm = farms.get(endpoint.farm_id as string);
      const sheet = sheets.get(endpoint.id);
      return {
        endpointId: endpoint.id,
        endpointName: endpoint.endpoint_name,
        isEnabled: endpoint.is_enabled === true,
        farmId: endpoint.farm_id as string,
        farmName: farm?.farm_name ?? "Unnamed Farm",
        farmGroupName: farm?.farm_group_name ?? null,
        spreadsheetName: sheet?.spreadsheet_name ?? null,
        spreadsheetId: sheet?.spreadsheet_id ?? null,
        rows: rows.filter((row) => row.endpointId === endpoint.id),
      };
    })
    .sort((left, right) => left.farmName.localeCompare(right.farmName, undefined, { numeric: true }));

  return {
    adapter,
    farms: farmsWithEndpoints,
  };
}
