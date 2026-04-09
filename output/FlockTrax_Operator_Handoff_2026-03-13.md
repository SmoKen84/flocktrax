# FlockTrax Operator Handoff

Date: 2026-03-13

Primary recovery file:

`C:\dev\FlockTrax\output\FlockTrax_Consolidated_Recovery_Brief_2026-03-13.md`

## Fast Context

FlockTrax is a poultry flock data system.

Stack:

- Adalo for UI only
- Supabase for auth, permissions, CRUD, views, sync, and integrations

Current target architecture comes from the 2026-02-27 checkpoint, not the older early scaffold.

## Current Truth

- Active auth pattern is `session-create`
- Adalo stores `ftx_session_token`, `ftx_user_id`, `ftx_session_exp`, `ftx_session_expires_at`
- Future API calls should use `Authorization: Bearer {ftx_session_token}`
- Repo path is `C:\dev\FlockTrax`

## Repo Status Summary

The repo is partially transitioned.

What exists:

- `session-create`
- schema for `log_daily`, `log_mortality`, `log_weight`, `placements`
- views including `placements_ui`, `placement_log_daily_ui`, `v_placement`, `v_placement_daily`
- local Supabase toolkit scripts

What is still misaligned with target design:

- older function/view naming is still present
- `log-daily-upsert` is still scaffold code
- `log-daily-get` likely needs cleanup
- split daily/mortality endpoints still exist instead of the newer single daily packet contract

## Target API Direction

Move toward these objects:

- `placements_dashboard_ui`
- `placement_day_ui`
- `dashboard-placements-list`
- `placement-day-get`
- `placement-day-submit`
- `weight-list`
- `weight-upsert`
- later `sync_queue` and `sync-worker`

## Best Next Step

Do not restart from scratch.

Reuse the existing schema and refactor toward the newer API contract.

Recommended order:

1. adapt or replace `placements_ui` into `placements_dashboard_ui`
2. implement `dashboard-placements-list`
3. adapt or replace `v_placement_daily` or `placement_log_daily_ui*` into `placement_day_ui`
4. implement `placement-day-get`
5. implement `placement-day-submit`

## Paste-Into-New-Chat Prompt

"Resume FlockTrax from `C:\dev\FlockTrax\output\FlockTrax_Consolidated_Recovery_Brief_2026-03-13.md` and `C:\dev\FlockTrax\output\FlockTrax_Operator_Handoff_2026-03-13.md`. Adalo is UI-only. Supabase owns auth, CRUD, views, sync, and integrations. `session-create` is the active auth flow. The repo contains older daily-log endpoints and views that need to be aligned to the target API: `dashboard-placements-list`, `placement-day-get`, and `placement-day-submit`."
