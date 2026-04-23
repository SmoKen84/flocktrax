import { NextResponse } from "next/server";

import { getAdminData } from "@/lib/admin-data";

export async function GET() {
  const data = await getAdminData();

  return NextResponse.json({
    farmGroups: data.farmGroups,
    farms: data.farms,
    placements: data.activePlacements,
  });
}
