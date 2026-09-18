"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireDemoOwner, issueDemoSetupLink } from "@/lib/demo-access";
import { demoLoginEmail } from "@/lib/demo-access-policy";

export type AccessResult = { error?: string; notice?: string; link?: string; linkExpires?: string };
export async function manageDemoAccess(_previous: AccessResult, form: FormData): Promise<AccessResult> {
  try {
    const admin = await requireDemoOwner();
    const action = String(form.get("action") || "create");
    let userId = String(form.get("userId") || "");
    const phone = String(form.get("phone") || "").trim();
    if (phone.length > 50) throw new Error("Phone number must be 50 characters or fewer.");
    const local = form.get("destination") === "local";
    if (action === "create") {
      const name = String(form.get("name") || "").trim();
      const email = String(form.get("email") || "").trim();
      const company = String(form.get("company") || "").trim();
      const role = String(form.get("role") || "");
      const farmId = String(form.get("farmId") || "");
      const days = Number(form.get("days"));
      if (!name || name.length>200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !["integrator_manager","farm_manager","flock_supervisor"].includes(role) || !Number.isInteger(days) || days<1 || days>365)
        throw new Error("Enter contact details, a role, farm and 1–365 access days.");
      const [farm, roleRow] = await Promise.all([
        role === "integrator_manager" ? Promise.resolve({error:null}) : admin.from("farms").select("id").eq("id",farmId).single(),
        admin.from("roles").select("id,code").eq("code",role).single(),
      ]);
      if(farm.error || roleRow.error) throw new Error("Select an available demo farm and role.");
      const alias = "evaluator-" + randomBytes(6).toString("hex");
      const created = await admin.auth.admin.createUser({
        email:demoLoginEmail(alias),password:randomBytes(48).toString("base64url"),email_confirm:true,
        user_metadata:{full_name:alias,name:alias},
        app_metadata:{demo_evaluator:true},
      });
      if(created.error || !created.data.user) throw new Error("Could not create evaluator account.");
      userId=created.data.user.id;
      try {
        const registry=await admin.from("demo_evaluators").insert({
          user_id:userId,alias,contact_name:name,contact_email:email,contact_phone:phone,company,role_code:role,farm_id:role === "integrator_manager" ? null : farmId,
          expires_at:new Date(Date.now()+days*86400000).toISOString(),
        });
        if(registry.error) throw new Error("Could not save private evaluator details.");
        const roleWrite=await admin.from("user_roles").upsert({user_id:userId,role_id:roleRow.data.id,role},{onConflict:"user_id,role_id"});
        if(roleWrite.error) {
          console.error("Demo evaluator role assignment failed", {code:roleWrite.error.code,message:roleWrite.error.message});
          throw new Error("Could not assign evaluator role. No evaluator access was created. Please retry or contact the administrator.");
        }
        if (role !== "integrator_manager") {
        const membership=await admin.from("farm_memberships").upsert({
          user_id:userId,farm_id:farmId,role_id:roleRow.data.id,is_active:true,
        },{onConflict:"user_id,farm_id"});
        if(membership.error) throw new Error("Could not assign demo farm access.");
        }
      } catch(error) {
        const cleanup=await admin.auth.admin.deleteUser(userId);
        if(cleanup.error) throw new Error("Provisioning failed; an incomplete account needs owner review.");
        throw error;
      }
    } else {
      const {data:existing,error}=await admin.from("demo_evaluators").select("user_id,farm_id,role_code").eq("user_id",userId).single();
      if(error || !existing) throw new Error("Evaluator not found.");
      if(action==="phone") {
        const saved=await admin.from("demo_evaluators").update({contact_phone:phone}).eq("user_id",userId);
        if(saved.error) throw new Error("Could not save contact phone.");
        revalidatePath("/admin/demo-access");
        return {notice:"Contact phone saved."};
      }
      if(action==="disable") {
        const result=await admin.from("demo_evaluators").update({disabled_at:new Date().toISOString()}).eq("user_id",userId);
        if(result.error) throw new Error("Could not disable evaluator.");
        await admin.from("demo_access_links").delete().eq("user_id",userId);
        // The live database gate blocks existing sessions as well as subsequent sign-ins.
        const banned=await admin.auth.admin.updateUserById(userId,{ban_duration:"876000h"});
        if(banned.error) throw new Error("Access disabled, but Auth ban failed; owner should retry.");
        revalidatePath("/admin/demo-access");
        return {notice:"Evaluator access disabled."};
      }
      if(action==="extend") {
        const days=Number(form.get("days"));
        if(!Number.isInteger(days)||days<1||days>365) throw new Error("Choose 1–365 days.");
        const unban=await admin.auth.admin.updateUserById(userId,{ban_duration:"none"});
        if(unban.error) throw new Error("Could not re-enable Auth account.");
        const result=await admin.from("demo_evaluators").update({disabled_at:null,expires_at:new Date(Date.now()+days*86400000).toISOString()}).eq("user_id",userId);
        if(result.error) throw new Error("Could not extend access.");
        if (existing.role_code !== "integrator_manager") {
        const roleRow=await admin.from("roles").select("id").eq("code",existing.role_code).single();
        if(roleRow.error) throw new Error("Access extended, but the farm role needs owner review.");
        const membership=await admin.from("farm_memberships").upsert({
          user_id:userId,farm_id:existing.farm_id,role_id:roleRow.data.id,is_active:true,
        },{onConflict:"user_id,farm_id"});
        if(membership.error) throw new Error("Access extended, but farm membership restoration needs owner review.");
        }
        revalidatePath("/admin/demo-access");
        return {notice:"Access enabled through the new expiration date."};
      }
      if(action!=="link") throw new Error("Unknown action.");
    }
    revalidatePath("/admin/demo-access");
    const link=await issueDemoSetupLink(userId,local);
    return {...link,notice:"Copy this single-use setup link and send it yourself. No email was sent. Replacing a link invalidates the previous one."};
  } catch(error) { return {error:error instanceof Error ? error.message : "Unable to manage evaluator."}; }
}
