import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const [attentionResult, pendingResult] = await Promise.all([
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
      ,
  ]);

  if (attentionResult.error || pendingResult.error) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const count = (attentionResult.count ?? 0) + (pendingResult.count ?? 0);

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
