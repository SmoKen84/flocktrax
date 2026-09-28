# FlockTrax detailed checkpoint — September 28, 2026

Status: work deployed; user requested checkpoint and rest. No scheduled follow-up. This supersedes the September 27 marketing WIP deployment status.

## Source and deployment map

Production: C:/dev/FlockTrax-Production-Release/web-admin; branch release/admin-2.6.0; https://flocktrax.com.
Demo: C:/dev/FlockTrax-Demo-Hosted/web-admin; branch demo-hosted; https://flocktrax-demo.vercel.app.
Prototype: C:/dev/FlockTrax-Marketing-Preview; not a Git repository; http://127.0.0.1:4173.
Do not deploy from historical/mobile tree C:/dev/FlockTrax.

Final deployed production source d2e5daa, READY deployment dpl_DDTZabz6q8Y6XWhdRaEcfdA2RJBW, https://web-admin-5a4bd5fud-flock-trax.vercel.app.
Final deployed demo source b7e2f36, READY deployment dpl_Gh65ftk5xQFwCUmAA7XXP6zxVSQ5, https://flocktrax-demo-ptcxv9n4w-flock-trax.vercel.app.
Canonical aliases confirmed. Documentation commits after these do not require redeployment.
Vercel projects: web-admin (production), flocktrax-demo (demo), team flock-trax. Each web-admin/.vercel/project.json identifies its own target.

## Pushed commit sequence

| Work | Production | Demo |
| --- | --- | --- |
| Signup/marketing/mail, evaluator list and permissions | e66df36 | f86bc55 |
| Independent latest valid weights | aaa0431 | 4a3178d |
| Full haul totals, negative reconciliation | ed99f82 | 004fae8 |
| Barn report includes BinSentry orders | d2e5daa | b7e2f36 |

## Marketing and branding

Production source: components/marketing. Standalone prototype source: src.
Approved Mobile/Admin hero separation is a narrow plain green gap with centered accent line, no arrow or background photograph in the gap.
Copy updated for mobile availability, collection-focused mobile versus Admin workflows, shared database capabilities, simultaneous Admin sessions, feed-ticket auditing and BinSentry integrations.
BinSentry chart remains in integration section with enlargement. Small bin illustration was removed from the feed-delivery presentation at user request.
Branding uses original hole-free bird SVG. Footer retains farm-photo disclosure and removes product-image disclosure.

## Verification and demo-access workflow

Request Demo Access expands name/email/company/optional phone/role form. Send Verification Email sends to entered address and retains the draft. Bold navy waiting message appears beside the button.
Email displays a readable Verify your email address link. Token is in URL fragment. Opening it automatically POSTs verification, stores proof, restores contact details and returns to /#contact.
Verification alone creates no account. The form changes to Send Demo Request; successful final submission provisions the evaluator and sends the welcome email. Draft clears only after success.
Changing email requires matching verification again. Storage/focus events synchronize within one browser. Outlook chooses which browser opens a link; it cannot be forced to return to Codex. Verified payload restores the request in the browser opened by email.

Production files: lib/demo-signup.ts; app/api/demo-request/route.ts; app/api/demo-verify/route.ts; app/demo-verify; components/marketing/demo-request-form.tsx.
Authenticated encrypted tokens distinguish verify and verified purposes, bind email, expire in 24 hours. Invalid/tampered/wrong-purpose/email-mismatch checks passed.
Integrator Manager maps to integrator_manager; other form choices map to farm_manager with configured Cedar Creek farm. Account expiry 30 days; setup links single-use, 24 hours.
Provisioning is locked to isolated demo Supabase: private evaluator record, alias Auth user, role and applicable farm membership. Existing requests preserve their stored role; no silent upgrades or renewal. Owner notification follows welcome mail.
Grower Admin support remains unfinished. Incomplete UI-only option was removed before release; deployed owner creation defaults to Farm Manager.

## Email configuration and approved template

SMTP host smtp.gmail.com authenticates as ken@mothercluckershenhouse.com. Display sender FlockTrax <ken@flocktrax.com>; Reply-To ken@flocktrax.com. These are not the same authenticated mailbox.
User confirmed Outlook verification messages were arriving in Junk. SMTP acceptance is not proof of inbox delivery.
Production Vercel settings added: SMTP_HOST/PORT/SECURE/USER/PASS/FROM and DEMO_SIGNUP_SUPABASE_URL/SERVICE_KEY/SECRET/FARM_ID/ORIGIN. No secret values belong in documentation. Keep signup secret stable. Production origin https://flocktrax.com; local origin http://127.0.0.1:4173.
Both web-admin projects have .vercelignore excluding .env files. Never commit/print credentials.

