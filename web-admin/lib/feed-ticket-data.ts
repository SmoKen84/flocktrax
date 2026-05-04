import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type FeedTicketAdminFilters = {
  listMode?: "ticket" | "drop" | null;
  ticketNumber?: string | null;
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
};

export type FeedTicketAdminBundle = {
  rows: FeedTicketAdminRow[];
  filters: {
    listMode: "ticket" | "drop";
    ticketNumber: string;
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
    farms: string[];
    barns: string[];
    bins: string[];
    flocks: string[];
  };
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
};

type FeedBinRow = {
  id: string;
  barn_id: string | null;
  bin_num: string | number | null;
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
    return emptyFeedTicketBundle(normalizedFilters, collectSourceTypes(tickets));
  }

  const { data: dropRows, error: dropsError } = await admin
    .from("feed_drops")
    .select("id,feed_ticket_id,farm_id,barn_id,feed_bin_id,drop_weight,placement_code,type,comment,bin_code")
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
      ? admin.from("barns").select("id,barn_code").in("id", barnIds)
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
  const barnCodeById = new Map((barnsResult.data ?? []).map((row) => [row.id, String(row.barn_code ?? "")]));
  const binCodeById = new Map(
    ((binsResult.data ?? []) as FeedBinRow[]).map((row) => [row.id, row.bin_num === null || row.bin_num === undefined ? "" : String(row.bin_num)]),
  );

  const ticketById = new Map(tickets.map((row) => [row.id, row]));
  const sourceTypes = collectSourceTypes(tickets);
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
      } satisfies FeedTicketAdminRow;
    })
    .filter((row): row is FeedTicketAdminRow => row !== null)
    .sort((a, b) => {
      const aDate = a.deliveryDate ?? "";
      const bDate = b.deliveryDate ?? "";
      if (aDate !== bDate) {
        return aDate < bDate ? 1 : -1;
      }

      return (a.ticketNumber ?? "").localeCompare(b.ticketNumber ?? "", undefined, { numeric: true });
    });

  if (rows.length === 0) {
    return emptyFeedTicketBundle(normalizedFilters, sourceTypes);
  }

  const farms = Array.from(new Set(rows.map((row) => normalize(row.farmName)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const barns = Array.from(new Set(rows.map((row) => normalize(row.barnCode)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const bins = Array.from(new Set(rows.map((row) => normalize(row.binCode)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
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
    rows,
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
      farms,
      barns,
      bins,
      flocks,
    },
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
      farms: [],
      barns: [],
      bins: [],
      flocks: [],
    },
  };
}
