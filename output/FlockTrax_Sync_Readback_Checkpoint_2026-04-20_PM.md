# FlockTrax Sync Readback Checkpoint

Date: 2026-04-20 PM
Root: `C:\dev\FlockTrax`

## Confirmed Working

- Google Sheets sync write path is operational end to end:
  - mobile/admin save
  - `platform.sync_outbox` enqueue
  - toolkit worker claim/process
  - Google Sheets cell write
  - sync audit trail
- Google Sheets read-before-edit path is now operational from the mobile app:
  - `log_daily`
  - `mortality`
  - `grades`
  - `weight`
- Verified against test flocks:
  - `999-W1`
  - `999-S1`
- Known good read test:
  - `999-W1`
  - `2026-04-24`

## Important Decisions Locked In

- For mapped sync fields, the integrator spreadsheet is the source of truth.
- FlockTrax does not need to mirror every spreadsheet edit continuously.
- Before a user edits a synced record, FlockTrax should refresh from the spreadsheet if possible.
- Workbook rule:
  - one spreadsheet per farm
  - worksheet/tab name = `placements.placement_key`

## What Was Fixed In This Pass

- Added shared Google Sheets read helper for Supabase edge functions.
- Fixed date matching so ISO dates like `2026-04-24` correctly match sheet rows such as `Fri 4/24/26`.
- Switched sync config/map lookup in read functions to service-role access so mobile user visibility on `platform.sync_*` does not block hydration.
- Marked spreadsheet-backed daily records as existing logs so mobile shows `Update Log` instead of `New Log`.

## Live Components In Play

- Supabase functions:
  - `placement-day-get`
  - `weight-entry-get`
- Shared helper:
  - `supabase/functions/_shared/google-sheets-read.ts`
- Google Sheets sync UI:
  - Config
  - Outbox
  - Column Map
- Sedberry and Woape maps completed.

## Local-Only UI Work Still Not Pushed

- Sync sidebar lands on Outbox.
- Top sync nav order starts with Outbox.
- Outbox stats/refresh improvements.
- Outbox filtering.

## Next Best Step

- Polish the sync operations UI:
  - push the local Outbox improvements live
  - keep tuning queue visibility and workflow
- Then continue with sync-engine operational refinements rather than core plumbing.

## Resume Note

If resuming later, assume:

1. write sync is working
2. read-before-edit is working
3. mobile app may need a full reload if stale state obscures new behavior
4. `999-W1` on `2026-04-24` is the strongest known-good proof record

