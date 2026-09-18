"use server";
import { demoAdmin, hashSetupToken } from "@/lib/demo-access";
export async function completeDemoSetup(_previous:{error?:string;alias?:string},form:FormData):Promise<{error?:string;alias?:string}> {
 try {
  const token=String(form.get("token")||"");
  const password=String(form.get("password")||"");
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("This setup link is invalid. Ask the demo owner for a replacement.");
  if(password.length<12 || password.length>128 || password!==String(form.get("confirm")||""))
    throw new Error("Use a matching password of 12–128 characters.");
  const admin=demoAdmin();
  const claim=await admin.rpc("claim_demo_access_link",{p_hash:hashSetupToken(token)});
  if(claim.error||!claim.data) throw new Error("This setup link expired or was already used. Ask the demo owner for a replacement.");
  const userId=String(claim.data);
  const update=await admin.auth.admin.updateUserById(userId,{password});
  if(update.error) throw new Error("Password setup failed. Ask the owner for a new link.");
  const accepted=await admin.from("demo_evaluators").update({accepted_at:new Date().toISOString()}).eq("user_id",userId).select("alias").single();
  if(accepted.error) throw new Error("Password saved, but setup tracking failed. Contact the demo owner.");
  await admin.from("demo_access_events").insert({user_id:userId,kind:"setup",client:"web"});
  return {alias:accepted.data.alias};
 } catch(error) {return {error:error instanceof Error?error.message:"Setup failed."};}
}
