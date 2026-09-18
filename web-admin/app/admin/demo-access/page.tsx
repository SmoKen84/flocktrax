import { requireDemoOwner } from "@/lib/demo-access";
import { AccessForm } from "./access-form";

export default async function DemoAccessPage() {
 const admin=await requireDemoOwner();
 const [people,farms,events]=await Promise.all([
  admin.from("demo_evaluators").select("*").order("created_at",{ascending:false}),
  admin.from("farms").select("id,farm_name").order("farm_name"),
  admin.from("demo_access_events").select("user_id,kind,path,client,created_at").order("created_at",{ascending:false}).limit(2000),
 ]);
 if(people.error||farms.error||events.error) return <section className="panel card"><h1>Demo Evaluator Access</h1><p>Evaluator access is not ready. Apply the demo evaluator-access migration before creating accounts.</p></section>;
 return <div className="demo-access-page">
  <section className="panel card"><h1>Create Demo User Access</h1>
   <p>Owner-only contact register. Evaluators see aliases; no invitation email is sent. All evaluators share demo records, so notes they enter may be visible to others.</p>
   <AccessForm farms={farms.data??[]}/>
  </section>
  {(people.data??[]).map(person=>{
    const activity=(events.data??[]).filter(e=>e.user_id===person.user_id);
    const status=person.disabled_at?"Disabled":Date.parse(person.expires_at)<=Date.now()?"Expired":person.accepted_at?"Active":"Awaiting setup";
    return <section className="panel card" key={person.user_id}>
     <h2>{person.alias} — {status}</h2>
     <p>{person.contact_name} · {person.company} · {person.contact_email}</p>
     <p>{person.role_code} · Access expires {person.expires_at}</p>
     <p>Setup completed: {person.accepted_at??"Not yet"} · Last recorded login: {activity.find(e=>e.kind==="login")?.created_at??"None"}</p>
     <p>{activity.filter(e=>e.kind==="login").length} logins · {activity.filter(e=>e.kind==="page_view").length} page views within the latest 2,000 events. Page views show navigation, not proof that a record was edited.</p>
     <details><summary>Recent activity</summary><ul>{activity.slice(0,30).map((e,i)=><li key={i}>{e.created_at} · {e.client} · {e.kind} {e.path}</li>)}</ul></details>
     <AccessForm userId={person.user_id} phone={person.contact_phone ?? ""}/>
    </section>;
  })}
 </div>;
}
