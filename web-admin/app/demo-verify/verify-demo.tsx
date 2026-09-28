"use client";
import {useEffect,useRef,useState} from "react";
export function VerifyDemo(){
 const started=useRef(false);
 const [message,setMessage]=useState("Verifying your email and returning to your request…");
 const [failed,setFailed]=useState(false);
 async function confirm(){
  setFailed(false);
  setMessage("Verifying your email and returning to your request…");
  try{
   const token=new URLSearchParams(window.location.hash.slice(1)).get("token");
   if(!token)throw new Error("Open the complete verification link from your email.");
   const response=await fetch("/api/demo-verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Unable to verify your email. Please try again.");
   const {draft,...proof}=data;
   localStorage.setItem("flocktrax-demo-verification",JSON.stringify(proof));
   // Restore the emailed request even when the mail app opens a different browser.
   let existing=null;
   try{existing=JSON.parse(sessionStorage.getItem("flocktrax-demo-draft")||"null");}catch{}
   if(!existing || existing.email?.trim().toLowerCase()!==data.email){
    sessionStorage.setItem("flocktrax-demo-draft",JSON.stringify(draft));
   }
   window.location.replace("/#contact");
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to verify. Please try again.");setFailed(true);}
 }
 useEffect(()=>{if(started.current)return;started.current=true;void confirm();},[]);
 return <><p role="status">{message}</p>{failed && <><button type="button" onClick={confirm}>Retry verification</button><p><a href="/#contact">Return to demo request</a></p></>}</>;
}