Both trees: lib/email/demo-access-email.ts and public/demo-email-bird.png. Subject: Your FlockTrax demo access is ready.
Branded HTML and text contain username, role/scope, password setup, expiry, login link, periodic database reset/data-loss notice, shared-demo caution and contact details.
Approved screen note recommends desktop monitor/tablet; smartphone works but Admin is not optimized for phone-sized screens.
Local preview http://127.0.0.1:4173/demo-access-email-preview.html uses example account details and disabled setup button; not sent or published.
Owner-created accounts retain existing manual setup-link workflow; presence of shared template does not mean every manual owner action emails automatically.

## Demo list and own-permissions report

/admin/demo-access is owner-only. Bounded listbox shows contact/company/email/expiry; name and company filters combine case-insensitively. Sort by name/company/expiration with direction, counts and clear filters. Selection updates ?user= and detail panel. Existing phone/link/extend/disable controls retained.
Files: app/admin/demo-access/{page,user-selector}.tsx and user-selector.module.css.

Both environments: Reports > Quick Access Reports > My Permissions > Open Report; /admin/reports/my-permissions.
Only signed-in user's report. Approved layout: green Dos and cream Can't Dos boxes side by side, stacked on smaller screens.
Assigned memberships precede permissions as a hierarchy. Direct farms nest beneath context-only parent groups; group-assigned farms marked included. Integrator memberships appear without invented parent-child mappings.
Files: app/admin/reports/my-permissions/{page,membership-hierarchy}.tsx and reports/page.tsx.
Demo middleware redirects active evaluator GET /admin/user-access to own report, with read-only demo notice. Mutation requests remain blocked; owner behavior unchanged.

## Dashboard weight fix

Newest blank/zero samples previously suppressed prior valid readings. lib/latest-valid-weight.ts now chooses latest positive finite weight independently per sex by log date. Count/date retained from selected sample; benchmark comparison uses its sample age. Both dates display if different.
Tests covered alternate-sex entries, reversed ordering, invalid values and sample date/count retention. Both environments deployed.

## Livehaul reconciliation and feed population

Production flock 330 September 23 male haul saved actual 4,500 correctly. Old dashboard capped haul to remaining population, explaining 4,269 at earlier mortality count.
Read-only diagnosis: started males 4,500, mortality/culls 240, actual male haul 4,500. Correct current reconciliation at those values is -240.
applyPastLiveHaulEvents preserves full haul amounts and negative balances. Mixed-sex events allocate proportionally to positive remaining populations; if none remain, split half while preserving full total. Existing past-date cutoff and actual-then-target fallback remain unchanged.
Feed projection starting populations clamp negatives to zero. User explicitly approved negative dashboard balances with nonnegative feed counts.
Regression checks covered full removals, both sexes, multiple events and mixed-sex conservation; type checks and production builds passed.

## Barn feed-button correction

Old tile FeedProjectionPopup used stored commitments without fetching BinSentry scheduled orders. Button now opens the full /admin/reports/feed-projection report, barnId scoped, includeBinSentryOnOrder=1, in a new tab.
Uses existing full-report integration and live inventory path. Old popup function remains unmounted in source; do not restore it accidentally. No external order write-back performed.
Both type checks and remote builds passed; final deployments above contain this fix.

## Validation and remaining limits

All final Vercel builds READY; aliases confirmed. Earlier public smoke checks passed for marketing/verification/assets, invalid token rejection and anonymous demo login redirects. Latest patches have code regression/type/build checks, not a fresh authenticated visual audit of every live row.
Signup rate limiter is per instance; shared firewall limit not verified. No durable mail queue. Concurrent confirmations may send duplicate copies of the same setup email. Owner-notification failure is logged.
Demo report filters capability descriptions using regex rules; explanatory hierarchy does not grant access. Database authorization remains authoritative.
No migrations or mobile releases in this session. Signup tests provisioned evaluator data only in isolated demo.

## Local services and recovery

4173 marketing Vite; proxies API/verification/Next assets to 4174. 4174 production Next dev (last session 61875). 4175 demo Next dev (last session 11385). Session IDs are ephemeral; check listeners before starting.
Run npm run dev -- --hostname 127.0.0.1 --port <port> in correct web-admin. Stop owned Next dev before local next build to avoid shared .next collisions; remote builds do not require stopping dev.
Demo .env trailing line breaks were normalized without exposing secrets. Do not reintroduce escaped CR/LF.
Unrelated production supabase/.temp/cli-latest remains dirty and uncommitted; preserve it. Demo code clean at last deployment. Prototype is not a Git repo; deployable equivalents committed in production.
No pending deployment. User requested rest; no further work until requested. For rollback use earlier READY deployment in the correct Vercel project; do not reset shared worktrees or alter user data.
