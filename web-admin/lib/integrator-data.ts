import { unstable_noStore as noStore } from "next/cache";

import { getAdminData } from "@/lib/admin-data";
import { getUserAccessBundle } from "@/lib/access-control";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const INTEGRATOR_SETTINGS_GROUP = "INTEGRATOR";

export const INTEGRATOR_FIELDS = [
  { key: "company_name", label: "Company Name", description: "Primary legal or operating name for the integrator." },
  { key: "company_code", label: "Company Code", description: "Short integrator code used to identify related records and keep listings compact." },
  { key: "address_line_1", label: "Address Line 1", description: "Primary physical street address." },
  { key: "address_line_2", label: "Address Line 2", description: "Secondary suite, unit, or mailing line." },
  { key: "city", label: "City", description: "Primary city for the integrator office." },
  { key: "state", label: "State", description: "Primary state or province." },
  { key: "postal_code", label: "Postal Code", description: "Primary ZIP or postal code." },
  { key: "main_phone", label: "Main Phone", description: "Main office phone number." },
  { key: "main_email", label: "Main Email", description: "General mailbox for the integrator office." },
  { key: "live_operations_contact", label: "Live Operations", description: "Lead contact for live operations." },
  { key: "live_operations_phone", label: "Live Operations Phone", description: "Direct phone for live operations." },
  { key: "hatchery_contact", label: "Hatchery", description: "Lead hatchery contact." },
  { key: "hatchery_phone", label: "Hatchery Phone", description: "Direct phone for hatchery operations." },
  { key: "processing_plant_contact", label: "Processing Plant", description: "Lead processing-plant contact." },
  { key: "processing_plant_phone", label: "Processing Plant Phone", description: "Direct phone for processing operations." },
  { key: "catch_crew_contact", label: "Catch Crew", description: "Lead catch-crew contact." },
  { key: "catch_crew_phone", label: "Catch Crew Phone", description: "Direct phone for catch-crew operations." },
  { key: "live_haul_contact", label: "Live Haul", description: "Lead live-haul contact." },
  { key: "live_haul_phone", label: "Live Haul Phone", description: "Direct phone for live-haul operations." },
] as const;

export type IntegratorFieldKey = (typeof INTEGRATOR_FIELDS)[number]["key"];

type AppSettingRow = {
  id: string;
  group: string | null;
  name: string | null;
  value: string | null;
  desc: string | null;
  updated_at?: string | null;
};

function hasMeaningfulValue(value: string | null | undefined) {
  return (value ?? "").trim().length > 0;
}

function pickPreferredAppSettingRow(rows: AppSettingRow[]) {
  return [...rows].sort((left, right) => {
    const leftValueRank = hasMeaningfulValue(left.value) ? 1 : 0;
    const rightValueRank = hasMeaningfulValue(right.value) ? 1 : 0;

    if (rightValueRank !== leftValueRank) {
      return rightValueRank - leftValueRank;
    }

    const leftTime = left.updated_at ? Date.parse(left.updated_at) : 0;
    const rightTime = right.updated_at ? Date.parse(right.updated_at) : 0;

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return right.id.localeCompare(left.id);
  })[0] ?? null;
}

export type IntegratorFieldRecord = {
  key: IntegratorFieldKey;
  label: string;
  description: string;
  id: string | null;
  value: string;
  updatedAt: string | null;
};

export type IntegratorStatRecord = {
  label: string;
  value: string;
  note: string;
};

export type IntegratorBundle = {
  profile: IntegratorFieldRecord[];
  stats: IntegratorStatRecord[];
};

export async function getIntegratorBundle(): Promise<IntegratorBundle> {
  noStore();

  const supabase = createSupabaseAdminClient();
  const [adminData, accessBundle, settingsResult] = await Promise.all([
    getAdminData(),
    getUserAccessBundle(),
    supabase
      ? supabase
          .from("app_settings")
          .select("id,group,name,value,desc,updated_at")
          .eq("group", INTEGRATOR_SETTINGS_GROUP)
          .order("name")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const rows = (((settingsResult as { data?: AppSettingRow[] | null }).data ?? []) as AppSettingRow[]).filter(
    (row) => row.name && row.group === INTEGRATOR_SETTINGS_GROUP,
  );

  const settings = new Map<IntegratorFieldKey, AppSettingRow>();
  for (const field of INTEGRATOR_FIELDS) {
    const fieldRows = rows.filter((row) => row.name === field.key);
    const preferredRow = pickPreferredAppSettingRow(fieldRows);
    if (preferredRow) {
      settings.set(field.key, preferredRow);
    }
  }

  const totalBarns = Object.values(adminData.barnsByFarmId).reduce((sum, barns) => sum + barns.length, 0);
  const barnsInProduction = Object.values(adminData.barnsByFarmId).reduce(
    (sum, barns) => sum + barns.filter((barn) => barn.currentPlacementCode).length,
    0,
  );
  const systemAuthUsers = accessBundle.users.length;
  const signedInUsers = accessBundle.users.filter((user) => user.status === "active").length;
  const invitedUsers = accessBundle.users.filter((user) => user.status === "invited").length;

  return {
    profile: INTEGRATOR_FIELDS.map((field) => {
      const row = settings.get(field.key);
      return {
        key: field.key,
        label: field.label,
        description: field.description,
        id: row?.id ?? null,
        value: row?.value ?? "",
        updatedAt: row?.updated_at ?? null,
      } satisfies IntegratorFieldRecord;
    }),
    stats: [
      { label: "Farm Groups", value: String(adminData.farmGroups.length), note: "Operating grower groups in the system." },
      { label: "Farms", value: String(adminData.farms.length), note: "Individual farm sites tied to the current integrator footprint." },
      { label: "Barns In Production", value: String(barnsInProduction), note: `${totalBarns} configured barns total.` },
      { label: "Active Placements", value: String(adminData.activePlacements.length), note: "Current placements driving today’s production records." },
      { label: "Flocks In Cycle", value: String(adminData.flocks.filter((flock) => flock.status !== "complete").length), note: "Scheduled or active flocks still inside the grow-out lifecycle." },
      { label: "Logged On Users", value: String(signedInUsers), note: "Authenticated users with at least one recorded sign-in." },
      { label: "System Auth Users", value: String(systemAuthUsers), note: `${signedInUsers} signed in at least once, ${invitedUsers} still invited.` },
    ],
  };
}
