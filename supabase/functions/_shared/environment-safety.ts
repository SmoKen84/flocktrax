function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function projectRef(value: string | undefined) {
  const normalized = normalize(value);
  if (!normalized) return "";
  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host.endsWith(".supabase.co") ? host.slice(0, -".supabase.co".length) : host;
  } catch {
    return "";
  }
}

export function assertOutboundIntegrationAllowed(integrationName: string) {
  const environmentName = normalize(Deno.env.get("FLOCKTRAX_ENVIRONMENT_NAME"));
  const outboundMode = normalize(Deno.env.get("FLOCKTRAX_OUTBOUND_MODE"));

  if (environmentName === "demo") {
    const currentProjectRef = projectRef(Deno.env.get("SUPABASE_URL"));
    const productionProjectRef = normalize(Deno.env.get("FLOCKTRAX_PRODUCTION_SUPABASE_PROJECT_REF"));
    if (!productionProjectRef) {
      throw new Error(`${integrationName} is blocked because the production Supabase isolation baseline is missing.`);
    }
    if (currentProjectRef === productionProjectRef) {
      throw new Error(`${integrationName} is blocked because this Edge Function is running in the production Supabase project.`);
    }
    if (outboundMode !== "sandbox") {
      throw new Error(
        `${integrationName} is blocked in demo. Set FLOCKTRAX_OUTBOUND_MODE=sandbox only after sandbox destinations are verified.`,
      );
    }
  }

  if (outboundMode === "disabled") {
    throw new Error(`${integrationName} is disabled by FLOCKTRAX_OUTBOUND_MODE.`);
  }
}
