const DEFAULT_API_BASE_URL = "https://frneaccbbrijpolcesjm.supabase.co/functions/v1";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ojGjQt_Dvd-edqCXA30J5w_605YnSfQ";
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const environmentName = (env.EXPO_PUBLIC_FLOCKTRAX_ENVIRONMENT_NAME ?? "").trim().toLowerCase();
const isDemo = environmentName === "demo";
const explicitApiBaseUrl = (env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();
const explicitSupabaseUrl = (env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const explicitPublishableKey =
  (env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim() ||
  (env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

function projectRef(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith(".supabase.co") ? host.slice(0, -".supabase.co".length) : host;
  } catch {
    return "";
  }
}

if (isDemo) {
  const productionProjectRef = (env.EXPO_PUBLIC_FLOCKTRAX_PRODUCTION_SUPABASE_PROJECT_REF ?? "").trim().toLowerCase();
  const demoProjectRef = projectRef(explicitSupabaseUrl || explicitApiBaseUrl);
  const missing = [
    !explicitApiBaseUrl ? "EXPO_PUBLIC_API_BASE_URL" : "",
    !explicitSupabaseUrl ? "EXPO_PUBLIC_SUPABASE_URL" : "",
    !explicitPublishableKey ? "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : "",
    !productionProjectRef ? "EXPO_PUBLIC_FLOCKTRAX_PRODUCTION_SUPABASE_PROJECT_REF" : "",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Unsafe FlockTrax demo build: missing ${missing.join(", ")}.`);
  }
  if (demoProjectRef === productionProjectRef) {
    throw new Error("Unsafe FlockTrax demo build: the demo Supabase project matches production.");
  }
}

const apiBaseUrl = explicitApiBaseUrl || DEFAULT_API_BASE_URL;
const derivedSupabaseUrl = explicitSupabaseUrl || apiBaseUrl.replace(/\/functions\/v1\/?$/, "");

export const apiConfig = {
  apiBaseUrl,
  supabaseUrl: derivedSupabaseUrl,
  // The anon key is intentionally public and required for hosted EAS/TestFlight builds,
  // where local .env files are not guaranteed to be present in the build context.
  supabaseAnonKey:
    explicitPublishableKey ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  passwordResetRedirectUrl: (env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL ?? "").trim(),
};
