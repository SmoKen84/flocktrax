import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function resolveAppOrigin(request: Request) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  const destination = new URL(
    "/login?notice=Signed+out.+Sign+in+with+another+user+to+switch+sessions.",
    resolveAppOrigin(request),
  );

  return NextResponse.redirect(destination, { status: 303 });
}
