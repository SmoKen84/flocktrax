import { demoAdmin } from "@/lib/demo-access";
import { DemoSetupForm } from "./setup-form";
export const dynamic = "force-dynamic";
export const metadata={title:"Set up demo access",referrer:"no-referrer"};
export default function DemoSetupPage() {
 demoAdmin();
 return <main className="login-modal-shell"><section className="login-modal-panel">
  <h1>Set up your FlockTrax demo access</h1>
  <p>Choose a password for your evaluator alias. Demo sign-ins and page visits are recorded for evaluation. Demo records are shared with other evaluators; do not enter private or real customer information.</p>
  <DemoSetupForm/>
 </section></main>;
}
