import { getBinSentryAccessToken, getBinSentryConfig } from "@/lib/binsentry-auth";

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: Array<{ rel?: string[]; href?: string }>;
  entities?: Array<{ rel?: string[]; href?: string; properties?: Record<string, unknown>; links?: Array<{ rel?: string[]; href?: string }> }>;
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

export function normalizeBinSentryValue(value: string | null | undefined) {
  return normalize(value);
}
