# FlockTrax Marketing Gatekeeper Production Checkpoint

Date: 2026-09-25
Status: Published and verified; user approved the final presentation and explicitly requested commit and production publication.

## Release identity and source of truth

- Public URL: https://flocktrax.com
- Authoritative repository: C:/dev/FlockTrax-Production-Release
- Remote: https://github.com/SmoKen84/flocktrax.git
- Branch: release/admin-2.6.0
- Deployed application commit: 0291cfaf9066be1176b957c949a009ff5286f74d
- Application commit message: Publish FlockTrax marketing landing page with real product tours
- Checkpoint tag: checkpoint/marketing-gatekeeper-production-20260925 (points to the documentation checkpoint commit; deployed application source remains 0291cfa).
- Previous application commit: dbc670d (pre-marketing homepage).
- Vercel project: web-admin / prj_dcPbY8QUhtUFn5Zi11h08cXmtWFj, team flock-trax.
- Vercel project Root Directory: . ; run deployment commands from this repository's web-admin directory.
- Production deployment: dpl_Fcz7gyoVWy33b2nasPyfLQiMc1KE, READY.
- Deployment URL: https://web-admin-axjnp76ds-flock-trax.vercel.app
- Inspector: https://vercel.com/flock-trax/web-admin/Fcz7gyoVWy33b2nasPyfLQiMc1KE
- Previous production deployment: dpl_FCh458mnLNuthFcPD3tdoZHXKr5t.
- Local design prototype: C:/dev/FlockTrax-Marketing-Preview, Vite preview http://127.0.0.1:4173/ . This is the design source, NOT the production deployment directory. Its server is temporary and may need restarting.
- Local integrated production test server used port 4174 (npm run start -- --port 4174).

## Homepage and authentication behavior

The root route now renders the public marketing presentation for everyone, including an already authenticated visitor. It does not automatically open the admin console. Existing /admin routes remain protected by the existing Admin layout and Supabase authentication.

Sign in links to /login. The login page redirects an already authenticated user to /admin/overview. Successful password login also redirects to /admin/overview. Login Cancel returns to the public homepage. Auth callback behavior outside these two login changes was not changed.

The user reported that linking to the separate production privacy page let Return Home take an authenticated visitor outside the presentation. The marketing footer now opens a native in-page dialog. Close and Return to presentation dismiss the dialog without navigation. The production server fetches the current policy through getPlatformPolicyByName("privacy") and passes it to the client component; it does not rely on the prototype's static policy snapshot. The public /privacy route remains available independently.

## Approved presentation and copy

- Forest green, cream, gold; blue/rust wordmark; Fraunces and Source Sans 3 fonts.
- Hero: From barn floor. To the bigger picture.
- Barn photo / real Mobile screenshot / real Admin dashboard triptych.
- Three benefits: daily flock records, feed planning, original documents.
- Desktop gallery heading: Real Work. The Real Picture.
- Desktop gallery: live dashboard with sidebar, feed projection, document archive.
- Shared data heading: One database. One live picture.
- Shared data explanation: Mobile saves directly to the same database Admin reads; saved records are available without separate submission, transfer or duplicate entry. Do not recast this as a batch handoff or imply that every already-open Admin view necessarily pushes updates without refreshing.
- Feed integrations: current BinSentry API, adaptable to other providers with suitable APIs. Do not assert that BarnTalk or other providers are already integrated.
- Corporate integrations: Google Cloud / Sheets sync and adaptability to corporate information systems.
- Original source documents remain associated with the flock and retrievable during review.
- Contact: Ken Smotherman, Ken@MotherCluckersHenHouse.com, (254) 715-6101.
- Owner: Smotherman Farms, Ltd., West, Texas, USA; copyright included.
- Request a demo opens an email draft. Existing evaluator link points to https://flocktrax-demo.vercel.app and explicitly states credentials are required.

## Mobile tour and photography

No live mobile demo is offered. Seven release screenshots provide the tour; all enlarge and support Previous/Next navigation, with original image links.

1. Start with the flock: iPad active-flock dashboard and operations calendar, paired with a female barn worker holding a tablet.
2. Follow every feed delivery: iPhone feed ticket search, ticket/drop review, bin allocation; feed truck unloading into bins behind them.
3. Keep the day moving: iPhone farm work orders and weather, with two workers repairing an electric motor behind them.

The user explicitly requested smaller screenshots so the photos remain identifiable, no white title panel, and outlined/shadowed text over the images. Screenshot captions retain readable cream panels. Screenshots preserve original proportions and are not fabricated device UI.

