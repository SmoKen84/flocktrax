# FlockTrax marketing / technical tour — detailed fresh-chat handoff

Date: 2026-09-27 (America/Chicago)
Status: WIP checkpoint, NOT a production release. User wants to close the long chat and resume in a new one.

## Read this first

The public marketing landing page was successfully released on September 25. Since then the user approved extensive copy changes and an illustrated technical overview. These later edits exist in the local preview AND production source but HAVE NOT BEEN PUBLISHED.

The immediate unresolved issue: the user clicked the FlockTrax-Admin region of the technical illustration and reported a blank/dead screen. The image previously linked to its standalone PNG rather than a component detail. Transparent accessible component buttons have now been added over the illustration in both sources. The preview build passed, but the new hotspot interaction has NOT been successfully verified end-to-end. Do not tell the user it is verified. Finish this first.

Last ambient browser URL was http://127.0.0.0/ — this is NOT the preview. Correct URL: http://127.0.0.1:4173/ . Browser had six tabs after repeated review and image openings. Keep work focused in one correct preview tab; do not proliferate tabs or delete user tabs without direction.

## Repositories, paths and current release

- Authoritative production repository: C:/dev/FlockTrax-Production-Release
- Branch: release/admin-2.6.0
- Remote: https://github.com/SmoKen84/flocktrax.git
- Production Next app: C:/dev/FlockTrax-Production-Release/web-admin
- Independent Vite design preview: C:/dev/FlockTrax-Marketing-Preview
- Main historical development workspace: C:/dev/FlockTrax (do not deploy this accidentally).
- Hosted demo workspace: C:/dev/FlockTrax-Demo-Hosted (not changed by this marketing work).
- Public production: https://flocktrax.com
- Published application commit: 0291cfaf9066be1176b957c949a009ff5286f74d
- Prior documentation checkpoint commit: 2a2fe55
- Published deployment: dpl_Fcz7gyoVWy33b2nasPyfLQiMc1KE, READY.
- Deployment URL: https://web-admin-axjnp76ds-flock-trax.vercel.app
- Vercel project: web-admin / prj_dcPbY8QUhtUFn5Zi11h08cXmtWFj, scope flock-trax, project Root Directory is .
- Deploy only from the production web-admin directory using the linked project; explicit production deployment was authorized for the September 25 release, not yet requested for these later revisions.
- Prior release checkpoint: output/FlockTrax_Marketing_Gatekeeper_Production_Checkpoint_2026-09-25.md
- Stable release tag: checkpoint/marketing-gatekeeper-production-20260925
- This handoff tag: checkpoint/marketing-technical-tour-wip-20260927 (WIP, not deployed).

## How to resume immediately

1. Read this note and inspect git status/log in the production repository.
2. Read C:/dev/FlockTrax-Marketing-Preview/AGENTS.md.
3. Check whether http://127.0.0.1:4173/ is serving. If not, run npm run dev -- --host 127.0.0.1 --port 4173 --strictPort from the preview directory. Use a hidden/noninteractive terminal. Do not assume old process/session IDs survive.
4. Open ONE browser tab at the correct URL. Expand “Want to know more… FlockTrax Technical Background.” near the end of the Mobile section.
5. Click the desktop/Admin region of the architecture image. It must open the FlockTrax-Admin details dialog on the SAME PAGE. Test Mobile, shared database and integration regions too. Verify Close details and Escape return focus to the diagram.
6. Test the four component buttons beneath the illustration; these were previously verified working with the native dialog.
7. Investigate why the final hotspot verification attempts did not expand the disclosure: the DOM contained the hotspot buttons but details.open remained false after a summary text click. A summary keyboard press also timed out. Could be wrong tab/state, browser interaction or user activity; no cause confirmed. Do not infer the application itself is broken from those tool failures alone.
8. If View full size remains, ensure it cannot strand a visitor in an unexplained raw-image tab. Consider an in-page image viewer with a clear close/return affordance. The direct raw-PNG full-size link is STILL present.
9. Check visual layout at desktop and narrow widths, especially lengthy copy over photos and title wrapping. Make no unsupported claims about automatic push refresh.
10. Run production npm run build and git diff --check after final fixes. Request/rely on a clear publish instruction before deploying these new revisions. Update the checkpoint with verification and release status.

## Current code map

