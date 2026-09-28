import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { buildDemoAccessEmail } from "@/lib/email/demo-access-email";
export type SignupContact={name:string;email:string;company:string;phone:string;role:"farm_manager"|"integrator_manager"};
function secret(){const value=process.env.DEMO_SIGNUP_SECRET;if(!value || value.length<64)throw new Error("Demo signup is not configured.");return value;}
function database(){const url=process.env.DEMO_SIGNUP_SUPABASE_URL;const key=process.env.DEMO_SIGNUP_SERVICE_KEY;
 if(!url || new URL(url).hostname!=="srkgobayrzidytmvoago.supabase.co" || !key)throw new Error("Isolated demo connection is unavailable.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function transport(){const {SMTP_HOST:host,SMTP_USER:user,SMTP_PASS:pass,SMTP_FROM:from}=process.env;const port=Number(process.env.SMTP_PORT);
 if(!host||!user||!pass||!from||!port)throw new Error("Email delivery is not configured.");
 return nodemailer.createTransport({host,port,secure:process.env.SMTP_SECURE ? ["true","1","yes","on"].includes(process.env.SMTP_SECURE.toLowerCase()) : port===465,auth:{user,pass},connectionTimeout:10000,socketTimeout:15000});
}
export function encryptSignup(contact:SignupContact, purpose="verify", expires=Date.now()+86400000){const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",createHash("sha256").update(secret()).digest(),iv);const body=Buffer.concat([cipher.update(JSON.stringify({...contact,email:contact.email.toLowerCase(),purpose,expires}),"utf8"),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString("base64url");}
function decryptSignup(token:string, purpose="verify"):SignupContact & {expires:number} {try{if(!/^[A-Za-z0-9_-]{50,3000}$/.test(token))throw new Error();const data=Buffer.from(token,"base64url");const decipher=createDecipheriv("aes-256-gcm",createHash("sha256").update(secret()).digest(),data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));const result=JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString("utf8"));if(result.purpose!==purpose || !Number.isFinite(result.expires) || result.expires<Date.now()||!["farm_manager","integrator_manager"].includes(result.role))throw new Error();return result;}catch{throw new Error("This verification link is invalid or expired. Submit a new demo request.");}}
export async function requestDemoSignup(contact:SignupContact){
 database();const mail=transport();
 const origin=process.env.DEMO_SIGNUP_ORIGIN||"https://flocktrax.com";
 if(new URL(origin).origin!==origin || (process.env.NODE_ENV==="production" && origin!=="https://flocktrax.com"))throw new Error("Demo verification origin is not configured.");
 const link=origin+"/demo-verify#token="+encryptSignup(contact);
 const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
 const html=`<!doctype html><html><body style="font-family:Arial,sans-serif;color:#173f32;line-height:1.6"><p>Hello ${escapeHtml(contact.name)},</p><p>Verify your email address, then return to the form to send your demo request:</p><p><a href="${escapeHtml(link)}" style="color:#173f32;font-weight:bold;text-decoration:underline">Verify your email address</a></p><p>This link expires in 24 hours. If you did not request demo access, ignore this email.</p><p>Verifying your email does not create an account. After verification, click <strong>Send Demo Request</strong> on the form.</p><p>Ken Smotherman<br>FlockTrax</p></body></html>`;
 const receipt=await mail.sendMail({from:process.env.SMTP_FROM,to:contact.email,replyTo:"ken@flocktrax.com",subject:"Verify your FlockTrax demo request",html,text:`Hello ${contact.name},\n\nVerify your email address, then return to the form to send your demo request:\n${link}\n\nThis link expires in 24 hours. If you did not request demo access, ignore this email. Verifying your email does not create an account. After verification, click Send Demo Request on the form.\n\nKen Smotherman\nFlockTrax`});
 if(!receipt.accepted?.length || receipt.rejected?.length)throw new Error("The mail server did not accept the verification email.");
 console.info("Demo verification email accepted",{to:contact.email,messageId:receipt.messageId,response:receipt.response});
}
export function verifyDemoEmail(token:string){
 const contact=decryptSignup(token);
 return {draft:{name:contact.name,email:contact.email,company:contact.company,phone:contact.phone,role:contact.role==="integrator_manager"?"Integrator Manager":"Grower / Farm Manager"},email:contact.email,token:encryptSignup(contact,"verified",contact.expires),expires:contact.expires,message:"Email verified. Return to the request form and click Send Demo Request."};
}
export async function completeDemoSignup(token:string, submitted:SignupContact){
 const verified=decryptSignup(token,"verified");
 if(verified.email!==submitted.email.toLowerCase())throw new Error("Verify the email address entered in the form first.");
 const contact={...submitted,email:verified.email};const admin=database();const mail=transport();
 const alias="evaluator-"+createHmac("sha256",secret()).update(contact.email).digest("hex").slice(0,12);
 const lookup=await admin.from("demo_evaluators").select("*").ilike("contact_email",contact.email.replace(/[%_]/g, char=>"\\"+char)).limit(2);
 if(lookup.error)throw new Error("Demo registration is unavailable. Please try again.");
 if((lookup.data?.length??0)>1)throw new Error("Please contact ken@FlockTrax.com to review your existing demo accounts.");
 let person=lookup.data?.[0];
 if(!person){
  const farmId=contact.role==="farm_manager"?process.env.DEMO_SIGNUP_FARM_ID:null;
  if(contact.role==="farm_manager") {const farm=await admin.from("farms").select("id").eq("id",farmId).single();if(farm.error)throw new Error("The default demo farm is unavailable.");}
  const role=await admin.from("roles").select("id").eq("code",contact.role).single();if(role.error)throw new Error("Demo role is unavailable.");
  const created=await admin.auth.admin.createUser({email:alias+"@evaluators.flocktrax.invalid",password:randomBytes(48).toString("base64url"),email_confirm:true,user_metadata:{full_name:alias,name:alias},app_metadata:{demo_evaluator:true}});
  if(created.error || !created.data.user)throw new Error("Your request may already be processing. Please retry this confirmation shortly.");
  const saved=await admin.from("demo_evaluators").insert({user_id:created.data.user.id,alias,contact_name:contact.name,contact_email:contact.email,contact_phone:contact.phone,company:contact.company,role_code:contact.role,farm_id:farmId,expires_at:new Date(Date.now()+30*86400000).toISOString()}).select("*").single();
  if(saved.error){await admin.auth.admin.deleteUser(created.data.user.id);throw new Error("Could not save your demo record. Please try again.");}person=saved.data;
 }
 if(person.disabled_at || Date.parse(person.expires_at)<=Date.now())throw new Error("Please contact ken@FlockTrax.com to renew your demo access.");
 if(person.accepted_at)return {message:"Your demo account is already active. Sign in at flocktrax-demo.vercel.app using your existing credentials."};
 const auth=await admin.auth.admin.getUserById(person.user_id);if(auth.error)throw new Error("Unable to verify demo account.");
 if(auth.data.user.app_metadata?.demo_welcome_sent)return {message:"Your demo access email has already been sent. Check your inbox or contact ken@FlockTrax.com for a new setup link."};
 // Restore incomplete provisioning using the saved role, never a later request's role.
 const role=await admin.from("roles").select("id").eq("code",person.role_code).single();if(role.error)throw new Error("Demo role unavailable.");
 const assigned=await admin.from("user_roles").upsert({user_id:person.user_id,role_id:role.data.id,role:person.role_code},{onConflict:"user_id,role_id"});if(assigned.error)throw new Error("Could not assign demo access. Retry this confirmation.");
 let farmName="All demo farm groups";
 if(person.role_code==="farm_manager"){
  const farm=await admin.from("farms").select("farm_name").eq("id",person.farm_id).single();if(farm.error)throw new Error("Demo farm unavailable.");farmName=farm.data.farm_name;
  const membership=await admin.from("farm_memberships").upsert({user_id:person.user_id,farm_id:person.farm_id,role_id:role.data.id,is_active:true},{onConflict:"user_id,farm_id"});if(membership.error)throw new Error("Could not assign demo farm. Retry this confirmation.");
 }
 const setupToken=createHmac("sha256",secret()).update("setup:"+person.user_id).digest("base64url");
 const tokenHash=createHash("sha256").update(setupToken).digest("hex");
 const prior=await admin.from("demo_access_links").select("token_hash,expires_at,used_at").eq("user_id",person.user_id).maybeSingle();if(prior.error)throw new Error("Setup link unavailable.");
 if(prior.data && (prior.data.token_hash!==tokenHash || prior.data.used_at || Date.parse(prior.data.expires_at)<=Date.now()))throw new Error("Please contact ken@FlockTrax.com for a replacement setup link.");
 const expires=prior.data?.expires_at||new Date(Math.min(Date.now()+86400000,Date.parse(person.expires_at))).toISOString();
 if(!prior.data){const saved=await admin.from("demo_access_links").upsert({user_id:person.user_id,token_hash:tokenHash,expires_at:expires},{onConflict:"user_id",ignoreDuplicates:true});if(saved.error)throw new Error("Could not prepare setup link. Retry this confirmation.");}
 const message=buildDemoAccessEmail({fullName:person.contact_name,alias:person.alias,setupUrl:"https://flocktrax-demo.vercel.app/demo-setup#token="+setupToken,setupExpiresAt:expires,accessExpiresAt:person.expires_at,farmName,role:person.role_code});
 await mail.sendMail({...message,from:process.env.SMTP_FROM,to:person.contact_email,replyTo:"ken@flocktrax.com"});
 const marked=await admin.auth.admin.updateUserById(person.user_id,{app_metadata:{...auth.data.user.app_metadata,demo_welcome_sent:new Date().toISOString()}});
 if(marked.error)throw new Error("Your access email was sent, but delivery tracking failed. Please check your inbox before retrying.");
 try{await mail.sendMail({from:process.env.SMTP_FROM,to:"ken@flocktrax.com",replyTo:person.contact_email,subject:"FlockTrax demo account created",text:`Verified evaluator: ${person.contact_name}\nEmail: ${person.contact_email}\nCompany: ${person.company}\nPhone: ${person.contact_phone}\nRole: ${person.role_code}\nUsername: ${person.alias}\nExpires: ${person.expires_at}\n\nhttps://flocktrax-demo.vercel.app/admin/demo-access`});}catch{console.error("Demo owner notification failed after evaluator welcome was sent.");}
 return {message:"Your demo account is ready. Check your email for your username and password-setup link."};
}
