import { NextResponse } from "next/server";
import { verifyDemoEmail } from "@/lib/demo-signup";
export const runtime="nodejs";
export async function POST(request:Request){
 const origin=request.headers.get("origin");
 if(!origin || (origin!==new URL(request.url).origin && !(process.env.NODE_ENV==="development" && origin==="http://127.0.0.1:4173")))return NextResponse.json({error:"Invalid origin."},{status:403});
 try{
  const reader=request.body?.getReader();if(!reader)throw new Error("Missing verification token.");
  let text="",size=0;const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await reader.cancel();throw new Error("Invalid verification token.");}text+=decoder.decode(part.value,{stream:true});}
  const data=JSON.parse(text);if(typeof data.token!=="string")throw new Error("Invalid verification token.");
  return NextResponse.json(await verifyDemoEmail(data.token));
 }catch(error){return NextResponse.json({error:error instanceof Error && !('code' in error) ? error.message : "Unable to complete signup. Please retry or contact ken@FlockTrax.com."},{status:400});}
}
