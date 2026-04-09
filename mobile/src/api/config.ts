const DEFAULT_API_BASE_URL = "https://frneaccbbrijpolcesjm.supabase.co/functions/v1";
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export const apiConfig = {
  apiBaseUrl: env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  passwordResetRedirectUrl: env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL ?? "",
};