Preview:
- src/App.jsx: main marketing page and privacy/image dialogs.
- src/technical-architecture.jsx: expandable architecture content, details dialog, generated illustration, four buttons and new image hotspots.
- src/styles.css: styling; incremental overrides appended. There are older diagram styles still present but unused.
- public/media/architecture-big-picture-modules.png: ACTIVE final approved diagram.
- public/media/architecture-illustration.png: same approved image, retained alias.
- public/media/architecture-illustration-16x9.png: REJECTED accidental variant; unused. Do not restore it.
- public/media/workflow-*.webp: generated workflow background photos.
- public/media/workflow-image-prompts.md: background generation prompts.
- qa/: screenshot and source-image review evidence. Some earlier screenshots are stale.
- design-qa.md: historical QA, NOT sufficient evidence that latest hotspots passed.

Production equivalents:
- web-admin/components/marketing/marketing-landing.tsx
- web-admin/components/marketing/technical-architecture.tsx
- web-admin/components/marketing/marketing.css (all selectors scoped under .marketing)
- web-admin/public/marketing/media/...
- web-admin/app/page.tsx: live policy server fetch, public marketing page and metadata.
- web-admin/app/login/page.tsx and actions.ts: authenticated/successful logins go to /admin/overview.

Keep both preview and production source in sync. Do not blindly copy JSX over TSX; production adds types and uses /marketing/media paths, preview uses /media paths. Production policy is fetched through getPlatformPolicyByName; preview uses src/privacy-policy.txt. Shared fonts are under public/marketing/fonts in production, public/fonts in preview.

## Approved page and post-release copy edits

Keep the forest-green, cream and gold design, blue/rust wordmark and real product screenshots. Photos may be generated; do not generate fake readable product screens. Desktop captures must use a proper desktop viewport, never a cramped browser sidebar layout.

Changes after September 25, not yet published:
- Remove small hero caption lines “Mobile release screen” and “Captured from the FlockTrax demo”; retain the main captions.
- Hero subheading: “Completely scalable flock management. From a single farm grower needing insight to an integrator collecting daily flock data from multiple growers, FlockTrax-Mobile & FlockTrax-Admin will bring your picture into focus.”
- Original documents benefit: “An original document archive included with every flock. Store original hatch tickets, feed deliveries, livehaul records & more.”
- Feed benefit: “Feed inventory by barn & flock. Reconcile deliveries. Feed required projections for 10, 14, 21 & 28 days in the future.”
- Desktop gallery heading remains “Real Work. The Real Picture.” Remove “The same interface you’ll explore in the demo.” Retain “Select a view, then open it at full size.”
- Dashboard title: “The barns come into focus.”
- Dashboard paragraph: “Daily input from FlockTrax-Mobile apps saves into the common database that FlockTrax-Admin reads. The Live Dashboard displays real-time farm data as it is collected. Managers and integrators have a shared view of flock activity, repair work orders and performance factors.”
- Mobile intro: “Multiple workers can use FlockTrax-Mobile to contribute to the daily input from the farms & barns.”
- Mobile note: “Screen tour from iPhone & iPad iOS apps. Also available for Android phones & tablets.”
- Feed workflow: “Feed deliveries are entered and allocated to the bins receiving feed. FlockTrax maintains the accounting by crediting the delivery to the correct flock. Feed transfers and pickups are handled by flock managers through FlockTrax-Admin. Feed delivery tickets are archived with this input.”
- FINAL work-order title: “Work Orders - Trace from Discovery to Completion” (supersedes “Updatable & Tracking”).
- Work-order paragraph: “As barns are checked, workers can record items that need repair or inspection. These Work Orders can later be retrieved and/or updated easily by any team member.”
- Former shared-database paragraph replaced with expandable “Want to know more… FlockTrax Technical Background.”

## Architecture section, intended audience and implementation

Audience: knowledgeable integrator I/S staff and technically informed growers. Clear technical descriptions, not vague marketing or unsupported certifications.

Four components:
1. FlockTrax-Mobile: React Native / Expo, iOS and Android phones/tablets, multiple workers; authenticated API calls persist to shared data.
2. FlockTrax-Admin: Next.js / React browser application; shared records, placements, scheduling, reports, configuration and access.
3. Shared data platform: Supabase PostgreSQL, authentication, document storage, server-side functions/business rules; common authoritative record.
4. Integration services: current BinSentry feed monitoring; Google Cloud/Sheets corporate workflows; weather; adaptable other APIs. Do not imply BarnTalk is already implemented or that all integrations are instantaneous.

Below the diagram, technical notes distinguish committed database availability from already-open screen refresh behavior. External integrations have separate schedules. Mobile does not submit a batch to Admin; both use the same backend. No claim that client devices have unrestricted raw-database access.

The user's sketch: C:/Users/Ken/OneDrive/Desktop/Scans/FlockTrax/Hatch/systemsketch.pdf, one scanned page. Rendered copy: preview/qa/system-sketch-0.png. It places Admin upper left, integrations lower left, relational cloud database center, several farms with multiple mobile devices right. The illustration follows this.

