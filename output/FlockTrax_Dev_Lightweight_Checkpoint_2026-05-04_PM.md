# FlockTrax Dev Lightweight Checkpoint — 2026-05-04 PM

## Purpose

Lightweight continuation point for the **development / bug-fix path**.
Use this instead of the larger weekend recovery notes when resuming normal admin and sync work.

## Current Focus

- `admin.flocktrax.com` web-admin refinement
- Google Sheets sync bug fixes
- feed ticket reporting and editor usability
- keep release/App Store work in a separate track

## Live State

- Feed ticket flock print report is live on `admin.flocktrax.com`
- Breed combobox backfill fix is live on `admin.flocktrax.com`
- Feed ticket list/outbox action icon cleanup is live on `admin.flocktrax.com`
- ODA / OutDoorYN sync mapping fix was applied **directly to live platform rows**

## Most Recent Dev Fix

### Google Sheets ODA checkbox bug

Problem:
- `is_oda_open` was syncing into the sheet’s `OutDoorYN` checkbox column incorrectly
- spreadsheet showed literal `X` / invalid checkbox artifacts instead of a proper checked state

Root cause:
- live map row used `value_mode = boolean_flag`
- worker interprets `boolean_flag` as `X` when true and blank when false
- this is correct for text-marker cells, but wrong for a real Google Sheets checkbox column

Live fix applied:
- changed live `platform.sync_googleapis_sheet_columns` rows for `source_field = is_oda_open`
- `value_mode` changed from `boolean_flag` to `direct`
- notes updated to:
  - `Checkbox cell: write TRUE/FALSE, not X/blank.`

Expected behavior now:
- next synced `is_oda_open = true` should check the checkbox
- next synced `is_oda_open = false` should uncheck it

Repo baseline updated:
- `C:\dev\FlockTrax\supabase\migrations\20260420123000_googleapis_column_map.sql`
  - seed row changed to `direct`
- `C:\dev\FlockTrax\supabase\migrations\20260504123500_fix_oda_checkbox_value_mode.sql`
  - corrective migration added for schema hygiene

Important note:
- live was already corrected directly
- migration still should be run later through the normal migration flow to keep environments aligned

## Recent Web-Admin Work

### Feed Ticket report

Implemented:
- flock-filtered printable report route
- inline `Print Flock Report` button beside `Flock Code`
- page break after header
- portrait print format
- right-justified drop column
- accounting-style negative values `(8,325)`

Primary files:
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\report\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-report-actions.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

### Feed ticket editor / list polish

Implemented:
- dedicated inline edit workspace behavior
- list action icons standardized
- sticky action column flattened visually
- row remove buttons changed to `X`
- editor header simplified

Primary files:
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

### Placement breed options

Implemented:
- placement scheduler now backfills selectable breeds from `public.stdbreedspec` into `public.breeds` when needed

Primary file:
- `C:\dev\FlockTrax\web-admin\lib\placement-scheduler-data.ts`

## Deployment Notes

- Git push alone has not been reliably triggering production
- manual Vercel production deploy has been required for some changes
- when live does not update after push, verify Vercel deployment freshness first

## Best Next Dev-Step

If resuming the dev path:
1. verify the next real ODA sync writes a proper checkbox state
2. if still wrong, inspect write behavior at the Sheets API cell-update level
3. continue feed ticket / sync console polish only after ODA behavior is confirmed

## Switch-Track Note

Next intended action after saving this checkpoint:
- switch to the **release path**
- load:
  - `C:\dev\FlockTrax\output\FlockTrax_Release_Track_Checkpoint_2026-05-04.md`
- respond to Apple’s latest review status/message from the cleaner release context
