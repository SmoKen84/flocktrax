import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_PROJECT_REF, evaluatorPathAllowed } from "@/lib/demo-access-policy";

export async function middleware(request:NextRequest) {
 if(request.nextUrl.pathname === "/logout") return NextResponse.next();
 if(process.env.FLOCKTRAX_ENVIRONMENT_NAME!=="demo") return NextResponse.next();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key||new URL(url).hostname!==DEMO_PROJECT_REF+".supabase.co")
  return new NextResponse("Demo environment is not configured.",{status:503});
 let response=NextResponse.next({request});
 const client=createServerClient(url,key,{cookies:{
  getAll:()=>request.cookies.getAll(),
  setAll:(values:Array<{name:string;value:string;options:CookieOptions}>)=>{
   values.forEach(({name,value})=>request.cookies.set(name,value));
   response=NextResponse.next({request});
   values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
  },
 }});
 const {data:{user}}=await client.auth.getUser();
 if(!user) return response;
 // app_metadata is set by the admin, never by the evaluator.
 if(user.app_metadata?.demo_evaluator!==true) return response;
 const status=await client.rpc("demo_evaluator_status");
 const blocked=status.error||!status.data?.evaluator||!status.data?.active||!status.data?.accepted;
 if(blocked || !evaluatorPathAllowed(request.nextUrl.pathname, status.data?.role_code)) {
  const message=blocked?"Demo access is expired, disabled or awaiting setup. Contact the demo owner.":"This area is reserved for the demo owner.";
  if(request.nextUrl.pathname.startsWith("/api/")||request.method!=="GET")
   return NextResponse.json({error:message},{status:403});
  if(blocked) {
    // Let the login page render rather than redirecting a stale session forever.
    await client.auth.signOut();
    const destination=NextResponse.redirect(new URL("/login?error="+encodeURIComponent(message),request.url));
    response.cookies.getAll().forEach(cookie=>destination.cookies.set(cookie));
    return destination;
  }
  return NextResponse.redirect(new URL("/admin/overview",request.url));
 }
 return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|demo-setup).*)"]};
