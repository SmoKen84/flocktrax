# FlockTrax Mobile Checkpoint

Date: 2026-04-06
Context: Mobile app polish and placement-day form completion checkpoint before testing resumes.

## Completed

- Darkened the shared mobile background slightly so tiles stand out better.
- Tightened header spacing across the mobile shell, login, and dashboard.
- Polished the placement-day screen to better match the mockup.
- Updated the daily log header tiles:
  - removed the `Placement` label from the flock code tile
  - made `Age` display with a larger value and no `days`
  - applied a larger flock code treatment without wrapping
- Updated `Entry Date` behavior:
  - resting display follows the options-table date format
  - edit mode uses standard US `MM/DD/YY`
- Added the `In the life of a chick...` task card:
  - up to 4 age-based tasks
  - table-driven from Supabase
  - local-only X checkboxes
- Updated daily weather/environment fields:
  - changed `Ambient Temp` intent to `Humidity`
  - added outside temps for `Current`, `Low`, and `High`
- Added `Water Meter` entry field to the daily log.
- Wired the 4 bottom boolean fields into saved `log_daily` values.
- Dashboard status behavior now works across mobile and web:
  - `Bird Health Alert` -> red
  - maintenance/feedline/nipple flags -> yellow `Needs R&M`
  - green badge shows completion time instead of `Complete`

## Schema Changes Applied

These SQL files were run manually in the Supabase SQL editor and completed successfully:

- `supabase/migrations/20260313094500_create_placement_day_ui.sql`
- `supabase/migrations/20260316083500_fix_can_write_farm_role_code.sql`
- `supabase/migrations/20260406120000_daily_age_tasks.sql`
- `supabase/migrations/20260406133000_log_daily_weather_fields.sql`
- `supabase/migrations/20260406143000_log_daily_alert_flags.sql`
- `supabase/migrations/20260406150000_log_daily_water_meter.sql`

## Deployments Completed

These functions were deployed:

- `placement-day-get`
- `placement-day-submit`
- `dashboard-placements-list`

## Testing To Do Next

- Reload the mobile app.
- Open a placement-day record and verify load/save for:
  - `Humidity`
  - `Outside Temp Current`
  - `Outside Temp Low`
  - `Outside Temp High`
  - `Water Meter`
  - bottom alert flags
- Confirm the task card shows up to 4 age-based tasks.
- Confirm dashboard badge behavior:
  - health alert -> red
  - maintenance/feedline/nipple flags -> yellow
  - normal completion today -> green with time

## Follow-Up

- Reconcile Supabase migration history later, since several migrations were applied manually instead of via `supabase db push`.
- Continue mobile screen polish after functional verification.
