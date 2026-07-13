# FlockTrax Mobile Work Orders 1.0.4 Test Readiness Checkpoint

Date: `2026-07-12`  
Branch: `main`  
Local HEAD: `7932dc6`  
Purpose: preserve the exact implementation, hosted-backend, build, test, release, and Git state immediately before field testing the new mobile Work Orders workspace.

## Current Product Direction

The mobile app now reflects the farm workers' two distinct work modes:

1. `Barn Care`
   - existing flock-focused dashboard
   - daily barn checks
   - daily log and mortality entry
   - bird weights and grading
   - placement-level operational details

2. `Work Orders`
   - separate facilities/action-item workspace
   - unresolved maintenance and placement concerns
   - ticket history, progress tracking, parts status, and resolution

The explicit product decision is to keep the existing flock dashboard focused. Facilities-maintenance data lives in its own workspace rather than cluttering the daily flock-care experience.

## Work Orders Implementation

The mobile dashboard now has a top-level segmented switch:

- `Barn Care`
- `Work Orders`

The Work Orders workspace supports:

- unresolved Action Items across every farm and barn accessible to the signed-in user
- two presentation modes:
  - `By Barn`
  - `All Barns`
- search by farm, barn, flock/placement, category, title, or description
- ownership filters:
  - all
  - barn / maintenance
  - placement / birds
- working-status filters:
  - all
  - open
  - in progress
  - parts ordered
- category filters based on issue types present in the returned work
- sorting by barn, newest, or oldest
- open-ticket count on the workspace
- detailed ticket view with chronological update history
- posting a trackable update as:
  - progress
  - parts ordered
  - note
- resolving the Action Item with a final resolution note

Working status is intentionally derived from the ticket update history because the parent `issues.status` field currently stores only `open` or `resolved`:

- no progress/parts update -> `Open`
- latest state-changing update is `progress` -> `In Progress`
- latest state-changing update is `parts_ordered` -> `Parts Ordered`

Ordinary notes do not incorrectly change the working state.

## Existing Placement Action Item Integration

The existing placement-day Action Items workflow was completed and retained:

- mobile users can create barn-owned or placement-owned Action Items
- new Action Items create an `opened` history entry
- mobile users can add progress, parts-ordered, or note updates
- mobile users can resolve an item
- resolution creates a final `resolved` history entry
- the placement dashboard includes a `Barn Repairs` shortcut with the open barn-item count

Typechecking uncovered and corrected an earlier incomplete local implementation where the placement screen referenced an Action Item update modal that had not yet been defined.

## Hosted Supabase Backend

New hosted Edge Function:

- `action-items-list`

Deployment result:

- project: `frneaccbbrijpolcesjm`
- deployed successfully on `2026-07-11` local time / `2026-07-12` UTC
- configured with `verify_jwt = false` at the gateway because the function performs its own bearer-token authentication

Security/data behavior:

- authenticates the current Supabase user
- resolves direct farm memberships and farm-group memberships
- global admins may see all farms
- non-admin users receive only Action Items belonging to accessible farms/groups
- returns unresolved barn and placement items
- includes farm, barn, placement/flock context and complete update history
- does not expose another operation's work queue

Related hosted mobile functions represented in the local tree:

- `issue-create`
- `issue-update`
- `issue-resolve`

## Mobile 1.0.4 Build State

Marketing version:

- `1.0.4`

### Android

- version code: `9`
- EAS build id: `ab3f271d-d5b3-4967-9825-b3cecb423871`
- status: `FINISHED`
- build page: https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/ab3f271d-d5b3-4967-9825-b3cecb423871
- AAB artifact: https://expo.dev/artifacts/eas/Ly8EN4A6MkzsOxgFDghf92DzJvVUe9SU97OW53G0IXA.aab

Android submission state:

- not uploaded to Google Play
- EAS submission is blocked because no Google Play service-account key is configured in EAS
- the finished AAB remains valid and Play-ready

### iOS

- build number: `15`
- EAS build id: `1c4fe17e-3e83-4fbb-b69f-ea4f8fbf7e06`
- status: `FINISHED`
- build page: https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/1c4fe17e-3e83-4fbb-b69f-ea4f8fbf7e06
- IPA artifact: https://expo.dev/artifacts/eas/kiBCdCE1dB562GquZdhvuNU8mB1PdbEmkwulgeD7EW8.ipa

iOS submission:

- scheduled successfully through EAS Submit
- submission id: `916856de-7a76-43d4-831c-16b6e86ea1ce`
- submission page: https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/916856de-7a76-43d4-831c-16b6e86ea1ce
- App Store Connect app id: `6763434225`
- API key id: `W9572DMP42`
- intended next stage: TestFlight processing/testing, not public release

## Verification Completed

Successful checks:

- `npm run typecheck` in `C:\dev\FlockTrax\mobile`
- production Expo bundle export for both iOS and Android
- hosted `action-items-list` function bundle and deployment
- unauthenticated hosted endpoint request correctly rejected with HTTP `401`
- production Android EAS build completed
- production iOS EAS build completed
- iOS submission scheduled

