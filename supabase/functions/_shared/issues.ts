import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type IssueEntityType = "barn" | "placement";

export type IssueType =
  | "maintenance"
  | "feedlines"
  | "nipple_lines"
  | "equipment"
  | "water"
  | "ventilation"
  | "bird_health"
  | "performance"
  | "mortality_review";

export type IssueStatus = "open" | "resolved";

export type IssueItem = {
  id: string;
  entity_type: IssueEntityType;
  entity_id: string;
  issue_type: IssueType;
  title: string;
  description: string | null;
  status: IssueStatus;
  opened_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  related_placement_id: string | null;
  reported_log_date: string | null;
};

const BARN_ISSUE_TYPES: IssueType[] = [
  "maintenance",
  "feedlines",
  "nipple_lines",
  "equipment",
  "water",
  "ventilation",
];

const PLACEMENT_ISSUE_TYPES: IssueType[] = [
  "bird_health",
  "performance",
  "mortality_review",
];

export function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function normalizeIssueType(
  value: unknown,
  entityType: IssueEntityType,
): IssueType | null {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";
  const allowed = entityType === "barn" ? BARN_ISSUE_TYPES : PLACEMENT_ISSUE_TYPES;
  return allowed.includes(normalized as IssueType) ? (normalized as IssueType) : null;
}

export function issueTypeLabel(type: IssueType) {
  switch (type) {
    case "maintenance":
      return "Maintenance";
    case "feedlines":
      return "Feedlines";
    case "nipple_lines":
      return "Nipple Lines";
    case "equipment":
      return "Equipment";
    case "water":
      return "Water";
    case "ventilation":
      return "Ventilation";
    case "bird_health":
      return "Bird Health";
    case "performance":
      return "Performance";
    case "mortality_review":
      return "Mortality Review";
    default:
      return "Issue";
  }
}

export function mapIssueRow(row: Record<string, unknown>): IssueItem {
  return {
    id: String(row.id ?? ""),
    entity_type: row.entity_type === "barn" ? "barn" : "placement",
    entity_id: String(row.entity_id ?? ""),
    issue_type: String(row.issue_type ?? "maintenance") as IssueType,
    title: String(row.title ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    status: row.status === "resolved" ? "resolved" : "open",
    opened_at: typeof row.opened_at === "string" ? row.opened_at : "",
    resolved_at: typeof row.resolved_at === "string" ? row.resolved_at : null,
    resolution_note: typeof row.resolution_note === "string" ? row.resolution_note : null,
    related_placement_id: typeof row.related_placement_id === "string" ? row.related_placement_id : null,
    reported_log_date: typeof row.reported_log_date === "string" ? row.reported_log_date : null,
  };
}

export async function syncDerivedPlacementIssues(
  service: ReturnType<typeof createClient>,
  placementIds: string[],
) {
  const normalizedIds = Array.from(
    new Set(
      placementIds.filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const { error } = await service.rpc("sync_derived_placement_issues", {
    p_placement_ids: normalizedIds,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function loadOpenIssueBundle(
  service: ReturnType<typeof createClient>,
  placementId: string,
  barnId: string,
) {
  const [placementResult, barnResult] = await Promise.all([
    service
      .from("issues")
      .select("id,entity_type,entity_id,issue_type,title,description,status,opened_at,resolved_at,resolution_note,related_placement_id,reported_log_date")
      .eq("entity_type", "placement")
      .eq("entity_id", placementId)
      .eq("status", "open")
      .order("opened_at", { ascending: false }),
    service
      .from("issues")
      .select("id,entity_type,entity_id,issue_type,title,description,status,opened_at,resolved_at,resolution_note,related_placement_id,reported_log_date")
      .eq("entity_type", "barn")
      .eq("entity_id", barnId)
      .eq("status", "open")
      .order("opened_at", { ascending: false }),
  ]);

  if (placementResult.error) {
    throw new Error(placementResult.error.message);
  }
  if (barnResult.error) {
    throw new Error(barnResult.error.message);
  }

  const placementIssues = (placementResult.data ?? []).map((row) =>
    mapIssueRow(row as Record<string, unknown>)
  );
  const barnIssues = (barnResult.data ?? []).map((row) =>
    mapIssueRow(row as Record<string, unknown>)
  );

  return {
    barn_id: barnId,
    barn_issues: barnIssues,
    placement_issues: placementIssues,
    open_barn_issue_count: barnIssues.length,
    open_placement_issue_count: placementIssues.length,
  };
}

export async function loadOpenIssueCounts(
  service: ReturnType<typeof createClient>,
  input: {
    placementIds: string[];
    barnIds: string[];
  },
) {
  const barnCounts = new Map<string, number>();
  const placementCounts = new Map<string, number>();

  const queries: Promise<unknown>[] = [];

  if (input.placementIds.length > 0) {
    queries.push(
      service
        .from("issues")
        .select("entity_id", { count: "exact" })
        .eq("entity_type", "placement")
        .eq("status", "open")
        .in("entity_id", input.placementIds)
        .then(({ data, error }) => {
          if (error) throw new Error(error.message);
          for (const row of data ?? []) {
            const entityId = typeof row.entity_id === "string" ? row.entity_id : null;
            if (!entityId) continue;
            placementCounts.set(entityId, (placementCounts.get(entityId) ?? 0) + 1);
          }
        }),
    );
  }

  if (input.barnIds.length > 0) {
    queries.push(
      service
        .from("issues")
        .select("entity_id", { count: "exact" })
        .eq("entity_type", "barn")
        .eq("status", "open")
        .in("entity_id", input.barnIds)
        .then(({ data, error }) => {
          if (error) throw new Error(error.message);
          for (const row of data ?? []) {
            const entityId = typeof row.entity_id === "string" ? row.entity_id : null;
            if (!entityId) continue;
            barnCounts.set(entityId, (barnCounts.get(entityId) ?? 0) + 1);
          }
        }),
    );
  }

  await Promise.all(queries);

  return {
    barnCounts,
    placementCounts,
  };
}
