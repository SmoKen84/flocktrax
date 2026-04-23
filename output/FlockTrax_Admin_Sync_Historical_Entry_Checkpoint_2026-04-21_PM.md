# FlockTrax Checkpoint
Date: 2026-04-21 PM

## Current Release State
- `admin.flocktrax.com` is live on the current admin build.
- The splash/version display is aligned with the live release.
- A duplicate `platform.control` admin row was identified and cleaned up manually in the hosted database.

## Admin UI Progress
- `Activity Log` archive screen was heavily polished and is now in a strong finished state.
- `Flocks` archive screen was brought into the same visual family as `Activity Log`.
- Activity Log improvements include:
  - archive-style hero/header treatment
  - `When`, `Farm`, `Barn`, `Flock`, `User` filters
  - two-line `When` display
  - popup reader for clipped `Details`, `User`, and `Source`
  - sticky column headers
  - dark brown divider beneath headers
  - pagination
- `Flocks` now uses screen text keys:
  - `archive_flocks_title`
  - `archive_flocks_desc`
  - `archive_flocks_filter`

## Sync Engine State
- The Google Sheets sync worker is no longer local-only in practice.
- A hosted Supabase Edge Function now processes the outbox:
  - `supabase/functions/googleapis-outbox-process/index.ts`
- Shared Google Sheets helper logic now supports hosted writes and clears:
  - `supabase/functions/_shared/google-sheets-read.ts`
- The Outbox admin action now prefers the hosted worker first and only falls back to local/manual execution if needed:
  - `web-admin/app/admin/sync/googleapis-sheets/actions.ts`

## Sync Scheduling
- Vercel cron was attempted first but blocked by the current Vercel plan because sub-daily cron is not allowed there.
- Final chosen approach is Supabase-side scheduling.
- Hosted Supabase extensions were enabled:
  - `pg_cron`
  - `pg_net`
- A Supabase cron job was created and verified active:
  - `googleapis-outbox-process-every-5-min`
  - schedule: every 5 minutes
- The migration file describing that setup exists locally at:
  - `C:\dev\FlockTrax\supabase\migrations\20260421174000_schedule_googleapis_outbox_worker.sql`
- The cron was also applied directly to the hosted project and verified active in `cron.job`.

## Historical Backfill Workflow
- `platform.settings.allow_historical_entry` is now wired into the mobile app path.
- The mobile dashboard settings payload now includes:
  - `allow_historical_entry`
- Historical save behavior on `PlacementDayScreen` now auto-advances the log date by one day after a successful save when:
  - `allow_historical_entry = true`
  - the current log date is before today
- This was designed specifically to support rapid mortality back-entry through a flock history.

## Historical Entry UX Fix
- The first pass of historical auto-advance caused an annoying full flash/reset while stepping dates.
- A follow-up mobile fix now preserves the current placement screen contents while loading the next date in the same placement flow.
- This should reduce the hard reset effect when saving through historical mortality entries.
- File updated:
  - `mobile/App.tsx`
- The next validation step is to reload Expo and confirm the user remains comfortably in the mortality-entry workflow.
- If it still feels jumpy, the next likely refinement is explicitly preserving the active tab (`Mortality`) during auto-advance.

## Hosted Data Cleanup
- The two placeholder blocker placements/flocks were removed from the hosted database:
  - `999-S1`
  - `999-W1`
- Their linked active flock assignments were cleared from barns.
- Verified final state:
  - `S1` empty
  - `W1` empty
  - no remaining `999-*` placements
  - no remaining `999` flocks
  - no orphaned daily/mortality/weight rows
- Their related activity diary rows were also removed, effectively clearing the current Activity Log contents that were tied to those placeholders.

## Important Hosted Configuration Notes
- Google Sheets service account path used locally:
  - `C:\dev-secrets\flocktrax-sync-e2fddb60793f.json`
- Target workbook sharing was intentionally kept to a single service account:
  - `flocktrax-sync@flocktrax-sync.iam.gserviceaccount.com`
- Sheet tab naming expectation remains:
  - worksheet/tab name must match `placement_key`

## Known Open Follow-Up
1. Reload Expo and verify the historical mortality save flow now feels steady.
2. If needed, preserve the `Mortality` tab explicitly across date auto-advance.
3. Queue one real outbox row and confirm the Supabase scheduled worker clears it without pressing `Process Outbox`.
4. Decide later whether the new Supabase cron schedule should become part of a formal tracked migration/apply process beyond the direct hosted setup already completed.

## Best Resume Point
Resume with one short mobile test:
1. Open a historical flock/day in mobile.
2. Enter mortality data.
3. Press `Save Log`.
4. Confirm:
   - the date advances
   - the screen does not hard-flash/reset
   - the workflow remains usable for repeated mortality entry

If that still feels rough, the next immediate patch should preserve the active `Mortality` tab during historical stepping.
