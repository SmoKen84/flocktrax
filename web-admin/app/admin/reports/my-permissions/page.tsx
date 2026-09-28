import { MembershipHierarchy } from "./membership-hierarchy";
import { redirect } from "next/navigation";
import { buildAccessValidationSummary, getUserAccessBundle } from "@/lib/access-control";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export const metadata = {title:"My Permissions | FlockTrax"};

export default async function MyPermissionsPage() {
 const client=await createSupabaseServerClient();
 if(!client) redirect("/login");
 const {data:auth,error}=await client.auth.getUser();
 if(error || !auth.user) redirect("/login");
 const bundle=await getUserAccessBundle();
 const user=bundle.users.find(candidate=>candidate.id===auth.user.id);
 const assigned=user ? (user.assignedRoles.length ? user.assignedRoles : [user.role]) : [];
 if(!user || !assigned.length || assigned.some(key=>!bundle.roles.some(role=>role.key===key))) return <section className="panel card"><h1>My Permissions</h1><p>Your permissions could not be verified. Please contact your administrator.</p></section>;
 const summary=buildAccessValidationSummary(user,bundle.roles);

 return <section className="panel card">
  <h1>My Permissions</h1>
  <p>Within your assigned access, based on your current role permissions.</p>
  <MembershipHierarchy memberships={user.memberships} groups={bundle.farmGroups} farms={bundle.farms}/>
  <div className="access-validation-grid">
   <section className="access-validation-block" aria-labelledby="permissions-dos">
    <h3 id="permissions-dos">Dos</h3>
    <ul className="access-validation-list">{summary.can.length ? summary.can.map(item=><li key={item}>{item}</li>) : <li>No allowed actions are listed.</li>}</ul>
   </section>
   <section className="access-validation-block access-validation-block-muted" aria-labelledby="permissions-cant-dos">
    <h3 id="permissions-cant-dos">Can’t Dos</h3>
    <ul className="access-validation-list">{summary.cannot.length ? summary.cannot.map(item=><li key={item}>{item}</li>) : <li>No blocked actions are listed in the permission catalog.</li>}</ul>
   </section>
  </div>
 </section>;
}
