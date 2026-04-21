# FlockTrax Google Sheets Sync Foundation

This folder is the cleaned starting point for the Google Sheets sync engine.

## Why this exists

Earlier sync experiments lived under:

- `C:\dev\gpc_engine`
- `C:\dev\supabase`

Those experiments proved a few key things:

1. Google Sheets auth works.
2. A target worksheet/tab can be located reliably.
3. A column can be found by header label.
4. A row can be found by date.
5. A specific cell can be read, written, or cleared without appending junk.

This folder keeps the useful foundation without the Adalo-specific baggage.

## Database foundation

The first shared sync schema lives in `platform.*` and is designed as a drop-in back-office sync engine:

- `platform.sync_adapters`
- `platform.sync_endpoints`
- `platform.sync_googleapis_sheets`
- `platform.sync_outbox`
- `platform.sync_audit`

For the current Google Sheets adapter:

- one spreadsheet/workbook per farm
- workbook id lives in `platform.sync_googleapis_sheets.spreadsheet_id`
- worksheet/tab name is always `public.placements.placement_key`

## Intended sync model

Near term:

- read/write specific cells in a known workbook
- use `placement_key` to identify a barn/flock worksheet/tab
- use date + header label to locate the correct row/column intersection

Longer term:

- move to an outbox-driven sync flow
- keep a small cache of resolved column indexes and row indexes
- support retries and audit logging

## Current outbox shape

The first queue pass is day-level and adapter-ready:

- mobile writes to `public.log_daily`
- mobile writes to `public.log_mortality`
- mobile writes to `public.log_weight`
- each insert/update can enqueue one `platform.sync_outbox` row for `googleapis-sheets`
- queue payloads already include:
  - workbook id
  - header row
  - date header label
  - worksheet/tab name from `placement_key`
  - source table
  - entity id
  - target log date

The worker still needs the finalized field-to-header column map before it can turn
those queued jobs into concrete cell updates.

## Worker helpers

The first worker pass also depends on database helper functions that safely:

- claim pending `googleapis-sheets` outbox rows
- mark them `in_progress`
- finalize them as `sent`, `failed`, or `rejected`
- write one `platform.sync_audit` row per processed outbox item

Migration:

- `C:\dev\FlockTrax\supabase\migrations\20260420154500_googleapis_worker_helpers.sql`

## Source of truth policy

This changed once a live integrator workbook entered the picture.

For Google Sheets synced fields:

- the integrator workbook is the source of truth
- Supabase is the local operational store and edit cache
- FlockTrax should not assume its stored value is still current when a user opens a synced dataset for editing

Practical rule:

- when a user opens a synced `log_daily`, `log_mortality`, or `log_weight` record for edit
- FlockTrax should read the mapped worksheet cells first, when possible
- the edit form should display the current spreadsheet value before the user changes anything

This does **not** mean FlockTrax must mirror every spreadsheet edit in real time.

It means:

- sync to sheet on save
- sync from sheet on edit-open

That keeps the user from editing blind if the integrator changed a number directly in the workbook.

## First reusable pieces

- `sheets_client.py`
  - service-account based Sheets client
  - finds headers by label
  - finds rows by date
  - reads/writes/clears a single target cell

- `auth_check.py`
  - validates service account auth

- `mapping.example.json`
  - rough shape for workbook/tab mapping decisions

## Environment

Set:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

to the values needed by the worker.

## Install

```powershell
cd C:\dev\FlockTrax\toolkit\sync_engine
python -m pip install -r requirements.txt
```

## Quick auth test

```powershell
cd C:\dev\FlockTrax\toolkit\sync_engine
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
python auth_check.py
```

## Manual worker run

The first worker is a manual batch processor, not a daemon.

It will:

1. claim pending Google Sheets outbox rows
2. load the source log record
3. load the endpoint column map
4. resolve the target tab from `placement_key`
5. resolve the target row from `DATE`
6. write or clear the mapped cells
7. finalize the outbox row and add a `platform.sync_audit` entry

Run:

```powershell
cd C:\dev\FlockTrax\toolkit\sync_engine
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
python worker.py --limit 10
```

The worker talks to Supabase through PostgREST/RPC directly.
It does not require the Python Supabase client.

This first pass is intentionally conservative:

- one outbox item is processed at a time
- each enabled map row is written independently
- failures stop that outbox item and mark it `failed`
- note/comment nulls and false boolean flags clear the target cell
- variant mismatches (for example female columns on a male weight record) are skipped, not cleared

## Design note

This is intentionally a foundation layer only.

It is not yet the final FlockTrax sync engine.
The next build step is to define:

1. workbook id(s)
2. tab naming rules
3. which FlockTrax tables/events produce sync payloads
4. which fields map to which sheet labels
5. whether updates are immediate or outbox-driven