Testing limitation:

- a real signed-in, farm-scoped Work Orders response has not yet been field-tested from the built mobile app
- public release must wait for that test

## Work Orders Field Test Checklist

Use a normal farm-worker account when possible.

1. Sign in and verify the existing `Barn Care` dashboard still behaves normally.
2. Switch to `Work Orders`.
3. Confirm only farms/barns assigned to that user appear.
4. Compare the open-item count and list against the web-admin Action Items console.
5. Test both `By Barn` and `All Barns` views.
6. Test search and each ownership/category/status/sort filter.
7. Open a ticket and verify the full history appears oldest to newest.
8. Add a `Note`; verify it appears but does not change `Open` to `In Progress`.
9. Add `Progress`; verify the ticket becomes `In Progress`.
10. Add `Parts Ordered`; verify the ticket becomes `Parts Ordered`.
11. Add another `Progress`; verify it returns to `In Progress`.
12. Resolve a test ticket with a resolution note.
13. Verify the resolved ticket leaves the unresolved mobile queue.
14. Verify the complete history and resolution are visible in web admin.
15. Reopen the mobile app/session and confirm the queue persists correctly.

## Agreed Remaining Mobile Scope Before Polish And Ship

After Work Orders testing is complete, only two feature areas are planned before the mobile release is considered feature-complete.

### 1. Read-Only Operations Calendars

- upcoming Placements calendar
- upcoming Livehaul calendar
- locked/display-only mobile views
- tapping a badge shows limited additional detail
- placement detail: scheduled chick count
- livehaul detail: scheduled bird count to be taken
- no create, edit, delete, reschedule, or administrative controls

### 2. Closed-Flock Performance Summary

Display the production outcome once enough closeout data exists:

- livehaul loads entered with live pounds
- feed marked finished so feed conversion can be calculated
- final live percentage
- final mortality
- first-7-day mortality
- feed conversion

Product purpose:

- let farm workers see how daily care affects production outcomes
- build awareness of the key metrics behind good production
- provide a future foundation for incentive/bonus goals

After those two read-only features:

- polish
- regression test
- submit/release
- do not continue expanding scope before shipping

## Weather/Humidity Confirmation

Relative humidity is included in mobile `1.0.4`:

- requests `relative_humidity_2m` from the weather API
- fills the current day's `rel_humidity` when not already recorded
- displays it in the daily Conditions section
- persists it to `public.log_daily.rel_humidity`
- historical saved values are not overwritten with current weather

## Git And Recovery State

GitHub is currently behind the local machine.

Branch state at checkpoint creation:

- local branch: `main`
- local HEAD: `7932dc6`
- `origin/main`: `6dd99d5`
- local branch is 2 commits ahead of GitHub

Committed but not pushed:

- `35aae38` - `Checkpoint feed tickets placements closeout and reports`
- `7932dc6` - `Add BinSentry density tools and report preflight`

The working tree is also substantially dirty:

- 21 tracked files modified
- 4 untracked product/checkpoint paths
- roughly 900 added lines before counting untracked files

Major uncommitted groups:

- mobile Work Orders and Action Item history/update flow
- mobile `1.0.4` release metadata
- hosted Action Item Edge Functions
- Action List print update nesting and cache revalidation
- placement lifecycle/operational-state synchronization
- feed projection starter/grower ordering correction
- BinSentry delivered-order feed-type inference
- checkpoint/index updates

Non-product noise:

- `supabase/.temp/cli-latest`

Important recovery rule:

- do not reset, clean, or discard this working tree
- Work Orders should be field-tested first
- fix any issues found
- then commit and push the complete known-good baseline before beginning the calendar or flock-performance work

## Key Files

Mobile:

- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\ActionItemsScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\mobile\src\types.ts`
- `C:\dev\FlockTrax\mobile\app.json`
- `C:\dev\FlockTrax\mobile\eas.json`

Supabase:

- `C:\dev\FlockTrax\supabase\functions\action-items-list\index.ts`
- `C:\dev\FlockTrax\supabase\functions\issue-update\index.ts`
- `C:\dev\FlockTrax\supabase\functions\issue-create\index.ts`
- `C:\dev\FlockTrax\supabase\functions\issue-resolve\index.ts`
- `C:\dev\FlockTrax\supabase\functions\_shared\issues.ts`
- `C:\dev\FlockTrax\supabase\config.toml`

## Safe Resume Prompt

`Load FlockTrax_Mobile_Work_Orders_1_0_4_Test_Readiness_Checkpoint_2026-07-12.md and FlockTrax_Checkpoint_Index.md. Continue from Work Orders field testing. Preserve the dirty working tree, do not publicly release mobile 1.0.4 yet, fix any test failures, then commit and push the complete known-good baseline before starting the read-only calendars or flock-performance summary.`

