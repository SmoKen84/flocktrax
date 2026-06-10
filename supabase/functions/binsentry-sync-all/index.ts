import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type FeedBinMapping = {
  id: string;
  farm_id: string | null;
  barn_id: string | null;
  bin_num: number | null;
  binsentry_bin_ref: string | null;
};

type InventorySnapshotWrite = {
  farmId: string | null;
  barnId: string;
  feedBinId: string;
  feedName: string | null;
  inventoryLbs: number;
  capturedAt: string;
  rawPayload: unknown;
};

type SirenLink = {
  rel?: string[];
  href?: string;
};

type SirenActionField = {
  name?: string;
};

type SirenAction = {
  name?: string;
  href?: string;
  method?: string;
  fields?: SirenActionField[];
};

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: SirenLink[];
  entities?: Array<{ rel?: string[]; href?: string; properties?: Record<string, unknown>; links?: SirenLink[] }>;
  actions?: SirenAction[];
  error?: unknown;
};

type WorkerBody = {
  force?: boolean;
};

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

async function readBody(req: Request): Promise<WorkerBody> {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    return (await req.json()) as WorkerBody;
  } catch {
    return {};
  }
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function createAdminClient() {
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

function getBinSentryConfig() {
  return {
    rootUrl: normalize(Deno.env.get("BINSENTRY_API_ROOT_URL")) || "https://api.binsentry.com",
    bearerToken: normalize(Deno.env.get("BINSENTRY_API_BEARER_TOKEN")),
    username: normalize(Deno.env.get("BINSENTRY_USERNAME")),
    password: normalize(Deno.env.get("BINSENTRY_PASSWORD")),
    entityUrlTemplate: normalize(Deno.env.get("BINSENTRY_BIN_ENTITY_URL_TEMPLATE")),
  };
}

function getCentralHour() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const hourText = parts.find((part) => part.type === "hour")?.value ?? "";
  const hour = Number.parseInt(hourText, 10);
  return Number.isFinite(hour) ? hour : null;
}

function shouldRunNow() {
  const hour = getCentralHour();
  if (hour === null) {
    return false;
  }

  return [6, 10, 14, 18].includes(hour);
}

function relMatches(relValues: string[] | undefined, needles: string[]) {
  return (relValues ?? []).some((relValue) => {
    const normalized = normalize(relValue).toLowerCase();
    return needles.some((needle) => {
      const normalizedNeedle = needle.toLowerCase();
      if (normalized === normalizedNeedle) {
        return true;
      }

      return normalizedNeedle.includes("/") ? normalized.endsWith(normalizedNeedle) : false;
    });
  });
}

function findHrefByRel(entity: SirenEntity, needles: string[]) {
  const linkHref = (entity.links ?? []).find((link) => relMatches(link.rel, needles) && normalize(link.href))?.href;
  if (linkHref) {
    return linkHref;
  }

  return (entity.entities ?? []).find((child) => relMatches(child.rel, needles) && normalize(child.href))?.href ?? null;
}

async function fetchSirenEntity(url: string, token?: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/vnd.siren+json, application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BinSentry request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as SirenEntity;
}

