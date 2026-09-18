"use client";

import { useActionState, useEffect, useState } from "react";

import { manageDemoAccess, type AccessResult } from "./actions";



export function AccessForm({userId,phone="",farms=[]}:{userId?:string;phone?:string;farms?:Array<{id:string;farm_name:string|null}>}) {

 const [state,action,pending]=useActionState<AccessResult,FormData>(manageDemoAccess,{});

 const [role,setRole]=useState("farm_manager");

 const [copied,setCopied]=useState(false);

 useEffect(()=>setCopied(false),[state.link]);

 return <form action={action} className="demo-access-form">

  {userId ? <input type="hidden" name="userId" value={userId}/> : <>

   <label>Private contact name<input required name="name" maxLength={200}/></label>

   <label>Private contact email<input required name="email" type="email"/></label>

   <label>Company<input name="company" maxLength={200}/></label>

   <label>Role<select name="role" value={role} onChange={event=>setRole(event.target.value)}><option value="integrator_manager">Integrator Manager - all farm groups</option><option value="farm_manager">Farm Manager</option><option value="flock_supervisor">Flock Supervisor</option></select></label>

   {role === "integrator_manager" ? <p>Access to all current and future demo farm groups, including creating groups, farms and barns.</p> : <label>Demo farm<select name="farmId" required>{farms.map(f=><option key={f.id} value={f.id}>{f.farm_name}</option>)}</select></label>}

  </>}

  <label>Private contact phone (optional)<input name="phone" type="tel" maxLength={50} defaultValue={phone}/></label>

  <label>Access days from today<input name="days" type="number" min={1} max={365} defaultValue={30}/></label>

  <label>Setup link destination<select name="destination"><option value="hosted">Hosted demo - for evaluators</option><option value="local">Localhost:3005 - testing on this PC</option></select></label>

  <div>{userId ? <>

   <button disabled={pending} className="button-secondary" name="action" value="phone">Save phone</button>{" "}

   <button disabled={pending} className="button-secondary" name="action" value="link">New setup link</button>{" "}

   <button disabled={pending} className="button-secondary" name="action" value="extend">Enable / extend</button>{" "}

   <button disabled={pending} className="button-secondary" name="action" value="disable">Disable access</button>

  </> : <button disabled={pending} className="button" name="action" value="create">Create evaluator access</button>}</div>

  {state.error && <p className="login-banner login-banner-error" role="alert">{state.error}</p>}

  {state.notice && <p className="login-banner login-banner-notice" role="status">{state.notice}</p>}

  {state.link && <div>

    <label>Private setup link<input readOnly value={state.link} onFocus={e=>e.target.select()}/></label>

    <button type="button" className="button-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(state.link!);setCopied(true);}catch{setCopied(false);}}}>{copied?"Copied":"Copy setup link"}</button>

    <p>Link expires: {state.linkExpires}. Copy now; the complete link is not saved in the register.</p>

  </div>}

 </form>;

}
