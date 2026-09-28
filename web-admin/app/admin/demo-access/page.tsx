import { requireDemoOwner } from "@/lib/demo-access";
import { AccessForm } from "./access-form";
import { DemoUserSelector } from "./user-selector";

export default async function DemoAccessPage({searchParams}:{searchParams?:Promise<{user?:string}>}) {
 const params=await searchParams;
 const admin=await requireDemoOwner();
 const [people,farms]=await Promise.all([
  admin.from("demo_evaluators").select("*").order("created_at",{ascending:false}),
  admin.from("farms").select("id,farm_name").order("farm_name"),
 ]);
 if(people.error||farms.error) return <section className="panel card"><h1>Demo Evaluator Access</h1><p>Evaluator access is not ready. Apply the demo evaluator-access migration before creating accounts.</p></section>;
 const users=people.data??[];
 const selected=users.find(user=>user.user_id===params?.user)??users[0];
 const events=selected ? await admin.from("demo_access_events").select("user_id,kind,path,client,created_at").eq("user_id",selected.user_id).order("created_at",{ascending:false}).limit(2000) : {data:[],error:null};
 return <div className="demo-access-page">
  <section className="panel card"><h1>Demo Evaluator Access</h1>
   <DemoUserSelector selected={selected?.user_id??""} users={users.map(person=>({id:person.user_id,name:person.contact_name??"",company:person.company??"",email:person.contact_email??"",alias:person.alias,expiresAt:person.expires_at}))}/>
  </section>
  {(selected?[selected]:[]).map(person=>{
    const activity=events.data??[];
    const status=person.disabled_at?"Disabled":Date.parse(person.expires_at)<=Date.now()?"Expired":person.accepted_at?"Active":"Awaiting setup";
    return <section className="panel card" key={person.user_id}>
     <h2>{person.alias} â€” {status}</h2>
     <p>{person.contact_name} Â· {person.company} Â· {person.contact_email}</p>
     <p>{person.role_code} Â· Access expires {person.expires_at}</p>
     <p>Setup completed: {person.accepted_at??"Not yet"} Â· Last recorded login: {activity.find(e=>e.kind==="login")?.created_at??"None"}</p>
     <p>{activity.filter(e=>e.kind==="login").length} logins Â· {activity.filter(e=>e.kind==="page_view").length} page views within this user’s latest 2,000 events. Page views show navigation, not proof that a record was edited.</p>
     {events.error && <p role="alert">Activity could not be loaded. Try refreshing this page.</p>}
     <details><summary>Recent activity</summary><ul>{activity.slice(0,30).map((e,i)=><li key={i}>{e.created_at} Â· {e.client} Â· {e.kind} {e.path}</li>)}</ul></details>
     <AccessForm userId={person.user_id} phone={person.contact_phone ?? ""}/>
    </section>;
  })}
  <section className="panel card"><details><summary>Create Demo User Access</summary>
   <p>Owner-only contact register. Evaluators see aliases; no invitation email is sent. All evaluators share demo records, so notes they enter may be visible to others.</p>
   <AccessForm farms={farms.data??[]}/>
  </details></section>
 </div>;
}
