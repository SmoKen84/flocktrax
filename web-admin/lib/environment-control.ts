import { createSupabaseAdminClient, createSupabaseServerClient, getSupabaseAdminKey, getSupabasePublicKey } from "@/lib/supabase/server";
import { evaluateEnvironmentSafety } from "@/lib/environment-safety";

export type EnvironmentCheckStatus = "configured" | "missing" | "external" | "action";

export type EnvironmentCheck = {
  name: string;
  status: EnvironmentCheckStatus;
  value: string;
  location: string;
  detail: string;
};

export type EnvironmentCheckGroup = {
  title: string;
  description: string;
  checks: EnvironmentCheck[];
};

export type EnvironmentControlSnapshot = {
  environmentName: string;
  environmentNameIsExplicit: boolean;
  deploymentProvider: string;
  deploymentStage: string;
  appHost: string;
  supabaseHost: string;
  supabaseProjectRef: string;
  webConfiguredCount: number;
  webRequiredCount: number;
  groups: EnvironmentCheckGroup[];
};

export type DemoShowcaseStatus = {
  state: "ready" | "unavailable" | "not-demo" | "unsafe";
  message: string;
  ok: boolean;
  projectRef?: string;
  seededAt?: string;
  counts: Array<{ label: string; value: number }>;
};

type UserRoleRow = {
  role_id: string | null;
};

type LegacyUserRoleRow = {
  role: string | null;
};

type RoleCodeRow = {
  code: string | null;
};

