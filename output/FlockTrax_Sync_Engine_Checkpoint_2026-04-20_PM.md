# FlockTrax Sync Engine Checkpoint
Date: 2026-04-20 PM

## Current State
- The Google Sheets sync engine now has a real first-pass back-office structure in both the database and the admin console.
- The sync system is no longer just notes and toolkit files. It now has:
  - adapter registry/config
  - farm workbook endpoints
  - outbox queue
  - outbox admin readout
  - per-endpoint column map
  - line-item map states including `Audit Log Only`
  - stable 3-button sync navigation across Config / Outbox / Column Map
  - per-farm batch save on the column-map screen instead of hidden per-row save buttons

## Database Foundation Applied

### 1. Sync engine foundation
Applied migration:
- `C:\dev\FlockTrax\supabase\migrations\20260420101500_platform_sync_engine_foundation.sql`

This created:
- `platform.sync_adapters`
- `platform.sync_endpoints`
- `platform.sync_googleapis_sheets`
- `platform.sync_outbox`
- `platform.sync_audit`

Current Google Sheets convention:
- one workbook per farm
- workbook id stored in `platform.sync_googleapis_sheets.spreadsheet_id`
- worksheet/tab name always equals `public.placements.placement_key`

### 2. Outbox queue
Applied migration:
- `C:\dev\FlockTrax\supabase\migrations\20260420114500_googleapis_outbox_queue.sql`

This added:
- `platform.sync_outbox.dedupe_key`
- `platform.enqueue_googleapis_sync_day(...)`
- triggers on:
  - `public.log_daily`
  - `public.log_mortality`
  - `public.log_weight`

Effect:
- daily, mortality, and weight writes can now auto-enqueue Google Sheets day-sync work into `platform.sync_outbox`

### 3. Column map table
Applied migration:
- `C:\dev\FlockTrax\supabase\migrations\20260420123000_googleapis_column_map.sql`

This created:
- `platform.sync_googleapis_sheet_columns`
- `platform.ensure_googleapis_sheet_columns(uuid)`

Effect:
- each configured farm workbook endpoint gets seeded with a default field-to-header map
- when the migration was run, it returned 2 rows with value `39`, meaning two endpoints were seeded and each got 39 map rows

### 4. Column map state upgrade
Applied migration:
- `C:\dev\FlockTrax\supabase\migrations\20260420131500_googleapis_column_map_state.sql`

This added:
- `platform.sync_googleapis_sheet_columns.map_state`

Allowed values:
- `enabled`
- `audit_log_only`
- `paused`

Meaning:
- `enabled` = write to spreadsheet
- `audit_log_only` = keep only in FlockTrax/audit history
- `paused` = temporarily inactive

## Admin Console UI Live

### Google Sheets config
Live route:
- `/admin/sync/googleapis-sheets`

Purpose:
- one card per farm workbook endpoint
- save spreadsheet id/name, header row, date header, endpoint notes
- save action also ensures default column rows exist for new endpoints

### Google Sheets outbox
Live route:
- `/admin/sync/googleapis-sheets/outbox`

Purpose:
- inspect recent queue rows
- see status, farm, endpoint, placement key, log date, attempts, and last error

### Google Sheets column map
Live route:
- `/admin/sync/googleapis-sheets/columns`

Purpose:
- edit the sheet header label per FlockTrax field
- choose value mode
- choose row state:
  - `Enabled`
  - `Audit Log Only`
  - `Paused`

## Current Live Production Deployments
- Sync config/outbox/column-map slice is live on:
  - `https://admin.flocktrax.com/admin/sync/googleapis-sheets`
  - `https://admin.flocktrax.com/admin/sync/googleapis-sheets/outbox`
  - `https://admin.flocktrax.com/admin/sync/googleapis-sheets/columns`

Most recent deployment in this session:
- `web-admin-jn1l7hf0x-flock-trax.vercel.app`

## Local Toolkit / Reference Files
- `C:\dev\FlockTrax\toolkit\sync_engine\README.md`
- `C:\dev\FlockTrax\toolkit\sync_engine\sheets_client.py`
- `C:\dev\FlockTrax\toolkit\sync_engine\auth_check.py`
- `C:\dev\FlockTrax\toolkit\sync_engine\mapping.example.json`
- `C:\dev\FlockTrax\toolkit\sync_engine\column_map_draft.md`

These are still useful foundation/reference materials, but the system of record is now moving into:
- `platform.sync_*`
- the admin sync screens

## Google Cloud / Credentials
- Google Cloud project name:
  - `FlockTrax Sync`
- Service account name:
  - `flocktrax-sync`
- JSON key exists locally outside repo folders

Important note:
- credentials are not stored in Supabase tables
- workbook ids and sync config are stored in DB
- the actual service account JSON stays external

## What Is Working Now
- farm workbook endpoints can be configured in the admin UI
- the system has a queue (`platform.sync_outbox`)
- core mobile log writes can enqueue day-level sync jobs
- queued jobs are visible in the admin outbox screen
- worksheet header mapping is editable per farm endpoint
- unmapped-but-important data can now be intentionally marked `Audit Log Only`
- synced edit behavior has a locked design rule:
  - spreadsheet = source of truth for mapped sync fields
  - FlockTrax should refresh from sheet on edit-open when possible
  - users should see the current workbook value before editing, not a stale local guess

## What Is Not Built Yet
- The worker that reads `platform.sync_outbox` and performs actual Google Sheets cell updates is not finished yet.
- The exact live workbook header text still needs to be verified/edited in the column-map screen.
- The final field-to-cell write logic still needs to use:
  - endpoint workbook config
  - `placement_key` tab
  - log date row
  - column map rows

## Best Resume Point
1. Open a real farm workbook and verify the actual worksheet header text against the live column-map screen
2. Adjust any `sheet_label` values that differ from the draft defaults
3. Decide which fields should be:
   - `Enabled`
   - `Audit Log Only`
   - `Paused`
4. Build the Google Sheets worker that:
   - claims pending rows from `platform.sync_outbox`
   - resolves the placement tab from `placement_key`
   - resolves the row from `DATE`
   - resolves the columns from `platform.sync_googleapis_sheet_columns`
   - writes the actual cell values
5. After write-side worker exists, add the read-before-edit path for synced fields so edit screens refresh from the workbook before user changes are made

## Stability Note
- User reported intermittent Windows/Codex “application not responding” messages.
- This checkpoint was created specifically to preserve the sync-engine progress before continuing further work.
