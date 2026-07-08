import { getBinSentryAccessToken, getBinSentryConfig } from "@/lib/binsentry-auth";

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: Array<{ rel?: string[]; href?: string }>;
  entities?: Array<{ rel?: string[]; href?: string; properties?: Record<string, unknown>; links?: Array<{ rel?: string[]; href?: string }> }>;
  actions?: Array<{ name?: string; href?: string; method?: string }>;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function buildBinSentryEntityUrl(binRef: string) {
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

export async function fetchBinSentryEntity(url: string) {
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

export async function performBinSentryEntityAction(
  entityUrl: string,
  actionName: string,
  values: Record<string, string | number>,
) {
  const token = await getBinSentryAccessToken();
  const entity = (await fetchBinSentryEntity(entityUrl)) as SirenEntity;
  const action = (entity.actions ?? []).find((candidate) => normalize(candidate.name) === actionName);

  if (!action?.href) {
    throw new Error(`BinSentry action '${actionName}' is not available for ${entityUrl}.`);
  }

  const method = normalize(action.method).toUpperCase() || "POST";
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    const normalized = typeof value === "number" ? String(value) : normalize(value);
    if (normalized) {
      params.set(key, normalized);
    }
  }

  const response = await fetch(action.href, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.siren+json, application/json",
      ...(method === "GET" ? {} : { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }),
    },
    body: method === "GET" ? undefined : params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BinSentry action '${actionName}' failed (${response.status}) for ${action.href}`);
  }

  return (await response.json()) as SirenEntity | Record<string, unknown>;
}

export function normalizeBinSentryValue(value: string | null | undefined) {
  return normalize(value);
}