The initial HTML diagram's component selection updated text below the fold, appearing to do nothing. Replaced it with a native dialog: selection sets selected index then detailDialog.current?.showModal(). Dialog has Close details, Escape support, backdrop dismissal. Admin and Integration dialog selection and close were verified before the later image-hotspot change.

Current illustration: an image-generated conceptual architecture drawing (not product screenshots), with exact top title on two lines:
“One Database.”
“Your BIG Picture.”

Original dimensions 1536 x 1024, 3:2. User accidentally requested 16:9 via UI, immediately withdrew it. Original aspect restored; DO NOT use 16:9.

Final approved addition centered beneath database cloud:
New Add-on Modules:
- Flock Processing Stats
- Nutrient Management Plan Support
- Organic System Plan Support
- ROC Plan Support

Do not infer module implementation status or add functionality claims beyond this user-approved label.

Final generated image source:
C:/Users/Ken/.codex/generated_images/01a0bcaf-6c67-7b02-9d39-6cd4c0653150/exec-f2e9b528-63f1-4c15-a222-6c9012d66212.png

The active versioned filename architecture-big-picture-modules.png avoids browser cache showing earlier title variants. The same bytes are copied into preview and production assets.

Current newly added image hotspot regions (percent of illustration):
- Mobile: left70 top14 width29 height76
- Admin: left1 top14 width32 height44
- Shared data: left34 top24 width32 height43
- Integrations: left1 top61 width36 height26
Transparent native buttons have accessible names, aria-haspopup=dialog, hover/focus outlines, and call the same dialog selection handler. The illustration no longer has a full-image anchor. The caption still has a separate View full size link targeting a new tab.

## Contact, source assets and known preferences

Owner: Smotherman Farms, Ltd., West, Texas. Contact Ken Smotherman, Ken@MotherCluckersHenHouse.com, (254) 715-6101. No fake testimonials or ROI metrics.

Real Mobile source screenshots:
C:/dev/FlockTrax/mobile/ReleaseSupport/AppScreens/1.0.5/AppStore-1242x2688
Seven original phone captures. Main mobile tour uses two replacement iPad captures plus five phone captures.
iPad: .../1.0.5/IPAD/AppStore-13-inch/image11.png (dashboard) and image8.png (calendar), 2732 x 2048.

Workflow backgrounds: different female worker with tablet for operations; bulk feed truck offloading for feed; two workers repairing a motor for work orders. User wanted smaller screenshot overlays so photos are identifiable, and white outlined/shadowed copy without white title panels. Captions retain cream panels. iPad screens match tablet in worker photo.

## Validation state and safety boundaries

- September 25 production release verified and deployed; see release checkpoint.
- Subsequent copy and architecture changes previously passed production build, with a nonblocking autoprefixer align-items:end warning.
- Latest hotspot patch: preview npm run build PASSED. Production build after this exact patch NOT run yet.
- Latest hotspot runtime verification UNRESOLVED as described above. Do not mark complete without a real click test.
- Earlier native-dialog interaction worked. All original product screenshot enlargement and Previous/Next features should be preserved.
- A narrow screenshot earlier used an actual 649px viewport despite requesting 390px; don't reuse as proof of a 390px test.
- Existing unrelated production dirty file supabase/.temp/cli-latest MUST remain untouched/uncommitted.
- No DB migrations, Edge Functions, secrets, roles, mobile binaries or production deployment are needed to make this checkpoint.
- Checkpoint code commit is a WIP backup, not an assertion of verified release readiness. The unused accidental 16:9 asset is excluded from the WIP commit; it may remain untracked locally.

## Browser and tooling continuity

Use fresh tool discovery in a new chat. Old browser REPL variables and exec session IDs are not portable. Use the computer/browser tool to inspect available tabs, select the correct localhost:4173 presentation, and read API documentation before advanced calls. Avoid inspecting cookies or secrets. Do not navigate to 127.0.0.0.

Do not assume an open PNG is an interactive webpage. If showing a full-size diagram, provide a clear return path. Reduce tab clutter through reuse, not by closing user-created tabs blindly.

## Handoff storage

Authoritative note: production output directory. Cross-referenced from production and main-workspace checkpoint indexes. A local START_HERE.md in the preview links to this note. A zip snapshot of preview source/public/config (excluding dependencies and build output) is saved in C:/dev/_snapshots/FlockTrax-Marketing-Preview-2026-09-27-handoff.zip. Production WIP code, assets and this note are committed/pushed with a named checkpoint tag. No live deployment is performed for this checkpoint.
