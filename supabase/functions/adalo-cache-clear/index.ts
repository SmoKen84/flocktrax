import {
  clearAdaloCache,
  corsHeaders,
  json,
  readJsonBody,
  requireString,
} from "../_shared/adalo-cache.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.headers.get("x-adalo-test") === "true") {
    return json(req, {
      ok: true,
      deleted_count: 3,
      matched_count: 3,
      mode: "adalo_test",
    });
  }

  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await readJsonBody(req);
    const cacheOwnerUserId = requireString(body.cache_owner_user_id, "cache_owner_user_id");
    const cacheType = requireString(body.cache_type, "cache_type");
    const collection = requireString(body.collection, "collection");

    if (collection !== "dashboard" && collection !== "placement_day") {
      return json(req, { ok: false, error: "collection must be dashboard or placement_day" }, 400);
    }

    const result = await clearAdaloCache(collection, cacheOwnerUserId, cacheType);

    return json(req, {
      ok: true,
      collection,
      cache_owner_user_id: cacheOwnerUserId,
      cache_type: cacheType,
      deleted_count: result.deletedCount,
      matched_count: result.matchedCount,
    });
  } catch (error) {
    return json(req, { ok: false, error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
