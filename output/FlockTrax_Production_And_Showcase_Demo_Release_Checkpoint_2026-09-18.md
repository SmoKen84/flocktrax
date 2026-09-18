# FlockTrax Production and Showcase Demo Release Checkpoint

Date: 2026-09-18 (America/Chicago)
Status: both applications committed, pushed and deployed; live HTTP verification passed.

## 1. Executive state

The console demo is ready to show to evaluators. It has owner-managed evaluator access, an Integrator Manager option, private contact information, password setup without email, basic activity reporting, realistic fictional supporting PDFs, and two nearly completed closeout scenarios. Production received the separately implemented operational fixes. No demo branch merge into production occurred.

The agreed mobile evaluation approach is a document using actual mobile screenshots and workflow explanations, potentially accompanied by a short recording or live phone walkthrough. No separate mobile demo binary, App Store submission, Play Store submission, or new mobile release was created. The mobile walkthrough document is a future task, not a completed deliverable in this release.

## 2. Repository and environment map

| Purpose | Worktree | Branch | Source commit | Supabase project |
| --- | --- | --- | --- | --- |
| Production | C:/dev/FlockTrax-Production-Release | release/admin-2.6.0 | 805d3e9 | frneaccbbrijpolcesjm |
| Hosted demo | C:/dev/FlockTrax-Demo-Hosted | demo-hosted | fa7588c | srkgobayrzidytmvoago |
| Original development worktree | C:/dev/FlockTrax | demo-platform | Not deployed by this release | Check its own configuration before use |

Git remote: https://github.com/SmoKen84/flocktrax.git.
Both named release branches were pushed to origin. Main was not moved by this release; do not assume origin/main contains the deployed changes. A later main update must use the production branch only, never demo-hosted.

C:/dev/GoProd.bat launches the production worktree on localhost:3010 against the production database. C:/dev/GoDemo.bat launches the demo worktree on localhost:3005 against the hosted demo database. The ports identify local web servers, not local databases. The shared launcher helpers are C:/dev/Start-FlockTraxLocal.ps1 and C:/dev/Start-FlockTraxLocal.cjs; these live outside the application worktrees.

## 3. Verified deployment identities

### Production

- Vercel project: web-admin, prj_dcPbY8QUhtUFn5Zi11h08cXmtWFj.
- Deployment: dpl_3xvzw7TytDja1pKmFmHf9x4PhBEB, READY.
- Immutable deployment URL: https://web-admin-r8t0fh0b0-flock-trax.vercel.app.
- Live canonical URL: https://flocktrax.com.
- https://www.flocktrax.com redirects to the canonical site successfully.
- Deployed source: 805d3e9, release/admin-2.6.0.

### Demo

- Vercel project: flocktrax-demo, prj_kd5UF1Bs69QRjICqxwdyiIiXvRNY.
- Deployment: dpl_JA4ZUjTz9UxmZBs6bPWpjuGaERNy, READY.
- Immutable deployment URL: https://flocktrax-demo-kyzog5wwq-flock-trax.vercel.app.
- Live URL: https://flocktrax-demo.vercel.app.
- Deployed source: fa7588c, demo-hosted.
- FLOCKTRAX_ENVIRONMENT_NAME is demo and FLOCKTRAX_OUTBOUND_MODE is disabled.

Both deployments were made from their respective web-admin directories using their verified Vercel project bindings. The application release/version markers were not advanced by this release; use the commit and deployment IDs above to identify the shipped code.

## 4. Shared operational changes shipped separately to both environments

### Bulk-density verification

- Dedicated Bulk Density Verification Report is available from Reports.
- Detailed verification content was removed from feed projection reports.
- Other applicable reports display the concise warning only when different bins with the same identified feed type have different valid densities.
- STARTER at 45.20 lb/cf and GROWER at 46.10 lb/cf is valid and does not itself trigger a warning.
- Comparison uses the displayed two-decimal precision and ignores invalid or unspecified densities.
- Warning: MIXED FEED DENSITIES FOUND, run Bulk Density Verification Report for more info.

### Barn ordering

- app_settings.name sort_by_sort_code controls custom physical barn order.
- True uses sort_code within each farm; False or an absent setting defaults to natural barn_code order.
- Dashboard, barn/flock/placement selectors, feed-bin selection on ticket drops, and affected scheduler/report data loaders use the shared ordering helpers.
- The setting remains under General; existing user preferences are preserved by the migration.

### Feed-ticket focus help

- Reconcile Feed Tickets displays blue contextual help in the header/filter area when a mapped field has focus.
- Content comes from platform.screen_txt feed_help_* entries.
- Missing help remains invisible. Formatting whitespace is retained; no visible field background or border is introduced.

