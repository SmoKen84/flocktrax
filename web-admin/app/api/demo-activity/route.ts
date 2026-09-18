import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoAdmin } from "@/lib/demo-access";
import { evaluatorPathAllowed } from "@/lib/demo-access-policy";
export async function POST(request:NextRequest) {
 if(request.headers.get("origin")!==request.nextUrl.origin) return new NextResponse(null,{status:403});
 const session=await createSupabaseServerClient();
 const user=session?(await session.auth.getUser()).data.user:null;
 if(!user?.app_metadata?.demo_evaluator) return new NextResponse(null,{status:403});
 const status=await session!.rpc("demo_evaluator_status");
 if(status.error||!status.data?.active||!status.data?.accepted) return new NextResponse(null,{status:403});
 const body=await request.json().catch(()=>null);
 const path=body?.path;
 if(typeof path!=="string" || path.length>180 || !/^\/admin(?:\/[a-zA-Z0-9_-]+)*$/.test(path) || !evaluatorPathAllowed(path, status.data?.role_code))
   return new NextResponse(null,{status:400});
 const admin=demoAdmin();
 const recent=await admin.from("demo_access_events").select("id").eq("user_id",user.id).eq("kind","page_view").eq("path",path).gte("created_at",new Date(Date.now()-10000).toISOString()).limit(1);
 if(recent.error) return new NextResponse(null,{status:503});
 if(!recent.data?.length) {
   const saved=await admin.from("demo_access_events").insert({user_id:user.id,kind:"page_view",path,client:"web"});
   if(saved.error) return new NextResponse(null,{status:503});
 }
 return new NextResponse(null,{status:204});
}
