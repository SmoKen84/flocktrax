# FlockTrax Sync Worker Checkpoint
Date: 2026-04-20 PM

## Current State
- The Google Sheets sync engine is now far enough along to attempt the first real write-side worker run.
- `Sedberry Farm` and `Woape` column maps have been manually corrected in the live admin screen and are considered ready for sync testing.
- The sync admin UI now has:
  - stable 3-button navigation (`Config`, `Outbox`, `Column Map`)
  - per-farm batch save on the column map screen
  - `Copy Maps From Farm` on the config screen

## Database Migrations Applied

### 1. Sync engine foundation
- `C:\dev\FlockTrax\supabase\migrations\20260420101500_platform_sync_engine_foundation.sql`

Creates:
- `platform.sync_adapters`
- `platform.sync_endpoints`
- `platform.sync_googleapis_sheets`
- `platform.sync_outbox`
- `platform.sync_audit`

### 2. Outbox queue
- `C:\dev\FlockTrax\supabase\migrations\20260420114500_googleapis_outbox_queue.sql`

Creates/adds:
- `platform.sync_outbox.dedupe_key`
- `platform.enqueue_googleapis_sync_day(...)`
- triggers on:
  - `public.log_daily`
  - `public.log_mortality`
  - `public.log_weight`

### 3. Column map table
- `C:\dev\FlockTrax\supabase\migrations\20260420123000_googleapis_column_map.sql`

Creates:
- `platform.sync_googleapis_sheet_columns`
- `platform.ensure_googleapis_sheet_columns(uuid)`

### 4. Column map state
- `C:\dev\FlockTrax\supabase\migrations\20260420131500_googleapis_column_map_state.sql`

Adds:
- `map_state`

Allowed values:
- `enabled`
- `audit_log_only`
- `paused`

### 5. Worker helper functions
- `C:\dev\FlockTrax\supabase\migrations\20260420154500_googleapis_worker_helpers.sql`

Creates:
- `platform.claim_googleapis_outbox(integer)`
- `platform.complete_googleapis_outbox(uuid, text, text, jsonb, jsonb, integer)`

Purpose:
- safe worker claims
- queue completion
- sync audit writes

## Live Admin Screens
- Config:
  - `https://admin.flocktrax.com/admin/sync/googleapis-sheets`
- Outbox:
  - `https://admin.flocktrax.com/admin/sync/googleapis-sheets/outbox`
- Column Map:
  - `https://admin.flocktrax.com/admin/sync/googleapis-sheets/columns`

## Latest Live UI Improvements
- Fixed 3-button sync navigation that stays in the same order on all sync pages.
- Column map page is card-based, not horizontally scroll-heavy.
- Column map saves happen per farm tile, not per row.
- `Paused` rows/tile states read light red.
- Config screen now supports `Copy Maps From Farm`.
- `Copy Maps From Farm` was confirmed working live by the user.

## Worker Foundation Added Locally
Files:
- `C:\dev\FlockTrax\toolkit\sync_engine\worker.py`
- `C:\dev\FlockTrax\toolkit\sync_engine\README.md`
- `C:\dev\FlockTrax\toolkit\sync_engine\requirements.txt`

Worker behavior:
1. claim pending Google Sheets outbox rows
2. load source row from Supabase
3. load enabled column-map rows for the endpoint
4. resolve worksheet/tab from `placement_key`
5. resolve row from `DATE`
6. write or clear mapped cells
7. finalize outbox row as `sent`, `failed`, or `rejected`
8. write one `platform.sync_audit` record

Current worker mode:
- manual batch run, not daemonized
- one outbox item processed at a time
- variant mismatches skip rather than clear
- false boolean flags clear cells
- `audit_log_only` rows are not yet given special audit formatting by the worker

## Source Of Truth Rule
This is now locked in:
- for mapped sync fields, the integrator workbook is the source of truth
- Supabase is the local operational store/edit cache
- FlockTrax should refresh from sheet on edit-open when possible
- users should see the spreadsheet's current value before editing, not stale local data

Short form:
- sync to sheet on save
- sync from sheet on edit-open

## Column Map Status
- `Sedberry Farm`: corrected and valid
- `Woape`: copied from Sedberry and confirmed working

## Audit Log Only Note
- `Audit Log Only` currently means “do not send to Sheets.”
- It does not yet generate a special diary display line from the map metadata by itself.
- Future desired behavior:
  - label audit-only diary entries from the source map origin (`source_table`, `source_field`, `source_variant`)

## Next Resume Point
1. Ensure there are real pending outbox rows from live/mobile/admin saves
2. Run the manual worker:
   - `cd C:\dev\FlockTrax\toolkit\sync_engine`
   - set:
     - `GOOGLE_APPLICATION_CREDENTIALS`
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
   - run:
     - `python worker.py --limit 10`
3. Review:
   - `platform.sync_outbox`
   - `platform.sync_audit`
   - actual Google Sheet cell updates
4. Fix any real-world header/value mismatches revealed by the first sync run
5. After write-side sync is proven, build read-before-edit for synced mobile/admin edit flows

## Stability Note
- This checkpoint is being created at a clean milestone before the first live worker execution.
- Good recovery point if the next run reveals mapping or value-shape issues.