### Placement Action Items and completed closeout

- Placement issues remain attached to their original placement/flock through closeout.
- Completing closeout resolves remaining open placement issues and records a resolution history entry.
- They must not reappear on a later flock in the same barn.
- The database prevents moving an existing placement issue to another entity/placement.
- Barn-level issues retain their separate lifecycle.
- The migration also resolves pre-existing open placement issues whose closeout was already completed.

## 5. Demo evaluator access

Owner entry point: /admin/demo-access, also linked as Demo Evaluator Access in the signed-in owner console.

The owner enters private name, email, optional phone and company, chooses a role and access duration, and creates an account. Auth uses a random evaluator alias and fictitious internal email. Real contact details are held in service-only registry tables, not evaluator Auth profile metadata. Existing phone numbers can be updated with Save phone.

Roles offered:
- Farm Manager: assigned demo farm.
- Flock Supervisor: assigned demo farm.
- Integrator Manager: all current and future farm groups; can create/maintain farm groups, farms and barns without a single-farm assignment.

The integrator evaluator still cannot access the owner contact register, user administration, settings, environment reset, or outbound synchronization controls. The shared demo data is not a private database per evaluator.

Create returns a copyable setup link. Choose Hosted demo when sending externally; Localhost:3005 is only for testing on the owner's PC. The application does not send invitation email. Tokens are random, single-use, hashed in the database, and expire within 24 hours or the evaluator access expiry, whichever is sooner. GET does not consume the token. The token is carried in the URL fragment and removed from browser history by the setup screen.

The evaluator chooses a password, then signs in with the displayed alias. New setup link replaces an unused previous link and supports forgotten passwords. Enable / extend sets a fresh expiry from today. Disable blocks subsequent website access. Middleware checks existing evaluator sessions; table policies restrict disabled/expired sessions. Native mobile integration still requires its own login/link and RPC/storage authorization review.

The owner can see setup, sign-ins and page visits within the most recent 2,000 events. These are basic navigation statistics, not evidence of edits. Passwords, setup tokens, form bodies and query strings are not logged in the activity records.

Displayed wording: Demo activity is recorded for evaluation. Shared records may be visible to other evaluators.
The setup page uses the corresponding recorded-for-evaluation wording. Demo home and admin sidebars offer Change User and Logout; both sign out before returning to Login.

## 6. Configuration sample parity

The production configuration was compared with demo, and only missing named entries were added. All existing demo rows were verified unchanged. Added 27 app settings and 29 screen-text rows. Demo now has 47 settings and 34 named screen-text records; an empty unnamed production screen-text row was skipped.

Production company/contact values were replaced with demo-safe empty fields or DEMO identity where appropriate. Outbound syncing remains disabled. Existing demo identity, explanatory copy, settings and overrides were preserved. The settings reset baseline was updated. Null setting descriptions are now represented and compared correctly during reset verification.

Before-change configuration snapshots are retained outside Git under the owner's LocalAppData/FlockTrax/config-backups/2026-09-18 directory. No environment files or credentials were committed.

## 7. Repository documents and closeout examples

31 PDFs are in the private flocktrax-document-archive bucket, linked through document_archives to actual demo records:

| Document type | Count |
| --- | --- |
| Feed delivery tickets | 11 |
| Hatchery delivery tickets | 6 |
| Livehaul bills of lading | 3 |
| Load scale tickets | 6 |
| Closeout worksheet snapshots | 2 |
| Grower service invoices | 2 |
| Settlement statements | 1 |

All are fictional and clearly marked DEMO / SAMPLE. They are not payable, shipping evidence, or real hatchery/scale certifications. Future scheduled arrivals do not receive fictitious completed hatch tickets.

Historical closeout examples:
- 2601-A-1, Cedar Creek Farm: submitted, awaiting settlement.
- 2602-C-2, Pine Hollow Farm: settlement received, awaiting final closeout.

Each has 10,000 placed birds, 300 recorded mortality, 9,700 hauled birds, 97,000 lb live weight and 169,000 lb allocated feed. Both final closeout completion timestamps remain null so an evaluator can finish the workflow. Existing growing flocks were retained.

The UI reset restores the database examples, preserves evaluator contacts/accounts, restores evaluator farm memberships, and regenerates PDFs using the restored dates and quantities. Integrator evaluators do not need individual farm memberships restored. Direct SQL reset calls do not upload PDF objects: run the document seed script afterwards.

From demo web-admin:
- node --env-file=.env.local scripts/seed-demo-documents.cjs restores missing sample documents without duplicating current attachments.
- node --env-file=.env.local scripts/verify-demo-documents.cjs downloads and validates stored file hashes and sizes.

