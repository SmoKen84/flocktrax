export function getSupabaseSecretKey(): string {
  const explicitKey = Deno.env.get("SUPABASE_SECRET_KEY")?.trim();
  if (explicitKey) return explicitKey;

  const keyCollection = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();
  if (keyCollection) {
    try {
      const parsed = JSON.parse(keyCollection) as Record<string, unknown>;
      const keyName = Deno.env.get("FLOCKTRAX_SUPABASE_SECRET_KEY_NAME")?.trim() || "default";
      const selectedKey = parsed[keyName];
      if (typeof selectedKey === "string" && selectedKey.trim()) return selectedKey.trim();
      throw new Error(`Supabase secret key '${keyName}' is not available.`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Supabase secret key")) throw error;
      throw new Error("SUPABASE_SECRET_KEYS is not valid JSON.");
    }
  }

  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacyKey) return legacyKey;

  throw new Error(
    "Missing SUPABASE_SECRET_KEY, SUPABASE_SECRET_KEYS, or legacy SUPABASE_SERVICE_ROLE_KEY.",
  );
}

export function hasValidSupabaseSecret(req: Request): boolean {
  const presentedKey = req.headers.get("apikey")?.trim();
  return !!presentedKey && presentedKey === getSupabaseSecretKey();
}
