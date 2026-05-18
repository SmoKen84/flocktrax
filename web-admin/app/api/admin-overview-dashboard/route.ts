import { NextResponse } from "next/server";

import { getAdminData } from "@/lib/admin-data";
import { applyPlacementEditorAccess } from "@/lib/placement-editor-access";

export async function GET() {
  const data = await getAdminData();
  const placements = await applyPlacementEditorAccess(data.activePlacements);

  return NextResponse.json({
    breedOptions: data.breedOptions,
    farmGroups: data.farmGroups,
    farms: data.farms,
    placements,
  });
}
