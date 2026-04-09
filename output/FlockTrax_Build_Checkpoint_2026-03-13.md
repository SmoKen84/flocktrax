# FlockTrax Build Checkpoint

Date: 2026-03-13

Checkpoint ID: FlockTrax_DashboardAndDailyPacket_API_Slice_2026-03-13

## What Was Added

### New views

- `public.placements_dashboard_ui`
- `public.placement_day_ui`

### New migrations

- `C:\dev\FlockTrax\supabase\migrations\20260313093000_create_placements_dashboard_ui.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260313094500_create_placement_day_ui.sql`

### New Edge Functions

- `dashboard-placements-list`
- `placement-day-get`
- `placement-day-submit`

### Config updates

`supabase/config.toml` now registers:

- `dashboard-placements-list`
- `placement-day-get`
- `placement-day-submit`

All three are set with `verify_jwt = false` to match the current Adalo session-token flow.

## Dashboard API

### View

`placements_dashboard_ui` is a compatibility view built on top of `placements_ui2` plus `flocks`.

It exposes:

- `placement_id`
- `farm_name`
- `barn_code`
- `placement_code`
- `placed_date`
- `est_first_catch`
- `age_days`
- `head_count`
- `is_active`
- `is_removed`
- `is_complete`
- `is_in_barn`
- `is_settled`

`head_count` is derived from:

- `flocks.start_cnt_females`
- `flocks.start_cnt_males`

### Function

`dashboard-placements-list`:

- supports `GET`, `POST`, and `OPTIONS`
- supports Adalo schema capture via `x-adalo-test: true`
- requires `Authorization: Bearer <token>` in normal mode
- returns:

```json
{
  "ok": true,
  "items": [...],
  "count": 12
}
```

Default behavior:

- returns active placements only

Optional behavior:

- `include_inactive=true` will include inactive placements

## Daily Packet Read API

### View

`placement_day_ui` is a compatibility read view built from:

- `v_placement_daily`
- `placements`
- `farms`
- `barns`
- `flocks`

It exposes both editable daily fields and display metadata.

### Function

`placement-day-get`:

- supports `GET`, `POST`, and `OPTIONS`
- supports Adalo schema capture via `x-adalo-test: true`
- requires `placement_id` and `log_date`
- returns an existing combined packet if one exists
- returns a synthesized draft packet if no log exists yet for that date

Draft fallback behavior:

- uses placement metadata from `placements_ui2`
- computes `placement_age_days` from `log_date - date_placed`
- defaults mortality counts to `0`
- defaults booleans to active or false where appropriate
- includes `is_existing_log: false`

## Daily Packet Write API

### Function

`placement-day-submit`:

- supports `POST` and `OPTIONS`
- supports Adalo schema capture via `x-adalo-test: true`
- requires `placement_id` and `log_date`
- accepts one payload that can contain daily fields, mortality fields, or both
- upserts into `log_daily` and `log_mortality`
- returns the saved rows and the combined `placement_day_ui` row

Response shape:

```json
{
  "ok": true,
  "daily_saved": true,
  "mortality_saved": true,
  "daily_row": {...},
  "mortality_row": {...},
  "item": {...}
}
```

## Important Notes

- No end-to-end runtime test was executed yet in this session.
- Local migration apply and function invocation still need to be run against the local Supabase stack.
- Existing legacy functions remain in the repo for now:
  - `log-daily-get`
  - `log-daily-upsert`
  - `log-mortality-upsert`

## Best Next Step

Run the local stack and test these three endpoints:

1. `dashboard-placements-list`
2. `placement-day-get`
3. `placement-day-submit`

After that, decide whether to:

- keep the legacy endpoints temporarily, or
- retire them in favor of the new placement-day API

## Recovery Prompt

"Resume FlockTrax from `C:\dev\FlockTrax\output\FlockTrax_Build_Checkpoint_2026-03-13.md`. The first Adalo-facing compatibility API slice is implemented: `placements_dashboard_ui`, `placement_day_ui`, `dashboard-placements-list`, `placement-day-get`, and `placement-day-submit`. Next step is local Supabase migration/function testing and then cleanup of legacy daily-log endpoints."