The local PDF copies and review montage are under output/pdf/demo-repository and ignored by Git. The generator/template and maintenance scripts are committed. ReportLab produced the stationery template; pdf-lib fills current record data during reset.

## 8. Database migration state

Applied and recorded in BOTH environments during this release:
- 20260918170000: placement-issue closeout enforcement and resolution history.
- 20260918180000: default barn-sort setting, preserving existing preference.

Previously applied in demo, now committed with the released code:
- 20260918200000: evaluator registry, setup links, activity and access gates.
- 20260918210000: Integrator Manager evaluator scope.
- 20260918220000: private phone contact.
- 20260918230000: missing configuration and screen-text seed.
- 20260919000000: two historical closeout scenarios and reset/status extension.
- 20260919001000: nullable setting-description baseline handling.

The 20260919-prefixed migration IDs were authored/applied in this September 18 session; the IDs are sequencing labels, not evidence of a later release. Never apply the demo-only migrations to production. Production contains only the shared migration files.

## 9. Release repairs and verification

- Both local optimized builds completed, including type checks and page generation.
- Both Vercel production-target builds completed and report READY.
- Barn-sort tests passed for defaults, True/False parsing, natural/custom order, missing codes, ties and unchanged inputs.
- Density regression checks passed for different feed types with stable within-type densities and actual same-feed mismatches.
- Disposable PostgreSQL evaluator tests passed for single-use/invalid/expired links, private contacts, role-escalation denial, expired/revoked access, integrator scope and ordinary-scope preservation.
- A transaction-only closeout test verified automatic issue resolution plus history creation, then rolled back.
- A transaction-only full demo reset returned ok=true and restored both unfinished closeout scenarios, then rolled back. Existing evaluator work was not reset.
- All 31 PDFs were downloaded, matched their recorded SHA-256 and byte size, had one page with extractable DEMO text, and representative layouts were visually reviewed.
- Repeat document seeding created zero duplicate documents.
- Postrelease demo database baseline check returned true with 31 current documents.
- Public HTTP checks returned 200 for production home/login, demo home/login/setup, and www production after canonical redirect. Signed-out protected production report and demo-owner pages redirected to Login.
- Demo login displayed evaluator username support; production login did not.
- Diff whitespace checks passed before commit.

The first plain local demo build attempted to prerender the setup page without the launcher environment. The setup route is now force-dynamic, so its environment guard is evaluated at request time. Stored demo Vercel configuration also contained literal trailing line-ending characters in several identity/URL/public-key values. These were cleaned through Vercel environment updates, without printing secret values. Hosted verification confirms the new evaluator login/setup pages now render successfully with exact demo environment checks.

Testing limits: no evaluator password was changed and no new real evaluator was created during production smoke checks. Signed-in local evaluation had already been performed by the owner; hosted checks in this release were anonymous page/redirect checks plus database/storage verification. No hosted reset was executed on the evaluator's working data.

## 10. Recovery and rollback

Pre-release source tags were pushed:
- checkpoint/pre-prod-demo-release-20260918-production -> 2943a22.
- checkpoint/pre-prod-demo-release-20260918-demo -> d61f08b.

Previous READY deployments:
- Production: dpl_5CeLW52t88VfBP4fjXgJhEDYyXLM, https://web-admin-14pm3agnz-flock-trax.vercel.app.
- Demo: dpl_EtPT4kJuy6uaFrkP7vuPrFgfwJNp, https://flocktrax-demo-pv6zx1yfg-flock-trax.vercel.app.

Use Vercel rollback/promotion against the correct project if application rollback is needed. A website rollback does not reverse database migrations, resolve/unresolve historical issues, delete evaluator accounts, or remove uploaded documents. Treat database reversal as a separate reviewed operation. Preserve the corrected demo environment bindings when rolling back application code. Do not reset production data or copy demo credentials/configuration into production.

## 11. Next work and boundaries

1. Owner should run one real hosted evaluator invitation through setup, sign-in and intended farm-group scope.
2. Evaluate both closeout examples and use the new supporting-document links.
3. Prepare the mobile/system overview document: actual screenshots, daily workflow, field data collection, shared database and resulting console/report outputs. Separate implemented functionality from plans.
4. If main is to track production, advance it from release/admin-2.6.0 through the normal reviewed production path. Do not merge demo-hosted into main.
5. Demo-only sidebar/session and evaluator behavior should not be assumed present in production merely because it exists in demo; shared future improvements must be promoted selectively.
6. App Store / Play Store mobile binaries and Edge Functions were not redeployed during this release.

This checkpoint supersedes earlier notes saying the evaluator feature, document reset enhancement, and September 18 shared console changes were local-only or awaiting website deployment.
