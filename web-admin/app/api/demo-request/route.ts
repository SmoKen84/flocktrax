import { NextResponse } from "next/server";
import { requestDemoSignup, completeDemoSignup } from "@/lib/demo-signup";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
// Best-effort per-instance protection; also apply a shared rate limit at the hosting firewall.
const attempts = new Map<string, { count: number; until: number }>();
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
export async function POST(request: Request) {
 const origin = request.headers.get("origin");
 const localPreview = process.env.NODE_ENV === "development" && origin === "http://127.0.0.1:4173";
 if (!origin || (origin !== new URL(request.url).origin && !localPreview)) return fail("Invalid request origin.",403);
 if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("Invalid request format.",415);
 const now = Date.now();
 for (const [key,value] of attempts) if (value.until <= now) attempts.delete(key);
 const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
 const key = createHash("sha256").update(ip).digest("hex");
 const limit = attempts.get(key);
 if ((limit?.count ?? 0) >= 5 || attempts.size >= 10000) return fail("Too many requests. Please try again later or email ken@FlockTrax.com.",429);
 attempts.set(key,{count:(limit?.count ?? 0)+1,until:limit?.until ?? now+3600000});
 let raw = "";
 const reader = request.body?.getReader();
 if (!reader) return fail("Missing request.",400);
 const decoder = new TextDecoder(); let size=0;
 while (true) { const part=await reader.read(); if(part.done)break; size+=part.value.byteLength; if(size>4096){await reader.cancel();return fail("Request too large.",413);} raw+=decoder.decode(part.value,{stream:true}); }
 let data: Record<string,unknown>;
 try { data=JSON.parse(raw); if (!data || typeof data!=="object" || Array.isArray(data)) throw new Error(); } catch {return fail("Invalid request.",400);}
 if(data.website) return NextResponse.json({ok:true});
 const field=(name:string,max:number)=>typeof data[name]==="string"?(data[name] as string).trim().slice(0,max+1):"";
 const name=field("name",200),email=field("email",254),company=field("company",200),phone=field("phone",50),role=field("role",80);
 if(!name || name.length>200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || /[\r\n]/.test(email) || company.length>200 || phone.length>50 || !["Grower / Farm Manager","Integrator Manager","Flock Supervisor","Other"].includes(role)) return fail("Please check your name, email and role.",400);
 const assignedRole = role === "Integrator Manager" ? "integrator_manager" : "farm_manager";
 try {
  if(typeof data.verificationToken === "string") return NextResponse.json(await completeDemoSignup(data.verificationToken,{name,email,company,phone,role:assignedRole}));
  await requestDemoSignup({name,email,company,phone,role:assignedRole});
  return NextResponse.json({ok:true});
 } catch {return fail("Your verification email could not be sent. Please try again or email ken@FlockTrax.com.",502);}
}
