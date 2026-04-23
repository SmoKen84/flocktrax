# FlockTrax Admin, Placement, Dashboard, Sync, And App Store Checkpoint
## Saved
- Date: April 22, 2026
- Context: local development baseline in `C:\dev\FlockTrax`
- Primary local admin URL: `http://localhost:3000`
- Hosted admin URL: `https://admin.flocktrax.com`

## Current Intent
This checkpoint captures the current working state after:
- sync engine hardening and scheduling work
- placement wizard stabilization
- dashboard mortality popup work
- mobile historical entry and weight input fixes
- App Store submission prep for the Expo mobile app

The main goal has been to get the system operational for live use while reducing fragile behavior in the placement editor and unnecessary Google Sheets quota usage.

## High-Level State
- The hosted admin site is live and functioning at `admin.flocktrax.com`.
- The local admin compile contains newer placement wizard and dashboard changes that are not necessarily deployed yet.
- Hosted Supabase is the active backend for both local and live admin testing.
- Google Sheets write processing is now hosted and scheduled from Supabase.
- Google Sheets read-before-edit is configurable and can be disabled through `platform.settings`.
- Placement wizard behavior has been significantly stabilized on localhost.
- Mobile historical save flow and weight decimal input were fixed locally.
- App Store build config for the mobile app has now been scaffolded locally.

## Important Local Files Updated
### Web Admin
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx`
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\placement-scheduler-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\types.ts`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\web-admin\app\logout\route.ts`
- `C:\dev\FlockTrax\web-admin\app\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\actions.ts`

### Mobile
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\app.json`
- `C:\dev\FlockTrax\mobile\eas.json`
- `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\WeightEntryScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\types.ts`

### Supabase Functions
- `C:\dev\FlockTrax\supabase\functions\_shared\google-sheets-read.ts`
- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\weight-entry-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\googleapis-outbox-process\index.ts`

### Supabase Migrations Added In This Phase
- `C:\dev\FlockTrax\supabase\migrations\20260421174000_schedule_googleapis_outbox_worker.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260422162000_create_breeds_lookup.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260422190000_googleapis_skip_unchanged_updates.sql`

## Production / Hosted State
### Admin Website
- `https://admin.flocktrax.com` is live.
- `platform.control` version display was manually aligned earlier by user.
- There had been a duplicate `platform.control` admin-ish row problem; that was manually cleaned up.

### Supabase Cron Worker
- The Google Sheets outbox processor is scheduled from Supabase using cron every 5 minutes.
- This was moved off the Vercel cron path because Vercel plan limits were too restrictive.
- Manual `Process Outbox` remains as an override.

### Read Before Edit Toggle
- The live system supports disabling Google Sheets preload reads via `platform.settings`.
- Accepted keys in code include:
  - `google_sheets_read_before_edit`
  - `google_sheet_read_before_edit`
  - `google_read_before_edit`
  - `sync_read_before_edit`
  - `read_before_edit`
- The user changed `sync_read_before_edit` to false in `platform.settings`.
- Live reads should now prefer existing Supabase rows and skip Google Sheets preload when the toggle is off.

## Placement Wizard State
### Design Boundary
- `platform.settings` is treated as platform/developer-controlled.
- `public.app_settings` is treated as system-admin-configurable business behavior.
- The scheduling rule boundary was clarified:
  - `Grow-out Days` is the user-facing field for flock end-cycle duration.
  - `next_place_date` in `public.app_settings` is a prediction control for the next cycle begin date.
  - `next_place_date` should not be conflated with grow-out duration.

### Key Fixes Made
- Clicking a scheduled flock tile or placement recap row now loads that flock into the editor.
- The editor mismatch bug where header info from one flock and details from another could mix has been addressed locally.
- Selecting an open date now clears stale placement selection and properly opens create mode.
- Month navigation and open-date clicks now clear stale placement context.
- The right-side multi-use panel was changed to safer behavior:
  - no editor by default after save
  - explicit click required to open create or edit mode
