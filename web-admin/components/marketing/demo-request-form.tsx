"use client";
import { useState, useEffect, type FormEvent } from 'react';

export function DemoRequestForm() {
 const [open, setOpen] = useState(false);
 const [status, setStatus] = useState('');
 const [pending, setPending] = useState(false);
 const [verificationSentTo,setVerificationSentTo]=useState('');
 const [fields,setFields]=useState<Record<string,string>>({name:'',email:'',company:'',phone:'',role:''});
 const [proof,setProof]=useState<{email:string;token:string;expires:number}|null>(null);
 useEffect(()=>{
  try {const draft=sessionStorage.getItem('flocktrax-demo-draft');if(draft){setFields(JSON.parse(draft));setOpen(true);}}catch{}
  const sync=()=>{try{const value=JSON.parse(localStorage.getItem('flocktrax-demo-verification')||'null');setProof(value?.expires>Date.now()?value:null);}catch{setProof(null);}};
  sync();window.addEventListener('storage',sync);window.addEventListener('focus',sync);
  return ()=>{window.removeEventListener('storage',sync);window.removeEventListener('focus',sync);};
 },[]);
 const verified=!!proof && proof.email===fields.email.trim().toLowerCase() && proof.expires>Date.now();
 function change(name:string,value:string){const next={...fields,[name]:value};setFields(next);sessionStorage.setItem('flocktrax-demo-draft',JSON.stringify(next));setStatus('');}

 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));

  setPending(true); setStatus('');
  try {
   const response = await fetch('/api/demo-request', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...values,...(verified?{verificationToken:proof?.token}:{})})});
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || 'Unable to send your request. Please try again.');
   if(verified){setVerificationSentTo('');setStatus(result.message);form.reset();setFields({name:'',email:'',company:'',phone:'',role:''});setProof(null);sessionStorage.removeItem('flocktrax-demo-draft');localStorage.removeItem('flocktrax-demo-verification');}
   else {setVerificationSentTo(String(values.email).trim().toLowerCase());setStatus('Verification email sent to '+values.email+'. Check your inbox and junk folder, verify your email, then return here to send your demo request. Your entries have been kept.');}
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to send your request. Please try again.'); }
  finally { setPending(false); }
 }
 return <div className="demo-request"><button type="button" className="button gold" aria-expanded={open} aria-controls="demo-request-form" onClick={()=>setOpen(!open)}>Request Demo Access <span aria-hidden="true">→</span></button>
 {open && <form id="demo-request-form" className="demo-request-form" onSubmit={submit}>
 <p>Tell us a little about yourself so we can arrange your demo access.</p>
 <div className="demo-request-fields">
 <label>Full name<input name="name" value={fields.name} onChange={event=>change("name",event.target.value)} autoComplete="name" required maxLength={200}/></label>
 <label>Email address<input name="email" value={fields.email} onChange={event=>change("email",event.target.value)} type="email" autoComplete="email" required maxLength={254}/></label>
 <label>Company / farm<input name="company" value={fields.company} onChange={event=>change("company",event.target.value)} autoComplete="organization" maxLength={200}/></label>
 <label>Phone (optional)<input name="phone" value={fields.phone} onChange={event=>change("phone",event.target.value)} type="tel" autoComplete="tel" maxLength={50}/></label>
 <label>Your role<select name="role" required value={fields.role} onChange={event=>change("role",event.target.value)}><option value="" disabled>Select your role</option><option>Grower / Farm Manager</option><option>Integrator Manager</option><option>Flock Supervisor</option><option>Other</option></select></label>
 </div>
 <label className="demo-request-trap" aria-hidden="true">Leave this blank<input name="website" tabIndex={-1} autoComplete="off"/></label>
 <p className="demo-request-privacy">Your contact information is sent privately to Ken at FlockTrax for demo access and follow-up. It is not shown to other evaluators.</p>
 <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}><button className="button gold" disabled={pending} type="submit">{pending?'Sending…':verified?'Send Demo Request':'Send Verification Email'}</button>
 {!verified && verificationSentTo===fields.email.trim().toLowerCase() && verificationSentTo && <strong role="status" style={{color:"#000080",fontWeight:700}}>Verification Sent, waiting for reply...</strong>}
 </div>
 {verified && <p role="status">Email verified. You can now send your demo request.</p>}
 {status && <p role="status">{status}</p>}
 </form>}
 </div>;
}
