"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function DemoActivity() {
 const pathname=usePathname();
 useEffect(()=>{void fetch("/api/demo-activity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:pathname})}).catch(()=>{});},[pathname]);
 return <p className="demo-activity-notice">Demo activity is recorded for evaluation. Shared records may be visible to other evaluators.</p>;
}
