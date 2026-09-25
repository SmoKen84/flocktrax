import type { Metadata } from "next";
import { MarketingLanding } from "@/components/marketing/marketing-landing";
import { getPlatformPolicyByName } from "@/lib/platform-content";
import "@/components/marketing/marketing.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
 title: "FlockTrax — From barn floor to the bigger picture",
 description: "Live flock records, feed planning and field workflows. FlockTrax connects farm teams and integrators from barn floor to the bigger picture.",
 openGraph: {title:"FlockTrax — From barn floor to the bigger picture",description:"One database. One live picture. Explore FlockTrax for your poultry operation.",url:"https://flocktrax.com",images:[{url:"https://flocktrax.com/marketing/media/barn-worker.png"}]},
};
export default async function HomePage() {
 const policy = await getPlatformPolicyByName("privacy");
 return <MarketingLanding policyText={policy?.body ?? "FlockTrax Privacy Policy\n\nThe Privacy Policy is currently unavailable. Please contact Ken@MotherCluckersHenHouse.com for assistance."}/>;
}
