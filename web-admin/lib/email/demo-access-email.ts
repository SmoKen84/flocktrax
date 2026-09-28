/** Standard evaluator welcome message, shared by automatic and owner-issued access. */
export type DemoAccessEmailInput = {
 fullName: string;
 alias: string;
 setupUrl: string;
 setupExpiresAt: string;
 accessExpiresAt: string;
 farmName: string;
 role?: "farm_manager" | "integrator_manager";
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
const formatDate = (value: string) => {
 const date = new Date(value);
 if (!Number.isFinite(date.getTime())) throw new Error("Invalid demo email expiration date.");
 return new Intl.DateTimeFormat("en-US", {dateStyle:"medium",timeStyle:"short",timeZone:"America/Chicago"}).format(date) + " (Central Time)";
};
export function buildDemoAccessEmail(input: DemoAccessEmailInput) {
 const url = new URL(input.setupUrl);
 if (url.origin !== "https://flocktrax-demo.vercel.app" || url.pathname !== "/demo-setup" || !/^#token=[A-Za-z0-9_-]{43}$/.test(url.hash)) throw new Error("Invalid hosted demo setup URL.");
 const roleLabel = input.role === "integrator_manager" ? "Integrator Manager" : "Farm Manager";
 const scopeLabel = input.role === "integrator_manager" ? "All demo farm groups" : input.farmName;
 const paragraphs = [
  `Hello ${input.fullName},`,
  "Your FlockTrax demo access is ready. Use the setup link below to choose your password, then sign in using your demo username.",
  `Demo username: ${input.alias}`,
  `Access role: ${roleLabel} | Demo scope: ${scopeLabel}`,
  `Set up your password: ${input.setupUrl}`,
  `This setup link can be used once and expires ${formatDate(input.setupExpiresAt)}. If it expires before you use it, contact us for a replacement.`,
  "Return to the demo: https://flocktrax-demo.vercel.app/login",
  `Your demo access expires ${formatDate(input.accessExpiresAt)}.`,
  "IMPORTANT â€” PERIODIC DEMO DATA RESETS",
  "We periodically reset the demo database to keep the example data current. Any records, changes, or documents you add may be removed during a reset and will not be retained. Please do not use the demo to store information you need to keep.",
  "The demo uses shared example data. Other evaluators may see changes you make, so please do not enter private information or real customer data. Demo sign-ins and page visits are recorded for evaluation.",
  "Questions or need help? Reply to this email or contact ken@FlockTrax.com.",
  "Ken Smotherman\nFlockTrax\n(254) 715-6101",
 ];
 return {
  subject: "Your FlockTrax demo access is ready",
  text: [...paragraphs.slice(0,2), "For the best experience, use the demo on a desktop monitor or tablet. It works on a smartphone, but the Admin screens are designed for larger displays and are not optimized for phone-sized screens.", ...paragraphs.slice(2)].join("\n\n"),
  attachments: [{ filename: "flocktrax-bird.png", path: process.cwd() + "/public/demo-email-bird.png", cid: "flocktrax-bird", contentType: "image/png" }],
  html: `<!doctype html><html><body style="margin:0;background:#eeeade;padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fbf8ef;font-family:Arial,sans-serif;color:#14382d;line-height:1.6">
<tr><td style="padding:24px 30px;background:#ffffff;border-bottom:4px solid #dba93e">
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding-right:18px"><img src="cid:flocktrax-bird" width="76" height="77" alt="FlockTrax bird" style="display:block;border:0"></td><td><span style="font:bold 38px Georgia,serif;color:#30618c">Flock<span style="color:#a04c24">Trax</span></span><br><span style="font-size:11px;letter-spacing:2px;color:#58675d">YOUR DEMO ACCESS</span></td></tr></table>
</td></tr>
<tr><td style="padding:28px 30px;background:#14382d;color:#fbf8ef"><h1 style="font:normal 32px Georgia,serif;margin:0 0 8px">Your next flock.<br>A clearer picture.</h1><p style="margin:0;color:#eed29a">Welcome to your FlockTrax demo.</p></td></tr>
<tr><td style="padding:28px 30px">
<p style="margin-top:0">${escapeHtml(paragraphs[0])}</p><p>${escapeHtml(paragraphs[1])}</p>
<p><strong>Recommended screen size:</strong> For the best experience, use the demo on a desktop monitor or tablet. It works on a smartphone, but the Admin screens are designed for larger displays and are not optimized for phone-sized screens.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e5ebdf;border-left:4px solid #dba93e"><tr><td style="padding:16px"><strong>Demo username</strong><br>${escapeHtml(input.alias)}<br><strong>Role:</strong> ${escapeHtml(roleLabel)}<br><strong>Demo scope:</strong> ${escapeHtml(scopeLabel)}<br><strong>Access expires:</strong> ${escapeHtml(formatDate(input.accessExpiresAt))}</td></tr></table>
<p style="margin:26px 0"><a href="${escapeHtml(input.setupUrl)}" style="display:inline-block;padding:13px 24px;background:#dba93e;color:#14382d;text-decoration:none;font-weight:bold;border-radius:4px">Set Up Demo Access &rarr;</a></p>
<p style="font-size:13px">${escapeHtml(paragraphs[5])}</p>
<p>After setup, <a href="https://flocktrax-demo.vercel.app/login" style="color:#30618c">return to the demo here</a>.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff0cf;border-top:3px solid #dba93e"><tr><td style="padding:18px"><strong>Important: periodic demo data resets</strong><p style="margin:8px 0 0">${escapeHtml(paragraphs[9])}</p></td></tr></table>
<p style="font-size:13px;color:#58675d">${escapeHtml(paragraphs[10])}</p>
<p>Questions or need help? Reply to this email or contact <a href="mailto:ken@FlockTrax.com" style="color:#30618c">ken@FlockTrax.com</a>.</p>
<p style="margin-bottom:0"><strong>Ken Smotherman</strong><br>FlockTrax<br>(254) 715-6101</p>
</td></tr><tr><td style="padding:16px 30px;background:#14382d;color:#fbf8ef;font-size:12px">Smotherman Farms, Ltd. &middot; West, Texas</td></tr>
</table></td></tr></table></body></html>`,
 };
}
