import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "authorization, content-type, x-adalo-test";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
    },
  });
}

export function parseAuthHeader(req: Request) {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return auth.slice(7).trim();
}

export async function readJsonBody(req: Request) {
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

export function getUserClient(accessToken: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

type AdaloCollectionKind = "dashboard" | "placement_day";

type AdaloSettings = {
  apiKey: string;
  collectionUrl: string;
};

export function requireString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

export function getAdaloSettings(collection: AdaloCollectionKind): AdaloSettings {
  const apiKey = Deno.env.get("ADALO_API_KEY");
  const collectionUrl = collection === "dashboard"
    ? Deno.env.get("ADALO_DASHBOARD_CACHE_COLLECTION_URL")
    : Deno.env.get("ADALO_PLACEMENT_DAY_CACHE_COLLECTION_URL");

  if (!apiKey || !collectionUrl) {
    throw new Error(
      collection === "dashboard"
        ? "Missing ADALO_API_KEY or ADALO_DASHBOARD_CACHE_COLLECTION_URL env vars"
        : "Missing ADALO_API_KEY or ADALO_PLACEMENT_DAY_CACHE_COLLECTION_URL env vars",
    );
  }

  return {
    apiKey,
    collectionUrl: collectionUrl.replace(/\/+$/, ""),
  };
}

function adaloHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function normalizeListPayload(payload: unknown) {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    if (Array.isArray(value.records)) return value.records as Record<string, unknown>[];
    if (Array.isArray(value.items)) return value.items as Record<string, unknown>[];
    if (Array.isArray(value.data)) return value.data as Record<string, unknown>[];
  }
  return [];
}

function rowIdOf(row: Record<string, unknown>) {
  if (typeof row.id === "string" || typeof row.id === "number") return String(row.id);
  if (typeof row.ID === "string" || typeof row.ID === "number") return String(row.ID);
  return null;
}

export async function listCollectionRows(settings: AdaloSettings) {
  const response = await fetch(settings.collectionUrl, {
    method: "GET",
    headers: adaloHeaders(settings.apiKey),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(`Adalo list failed (${response.status}): ${text}`);
  }

  return normalizeListPayload(payload);
}

export async function createCollectionRow(settings: AdaloSettings, row: Record<string, unknown>) {
  const response = await fetch(settings.collectionUrl, {
    method: "POST",
    headers: adaloHeaders(settings.apiKey),
    body: JSON.stringify(row),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Adalo create failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

export async function deleteCollectionRow(settings: AdaloSettings, rowId: string) {
  const response = await fetch(`${settings.collectionUrl}/${rowId}`, {
    method: "DELETE",
    headers: adaloHeaders(settings.apiKey),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Adalo delete failed (${response.status}): ${text}`);
  }
}

export async function clearAdaloCache(collection: AdaloCollectionKind, cacheOwnerUserId: string, cacheType: string) {
  const settings = getAdaloSettings(collection);
  const rows = await listCollectionRows(settings);

  const matches = rows.filter((row) =>
    row.cache_owner_user_id === cacheOwnerUserId && row.cache_type === cacheType
  );

  let deletedCount = 0;
  for (const row of matches) {
    const rowId = rowIdOf(row);
    if (!rowId) continue;
    await deleteCollectionRow(settings, rowId);
    deletedCount += 1;
  }

  return { deletedCount, matchedCount: matches.length };
}

export async function createAdaloRows(collection: AdaloCollectionKind, rows: Record<string, unknown>[]) {
  const settings = getAdaloSettings(collection);
  const created: unknown[] = [];

  for (const row of rows) {
    created.push(await createCollectionRow(settings, row));
  }

  return { createdCount: created.length, created };
}
