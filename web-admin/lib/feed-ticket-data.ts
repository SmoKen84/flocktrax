import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type FeedTicketAdminFilters = {
  listMode?: "ticket" | "drop" | null;
  ticketNumber?: string | null;
  ticketTypes?: string[] | null;
  flockCode?: string | null;
  farm?: string | null;
  barn?: string | null;
  bin?: string | null;
  sourceType?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  includeStarter?: boolean | null;
  includeGrower?: boolean | null;
};

export type FeedTicketAdminRow = {
  id: string;
  ticketId: string;
  deliveryDate: string | null;
  ticketNumber: string | null;
  ticketType: string | null;
  source: string | null;
  grossWeightLbs: number | null;
  farmName: string | null;
  barnCode: string | null;
  binCode: string | null;
  placementCode: string | null;
  feedType: string | null;
  dropWeightLbs: number | null;
  comment: string | null;
  offFarmRedirect: boolean;
};

type FeedTicketAdminRowWithSort = FeedTicketAdminRow & {
  barnSortCode: string | null;
};

export type FeedTicketAdminBundle = {
  rows: FeedTicketAdminRow[];
  filters: {
    listMode: "ticket" | "drop";
    ticketNumber: string;
    ticketTypes: string[];
    flockCode: string;
    farm: string;
    barn: string;
    bin: string;
    sourceType: string;
    dateFrom: string;
    dateTo: string;
    includeStarter: boolean;
    includeGrower: boolean;
  };
  rollups: {
    ticketCount: number;
    dropCount: number;
    grossWeightLbs: number;
    selectedDropWeightLbs: number;
    starterDropWeightLbs: number;
    growerDropWeightLbs: number;
  };
  summaryText: string;
  filterOptions: {
    sourceTypes: string[];
    ticketTypes: string[];
    farms: string[];
    barns: string[];
    bins: string[];
    flocks: string[];
  };
};

export type FeedTicketFlockReportBundle = {
  filters: {
    flockCode: string;
    dateFrom: string;
    dateTo: string;
    includeStarter: boolean;
    includeGrower: boolean;
  };
  rows: FeedTicketAdminRow[];
  generatedAt: string;
  totals: {
    netDropWeightLbs: number;
    starterNetLbs: number;
    growerNetLbs: number;
    byTicketType: Array<{ key: string; pounds: number }>;
    bySource: Array<{ key: string; pounds: number }>;
  };
};

export type FeedTicketPrintBundle = {
  ticket: {
    id: string;
    ticketNumber: string | null;
    deliveryDate: string | null;
    ticketType: string | null;
    vendorName: string | null;
    feedName: string | null;
    loadType: string | null;
    grossWeightLbs: number | null;
    comment: string | null;
    createdByName: string | null;
    createdAt: string | null;
    updatedByName: string | null;
    updatedAt: string | null;
  };
  drops: Array<{
    id: string;
    dropOrder: number;
    farmName: string | null;
    barnCode: string | null;
    binCode: string | null;
    placementCode: string | null;
    feedType: string | null;
    dropWeightLbs: number | null;
    comment: string | null;
    offFarmRedirect: boolean;
  }>;
  totals: {
    dropCount: number;
    totalDropWeightLbs: number;
    remainingWeightLbs: number | null;
  };
  generatedAt: string;
};

type FeedTicketRow = {
  id: string;
  ticket_num: string | null;
  delivery_date: string | null;
  created_at: string | null;
  feedmill: string | null;
  feed_weight: number | null;
  feed_name: string | null;
  ticket_type: string | null;
  source_type: string | null;
};

type FeedDropRow = {
  id: string;
  feed_ticket_id: string;
  farm_id: string | null;
  barn_id: string | null;
  feed_bin_id: string | null;
  drop_weight: number | null;
  placement_code: string | null;
  type: string | null;
  comment: string | null;
  bin_code: string | null;
  off_farm_redirect?: boolean | null;
};

type FeedBinRow = {
  id: string;
  barn_id: string | null;
  bin_num: string | number | null;
};

type BarnRow = {
  id: string;
  barn_code: string | null;
  sort_code: string | null;
};

