type SirenLink = {
  rel?: string[];
  href?: string;
};

type SirenActionField = {
  name?: string;
};

type SirenAction = {
  name?: string;
  href?: string;
  method?: string;
  fields?: SirenActionField[];
};

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: SirenLink[];
  entities?: Array<{ rel?: string[]; href?: string }>;
  actions?: SirenAction[];
  error?: unknown;
};

type BinSentryConfig = {
  rootUrl: string;
  bearerToken: string;
  username: string;
  password: string;
  entityUrlTemplate: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function getBinSentryConfig(): BinSentryConfig {
  return {
    rootUrl: normalize(process.env.BINSENTRY_API_ROOT_URL) || "https://api.binsentry.com",
    bearerToken: normalize(process.env.BINSENTRY_API_BEARER_TOKEN),
    username: normalize(process.env.BINSENTRY_USERNAME),
    password: normalize(process.env.BINSENTRY_PASSWORD),
    entityUrlTemplate: normalize(process.env.BINSENTRY_BIN_ENTITY_URL_TEMPLATE),
  };
}

function relMatches(relValues: string[] | undefined, needles: string[]) {
  return (relValues ?? []).some((relValue) => {
    const normalized = normalize(relValue).toLowerCase();
    return needles.some((needle) => {
      const normalizedNeedle = needle.toLowerCase();
      if (normalized === normalizedNeedle) {
        return true;
      }

      return normalizedNeedle.includes("/") ? normalized.endsWith(normalizedNeedle) : false;
    });
  });
}

function findHrefByRel(entity: SirenEntity, needles: string[]) {
  const linkHref = (entity.links ?? []).find((link) => relMatches(link.rel, needles) && normalize(link.href))?.href;
  if (linkHref) {
    return linkHref;
  }

  return (entity.entities ?? []).find((child) => relMatches(child.rel, needles) && normalize(child.href))?.href ?? null;
}

async function fetchSirenEntity(url: string, token?: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/vnd.siren+json, application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BinSentry request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as SirenEntity;
}

async function performSirenAction(entity: SirenEntity, actionName: string, values: Record<string, string>) {
  const action = (entity.actions ?? []).find((candidate) => candidate.name === actionName);
  if (!action?.href) {
    throw new Error(`BinSentry action '${actionName}' was not available.`);
  }

  const method = normalize(action.method).toUpperCase() || "GET";
  const filteredEntries = Object.entries(values).filter(([, value]) => normalize(value));
  const params = new URLSearchParams(filteredEntries);

  const response = await fetch(method === "GET" ? `${action.href}?${params.toString()}` : action.href, {
    method,
    headers: {
      Accept: "application/vnd.siren+json, application/json",
      ...(method === "GET" ? {} : { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }),
    },
    body: method === "GET" ? undefined : params.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BinSentry login failed (${response.status}) for ${action.href}`);
  }

  return (await response.json()) as SirenEntity;
}

function pickString(source: Record<string, unknown> | undefined, keys: string[]) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function loginWithCredentials(config: BinSentryConfig) {
  if (!config.username || !config.password) {
    return null;
  }

  const rootEntity = await fetchSirenEntity(config.rootUrl);
  const loginUrl = findHrefByRel(rootEntity, ["/login", "login"]);
  if (!loginUrl) {
    throw new Error("BinSentry login link was not present on the API root entity.");
  }

  const loginEntity = await fetchSirenEntity(loginUrl);
  const authEntity = await performSirenAction(loginEntity, "user-login", {
    email: config.username,
    password: config.password,
  });

  const errorMessage =
    typeof authEntity.error === "string"
      ? authEntity.error
      : pickString(authEntity.properties, ["error", "message"]);
  if (errorMessage) {
    throw new Error(`BinSentry login failed: ${errorMessage}`);
  }

  const token = pickString(authEntity.properties, ["token", "access_token", "accessToken"]);
  if (!token) {
    throw new Error("BinSentry login succeeded but no bearer token was returned.");
  }

  return token;
}

export async function getBinSentryAccessToken() {
  const config = getBinSentryConfig();
  const credentialToken = await loginWithCredentials(config);
  if (credentialToken) {
    return credentialToken;
  }

  if (config.bearerToken) {
    return config.bearerToken;
  }

  throw new Error(
    "BinSentry credentials are not configured. Set BINSENTRY_USERNAME and BINSENTRY_PASSWORD, or provide BINSENTRY_API_BEARER_TOKEN.",
  );
}
