import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const settingsResult = await admin
    .schema("platform")
    .from("settings")
    .select("name,value,is_active")
    .limit(100);

  if (settingsResult.error) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const scheduleMinutes = deriveScheduleMinutes(settingsResult.data ?? []);
  const stalePendingCutoff = new Date(Date.now() - scheduleMinutes * 60 * 1000).toISOString();

  const [attentionResult, stalePendingResult] = await Promise.all([
    admin
      .schema("platform")
      .from("sync_outbox")
      .select("*", { count: "exact", head: true })
      .in("status", ["in_progress", "failed", "rejected"]),
    admin
      .schema("platform")
      .from("sync_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("requested_at", stalePendingCutoff),
  ]);

  if (attentionResult.error || stalePendingResult.error) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const count = (attentionResult.count ?? 0) + (stalePendingResult.count ?? 0);

  return NextResponse.json(
    { count },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

function deriveScheduleMinutes(rows: Array<{ name?: string | null; value?: unknown; is_active?: boolean | null }>) {
  for (const row of rows) {
    if (row.is_active === false) {
      continue;
    }

    const name = String(row.name ?? "").trim().toLowerCase();
    if (!["googleapis_outbox_schedule_minutes", "googleapis_worker_schedule_minutes", "sync_worker_schedule_minutes"].includes(name)) {
      continue;
    }

    const parsed = Number.parseInt(String(row.value ?? ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 15;
}
