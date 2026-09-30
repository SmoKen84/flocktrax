import type { AccessMembership, FarmGroupRecord, FarmRecord } from "@/lib/types";

export function MembershipHierarchy({memberships,groups,farms}:{memberships:AccessMembership[];groups:FarmGroupRecord[];farms:FarmRecord[]}) {
 const assignedGroups=new Set(memberships.filter(m=>m.scopeType==="farm_group").map(m=>m.scopeId));
 const assignedFarms=new Set(memberships.filter(m=>m.scopeType==="farm").map(m=>m.scopeId));
 const groupIds=new Set([...assignedGroups,...farms.filter(f=>assignedFarms.has(f.id)).map(f=>f.farmGroupId)]);
 const nested={margin:"8px 0 12px 8px",paddingLeft:22,borderLeft:"2px solid #b9c8c0",listStyle:"none" as const};
 return <section className="access-validation-block" aria-labelledby="assigned-memberships" style={{marginBottom:14}}>
  <h3 id="assigned-memberships">Assigned Memberships</h3>
  {!memberships.length ? <p>No memberships are assigned to this account.</p> : <>
   <p style={{margin:0}}>Direct assignments are marked below. A farm-group assignment includes its farms; a farm assignment does not include other farms in the group. Actions remain subject to the account role permissions.</p>
   <ul style={{listStyle:"none",padding:0,margin:0}}>
    {memberships.filter(m=>m.scopeType==="integrator_group").map(m=><li key={m.id}><strong>Integrator group: {m.scopeLabel}</strong> — Direct assignment</li>)}
    {[...groupIds].map(id=>{
     const direct=assignedGroups.has(id);
     const group=groups.find(g=>g.id===id);
     const children=farms.filter(f=>f.farmGroupId===id && (direct||assignedFarms.has(f.id))).sort((a,b)=>a.farmName.localeCompare(b.farmName));
     const label=group?.groupName || memberships.find(m=>m.scopeType==="farm_group"&&m.scopeId===id)?.scopeLabel || children[0]?.farmGroupName || "Farm group";
     return <li key={id}><strong>Farm group: {label}</strong> — {direct?"Direct assignment":"Parent group (context only)"}
      <ul style={nested}>{children.map(f=><li key={f.id} style={{padding:"5px 0"}}><strong>Farm: {f.farmName}</strong> — {assignedFarms.has(f.id)?"Direct assignment":"Included through farm group"}</li>)}
       {!children.length && <li>No farm details available for this group.</li>}
      </ul>
     </li>;
    })}
    {memberships.filter(m=>m.scopeType==="farm"&&!farms.some(f=>f.id===m.scopeId)).map(m=><li key={m.id}><strong>Farm: {m.scopeLabel}</strong> — Direct assignment (parent group unavailable)</li>)}
   </ul>
  </>}
 </section>;
}