Sources:
- iPhone release 1.0.5: C:/dev/FlockTrax/mobile/ReleaseSupport/AppScreens/1.0.5/AppStore-1242x2688 (1242 x 2688).
- iPad release 1.0.5: C:/dev/FlockTrax/mobile/ReleaseSupport/AppScreens/1.0.5/IPAD/AppStore-13-inch/image11.png (dashboard) and image8.png (calendar), both 2732 x 2048.
- Desktop captures: signed-in hosted demo with sample data, taken using a 1440 x 1000 CSS viewport; browser PNG exports measured 1425 x 990. Do not claim original PNGs are exactly 1440 x 1000. User explicitly rejects narrow-sidebar desktop captures.
- Three new farm backgrounds generated using the built-in image_gen tool. Production uses WebP exports; uncompressed originals and exact prompts are in the prototype public/media folder (workflow-image-prompts.md). The footer discloses AI-generated farm photographs.
- Mobile captures are labeled release 1.0.5; this is screenshot provenance, not a claim that the current published binary is 1.0.5.

## Implementation map

- web-admin/app/page.tsx: server homepage, marketing metadata/Open Graph, live policy loading.
- web-admin/components/marketing/marketing-landing.tsx: client presentation, galleries, dialogs and mobile tour.
- web-admin/components/marketing/marketing.css: styles scoped under .marketing to avoid altering Admin.
- web-admin/public/marketing/media/: all deployed screenshots and farm photos.
- web-admin/public/marketing/fonts/: self-hosted font files.
- web-admin/app/login/page.tsx and actions.ts: dashboard redirect changes.
- web-admin/package.json and package-lock.json: @phosphor-icons/react added.

No database migrations, Edge Function changes, role changes, new credentials, DNS changes, mobile builds, or app-version metadata changes were part of this release. The hosted demo application was not redeployed by this marketing publication.

## Verification and practical limits

- Prototype and integrated Next production builds passed. Next build included lint/type validation.
- git diff --check passed before release commit.
- Integrated homepage visually inspected in browser and matched the approved preview.
- Integrated policy opened with actual policy text and closed within the page.
- Integrated iPad screenshot viewer loaded the original 2732px-wide image.
- On live flocktrax.com, hero was visible and privacy dialog opened without changing URL; close worked.
- Live HTTP checks: homepage, iPad dashboard asset and feed background returned 200. Unauthenticated /admin/overview redirected to /login.
- Live Sign in reached /login in the test browser. That browser did not have a production authenticated session. Already-authenticated login redirect is implemented and build-checked, but was NOT verified with a signed-in production session in this release check.
- Earlier prototype viewer checks covered Next/Previous, disabled endpoints and no browser console errors.
- Narrow layout was visually checked earlier, but one attempted 390px capture actually exported at a 649px CSS viewport. Do not describe that artifact as a verified 390px production check.
- Build emitted a non-blocking autoprefixer warning about align-items:end. Dependency installation reported existing audit findings; no unrelated dependency upgrade was attempted.
- No backend tests or database changes were needed for this presentation release.

## Recovery and future work

1. Resume in C:/dev/FlockTrax-Production-Release on release/admin-2.6.0, inspect git status before editing.
2. Use the checkpoint tag or deployed commit 0291cfa to recover the exact released application. The subsequent documentation checkpoint does not require a redeploy.
3. For an urgent approved rollback, use Vercel's previous deployment dpl_FCh458mnLNuthFcPD3tdoZHXKr5t. This restores the earlier homepage as well as the prior login behavior. No database rollback is required.
4. For a source-level reversal, revert the marketing application commit on a new change and validate before redeploying. Do not hard-reset a dirty working tree.
5. Deploy from web-admin with vercel --prod --yes against the linked web-admin project; confirm alias flocktrax.com and READY state.
6. Production edits should target the integrated TSX and scoped CSS, not only the standalone prototype. Keep original screenshot assets rather than regenerating UI.
7. Preserve the pre-existing unrelated modification supabase/.temp/cli-latest; it was not staged or committed in this release.
8. Do not commit environment files, access tokens or other credentials. None are recorded here.

## Indexing

This checkpoint is linked from the production output/FlockTrax_Checkpoint_Index.md and the main C:/dev/FlockTrax/output/FlockTrax_Checkpoint_Index.md. The main-workspace index entry is a local cross-reference to the authoritative production note; no unrelated main-workspace changes are committed.
