import type { Metadata } from "next";
import { MarketingLanding } from "@/components/marketing/marketing-landing";
import { getPlatformPolicyByName } from "@/lib/platform-content";
import "@/components/marketing/marketing.css";
import "@/components/marketing/brochure.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
 title: "FlockTrax — From the Barn to the Big Picture",
 description: "Connected flock management, from one farm to multiple growers. Daily records, feed planning, work orders and original documents. Built by a farmer, for farmers.",
 openGraph: {title:"FlockTrax — From the Barn to the Big Picture",description:"Two applications. One connected operation. Explore daily flock records, feed management and document audits.",url:"https://flocktrax.com",images:[{url:"https://flocktrax.com/marketing/brochure/barn.webp"}]},
};
export default async function HomePage() {
 const policy = await getPlatformPolicyByName("privacy");
 return <MarketingLanding policyText={policy?.body ?? "FlockTrax Privacy Policy\n\nThe Privacy Policy is currently unavailable. Please contact Ken@MotherCluckersHenHouse.com for assistance."}/>;
}
