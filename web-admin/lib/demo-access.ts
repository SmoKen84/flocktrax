import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_OWNER_ID, DEMO_PROJECT_REF } from "@/lib/demo-access-policy";

export function demoAdmin() {
  if (process.env.FLOCKTRAX_ENVIRONMENT_NAME !== "demo" ||
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid").hostname !== DEMO_PROJECT_REF + ".supabase.co")
    throw new Error("Evaluator access is available only in the isolated demo.");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Demo admin connection is unavailable.");
  return admin;
}
export async function requireDemoOwner() {
  const admin = demoAdmin();
  const session = await createSupabaseServerClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  if (!user || user.id !== DEMO_OWNER_ID) throw new Error("Only the demo owner can manage evaluator access.");
  return admin;
}
export function hashSetupToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function issueDemoSetupLink(userId: string, local: boolean) {
  const admin = await requireDemoOwner();
  const { data: evaluator, error } = await admin.from("demo_evaluators").select("expires_at,disabled_at").eq("user_id",userId).single();
  if (error || !evaluator || evaluator.disabled_at || Date.parse(evaluator.expires_at)<=Date.now())
    throw new Error("Enable and extend this evaluator before issuing a setup link.");
  const token = randomBytes(32).toString("base64url");
  const revoke = await admin.from("demo_access_links").delete().eq("user_id",userId);
  if (revoke.error) throw new Error("Could not replace the previous link.");
  const expires = new Date(Math.min(Date.now()+24*60*60*1000,Date.parse(evaluator.expires_at))).toISOString();
  const result = await admin.from("demo_access_links").insert({user_id:userId,token_hash:hashSetupToken(token),expires_at:expires});
  if(result.error) throw new Error("Could not create the setup link.");
  // Token in fragment avoids HTTP logs and referrer headers; GET never consumes it.
  const origin = local ? "http://localhost:3005" : "https://flocktrax-demo.vercel.app";
  return { link: origin + "/demo-setup#token=" + token, linkExpires: expires };
}