type FeedTicketPrintRow = {
  id: string;
  ticket_num: string | null;
  delivery_date: string | null;
  ticket_type: string | null;
  feedmill: string | null;
  feed_name: string | null;
  source_type: string | null;
  feed_weight: number | null;
  comment: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_on?: string | null;
  updated_on?: string | null;
};

export async function getFeedTicketAdminBundle(filters: FeedTicketAdminFilters = {}): Promise<FeedTicketAdminBundle> {
  noStore();

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Feed ticket data could not connect to Supabase.");
  }

  const normalizedFilters: FeedTicketAdminBundle["filters"] = {
    listMode: filters.listMode === "drop" ? "drop" : "ticket",
    ticketNumber: normalize(filters.ticketNumber),
    ticketTypes: normalizeTicketTypes(filters.ticketTypes),
    flockCode: normalize(filters.flockCode),
    farm: normalize(filters.farm),
    barn: normalize(filters.barn),
    bin: normalize(filters.bin),
    sourceType: normalize(filters.sourceType),
    dateFrom: normalize(filters.dateFrom),
    dateTo: normalize(filters.dateTo),
    includeStarter: filters.includeStarter === true,
    includeGrower: filters.includeGrower === true,
  };

  let ticketsQuery = admin
    .from("feed_tickets")
    .select("id,ticket_num,delivery_date,created_at,feedmill,feed_weight,feed_name,ticket_type,source_type")
    .order("delivery_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(400);

  if (normalizedFilters.ticketNumber) {
    ticketsQuery = ticketsQuery.ilike("ticket_num", `%${normalizedFilters.ticketNumber}%`);
  }
  if (normalizedFilters.ticketTypes.length > 0) {
    ticketsQuery = ticketsQuery.in("ticket_type", normalizedFilters.ticketTypes);
  }
  if (normalizedFilters.dateFrom) {
    ticketsQuery = ticketsQuery.gte("delivery_date", normalizedFilters.dateFrom);
  }
  if (normalizedFilters.dateTo) {
    ticketsQuery = ticketsQuery.lte("delivery_date", normalizedFilters.dateTo);
  }

  const { data: ticketRows, error: ticketsError } = await ticketsQuery;
  if (ticketsError) {
    throw new Error(ticketsError.message);
  }

  const tickets = (ticketRows ?? []) as FeedTicketRow[];
  const ticketIds = tickets.map((row) => row.id).filter(Boolean);
  if (ticketIds.length === 0) {
    return emptyFeedTicketBundle(normalizedFilters, collectSourceTypes(tickets), collectTicketTypes(tickets));
  }

  const { data: dropRows, error: dropsError } = await admin
    .from("feed_drops")
    .select("id,feed_ticket_id,farm_id,barn_id,feed_bin_id,drop_weight,placement_code,type,comment,bin_code,off_farm_redirect")
    .in("feed_ticket_id", ticketIds);
  if (dropsError) {
    throw new Error(dropsError.message);
  }

  const drops = (dropRows ?? []) as FeedDropRow[];

  const farmIds = Array.from(new Set(drops.map((row) => row.farm_id).filter(Boolean)));
  const barnIds = Array.from(new Set(drops.map((row) => row.barn_id).filter(Boolean)));
  const binIds = Array.from(new Set(drops.map((row) => row.feed_bin_id).filter(Boolean)));

  const [farmsResult, barnsResult, binsResult] = await Promise.all([
    farmIds.length
      ? admin.from("farms").select("id,farm_name").in("id", farmIds)
      : Promise.resolve({ data: [], error: null }),
    barnIds.length
      ? admin.from("barns").select("id,barn_code,sort_code").in("id", barnIds)
      : Promise.resolve({ data: [], error: null }),
    binIds.length
      ? admin.from("feedbins").select("id,barn_id,bin_num").in("id", binIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (farmsResult.error || barnsResult.error || binsResult.error) {
    throw new Error(
      farmsResult.error?.message ??
        barnsResult.error?.message ??
        binsResult.error?.message ??
        "Feed ticket reference lookup failed.",
    );
  }

  const farmNameById = new Map((farmsResult.data ?? []).map((row) => [row.id, String(row.farm_name ?? "")]));
  const barnRows = (barnsResult.data ?? []) as BarnRow[];
  const barnCodeById = new Map(barnRows.map((row) => [row.id, String(row.barn_code ?? "")]));
  const barnSortCodeById = new Map(barnRows.map((row) => [row.id, normalize(row.sort_code)]));
  const binCodeById = new Map(
    ((binsResult.data ?? []) as FeedBinRow[]).map((row) => [row.id, row.bin_num === null || row.bin_num === undefined ? "" : String(row.bin_num)]),
  );

  const ticketById = new Map(tickets.map((row) => [row.id, row]));
  const sourceTypes = collectSourceTypes(tickets);
  const ticketTypes = collectTicketTypes(tickets);
  const shouldFilterType = normalizedFilters.includeStarter || normalizedFilters.includeGrower;

  const rows = drops
    .map((drop) => {
      const ticket = ticketById.get(drop.feed_ticket_id);
      if (!ticket) {
        return null;
      }

      const farmName = farmNameById.get(drop.farm_id ?? "") ?? null;
      const barnCode = barnCodeById.get(drop.barn_id ?? "") ?? null;
      const binCode = binCodeById.get(drop.feed_bin_id ?? "") ?? drop.bin_code ?? null;
      const source = ticket.feedmill ?? ticket.source_type ?? ticket.feed_name ?? null;
      const feedType = normalize(drop.type);

      if (normalizedFilters.flockCode && !normalize(drop.placement_code).toLowerCase().includes(normalizedFilters.flockCode.toLowerCase())) {
        return null;
      }
      if (normalizedFilters.farm && !normalize(farmName).toLowerCase().includes(normalizedFilters.farm.toLowerCase())) {
        return null;
      }
      if (normalizedFilters.barn && !normalize(barnCode).toLowerCase().includes(normalizedFilters.barn.toLowerCase())) {
        return null;
      }
      if (normalizedFilters.bin && !normalize(binCode).toLowerCase().includes(normalizedFilters.bin.toLowerCase())) {
        return null;
      }
      if (normalizedFilters.sourceType) {
        const haystack = [source, ticket.source_type, ticket.feed_name].map((value) => normalize(value).toLowerCase()).join(" ");
        if (!haystack.includes(normalizedFilters.sourceType.toLowerCase())) {
          return null;
        }
      }
      if (shouldFilterType) {
        const isStarter = feedType.toLowerCase() === "starter";
        const isGrower = feedType.toLowerCase() === "grower";
        if ((normalizedFilters.includeStarter && isStarter) || (normalizedFilters.includeGrower && isGrower)) {
          // keep
        } else {
          return null;
        }
      }

      return {
        id: drop.id,
        ticketId: ticket.id,
        deliveryDate: ticket.delivery_date ?? null,
        ticketNumber: ticket.ticket_num ?? null,
        ticketType: ticket.ticket_type ?? null,
        source,
        grossWeightLbs: typeof ticket.feed_weight === "number" ? ticket.feed_weight : null,
        farmName,
        barnCode,
        binCode,
        placementCode: drop.placement_code ?? null,
        feedType: feedType || null,
        dropWeightLbs: typeof drop.drop_weight === "number" ? drop.drop_weight : null,
        comment: normalize(drop.comment) || null,
        offFarmRedirect: drop.off_farm_redirect === true,
        barnSortCode: barnSortCodeById.get(drop.barn_id ?? "") || null,
      } satisfies FeedTicketAdminRowWithSort;
    })
    .filter((row): row is FeedTicketAdminRowWithSort => row !== null)
    .sort((a, b) => {
      const aDate = a.deliveryDate ?? "";
      const bDate = b.deliveryDate ?? "";
      if (aDate !== bDate) {
        return aDate < bDate ? 1 : -1;
      }

      return (a.ticketNumber ?? "").localeCompare(b.ticketNumber ?? "", undefined, { numeric: true });
    });

  if (rows.length === 0) {
    return emptyFeedTicketBundle(normalizedFilters, sourceTypes, ticketTypes);
  }

  const farms = Array.from(new Set(rows.map((row) => normalize(row.farmName)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const barns = Array.from(new Set(rows.map((row) => normalize(row.barnCode)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const bins = Array.from(
    new Map(
      rows
        .filter((row) => normalize(row.binCode))
        .sort((left, right) => {
          const leftSort = left.barnSortCode || "";
          const rightSort = right.barnSortCode || "";
          if (leftSort !== rightSort) {
            return leftSort.localeCompare(rightSort, undefined, { numeric: true });
          }
          return normalize(left.binCode).localeCompare(normalize(right.binCode), undefined, { numeric: true });
        })
        .map((row) => [normalize(row.binCode), normalize(row.binCode)]),
    ).values(),
  );
  const flocks = Array.from(new Set(rows.map((row) => normalize(row.placementCode)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  const distinctTicketIds = new Set(
    rows.map((row) => {
      const ticket = tickets.find((entry) => entry.ticket_num === row.ticketNumber && entry.delivery_date === row.deliveryDate);
      return ticket?.id ?? `${row.ticketNumber}:${row.deliveryDate}`;
    }),
  );

  const summaryText = buildSummaryText(normalizedFilters, rows);

  return {
    rows: rows.map(({ barnSortCode: _barnSortCode, ...row }) => row),
    filters: normalizedFilters,
    rollups: {
      ticketCount: distinctTicketIds.size,
      dropCount: rows.length,
      grossWeightLbs: sumDistinctTicketWeights(rows),
      selectedDropWeightLbs: rows.reduce((sum, row) => sum + (row.dropWeightLbs ?? 0), 0),
      starterDropWeightLbs: rows.reduce(
        (sum, row) => sum + (row.feedType?.toLowerCase() === "starter" ? row.dropWeightLbs ?? 0 : 0),
        0,
      ),
      growerDropWeightLbs: rows.reduce(
        (sum, row) => sum + (row.feedType?.toLowerCase() === "grower" ? row.dropWeightLbs ?? 0 : 0),
        0,
      ),
    },
    summaryText,
    filterOptions: {
      sourceTypes,
      ticketTypes,
      farms,
      barns,
      bins,
      flocks,
    },
  };
}

export async function getFeedTicketFlockReportBundle(filters: FeedTicketAdminFilters = {}): Promise<FeedTicketFlockReportBundle> {
  const bundle = await getFeedTicketAdminBundle({
    ...filters,
    listMode: "drop",
  });

  const rows = bundle.rows
    .filter((row) => normalize(row.placementCode).toLowerCase() === normalize(filters.flockCode).toLowerCase())
    .sort((a, b) => {
      const aDate = a.deliveryDate ?? "";
      const bDate = b.deliveryDate ?? "";
      if (aDate !== bDate) {
        return aDate.localeCompare(bDate);
      }

      return (a.ticketNumber ?? "").localeCompare(b.ticketNumber ?? "", undefined, { numeric: true });
    });

  return {
    filters: {
      flockCode: normalize(filters.flockCode),
      dateFrom: normalize(filters.dateFrom),
      dateTo: normalize(filters.dateTo),
      includeStarter: filters.includeStarter === true,
      includeGrower: filters.includeGrower === true,
    },
    rows,
    generatedAt: new Date().toISOString(),
    totals: {
      netDropWeightLbs: rows.reduce((sum, row) => sum + (row.dropWeightLbs ?? 0), 0),
      starterNetLbs: rows.reduce(
        (sum, row) => sum + (row.feedType?.toLowerCase() === "starter" ? row.dropWeightLbs ?? 0 : 0),
        0,
      ),
      growerNetLbs: rows.reduce(
        (sum, row) => sum + (row.feedType?.toLowerCase() === "grower" ? row.dropWeightLbs ?? 0 : 0),
        0,
      ),
      byTicketType: buildGroupedTotals(rows, (row) => normalize(row.ticketType) || "Unknown"),
      bySource: buildGroupedTotals(rows, (row) => normalize(row.source) || "Unknown"),
    },
  };
}

export async function getFeedTicketPrintBundle(ticketId: string): Promise<FeedTicketPrintBundle | null> {
  noStore();

  const normalizedTicketId = normalize(ticketId);
  if (!normalizedTicketId) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("Feed ticket data could not connect to Supabase.");
  }

  const { data: ticketRows, error: ticketError } = await admin
    .from("feed_tickets")
    .select("*")
    .eq("id", normalizedTicketId)
    .limit(1);

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  const ticket = (ticketRows?.[0] ?? null) as FeedTicketPrintRow | null;
  if (!ticket) {
    return null;
  }

  const { data: dropRows, error: dropError } = await admin
    .from("feed_drops")
    .select("id,drop_order,farm_id,barn_id,feed_bin_id,placement_code,type,drop_weight,comment,bin_code,off_farm_redirect")
    .eq("feed_ticket_id", normalizedTicketId)
    .order("drop_order", { ascending: true })
    .order("id", { ascending: true });

  if (dropError) {
    throw new Error(dropError.message);
  }

  const drops = (dropRows ?? []) as Array<{
    id: string;
    drop_order: number | null;
    farm_id: string | null;
    barn_id: string | null;
    feed_bin_id: string | null;
    placement_code: string | null;
    type: string | null;
    drop_weight: number | null;
    comment: string | null;
    bin_code: string | null;
    off_farm_redirect?: boolean | null;
  }>;

  const farmIds = Array.from(new Set(drops.map((row) => row.farm_id).filter(Boolean)));
  const barnIds = Array.from(new Set(drops.map((row) => row.barn_id).filter(Boolean)));
  const binIds = Array.from(new Set(drops.map((row) => row.feed_bin_id).filter(Boolean)));
  const userIds = Array.from(
    new Set([ticket.created_by, ticket.updated_by].filter((value): value is string => typeof value === "string" && value.length > 0)),
  );

  const [farmsResult, barnsResult, binsResult, usersResult] = await Promise.all([
    farmIds.length
      ? admin.from("farms").select("id,farm_name").in("id", farmIds)
      : Promise.resolve({ data: [], error: null }),
    barnIds.length
      ? admin.from("barns").select("id,barn_code").in("id", barnIds)
      : Promise.resolve({ data: [], error: null }),
    binIds.length
      ? admin.from("feedbins").select("id,bin_num").in("id", binIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.from("profiles").select("id,full_name,email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (farmsResult.error || barnsResult.error || binsResult.error || usersResult.error) {
    throw new Error(
      farmsResult.error?.message ??
        barnsResult.error?.message ??
        binsResult.error?.message ??
        usersResult.error?.message ??
        "Feed ticket reference lookup failed.",
    );
  }

  const farmNameById = new Map((farmsResult.data ?? []).map((row) => [row.id, normalize(row.farm_name)]));
  const barnCodeById = new Map((barnsResult.data ?? []).map((row) => [row.id, normalize(row.barn_code)]));
  const binCodeById = new Map(
    ((binsResult.data ?? []) as Array<{ id: string; bin_num: string | number | null }>).map((row) => [
      row.id,
      row.bin_num === null || row.bin_num === undefined ? "" : String(row.bin_num),
    ]),
  );
  const userNameById = new Map(
    ((usersResult.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((row) => [
      row.id,
      normalize(row.full_name) || normalize(row.email) || row.id,
    ]),
  );

  const normalizedDrops = drops.map((drop, index) => ({
    id: drop.id,
    dropOrder: typeof drop.drop_order === "number" ? drop.drop_order : index + 1,
    farmName: farmNameById.get(drop.farm_id ?? "") || null,
    barnCode: barnCodeById.get(drop.barn_id ?? "") || null,
    binCode: binCodeById.get(drop.feed_bin_id ?? "") || normalize(drop.bin_code) || null,
    placementCode: normalize(drop.placement_code) || null,
    feedType: normalize(drop.type) || null,
    dropWeightLbs: typeof drop.drop_weight === "number" ? drop.drop_weight : null,
    comment: normalize(drop.comment) || null,
    offFarmRedirect: drop.off_farm_redirect === true,
  }));

  const totalDropWeightLbs = normalizedDrops.reduce((sum, drop) => sum + (drop.dropWeightLbs ?? 0), 0);

  return {
    ticket: {
      id: ticket.id,
      ticketNumber: normalize(ticket.ticket_num) || null,
      deliveryDate: ticket.delivery_date ?? null,
      ticketType: normalize(ticket.ticket_type) || null,
      vendorName: normalize(ticket.feedmill) || null,
      feedName: normalize(ticket.feed_name) || null,
      loadType: normalize(ticket.source_type) || null,
      grossWeightLbs: typeof ticket.feed_weight === "number" ? ticket.feed_weight : null,
      comment: normalize(ticket.comment) || null,
      createdByName: userNameById.get(ticket.created_by ?? "") || null,
      createdAt: ticket.created_at ?? ticket.created_on ?? null,
      updatedByName: userNameById.get(ticket.updated_by ?? "") || null,
      updatedAt: ticket.updated_at ?? ticket.updated_on ?? null,
    },
    drops: normalizedDrops,
    totals: {
      dropCount: normalizedDrops.length,
      totalDropWeightLbs,
      remainingWeightLbs:
        typeof ticket.feed_weight === "number" ? ticket.feed_weight - totalDropWeightLbs : null,
    },
    generatedAt: new Date().toISOString(),
  };
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function collectSourceTypes(rows: FeedTicketRow[]) {
  return Array.from(new Set(rows.map((row) => normalize(row.source_type ?? row.feed_name ?? row.feedmill ?? "")).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function collectTicketTypes(rows: FeedTicketRow[]) {
  return Array.from(new Set(rows.map((row) => normalize(row.ticket_type)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function normalizeTicketTypes(values: string[] | null | undefined) {
  const allowed = new Set(["Reg", "xTran", "iTran", "f2f"]);
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalize(value))
        .filter((value) => allowed.has(value)),
    ),
  );
}

function sumDistinctTicketWeights(rows: FeedTicketAdminRow[]) {
  const seen = new Set<string>();
  let sum = 0;

  for (const row of rows) {
    const key = `${row.ticketNumber ?? ""}:${row.deliveryDate ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sum += row.grossWeightLbs ?? 0;
  }

  return sum;
}

function buildSummaryText(
  filters: FeedTicketAdminBundle["filters"],
  rows: FeedTicketAdminRow[],
) {
  if (filters.flockCode) {
    return `Includes all feed_drops for Flock ${filters.flockCode}`;
  }
  if (filters.ticketNumber) {
    return `Includes all matched feed_drops for Ticket ${filters.ticketNumber}`;
  }
  if (filters.farm || filters.barn || filters.bin) {
    const parts = [filters.farm, filters.barn, filters.bin].filter(Boolean);
    return `Includes ${rows.length} matching drop records for ${parts.join(" / ")}`;
  }

  return `Includes ${rows.length} selected feed_drop records.`;
}

function emptyFeedTicketBundle(
  filters: FeedTicketAdminBundle["filters"],
  sourceTypes: string[] = [],
  ticketTypes: string[] = [],
): FeedTicketAdminBundle {
  return {
    rows: [],
    filters,
    rollups: {
      ticketCount: 0,
      dropCount: 0,
      grossWeightLbs: 0,
      selectedDropWeightLbs: 0,
      starterDropWeightLbs: 0,
      growerDropWeightLbs: 0,
    },
    summaryText: "No matching feed_drop records.",
    filterOptions: {
      sourceTypes,
      ticketTypes,
      farms: [],
      barns: [],
      bins: [],
      flocks: [],
    },
  };
}

function buildGroupedTotals(rows: FeedTicketAdminRow[], keyFor: (row: FeedTicketAdminRow) => string) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const key = keyFor(row);
    grouped.set(key, (grouped.get(key) ?? 0) + (row.dropWeightLbs ?? 0));
  }

  return Array.from(grouped.entries())
    .map(([key, pounds]) => ({ key, pounds }))
    .sort((left, right) => left.key.localeCompare(right.key, undefined, { numeric: true }));
}
