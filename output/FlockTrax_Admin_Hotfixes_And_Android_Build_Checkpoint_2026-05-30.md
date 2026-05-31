# FlockTrax Admin Hotfixes And Android Build Checkpoint

Date: `2026-05-30`  
Captured: `2026-05-30 19:31:23 -05:00`  
Branch: `main`  
HEAD: `5bb90a0bf4f08add73ab2bda18d31f2f8bfc130f`

## Purpose

Capture the current end-of-session state after:

- feed-ticket editor recovery fix for saved `OFF-FARM` drops
- live sidebar clock fix in the admin shell and splash page
- sync-outbox failed-row inline error detail improvement
- production `web-admin` deployments to `flocktrax.com`
- fresh Android production store build from current git
- Google Play submission readiness check and confirmed blocker

## Repo State

Committed and pushed to `origin/main`:

- commit: `b572497`
- message: `Fix feed ticket draft recovery and sidebar clock`

- commit: `5bb90a0`
- message: `Show sync outbox errors inline for failed rows`

Repo status before checkpoint documentation:

- working tree includes one remaining untracked cleanup folder:
  - `C:\dev\FlockTrax\output\stray-images\`

Context for the untracked folder:

- it contains two accidentally dropped landscape promo images moved out of `mobile/ReleaseSupport/AppScreens`
- those files were intentionally left uncommitted and are not part of the product state

## Production Deployment

### Admin Hotfix Deploy

Production `web-admin` deployment completed through Vercel from commit `b572497`:

- deployment id: `dpl_5XV35ZpW9vrKAV6mhsN9TTYjyicq`
- inspector: [https://vercel.com/flock-trax/web-admin/5XV35ZpW9vrKAV6mhsN9TTYjyicq](https://vercel.com/flock-trax/web-admin/5XV35ZpW9vrKAV6mhsN9TTYjyicq)
- deployment URL: [https://web-admin-7a9lk3vau-flock-trax.vercel.app](https://web-admin-7a9lk3vau-flock-trax.vercel.app)
- production alias: [https://flocktrax.com](https://flocktrax.com)

### Sync-Outbox Error Detail Deploy

Production `web-admin` deployment completed through Vercel from commit `5bb90a0`:

- deployment id: `dpl_6bGDYCukADFd2JDC3xRq3SzSq6fe`
- inspector: [https://vercel.com/flock-trax/web-admin/6bGDYCukADFd2JDC3xRq3SzSq6fe](https://vercel.com/flock-trax/web-admin/6bGDYCukADFd2JDC3xRq3SzSq6fe)
- deployment URL: [https://web-admin-qcw95aldh-flock-trax.vercel.app](https://web-admin-qcw95aldh-flock-trax.vercel.app)
- production alias: [https://flocktrax.com](https://flocktrax.com)

Verification:

- both production deploys completed successfully
- `curl -I https://flocktrax.com` returned HTTP `200`

Build note:

- Vercel build succeeded with the same non-blocking autoprefixer warnings in `app/globals.css` about `end` vs `flex-end`

## What Is Now Live

### Feed Ticket Editor Recovery Fix

The feed-ticket editor no longer auto-overrides saved existing tickets with browser draft data.

This fixed the bug where a saved `OFF-FARM` redirected drop could reopen looking like:

- `Not Allocated` weight
- blank drop row fields
- unchecked redirect box
- missing note text

Current behavior:

- saved ticket loads from the server first
- browser draft is offered as an explicit recovery choice
- successful saves clear the draft and stop it from immediately rewriting itself

### Live Sidebar Clock

The admin sidebar and splash sidebar now use a real-time client clock instead of a static server-rendered timestamp.

Current behavior:

- updates every second
- uses `America/Chicago`
- visible on both signed-in admin shell and signed-out splash page

### Sync Outbox Failed-Row Error Detail

The Google Sheets sync outbox now shows `last_error` directly under failed rows.

Current behavior:

- rows with `status = failed` render a compact second line immediately underneath
- that detail line shows the stored `platform.sync_outbox.last_error`
- normal rows remain single-line

This gives the UI operator immediate context for why a sync row failed without needing to open the full field modal first.

## Android Build State

Fresh Android production store build completed successfully through EAS:

- build id: `f1aba76a-428b-42df-9c34-4c1752bba46e`
- project: `flocktrax-mobile`
- platform: `ANDROID`
- distribution: `STORE`
- build profile: `production`
- app version: `1.0.3`
- app build version / versionCode: `8`
- git commit used for build: `b57249751e1500d3d81553922810a859a3a68c18`
- build artifact: [https://expo.dev/artifacts/eas/vQSc8AxFBKsJGg98r4uN5w.aab](https://expo.dev/artifacts/eas/vQSc8AxFBKsJGg98r4uN5w.aab)
- build page: [https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/f1aba76a-428b-42df-9c34-4c1752bba46e](https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/f1aba76a-428b-42df-9c34-4c1752bba46e)

Verification:

- `npm run typecheck` passed in `C:\dev\FlockTrax\mobile`
- EAS used remote Android credentials successfully
- build finished in `FINISHED` state

## Google Play Submission Status

Submission is **not yet executable** from the current non-interactive setup.

Exact blocker from EAS Submit:

- `Google Service Account Keys cannot be set up in --non-interactive mode.`

What this means:

- Android build/signing path is healthy
- Expo account access is healthy
- Play submission still needs one-time Google Play Developer API service-account setup in EAS

What is needed next:

1. In Google Play Console, confirm the linked Google Cloud project under `Setup` / `API access`.
2. In that linked Google Cloud project, create a service account and JSON key.
3. In Play Console, grant that service account access to `com.flocktrax.mobile`.
4. Upload that JSON key into Expo/EAS Android submit credentials.
5. Re-run `eas submit --platform android --latest --profile production --non-interactive`.

Once that is done, the already-built Android artifact above can be submitted without rebuilding.

## Local Verification

Web-admin verification completed locally during this session:

- `npm run typecheck` passed after the feed-ticket editor recovery fix
- `npm run typecheck` passed after the live sidebar clock change
- `npm run typecheck` passed after the sync-outbox failed-row inline error change

Mobile verification completed locally:

- `npm run typecheck` passed

## Key Files

- [feed-ticket-editor.tsx](C:/dev/FlockTrax/web-admin/app/admin/feed-tickets/feed-ticket-editor.tsx)
- [live-sidebar-clock.tsx](C:/dev/FlockTrax/web-admin/components/live-sidebar-clock.tsx)
- [admin-shell.tsx](C:/dev/FlockTrax/web-admin/components/admin-shell.tsx)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/page.tsx)
- [outbox-table.tsx](C:/dev/FlockTrax/web-admin/app/admin/sync/googleapis-sheets/outbox/outbox-table.tsx)
- [globals.css](C:/dev/FlockTrax/web-admin/app/globals.css)
- [eas.json](C:/dev/FlockTrax/mobile/eas.json)
- [app.json](C:/dev/FlockTrax/mobile/app.json)

## Recommended Resume Point

If work resumes in a new chat after clearing this one, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Admin_Hotfixes_And_Android_Build_Checkpoint_2026-05-30.md first.`

Then likely next steps are:

1. Finish Google Play service-account setup so the current Android build can be submitted.
2. Decide whether to save or delete `C:\dev\FlockTrax\output\stray-images\` after confirming those moved promo images are not needed.
3. Continue with whatever new topic is next from this stabilized web/mobile baseline.