function normalizeRole(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isSuperAdminRole(value: string | null | undefined) {
  const normalized = normalizeRole(value);
  return normalized === "super_admin" || normalized === "superadmin";
}

function configured(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function statusFor(value: string | null | undefined): EnvironmentCheckStatus {
  return configured(value) ? "configured" : "missing";
}

function safeUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function projectRefFromUrl(value: string | null | undefined) {
  const hostname = safeUrl(value)?.hostname ?? "";
  if (!hostname) return "Not configured";
  if (hostname.endsWith(".supabase.co")) return hostname.slice(0, -".supabase.co".length);
  return "Custom endpoint";
}

function inferredEnvironmentName() {
  const explicit = process.env.FLOCKTRAX_ENVIRONMENT_NAME?.trim();
  if (explicit) return explicit;
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.VERCEL_ENV === "development" || process.env.NODE_ENV === "development") return "development";
  return "unlabeled";
}

function presenceValue(value: string | null | undefined) {
  return configured(value) ? "Configured" : "Missing";
}

function groupedCredentialStatus(values: Array<string | null | undefined>) {
  return values.some(configured) ? "Configured" : "Disabled / not configured";
}

export async function hasEnvironmentControlAccess() {
  const server = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const authResult = server ? await server.auth.getUser() : null;
  const user = authResult?.data.user ?? null;

  if (!user || !admin) return false;

  const ownerEmails = (process.env.FLOCKTRAX_ENVIRONMENT_CONTROL_OWNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (ownerEmails.length > 0 && (!user.email || !ownerEmails.includes(user.email.toLowerCase()))) {
    return false;
  }

  const normalizedRoles = await admin.from("user_roles").select("role_id").eq("user_id", user.id);
  if (!normalizedRoles.error) {
    const roleIds = ((normalizedRoles.data ?? []) as UserRoleRow[])
      .map((row) => row.role_id)
      .filter((roleId): roleId is string => Boolean(roleId));

    if (roleIds.length > 0) {
      const roles = await admin.from("roles").select("code").in("id", roleIds);
      if (!roles.error && ((roles.data ?? []) as RoleCodeRow[]).some((row) => isSuperAdminRole(row.code))) {
        return true;
      }
    }
  }

  const legacyRoles = await admin.from("user_roles").select("role").eq("user_id", user.id);
  return !legacyRoles.error && ((legacyRoles.data ?? []) as LegacyUserRoleRow[]).some((row) => isSuperAdminRole(row.role));
}

export function getEnvironmentControlSnapshot(): EnvironmentControlSnapshot {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const environmentName = inferredEnvironmentName();
  const supabaseHost = safeUrl(supabaseUrl)?.hostname ?? "Not configured";
  const appHost = safeUrl(appUrl)?.host ?? process.env.VERCEL_URL?.trim() ?? "Not configured";
  const publicKey = getSupabasePublicKey();
  const adminKey = getSupabaseAdminKey();
  const explicitEnvironmentName = process.env.FLOCKTRAX_ENVIRONMENT_NAME;
  const safety = evaluateEnvironmentSafety();

  const webChecks: EnvironmentCheck[] = [
    {
      name: "Deployment identity",
      status: statusFor(explicitEnvironmentName),
      value: explicitEnvironmentName?.trim() || "Inferred only",
      location: "FLOCKTRAX_ENVIRONMENT_NAME",
      detail: "Set this explicitly to production, demo, preview, or development. Never infer demo from a URL.",
    },
    {
      name: "Supabase endpoint",
      status: statusFor(supabaseUrl),
      value: supabaseHost,
      location: "NEXT_PUBLIC_SUPABASE_URL",
      detail: "The browser, server session client, and API routing use this project endpoint.",
    },
    {
      name: "Browser publishable key",
      status: statusFor(publicKey),
      value: presenceValue(publicKey),
      location: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      detail: "Public client credential for the selected Supabase project. The value is intentionally never displayed here.",
    },
    {
      name: "Server secret key",
      status: statusFor(adminKey),
      value: presenceValue(adminKey),
      location: "SUPABASE_SECRET_KEY",
      detail: "Server-only elevated credential for the selected project. It must never be copied into a NEXT_PUBLIC variable.",
    },
    {
      name: "Canonical app URL",
      status: statusFor(appUrl),
      value: appHost,
      location: "NEXT_PUBLIC_APP_URL",
      detail: "Used for login, logout, invitations, and callback URLs in this deployment.",
    },
  ];

  const groups: EnvironmentCheckGroup[] = [
    {
      title: "Do No Harm isolation",
      description: "Fail-closed rules are evaluated before the web server creates any Supabase client.",
      checks: [
        {
          name: "Production database rejection",
          status: safety.issues.length > 0 ? "action" : "configured",
          value: safety.isDemo ? (safety.issues.length > 0 ? "Blocked: unsafe binding" : "Demo binding isolated") : "Guard armed for demo",
          location: "FLOCKTRAX_PRODUCTION_SUPABASE_PROJECT_REF",
          detail: "A deployment labeled demo cannot start when its Supabase project matches the protected production reference.",
        },
        {
          name: "Production hostname rejection",
          status: safety.issues.length > 0 ? "action" : "configured",
          value: safety.isDemo ? (safety.issues.length > 0 ? "Blocked: verify configuration" : "Demo host isolated") : "Guard armed for demo",
          location: "FLOCKTRAX_PRODUCTION_APP_HOST",
          detail: "A deployment labeled demo cannot start on the protected production hostname.",
        },
        {
          name: "Outbound network mode",
          status: safety.isDemo && safety.outboundMode === "live" ? "action" : "configured",
          value: safety.outboundMode,
          location: "FLOCKTRAX_OUTBOUND_MODE",
          detail: "Demo accepts only disabled or sandbox. Web email, Google Sheets, and BinSentry plus Edge Google, BinSentry, and Adalo calls enforce this gate.",
        },
        {
          name: "Mobile demo binding",
          status: "configured",
          value: "Fail-closed for demo builds",
          location: "EXPO_PUBLIC_FLOCKTRAX_*",
          detail: "A mobile build labeled demo requires explicit endpoints and refuses the protected production project reference.",
        },
      ],
    },
    {
      title: "Web deployment",
      description: "Values that bind one Vercel deployment to exactly one Supabase project.",
      checks: webChecks,
    },
    {
      title: "Demo Supabase project",
      description: "Project-local resources cannot be switched by the web application and must be provisioned in the demo project.",
      checks: [
        {
          name: "Schema and seed data",
          status: "external",
          value: "Verify in demo Supabase",
          location: "Supabase migrations + controlled demo seed",
          detail: "Apply the same migrations, then load scrubbed or synthetic farms, barns, flocks, users, and reference data.",
        },
        {
          name: "Authentication",
          status: "external",
          value: "Verify in demo Supabase",
          location: "Auth users, redirect URLs, email templates",
          detail: "Create demo-only evaluator accounts and authorize only the demo domain callbacks.",
        },
        {
          name: "Storage",
          status: "external",
          value: "Verify in demo Supabase",
          location: "Buckets, policies, and demo documents",
          detail: "Recreate required buckets and policies without copying sensitive production documents.",
        },
        {
          name: "Edge Functions and secrets",
          status: "external",
          value: "Verify in demo Supabase",
          location: "Functions + Supabase project secrets",
          detail: "Deploy functions and review SUPABASE_* key aliases, FTX/JWT secrets, password-reset redirects, Google, BinSentry, and any Adalo secrets.",
        },
        {
          name: "Scheduled jobs",
          status: "external",
          value: "Keep disabled until reviewed",
          location: "Supabase Cron + Vault (including GOOGLEAPIS_OUTBOX_CRON_SECRET)",
          detail: "Create demo-specific cron/Vault entries only after every outbound integration has been made safe. Never copy a production cron target or secret blindly.",
        },
      ],
    },
    {
      title: "External integrations",
      description: "Credential presence is shown, never credential content. Demo should use sandbox destinations or leave these disabled.",
      checks: [
        {
          name: "Email delivery",
          status: configured(process.env.SMTP_HOST) ? "action" : "configured",
          value: groupedCredentialStatus([process.env.SMTP_HOST, process.env.SMTP_USER, process.env.SMTP_PASS]),
          location: "SMTP_* in the web deployment",
          detail: configured(process.env.SMTP_HOST)
            ? "Credentials are present. Use a demo mailbox/sink before inviting evaluators."
            : "No SMTP host is present, so application email delivery is inactive.",
        },
        {
          name: "BinSentry",
          status: [process.env.BINSENTRY_API_BEARER_TOKEN, process.env.BINSENTRY_USERNAME].some(configured) ? "action" : "configured",
          value: groupedCredentialStatus([process.env.BINSENTRY_API_BEARER_TOKEN, process.env.BINSENTRY_USERNAME, process.env.BINSENTRY_PASSWORD]),
          location: "BINSENTRY_* in web + Edge Function secrets",
          detail: "Do not reuse production credentials in demo. Leave disabled or use a vendor sandbox account.",
        },
        {
          name: "Google Sheets sync",
          status: configured(process.env.GOOGLE_APPLICATION_CREDENTIALS) ? "action" : "configured",
          value: groupedCredentialStatus([process.env.GOOGLE_APPLICATION_CREDENTIALS]),
          location: "GOOGLE_APPLICATION_CREDENTIALS / PYTHON_SYNC_WORKER + Edge Google secrets",
          detail: "Use separate demo worksheets and GOOGLE_SERVICE_ACCOUNT_* access, or keep both local workers and Edge cron disabled.",
        },
      ],
    },
    {
      title: "Mobile build",
      description: "Expo values are compiled into each app build; changing Vercel does not retarget an installed mobile app.",
      checks: [
        {
          name: "API base URL",
          status: "external",
          value: "Required for demo build",
          location: "EXPO_PUBLIC_API_BASE_URL",
          detail: "Point to the demo project's /functions/v1 endpoint.",
        },
        {
          name: "Supabase endpoint and key",
          status: "external",
          value: "Required for demo build",
          location: "EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          detail: "Create a distinct EAS environment/profile for the demo project.",
        },
        {
          name: "Production fallback guard",
          status: "configured",
          value: "Fail-closed for demo builds",
          location: "mobile/src/api/config.ts",
          detail: "Production compatibility fallbacks remain for existing builds, but a build explicitly labeled demo requires complete demo values and rejects the production project.",
        },
      ],
    },
  ];

  return {
    environmentName,
    environmentNameIsExplicit: configured(explicitEnvironmentName),
    deploymentProvider: process.env.VERCEL ? "Vercel" : "Local / other",
    deploymentStage: process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || "unknown",
    appHost,
    supabaseHost,
    supabaseProjectRef: projectRefFromUrl(supabaseUrl),
    webConfiguredCount: webChecks.filter((check) => check.status === "configured").length,
    webRequiredCount: webChecks.length,
    groups,
  };
}

export async function getDemoShowcaseStatus(): Promise<DemoShowcaseStatus> {
  const safety = evaluateEnvironmentSafety();

  if (!safety.isDemo) {
    return {
      state: "not-demo",
      message: "Showcase reset controls are available only from an explicitly labeled demo deployment.",
      ok: false,
      counts: [],
    };
  }

  if (safety.issues.length > 0) {
    return {
      state: "unsafe",
      message: safety.issues.join(" "),
      ok: false,
      counts: [],
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      state: "unavailable",
      message: "The demo service credential is not configured for this deployment.",
      ok: false,
      counts: [],
    };
  }

  const [result, bucketResult] = await Promise.all([
    admin.rpc("get_demo_showcase_status"),
    admin.storage.getBucket("flocktrax-document-archive"),
  ]);
  if (result.error || !result.data || typeof result.data !== "object") {
    return {
      state: "unavailable",
      message: result.error?.message ?? "The demo database did not return a showcase status.",
      ok: false,
      counts: [],
    };
  }

  const status = result.data as Record<string, unknown>;
  const countFields: Array<[string, string]> = [
    ["Farm groups", "farm_groups"],
    ["Farms", "farms"],
    ["Barns", "barns"],
    ["Placements", "placements"],
    ["Future placements", "future_placements"],
    ["Daily logs", "daily_logs"],
    ["Mortality logs", "mortality_logs"],
    ["Weight samples", "weight_samples"],
    ["Mobile daily-age tasks", "daily_age_tasks"],
    ["Feed tickets", "feed_tickets"],
    ["Feed drops", "feed_drops"],
    ["Simulated BinSentry orders", "binsentry_demo_orders"],
    ["Simulated BinSentry bins", "binsentry_demo_bins"],
    ["Feed curve days", "feed_prediction_curve_days"],
    ["Application settings", "app_settings"],
    ["Livehaul events", "livehaul_events"],
    ["Future livehaul events", "future_livehaul_events"],
    ["Action items", "issues"],
  ];
  const bucketReady = !bucketResult.error && bucketResult.data?.public === false;
  const ok = status.ok === true && bucketReady;

  return {
    state: ok ? "ready" : "unsafe",
    message: ok
      ? "Synthetic showcase data is complete, private document storage is ready, and both outbound queues are empty."
      : "The demo dataset differs from its verified baseline. Use the guarded reset to restore it.",
    ok,
    projectRef: typeof status.project_ref === "string" ? status.project_ref : undefined,
    seededAt: typeof status.seeded_at === "string" ? status.seeded_at : undefined,
    counts: countFields.map(([label, key]) => ({
      label,
      value: typeof status[key] === "number" ? status[key] : 0,
    })).concat({ label: "Private document bucket", value: bucketReady ? 1 : 0 }),
  };
}
