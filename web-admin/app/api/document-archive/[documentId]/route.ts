import { NextResponse } from "next/server";

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

type DocumentLookupRow = {
  storage_bucket: string;
  storage_path: string;
};

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const params = await context.params;
  const documentId = params.documentId?.trim();
  if (!documentId) {
    return NextResponse.json({ error: "Document id is required." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("document_archives")
    .select("storage_bucket,storage_path")
    .eq("id", documentId)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = (data?.[0] ?? null) as DocumentLookupRow | null;
  if (!row) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const signedUrlResult = await admin.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 60);

  if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
    return NextResponse.json(
      { error: signedUrlResult.error?.message ?? "Could not open archived document." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signedUrlResult.data.signedUrl);
}