- Farm/barn selection alone should no longer auto-open the right panel based on recommended date.
- Redundant blocked-mode flock tiles were removed in favor of a compact flock list.
- The list was tightened and visually cleaned up:
  - actual place date under flock code
  - next place date to the right
  - clearer state labels and colors
- Scheduler state inference was improved so stale DB flags do not mislabel clearly past flocks.

### Dangerous Bug Previously Observed
The user observed that selecting a flock into the editor could leave stale `Placed Date` and `Projected End` fields from the previous flock. That could overwrite correct dates on save.

Mitigations applied:
- form remounting via `key` behavior
- safer selection clearing after save
- no auto-open on farm/barn select

### Remaining Caution
Even after these fixes, the placement editor is still a sensitive area and should be tested carefully on localhost before live deployment. The current local behavior is much safer than before, but this is still the part of the app where accidental cross-record contamination would be most expensive.

## Breed Lookup Upgrade
### Problem
The placement editor allowed free-text entry into breed UUID fields, which led to invalid values like `Ross308` being put where a UUID FK was expected.

### Fix
- Added real lookup table `public.breeds`
- Seeded from `public.stdbreedspec`
- Added foreign keys from flock breed fields to that lookup table
- Changed placement wizard breed fields from raw text to dropdown selects

### Migration Status
- The user manually ran:
  - `20260422162000_create_breeds_lookup.sql`
- Then aligned migration history with:
  - `supabase migration repair --status applied 20260422162000 --linked`

### Current Expected Behavior
- Breed male and breed female fields should now be dropdowns.
- The redundant placeholder option text in the opened combo box was removed.

## Sync Engine State
### Worker
- The old local Python worker path still exists as a fallback and for local use.
- A hosted Supabase worker function now exists:
  - `googleapis-outbox-process`
- Outbox processing on the live admin should use the hosted function path.

### Schedule
- Sync write processing is scheduled via Supabase cron every 5 minutes.
- Manual processing is still available.

### Unchanged Record Sync Suppression
The user wanted true sync semantics:
- if no sync-relevant fields changed, do not enqueue a Google Sheets write
- optional audit for skipped syncs was deferred to avoid noise

Implemented with migration:
- `20260422190000_googleapis_skip_unchanged_updates.sql`

User has said this migration was applied.

Expected behavior now:
- changed daily/mortality/weight save -> enqueue sync
- unchanged save -> no new outbox row

## Dashboard State
### Weight Benchmark Percent
On admin dashboard overview tiles, male and female latest weights now show a benchmark percentage beside the current/last weight:
- `actual weight / expected weight from stdbreedspec by age and sex`
- rendered as `##.#%`

### Mortality Popup Controls
The two mortality items under dashboard mortality are now intended as real popup actions, not pills.

Current labels:
- `First 7 Days`
- `Last 7 Days`

Popup behavior includes:
- day-by-day columns
- male/female daily losses
- current livability %
- mortality % over the displayed window
- close button

### Most Recent Mortality Window Rule
The user clarified the business rule multiple times. Final intended rule:
- do not include the day birds were placed
- dead on arrival on placement day are excluded from this metric
- first 7-day display should show 7 actual days after placement day

Latest local code change:
- `First 7 Days` now uses `place_date + 1` through `place_date + 7`

Important note:
- there was confusion earlier because an 8-day range had been briefly implemented and then corrected
- the last fix in `web-admin/lib/admin-data.ts` reduces the display back to 7 days

## Mobile App State
### Historical Entry
The app supports historical logging when `allow_historical_entry` is enabled.
- On successful historical save, the date auto-advances to the next day.
- This was added to make backfilling mortality less painful.

### Remaining UX Note
The user was annoyed that `Save Log` during historical mortality entry flashed and moved away from the mortality section.
A partial stabilization pass was applied by avoiding a hard placement reset during date advance, but this area may still merit additional UX polish later if any tab-jump behavior remains.

### Weight Input Fix
The mobile weight entry screen had a decimal-entry bug:
- entering `4.54` was being collapsed and saved as `454.00`

