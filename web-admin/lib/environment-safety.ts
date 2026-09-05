type EnvironmentSource = Record<string, string | undefined>;

export type OutboundMode = "live" | "sandbox" | "disabled";

export type EnvironmentSafetyEvaluation = {
  environmentName: string;
  isDemo: boolean;
  outboundMode: OutboundMode;
  issues: string[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeEnvironmentName(value: string | null | undefined) {
  return normalize(value).toLowerCase().replace(/[\s_]+/g, "-");
}

function readHost(value: string | null | undefined) {
  const normalized = normalize(value);
  if (!normalized) return "";
  try {
    return new URL(normalized.includes("://") ? normalized : `https://${normalized}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function readSupabaseProjectRef(value: string | null | undefined) {
  const host = readHost(value);
  return host.endsWith(".supabase.co") ? host.slice(0, -".supabase.co".length) : host;
}

function readOutboundMode(value: string | null | undefined, isDemo: boolean): OutboundMode {
  const normalized = normalize(value).toLowerCase();
  if (normalized === "sandbox" || normalized === "disabled" || normalized === "live") return normalized;
  return isDemo ? "disabled" : "live";
}

export function evaluateEnvironmentSafety(env: EnvironmentSource = process.env): EnvironmentSafetyEvaluation {
  const environmentName = normalizeEnvironmentName(env.FLOCKTRAX_ENVIRONMENT_NAME);
  const isDemo = environmentName === "demo";
  const outboundMode = readOutboundMode(env.FLOCKTRAX_OUTBOUND_MODE, isDemo);
  const issues: string[] = [];

  if (!isDemo) {
    return { environmentName: environmentName || "unlabeled", isDemo, outboundMode, issues };
  }

  const currentProjectRef = readSupabaseProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const productionProjectRef = normalize(env.FLOCKTRAX_PRODUCTION_SUPABASE_PROJECT_REF).toLowerCase();
  const currentAppHost = readHost(env.NEXT_PUBLIC_APP_URL);
  const productionAppHost = readHost(env.FLOCKTRAX_PRODUCTION_APP_HOST);
  const configuredOutboundMode = normalize(env.FLOCKTRAX_OUTBOUND_MODE).toLowerCase();

  if (!currentProjectRef) issues.push("NEXT_PUBLIC_SUPABASE_URL is required for a demo deployment.");
  if (!productionProjectRef) issues.push("FLOCKTRAX_PRODUCTION_SUPABASE_PROJECT_REF is required as the isolation baseline.");
  if (currentProjectRef && productionProjectRef && currentProjectRef === productionProjectRef) {
    issues.push("The demo Supabase project matches the protected production project.");
  }
  if (!currentAppHost) issues.push("NEXT_PUBLIC_APP_URL is required for a demo deployment.");
  if (!productionAppHost) issues.push("FLOCKTRAX_PRODUCTION_APP_HOST is required as the isolation baseline.");
  if (currentAppHost && productionAppHost && currentAppHost === productionAppHost) {
    issues.push("The demo application host matches the protected production host.");
  }
  if (configuredOutboundMode !== "disabled" && configuredOutboundMode !== "sandbox") {
    issues.push("FLOCKTRAX_OUTBOUND_MODE must explicitly be disabled or sandbox for a demo deployment.");
  }

  return { environmentName, isDemo, outboundMode, issues };
}

export function assertSafeEnvironmentBinding(env: EnvironmentSource = process.env) {
  const evaluation = evaluateEnvironmentSafety(env);
  if (evaluation.issues.length > 0) {
    throw new Error(`Unsafe FlockTrax environment binding: ${evaluation.issues.join(" ")}`);
  }
  return evaluation;
}

export function assertOutboundIntegrationAllowed(integrationName: string, env: EnvironmentSource = process.env) {
  const evaluation = assertSafeEnvironmentBinding(env);
  if (evaluation.outboundMode === "disabled") {
    throw new Error(`${integrationName} is disabled by FLOCKTRAX_OUTBOUND_MODE.`);
  }
  if (evaluation.isDemo && evaluation.outboundMode !== "sandbox") {
    throw new Error(`${integrationName} requires sandbox outbound mode in the demo environment.`);
  }
}