async function performSirenAction(entity: SirenEntity, actionName: string, values: Record<string, string>) {
  const action = (entity.actions ?? []).find((candidate) => candidate.name === actionName);
  if (!action?.href) {
    throw new Error(`BinSentry action '${actionName}' was not available.`);
  }

  const method = normalize(action.method).toUpperCase() || "GET";
  const filteredEntries = Object.entries(values).filter(([, value]) => normalize(value));
  const params = new URLSearchParams(filteredEntries);

  const response = await fetch(method === "GET" ? `${action.href}?${params.toString()}` : action.href, {
    method,
    headers: {
      Accept: "application/vnd.siren+json, application/json",
      ...(method === "GET" ? {} : { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }),
    },
    body: method === "GET" ? undefined : params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BinSentry login failed (${response.status}) for ${action.href}`);
  }

  return (await response.json()) as SirenEntity;
}

function pickString(source: Record<string, unknown> | undefined, keys: string[]) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function loginWithCredentials() {
  const config = getBinSentryConfig();
  if (!config.username || !config.password) {
    return null;
  }

  const rootEntity = await fetchSirenEntity(config.rootUrl);
  const loginUrl = findHrefByRel(rootEntity, ["/login", "login"]);
  if (!loginUrl) {
    throw new Error("BinSentry login link was not present on the API root entity.");
  }

  const loginEntity = await fetchSirenEntity(loginUrl);
  const authEntity = await performSirenAction(loginEntity, "user-login", {
    email: config.username,
    password: config.password,
  });

  const errorMessage =
    typeof authEntity.error === "string"
      ? authEntity.error
      : pickString(authEntity.properties, ["error", "message"]);
  if (errorMessage) {
    throw new Error(`BinSentry login failed: ${errorMessage}`);
  }

  const token = pickString(authEntity.properties, ["token", "access_token", "accessToken"]);
  if (!token) {
    throw new Error("BinSentry login succeeded but no bearer token was returned.");
  }

  return token;
}

async function getBinSentryAccessToken() {
  const config = getBinSentryConfig();
  const credentialToken = await loginWithCredentials();
  if (credentialToken) {
    return credentialToken;
  }

  if (config.bearerToken) {
    return config.bearerToken;
  }

  throw new Error(
    "BinSentry credentials are not configured. Set BINSENTRY_USERNAME and BINSENTRY_PASSWORD, or provide BINSENTRY_API_BEARER_TOKEN.",
  );
}

function buildBinSentryEntityUrl(binRef: string) {
  const config = getBinSentryConfig();
  if (/^https?:\/\//i.test(binRef)) {
    return binRef;
  }

  if (config.entityUrlTemplate) {
    return config.entityUrlTemplate.replace("{binRef}", encodeURIComponent(binRef));
  }

  const root = config.rootUrl.replace(/\/+$/, "");
  return `${root}/bins/${encodeURIComponent(binRef)}`;
}

async function fetchBinSentryEntity(url: string) {
  const token = await getBinSentryAccessToken();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.siren+json, application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BinSentry request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as SirenEntity | Record<string, unknown>;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = coerceNumber(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function pickFirstNumberEntry(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = coerceNumber(source[key]);
    if (value !== null) {
      return { key, value };
    }
  }

  return null;
}

function pickFirstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function fetchBestInventoryPayload(entityUrl: string) {
  const binPayload = (await fetchBinSentryEntity(entityUrl)) as SirenEntity | Record<string, unknown>;
  if (!("entities" in binPayload) && !("links" in binPayload)) {
    return binPayload;
  }

  const sirenPayload = binPayload as SirenEntity;
  const latestLevelUrl =
    findHrefByRel(sirenPayload, ["/bin-level-latest-valid", "bin-level-latest-valid"]) ??
    findHrefByRel(sirenPayload, ["/bin-level-latest", "bin-level-latest"]);

  if (!latestLevelUrl) {
    return binPayload;
  }

  return await fetchBinSentryEntity(latestLevelUrl);
}

function extractInventorySnapshot(
  payload: SirenEntity | Record<string, unknown>,
  mapping: FeedBinMapping,
): InventorySnapshotWrite | null {
  const properties =
    "properties" in payload && payload.properties && typeof payload.properties === "object"
      ? (payload.properties as Record<string, unknown>)
      : (payload as Record<string, unknown>);

  const poundsEntry = pickFirstNumberEntry(properties, [
    "inventory_lbs",
    "inventoryLbs",
    "current_inventory_lbs",
    "currentInventoryLbs",
    "pounds_on_hand",
    "poundsOnHand",
    "estimated_weight_lbs",
    "estimatedWeightLbs",
    "weight_lbs",
    "weightLbs",
  ]);
  const kilogramEntry = pickFirstNumberEntry(properties, ["estimatedWeight", "weight"]);
  const tonsEntry = pickFirstNumber(properties, ["inventory_tons", "inventoryTons", "current_inventory_tons", "currentInventoryTons"]);

  const inventoryLbs =
    poundsEntry?.value ??
    (kilogramEntry ? kilogramEntry.value * 2.20462 : null) ??
    (tonsEntry !== null ? tonsEntry * 2000 : null);

  if (inventoryLbs === null || !mapping.barn_id) {
    return null;
  }

  const capturedAt =
    pickFirstString(properties, [
      "captured_at",
      "capturedAt",
      "last_reading_at",
      "lastReadingAt",
      "measured_at",
      "measuredAt",
      "updated_at",
      "updatedAt",
    ]) ?? new Date().toISOString();

  const feedName = pickFirstString(properties, ["feed_name", "feedName", "ration_name", "rationName", "product_name", "productName"]);

  return {
    farmId: mapping.farm_id,
    barnId: mapping.barn_id,
    feedBinId: mapping.id,
    feedName,
    inventoryLbs: Math.max(0, inventoryLbs),
    capturedAt,
    rawPayload: payload,
  };
}

async function syncBarnInventory(
  supabase: ReturnType<typeof createClient>,
  barnId: string,
) {
  const { data, error } = await supabase
    .from("feedbins")
    .select("id,farm_id,barn_id,bin_num,binsentry_bin_ref")
    .eq("barn_id", barnId)
    .order("bin_num", { ascending: true });

  if (error) {
    return { ok: false as const, message: error.message, synced: 0, warnings: 1 };
  }

  const mappings = ((data ?? []) as FeedBinMapping[]).filter((row) => normalize(row.binsentry_bin_ref));
  if (mappings.length === 0) {
    return { ok: false as const, message: "No BinSentry bin mappings are saved for this barn yet.", synced: 0, warnings: 1 };
  }

  const snapshots: InventorySnapshotWrite[] = [];
  const syncErrors: string[] = [];

  for (const mapping of mappings) {
    const binRef = normalize(mapping.binsentry_bin_ref);
    const entityUrl = buildBinSentryEntityUrl(binRef);

    try {
      const payload = await fetchBestInventoryPayload(entityUrl);
      const snapshot = extractInventorySnapshot(payload, mapping);
      if (!snapshot) {
        syncErrors.push(`Bin ${mapping.bin_num ?? "?"}: inventory pounds were not found in the BinSentry payload.`);
        await supabase
          .from("feedbins")
          .update({
            binsentry_last_sync_at: new Date().toISOString(),
            binsentry_sync_note: "Latest BinSentry payload did not expose an inventory pounds value.",
          })
          .eq("id", mapping.id);
        continue;
      }

      snapshots.push(snapshot);
      await supabase
        .from("feedbins")
        .update({
          binsentry_last_sync_at: snapshot.capturedAt,
          binsentry_last_inventory_lbs: snapshot.inventoryLbs,
          binsentry_sync_note: `Inventory synced from BinSentry (${Math.round(snapshot.inventoryLbs).toLocaleString()} lbs).`,
        })
        .eq("id", mapping.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "BinSentry request failed.";
      syncErrors.push(`Bin ${mapping.bin_num ?? "?"}: ${message}`);
      await supabase
        .from("feedbins")
        .update({
          binsentry_last_sync_at: new Date().toISOString(),
          binsentry_sync_note: message,
        })
        .eq("id", mapping.id);
    }
  }

  if (snapshots.length > 0) {
    const insertResult = await supabase.from("feed_inventory_snapshots").insert(
      snapshots.map((snapshot) => ({
        farm_id: snapshot.farmId,
        barn_id: snapshot.barnId,
        feed_bin_id: snapshot.feedBinId,
        source: "binsentry",
        captured_at: snapshot.capturedAt,
        inventory_lbs: snapshot.inventoryLbs,
        feed_name: snapshot.feedName,
        raw_payload: snapshot.rawPayload,
      })),
    );

    if (insertResult.error) {
      return { ok: false as const, message: insertResult.error.message, synced: 0, warnings: syncErrors.length };
    }
  }

  if (snapshots.length === 0) {
    return {
      ok: false as const,
      message: syncErrors[0] ?? "No BinSentry inventory snapshots were written.",
      synced: 0,
      warnings: Math.max(1, syncErrors.length),
    };
  }

  return {
    ok: true as const,
    message:
      syncErrors.length > 0
        ? `Synced ${snapshots.length} mapped bin${snapshots.length === 1 ? "" : "s"} with ${syncErrors.length} warning${syncErrors.length === 1 ? "" : "s"}.`
        : `Synced ${snapshots.length} mapped bin${snapshots.length === 1 ? "" : "s"} from BinSentry.`,
    synced: snapshots.length,
    warnings: syncErrors.length,
  };
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
    const force = body.force === true;
    if (!force && !shouldRunNow()) {
      return json(req, {
        ok: true,
        ran: false,
        reason: "Outside the configured America/Chicago sync window.",
      });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("feedbins")
      .select("barn_id")
      .not("barn_id", "is", null)
      .not("binsentry_bin_ref", "is", null);

    if (error) {
      throw new Error(error.message);
    }

    const barnIds = Array.from(
      new Set(
        ((data ?? []) as Array<{ barn_id: string | null }>)
          .map((row) => normalize(row.barn_id))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let barnsAttempted = 0;
    let barnsSucceeded = 0;
    let warnings = 0;
    let binsSynced = 0;
    const errors: string[] = [];

    for (const barnId of barnIds) {
      barnsAttempted += 1;
      const result = await syncBarnInventory(supabase, barnId);
      binsSynced += result.synced;
      warnings += result.warnings;
      if (result.ok) {
        barnsSucceeded += 1;
      } else {
        errors.push(`${barnId}: ${result.message}`);
      }
    }

    return json(req, {
      ok: true,
      ran: true,
      force,
      barnsAttempted,
      barnsSucceeded,
      binsSynced,
      warnings,
      errors,
      localHour: getCentralHour(),
      message: `Processed ${barnsAttempted} mapped barn${barnsAttempted === 1 ? "" : "s"} and synced ${binsSynced} bin snapshot${binsSynced === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    return json(
      req,
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
