import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PlatformControlRow = {
  id: number;
  group: string | null;
  version: string | null;
  build: number | null;
  build_label: string | null;
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

type PlatformReportOptionRow = {
  id: number;
  name: string | null;
  rpt_group: string | null;
  rpt_location: string | null;
  rpt_title: string | null;
  rpt_subtitle: string | null;
  rpt_button_txt: string | null;
  rpt_function: string | null;
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

export type PublishedPlatformVersion = {
  key: "admin" | "mobile_ios" | "mobile_droid";
  label: string;
  version: string | null;
  build: number | null;
  buildLabel: string | null;
  released: string | null;
  versionLine: string | null;
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

export async function getAppSettingTextValues(names: string[]) {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase || names.length === 0) {
    return new Map<string, { value: string; desc: string }>();
  }

  const requested = new Set(names.map((name) => normalize(name).toLowerCase()).filter((name) => name.length > 0));
  if (requested.size === 0) {
    return new Map<string, { value: string; desc: string }>();
  }

  const { data } = await supabase
    .from("app_settings")
    .select("name,value,desc");

  const rows =
    ((data as Array<{ name: string | null; value: string | number | null; desc: string | null }> | null) ?? []).filter(
      (row) => requested.has(normalize(row.name).toLowerCase()),
    );

  return new Map(
    rows.map((row) => [
      normalize(row.name).toLowerCase(),
      {
        value: normalize(row.value === null || row.value === undefined ? "" : String(row.value)),
        desc: normalize(row.desc),
      },
    ]),
  );
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

  const parts: string[] = [];

  if (normalize(control.version).length > 0) {
    parts.push(`Version ${normalize(control.version)}`);
  }

  const buildLabel = normalize(control.build_label);
  if (buildLabel.length > 0) {
    parts.push(`Build ${buildLabel}`);
  } else if (control.build !== null) {
    parts.push(`Build ${control.build}`);
  }

  if (control.released) {
    parts.push(control.released);
  }

  return parts.length ? parts.join(" · ") : null;
}

function findControlRowByGroupKeys(rows: PlatformControlRow[], keys: string[]) {
  const normalizedKeys = keys.map((key) => key.toLowerCase());

  return rows.find((row) => normalizedKeys.includes(normalize(row.group).toLowerCase())) ?? null;
}

function toPublishedPlatformVersion(
  key: PublishedPlatformVersion["key"],
  label: string,
  control: PlatformControlRow | null,
): PublishedPlatformVersion {
  return {
    key,
    label,
    version: normalize(control?.version) || null,
    build: control?.build ?? null,
    buildLabel: normalize(control?.build_label) || null,
    released: normalize(control?.released) || null,
    versionLine: buildVersionLine(control),
  };
}

export async function getPlatformPolicyByName(name: string) {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase || normalize(name).length === 0) {
    return null;
  }

  const { data } = await supabase
    .schema("platform")
    .from("license_policy")
    .select("id, name, display_txt, note, scrn_location")
    .eq("name", name)
    .maybeSingle();

  const row = (data as PlatformLicensePolicyRow | null) ?? null;
  if (!row || normalize(row.display_txt).length === 0) {
    return null;
  }

  return {
    name: normalize(row.name) || "Policy",
    body: normalize(row.display_txt),
    note: normalize(row.note) || null,
  };
}

export async function getPlatformReportOption(input: { location: string; name?: string | null }) {
  noStore();

  const supabase = createSupabaseAdminClient();
  const location = normalize(input.location);
  const name = normalize(input.name);

  if (!supabase || location.length === 0) {
    return null;
  }

  let query = supabase
    .schema("platform")
    .from("reportoptions")
    .select("id, name, rpt_group, rpt_location, rpt_title, rpt_subtitle, rpt_button_txt, rpt_function")
    .eq("rpt_location", location);

  if (name.length > 0) {
    query = query.eq("name", name);
  }

  const { data } = await query.order("id", { ascending: true }).limit(1).maybeSingle();
  const row = (data as PlatformReportOptionRow | null) ?? null;

  if (!row) {
    return null;
  }

  return {
    name: normalize(row.name) || "Report",
    group: normalize(row.rpt_group) || null,
    location: normalize(row.rpt_location) || null,
    title: normalize(row.rpt_title) || null,
    subtitle: normalize(row.rpt_subtitle) || null,
    buttonText: normalize(row.rpt_button_txt) || null,
    functionName: normalize(row.rpt_function) || null,
  };
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
    supabase.schema("platform").from("control").select("id, group, version, build, build_label, released").order("id", { ascending: false }),
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
    findControlRowByGroupKeys(allControlRows, ["admin", "web_admin", "webapp", "web_admin_console"]) ??
    findControlRowByGroupKeys(allControlRows, ["global"]) ??
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

export async function getPublishedPlatformVersions() {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      admin: toPublishedPlatformVersion("admin", "FlockTrax-Admin", null),
      mobileIos: toPublishedPlatformVersion("mobile_ios", "iPhone (iOS)", null),
      mobileAndroid: toPublishedPlatformVersion("mobile_droid", "Android", null),
    };
  }

  const { data } = await supabase
    .schema("platform")
    .from("control")
    .select("id, group, version, build, build_label, released")
    .order("id", { ascending: false });

  const rows = (data as PlatformControlRow[] | null) ?? [];

  const adminControl =
    findControlRowByGroupKeys(rows, ["admin", "web_admin", "webapp", "web_admin_console"]) ??
    findControlRowByGroupKeys(rows, ["global"]);
  const iosControl = findControlRowByGroupKeys(rows, ["mobile_ios", "ios"]);
  const androidControl = findControlRowByGroupKeys(rows, ["mobile_droid", "android"]);

  return {
    admin: toPublishedPlatformVersion("admin", "FlockTrax-Admin", adminControl),
    mobileIos: toPublishedPlatformVersion("mobile_ios", "iPhone (iOS)", iosControl),
    mobileAndroid: toPublishedPlatformVersion("mobile_droid", "Android", androidControl),
  };
}
