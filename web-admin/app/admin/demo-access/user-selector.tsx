"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import styles from "./user-selector.module.css";

type DemoUser={id:string;name:string;company:string;email:string;alias:string;expiresAt:string};
export function DemoUserSelector({users,selected}:{users:DemoUser[];selected:string}) {
 const router=useRouter();
 const [pending,startTransition]=useTransition();
 const [name,setName]=useState("");
 const [company,setCompany]=useState("");
 const [sort,setSort]=useState("name");
 const [descending,setDescending]=useState(false);
 const visible=useMemo(()=>users.filter(user=>
  user.name.toLowerCase().includes(name.trim().toLowerCase()) &&
  user.company.toLowerCase().includes(company.trim().toLowerCase())
 ).sort((a,b)=>{
  const compared=sort==="expires" ? (Date.parse(a.expiresAt)||0)-(Date.parse(b.expiresAt)||0)
   : (sort==="company"?a.company:a.name).localeCompare(sort==="company"?b.company:b.name,undefined,{sensitivity:"base",numeric:true});
  return (compared || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))*(descending?-1:1);
 }),[users,name,company,sort,descending]);
 const selectedVisible=visible.some(user=>user.id===selected);
 const date=(value:string)=>{const parsed=new Date(value);return Number.isNaN(parsed.getTime())?"Not set":parsed.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});};
 return <div aria-busy={pending} className={styles.selector}>
  <div className={styles.filters}>
   <label>Filter by name<input type="search" value={name} placeholder="Search names" onChange={event=>setName(event.target.value)}/></label>
   <label>Filter by company<input type="search" value={company} placeholder="Search companies" onChange={event=>setCompany(event.target.value)}/></label>
   <label>Sort by<select value={sort} onChange={event=>setSort(event.target.value)}><option value="name">Name</option><option value="company">Company</option><option value="expires">Expiration date</option></select></label>
   <label>Order<select value={descending?"desc":"asc"} onChange={event=>setDescending(event.target.value==="desc")}><option value="asc">{sort==="expires"?"Soonest first":"A to Z"}</option><option value="desc">{sort==="expires"?"Latest first":"Z to A"}</option></select></label>
  </div>
  <div className={styles.heading}><label htmlFor="demo-user-selector">Demo users ({visible.length} of {users.length})</label>{(name||company) && <button type="button" onClick={()=>{setName("");setCompany("");}}>Clear filters</button>}</div>
  <select id="demo-user-selector" className={styles.list} size={6} value={selectedVisible?selected:""} disabled={pending || !visible.length}
   aria-describedby="demo-user-help"
   onChange={event=>{const id=event.target.value;startTransition(()=>router.replace(`/admin/demo-access?user=${encodeURIComponent(id)}`,{scroll:false}));}}>
   {!visible.length && <option value="">{users.length?"No users match these filters":"No demo users yet"}</option>}
   {visible.map(user=><option key={user.id} value={user.id}>{user.name||user.alias} — {user.company||"No company"} · Expires {date(user.expiresAt)} · {user.email}</option>)}
  </select>
  <p id="demo-user-help" role="status">{pending?"Loading user…":!selectedVisible && selected?"The selected user is outside these filters. Their details remain below until you select another user.":"Select a user to view their access and activity."}</p>
 </div>;
}
