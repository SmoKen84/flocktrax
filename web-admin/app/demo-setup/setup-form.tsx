"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { completeDemoSetup } from "./actions";
export function DemoSetupForm() {
 const [token,setToken]=useState("");
 const captured=useRef(false);
 const [state,action,pending]=useActionState(completeDemoSetup,{});
 useEffect(()=>{if(captured.current)return;captured.current=true;setToken(new URLSearchParams(location.hash.slice(1)).get("token")||"");history.replaceState(null,"",location.pathname);},[]);
 if(state.alias) return <div><h2>Your demo login is ready</h2><p>Username: <strong>{state.alias}</strong></p><p>Save this username with the password you just chose.</p><Link className="button" href="/login">Sign in to demo</Link></div>;
 return <form action={action} className="demo-access-form">
  <input type="hidden" name="token" value={token}/>
  <label>New demo password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
  <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
  <button disabled={pending||!token} className="button">Set demo password</button>
  {!token&&<p>Open the complete setup link provided by the demo owner.</p>}
  {state.error&&<p role="alert">{state.error}</p>}
 </form>;
}
