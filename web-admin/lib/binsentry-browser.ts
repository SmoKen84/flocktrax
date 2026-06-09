import { fetchBinSentryEntity, normalizeBinSentryValue } from "@/lib/binsentry-http";
import { getBinSentryConfig } from "@/lib/binsentry-auth";

type SirenLink = {
  rel?: string[];
  href?: string;
};

type SirenSubEntity = {
  rel?: string[];
  href?: string;
  properties?: Record<string, unknown>;
  links?: SirenLink[];
};

type SirenEntity = {
  properties?: Record<string, unknown>;
  links?: SirenLink[];
  entities?: SirenSubEntity[];
};

export type BinSentryDiscoveredBin = {
  id: string | null;
  name: string | null;
  href: string | null;
  ref: string;
  rawProperties: Record<string, unknown>;
};

export type BinSentryDiscoveryResult = {
  binsUrl: string;
  discoveredBins: BinSentryDiscoveredBin[];
};

function normalize(value: string | null | undefined) {
  return normalizeBinSentryValue(value);
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

function findNextHref(entity: SirenEntity) {
  return (entity.links ?? []).find((link) => relMatches(link.rel, ["next"]) && normalize(link.href))?.href ?? null;
}

function pickString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function deriveIdFromHref(href: string | null) {
  if (!href) {
    return null;
  }

  const match = href.match(/\/([^/?#]+)(?:[?#].*)?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function findSelfHref(links: SirenLink[] | undefined) {
  return (links ?? []).find((link) => relMatches(link.rel, ["self"]) && normalize(link.href))?.href ?? null;
}

function mapDiscoveredBin(entity: SirenSubEntity): BinSentryDiscoveredBin | null {
  const rawProperties =
    entity.properties && typeof entity.properties === "object" ? entity.properties : {};
  const href = normalize(entity.href) || normalize(findSelfHref(entity.links)) || null;
  const id =
    pickString(rawProperties, ["id", "bin_id", "binId", "entity_id", "entityId", "uuid"]) ??
    deriveIdFromHref(href);
  const name = pickString(rawProperties, [
    "name",
    "bin_name",
    "binName",
    "display_name",
    "displayName",
    "label",
    "title",
  ]);

  if (!href && !id) {
    return null;
  }

  return {
    id,
    name,
    href,
    ref: href ?? id ?? "",
    rawProperties,
  };
}

export async function discoverBinSentryBinRefs(): Promise<BinSentryDiscoveryResult> {
  const { rootUrl } = getBinSentryConfig();

  const rootEntity = (await fetchBinSentryEntity(rootUrl)) as SirenEntity;
  const primaryOrganizationUrl = findHrefByRel(rootEntity, ["/primary-organization", "primary-organization"]);
  if (!primaryOrganizationUrl) {
    throw new Error("Primary organization link was not present in the BinSentry root entity.");
  }

  const primaryOrganization = (await fetchBinSentryEntity(primaryOrganizationUrl)) as SirenEntity;
  const binsUrl =
    findHrefByRel(primaryOrganization, ["/bins", "bins"]) ??
    findHrefByRel(primaryOrganization, ["/feed-bins", "feed-bins", "/bin", "bin"]);

  if (!binsUrl) {
    throw new Error("Bins link was not present on the BinSentry organization entity.");
  }

  const discoveredBins: BinSentryDiscoveredBin[] = [];
  const seenRefs = new Set<string>();
  let nextUrl: string | null = new URL(binsUrl).toString();
  let pageCount = 0;

  while (nextUrl && pageCount < 10) {
    const pagedUrl = new URL(nextUrl);
    if (!pagedUrl.searchParams.get("limit")) {
      pagedUrl.searchParams.set("limit", "100");
    }

    const binsEntity = (await fetchBinSentryEntity(pagedUrl.toString())) as SirenEntity;
    for (const bin of (binsEntity.entities ?? [])
      .map(mapDiscoveredBin)
      .filter((candidate): candidate is BinSentryDiscoveredBin => Boolean(candidate))
      .filter((candidate) => Boolean(candidate.ref))) {
      if (seenRefs.has(bin.ref)) {
        continue;
      }

      seenRefs.add(bin.ref);
      discoveredBins.push(bin);
    }

    nextUrl = findNextHref(binsEntity);
    pageCount += 1;
  }

  return {
    binsUrl,
    discoveredBins,
  };
}
