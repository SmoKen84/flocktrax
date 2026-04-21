import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PlatformControlRow = {
  id: number;
  group: string | null;
  version: number | null;
  build: number | null;
  released: string | null;
};

type PlatformScreenTextRow = {
  id: number;
  name: string | null;
  display: string | null;
  note: string | null;
  scrn_location: string | null;
};

type PlatformLicensePolicyRow = {
  id: number;
  name: string | null;
  display_txt: string | null;
  note: string | null;
  scrn_location: string | null;
};

export type PlatformSplashContent = {
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel: string;
  descriptor: string;
  productLabel: string;
  subsystemLine: string | null;
  copyrightLine: string;
  versionLine: string | null;
  policies: Array<{
    name: string;
    body: string;
    note: string | null;
  }>;
};

export async function getPlatformScreenTextValues(names: string[]) {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase || names.length === 0) {
    return new Map<string, string>();
  }

  const requested = new Set(names.map((name) => normalize(name).toLowerCase()).filter((name) => name.length > 0));
  if (requested.size === 0) {
    return new Map<string, string>();
  }

  const { data } = await supabase
    .schema("platform")
    .from("screen_txt")
    .select("name,display");

  const rows = ((data as Array<{ name: string | null; display: string | null }> | null) ?? []).filter(
    (row) => requested.has(normalize(row.name).toLowerCase()),
  );

  return new Map(rows.map((row) => [normalize(row.name).toLowerCase(), normalize(row.display)]));
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function findByName(rows: PlatformScreenTextRow[], name: string) {
  return rows.find((row) => normalize(row.name).toLowerCase() === name.toLowerCase()) ?? null;
}

function findBestScreenText(
  rows: PlatformScreenTextRow[],
  include: string[],
  exclude: string[] = [],
) {
  const match = rows.find((row) => {
    const haystack = [row.name, row.display, row.note, row.scrn_location]
      .map((value) => normalize(value).toLowerCase())
      .join(" ");

    return include.every((needle) => haystack.includes(needle)) && exclude.every((needle) => !haystack.includes(needle));
  });

  return match ?? null;
}

function buildVersionLine(control: PlatformControlRow | null) {
  if (!control) {
    return null;
  }

  const versionParts: string[] = [];

  if (control.version !== null) {
    versionParts.push(`Version ${control.version}`);
  }

  if (control.build !== null) {
    versionParts.push(`Build ${control.build}`);
  }

  if (control.released) {
    versionParts.push(`Released ${control.released}`);
  }

  return versionParts.length ? versionParts.join(" · ") : null;
}

export async function getPlatformSplashContent(): Promise<PlatformSplashContent> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      eyebrow: "FlockTrax Console",
      title: "Open the operational console.",
      body:
        "This web console is the desktop side of FlockTrax for setup, oversight, reporting, and controlled administration.",
      buttonLabel: "Live Dashboard",
      descriptor: "Admin & platform console",
      productLabel: "Integrated Flock Management Platform",
      subsystemLine: null,
      copyrightLine: "Copyright © 2026 All Rights Reserved. Smotherman Farms, Ltd. West, Texas.",
      versionLine: null,
      policies: [],
    };
  }

  const [
    { data: controlRows, error: controlError },
    { data: screenRows, error: screenError },
    { data: policyRows, error: policyError },
  ] = await Promise.all([
    supabase.schema("platform").from("control").select("id, group, version, build, released").order("id", { ascending: false }),
    supabase.schema("platform").from("screen_txt").select("id, name, display, note, scrn_location").order("id", { ascending: true }),
    supabase
      .schema("platform")
      .from("license_policy")
      .select("id, name, display_txt, note, scrn_location")
      .order("id", { ascending: true }),
  ]);

  const allControlRows = (controlRows as PlatformControlRow[] | null) ?? [];
  const screens = (screenRows as PlatformScreenTextRow[] | null) ?? [];
  const policies = (policyRows as PlatformLicensePolicyRow[] | null) ?? [];

  const control =
    allControlRows.find((row) => normalize(row.group).toLowerCase() === "admin") ??
    allControlRows.find((row) => normalize(row.group).toLowerCase() === "global") ??
    allControlRows[0] ??
    null;

  const taglineRow = findByName(screens, "webapp_tagline");
  const titleRow = findByName(screens, "webapp_splash_title");
  const bodyRow = findByName(screens, "splash_verbose_desc");
  const platformTypeRow = findByName(screens, "platform_type");
  const subsystemRow = findByName(screens, "platform_subsystems");
  const copyrightRow = findByName(screens, "copyright");

  const eyebrowRow =
    findBestScreenText(screens, ["eyebrow"]) ??
    findBestScreenText(screens, ["kicker"]) ??
    findBestScreenText(screens, ["options"]) ??
    null;
  const buttonRow =
    findBestScreenText(screens, ["button"]) ??
    findBestScreenText(screens, ["open"]) ??
    findBestScreenText(screens, ["console"]) ??
    null;

  return {
    eyebrow: normalize(eyebrowRow?.display) || "Console Entry",
    title: normalize(titleRow?.display) || "Open the FlockTrax console.",
    body:
      normalize(bodyRow?.display) ||
      "This web console is the desktop side of FlockTrax for setup, oversight, reporting, and controlled administration.",
    buttonLabel: normalize(buttonRow?.display) || "Live Dashboard",
    descriptor: normalize(taglineRow?.display) || "Admin & platform console",
    productLabel: normalize(platformTypeRow?.display) || "Integrated Flock Management Platform",
    subsystemLine: normalize(subsystemRow?.display) || null,
    copyrightLine:
      normalize(copyrightRow?.display) || "Copyright © 2026 All Rights Reserved. Smotherman Farms, Ltd. West, Texas.",
    versionLine: buildVersionLine(control),
    policies: policies
      .map((row) => ({
        name: normalize(row.name) || "Policy",
        body: normalize(row.display_txt),
        note: normalize(row.note) || null,
      }))
      .filter((row) => row.body.length > 0),
  };
}