This was fixed by preserving raw input text during typing and parsing decimal fields correctly.

The user confirmed that fix worked.

## Mobile App Store Prep
### New Config
App Store submission scaffolding was added locally:
- `C:\dev\FlockTrax\mobile\app.json`
- `C:\dev\FlockTrax\mobile\eas.json`

Configured values:
- app name: `FlockTrax`
- scheme: `flocktrax`
- version: `1.0.1`
- iOS bundle identifier: `com.flocktrax.mobile`
- iOS build number: `1`
- Android package: `com.flocktrax.mobile`

### Asset Assumption
The config currently points to existing art:
- `C:\dev\FlockTrax\output\MC_Favicon2-transparent.png`

This is a practical placeholder based on existing repo assets, but the final App Store icon and splash should still be reviewed for Apple submission quality.

### Still Needed Before Real Submission
- Confirm `com.flocktrax.mobile` is the permanent bundle ID desired
- Create the App Store Connect app record
- Add a real privacy policy URL
- Prepare final App Store screenshots
- Confirm or improve app icon and launch art
- Run EAS production build and submit

## Web Admin Local Build / Tooling Notes
- `next build` is currently passing after recent CSS cleanup.
- There was noisy webpack cache behavior caused by Autoprefixer warnings in `globals.css`.
- Those warnings were cleaned by replacing `start/end` flex alignments with `flex-start/flex-end`.
- `npm run typecheck` can still temporarily complain about missing `.next/types/**` after cache cleanup until a successful build regenerates those artifacts.

## Important Data / Operations History
### Placeholder Flocks Removed
Earlier, the hosted placeholder blockers were removed:
- `999-S1`
- `999-W1`
- linked `999` flocks

This freed real barn usage for actual flock entries.

### Corrected Real Flock Dates
The user supplied intended dates for:
- `283-S2`
- `265-S2`

Those were repaired so:
- `265-S2` placed `2026-01-05`, ends `2026-03-08`
- `283-S2` placed `2026-03-09`, ends `2026-05-10`

This was in response to earlier placement editor cross-record confusion.

## Known Repo State
Current git status shows many modified/untracked files beyond the checkpoint itself. Important ones include:
- modified mobile files
- modified placement wizard files
- modified dashboard files
- new migration files
- new `mobile/eas.json`

There are also unrelated or user-managed items present:
- `web-admin/.env`
- `supabase/.temp/cli-latest`
- backup and output files
- toolkit and security folders

Be careful not to revert user-owned environment or backup files.

## Recommended Resume Order
When resuming later, this is the safest next sequence:
1. Refresh localhost admin and verify `First 7 Days` popup now shows exactly 7 days.
2. Re-verify placement wizard selection safety by switching between multiple flocks before saving.
3. Confirm breed dropdown behavior in placement editor still works after latest local changes.
4. Decide whether placement wizard local fixes should now be compiled/deployed to production.
5. Continue App Store prep:
   - privacy policy URL
   - screenshots
   - final icon review
   - EAS build

## Suggested Immediate Smoke Tests On Resume
### Dashboard
- Open admin overview
- Verify weight benchmark percentages appear
- Open `First 7 Days`
- Confirm placement day is excluded
- Confirm only 7 day columns display

### Placement Wizard
- Select farm and barn only
- Confirm right panel stays passive until explicit click
- Click open date -> create mode
- Click occupied/scheduled flock -> correct flock editor
- Save placement -> editor closes back to list-only state

### Mobile
- Enter decimal average weight such as `4.54`
- Confirm it saves as decimal
- Historical mortality save:
  - confirm date advances correctly
  - confirm experience is still acceptable

## Final Note
This checkpoint is a local project-state checkpoint, not a git commit. The most sensitive areas going forward are:
- placement editor correctness
- mortality popup window semantics
- App Store submission readiness details

The sync engine, hosted worker, and read-before-edit controls are in a much stronger place than they were before this session.
