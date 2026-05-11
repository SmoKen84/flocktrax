const DEFAULT_API_BASE_URL = "https://frneaccbbrijpolcesjm.supabase.co/functions/v1";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybmVhY2NiYnJpanBvbGNlc2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjcxMjksImV4cCI6MjA2NDE0MzEyOX0.EH6M6rIAVlYxIKgS8CMBGA0In4GlqGMaOFKgY9aCnho";
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const derivedSupabaseUrl = (env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim() || DEFAULT_API_BASE_URL.replace(/\/functions\/v1\/?$/, "");

export const apiConfig = {
  apiBaseUrl: (env.EXPO_PUBLIC_API_BASE_URL ?? "").trim() || DEFAULT_API_BASE_URL,
  supabaseUrl: derivedSupabaseUrl,
  // The anon key is intentionally public and required for hosted EAS/TestFlight builds,
  // where local .env files are not guaranteed to be present in the build context.
  supabaseAnonKey: (env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() || DEFAULT_SUPABASE_ANON_KEY,
  passwordResetRedirectUrl: (env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL ?? "").trim(),
};
