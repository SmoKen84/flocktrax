# FlockTrax Schema To API Map

Date: 2026-03-13

Purpose: Map the existing database objects in `C:\dev\FlockTrax` to the target Adalo-facing API described in the later checkpoint.

## Summary

Best dashboard base:

- `public.placements_ui2`

Best daily packet base:

- `public.v_placement_daily`

These two objects provide the least-disruptive path to the target API.

## Dashboard Mapping

Target object:

- `placements_dashboard_ui`

Best current source:

- `placements_ui2`

Why:

- already returns one row per placement
- already includes farm and barn labels
- already includes `first_catch`
- already includes calculated `age_today`

Fields already present in `placements_ui2`:

- `placement_id`
- `placement_key`
- `farm_id`
- `farm_code`
- `farm_name`
- `barn_id`
- `barn_code`
- `flock_id`
- `flock_number`
- `date_placed`
- `date_removed`
- `is_active`
- `created_at`
- `updated_at`
- `sort_code`
- `first_catch`
- `age_today`

Target response fields from checkpoint likely needed for Adalo cache:

- `placement_id`
- `farm_name`
- `barn_code`
- `placement_code`
- `placed_date`
- `est_first_catch`
- `age_days`
- `head_count`
- status flags

Gap notes:

- `placement_key` can likely serve as `placement_code`
- `date_placed` can map to `placed_date`
- `first_catch` can map to `est_first_catch`
- `age_today` can map to `age_days`
- `head_count` is not visible in `placements_ui2` and may need to come from `placements`, `flocks`, or another source not yet mapped
- status flags may need to be derived from `is_active`, `date_removed`, or additional business rules

Recommendation:

Create `placements_dashboard_ui` as either:

1. a renamed or replacement view derived from `placements_ui2`, or
2. a new compatibility view that selects from `placements_ui2` with target field names

Option 2 is lower risk.

## Daily Packet Mapping

Target object:

- `placement_day_ui`

Best current source:

- `v_placement_daily`

Why:

- already merges `log_daily` and `log_mortality`
- already produces one logical row per `placement_id + log_date`
- already exposes most fields named in the later checkpoint

Fields already present in `v_placement_daily`:

- `placement_id`
- `log_date`
- `age_days`
- `am_temp`
- `set_temp`
- `ambient_temp`
- `min_vent`
- `is_oda_open`
- `oda_exception`
- `naoh`
- `comment`
- `daily_is_active`
- `dead_female`
- `dead_male`
- `cull_female`
- `cull_male`
- `cull_female_note`
- `cull_male_note`
- `dead_reason`
- `grade_litter`
- `grade_footpad`
- `grade_feathers`
- `grade_lame`
- `grade_pecking`
- `mortality_is_active`

Checkpoint daily draft fields included examples like:

- `placement_id`
- `log_date`
- `age_days`
- `am_temp`
- `set_temp`
- `ambient_temp`
- `min_vent`
- `is_oda_open`
- `oda_exception`
- `naoh`
- `comment`
- mortality fields

Gap notes:

- `v_placement_daily` does not include display labels such as farm name, barn code, or placement code
- if the Adalo detail screen needs labels and not just editable data, then `placement_day_ui` should join placement metadata onto `v_placement_daily`
- field naming is already close to the target checkpoint naming, which makes this a strong base

Recommendation:

Create `placement_day_ui` as a new read view that:

- starts from `v_placement_daily`
- joins `placements`, `farms`, `barns`, and possibly `flocks`
- adds display metadata for the detail screen
- keeps the editable payload fields unchanged where possible

## Submit API Mapping

Target object:

- `placement-day-submit`

Current related objects:

- `log-daily-upsert` (not implemented)
- `log-mortality-upsert` (implemented separately)
- `v_placement`
- `v_placement_daily`
- trigger functions `v_placement_write()` and `v_placement_daily_write()`

Interpretation:

The database already has a good write abstraction through the updatable placement views and triggers.

That means `placement-day-submit` probably should not write directly to `log_daily` and `log_mortality` separately if we want a cleaner contract.

Recommendation:

Implement `placement-day-submit` against `v_placement_daily` or `v_placement` so one payload can write both daily and mortality fields through the existing trigger-based write path.

## Read API Mapping

Target object:

- `dashboard-placements-list`

Best source:

- `placements_dashboard_ui` backed initially by `placements_ui2`

Target object:

- `placement-day-get`

Best source:

- `placement_day_ui` backed initially by `v_placement_daily` plus placement metadata joins

## Immediate Build Plan

1. Create a compatibility dashboard view from `placements_ui2`
2. Implement `dashboard-placements-list`
3. Create a compatibility daily packet view from `v_placement_daily`
4. Implement `placement-day-get`
5. Implement `placement-day-submit` using the view-based write path

## Decision Rationale

This path reuses the most complete objects already in the schema and avoids rebuilding the domain model from scratch.

It also aligns the API contract to the newer checkpoint without forcing a risky wholesale rename of existing objects all at once.
