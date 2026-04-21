import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type FarmGroupEditorRecord = {
  id: string;
  groupName: string;
  contactName: string;
  contactTitle: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  isActive: boolean;
};

export type FarmEditorRecord = {
  id: string;
  farmGroupId: string | null;
  farmCode: string;
  farmName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  mapUrl: string;
  isActive: boolean;
};

export type BarnEditorRecord = {
  id: string;
  farmId: string;
  barnCode: string;
  sortCode: string;
  lengthFt: string;
  widthFt: string;
  sqft: string;
  standardHead: string;
  isActive: boolean;
};

export type FarmStructureEditorBundle = {
  farmGroup: FarmGroupEditorRecord | null;
  farm: FarmEditorRecord | null;
  barn: BarnEditorRecord | null;
};

type FarmGroupRow = {
  id: string;
  group_name: string | null;
  group_contact_name: string | null;
  contact_title: string | null;
  phone: string | null;
  addr1: string | null;
  addr2: string | null;
  city: string | null;
  st: string | null;
  zip: string | null;
  is_active: boolean | null;
};

type FarmRow = {
  id: string;
  farm_group_id: string | null;
  farm_code: string | null;
  farm_name: string | null;
  addr: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  map_url: string | null;
  is_active: boolean | null;
};

type BarnRow = {
  id: string;
  farm_id: string;
  barn_code: string | null;
  sort_code: string | null;
  length_ft: number | null;
  width_ft: number | null;
  sqft: number | null;
  stdroc_head: string | null;
  is_active: boolean | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function formatNumeric(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export async function getFarmStructureEditorBundle(options: {
  farmGroupId?: string | null;
  farmId?: string | null;
  barnId?: string | null;
}): Promise<FarmStructureEditorBundle> {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      farmGroup: null,
      farm: null,
      barn: null,
    };
  }

  const farmGroupPromise = options.farmGroupId
    ? supabase
        .from("farm_groups")
        .select("id,group_name,group_contact_name,contact_title,phone,addr1,addr2,city,st,zip,is_active")
        .eq("id", options.farmGroupId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const farmPromise = options.farmId
    ? supabase
        .from("farms")
        .select("id,farm_group_id,farm_code,farm_name,addr,city,state,zip,map_url,is_active")
        .eq("id", options.farmId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const barnPromise = options.barnId
    ? supabase
        .from("barns")
        .select("id,farm_id,barn_code,sort_code,length_ft,width_ft,sqft,stdroc_head,is_active")
        .eq("id", options.barnId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [farmGroupResult, farmResult, barnResult] = await Promise.all([farmGroupPromise, farmPromise, barnPromise]);

  const farmGroupRow = (farmGroupResult.data ?? null) as FarmGroupRow | null;
  const farmRow = (farmResult.data ?? null) as FarmRow | null;
  const barnRow = (barnResult.data ?? null) as BarnRow | null;

  return {
    farmGroup: farmGroupRow
      ? {
          id: farmGroupRow.id,
          groupName: normalize(farmGroupRow.group_name),
          contactName: normalize(farmGroupRow.group_contact_name),
          contactTitle: normalize(farmGroupRow.contact_title),
          phone: normalize(farmGroupRow.phone),
          address1: normalize(farmGroupRow.addr1),
          address2: normalize(farmGroupRow.addr2),
          city: normalize(farmGroupRow.city),
          state: normalize(farmGroupRow.st),
          postalCode: normalize(farmGroupRow.zip),
          isActive: farmGroupRow.is_active !== false,
        }
      : null,
    farm: farmRow
      ? {
          id: farmRow.id,
          farmGroupId: farmRow.farm_group_id,
          farmCode: normalize(farmRow.farm_code),
          farmName: normalize(farmRow.farm_name),
          address: normalize(farmRow.addr),
          city: normalize(farmRow.city),
          state: normalize(farmRow.state),
          postalCode: normalize(farmRow.zip),
          mapUrl: normalize(farmRow.map_url),
          isActive: farmRow.is_active !== false,
        }
      : null,
    barn: barnRow
      ? {
          id: barnRow.id,
          farmId: barnRow.farm_id,
          barnCode: normalize(barnRow.barn_code),
          sortCode: normalize(barnRow.sort_code),
          lengthFt: formatNumeric(barnRow.length_ft),
          widthFt: formatNumeric(barnRow.width_ft),
          sqft: formatNumeric(barnRow.sqft),
          standardHead: normalize(barnRow.stdroc_head),
          isActive: barnRow.is_active !== false,
        }
      : null,
  };
}
