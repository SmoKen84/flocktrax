# FlockTrax Consolidated Recovery Brief

Date: 2026-03-13

Purpose: This document consolidates the known project state from prior checkpoint files plus the current codebase in `C:\dev\FlockTrax`, so work can resume quickly after chat loss or handoff.

## Project Summary

FlockTrax is a poultry flock data system using:

- Adalo for UI rendering and data input
- Supabase for authentication, authorization, database access, business logic, sync, and integrations

The architectural direction is to keep Adalo thin and move logic and security into Supabase.

## Source Inputs Used For This Brief

- `C:\Users\Ken\Desktop\CoreProjectCheckpoint.txt`
- `C:\Users\Ken\Desktop\checkpoint.txt`
- Current project files under `C:\dev\FlockTrax`

## Authoritative Direction

Use the 2026-02-27 checkpoint as the target architecture.

Use the 2026-02-16 checkpoint as environment history and early implementation context.

Use the current repo state as the implementation baseline that must be aligned to the newer architecture.

## Environment

- OS: Windows 10
- Project path: `C:\dev\FlockTrax`
- Docker Desktop: installed and previously working
- Supabase CLI: 2.75.0 via Scoop
- Local stack: previously confirmed working with `supabase start`
- Remote project ref noted in checkpoint: `frneaccbbrijpolcesjm`

## Core Architecture Decision

Adalo responsibilities:

- login UI
- dashboard display
- daily data entry screens
- local cache or draft collections for screen state
- calling Supabase Edge Functions

Supabase responsibilities:

- session creation and auth gateway
- permission checks via farm membership data
- CRUD APIs
- read-optimized UI views
- sync queue, triggers, worker, and exports

Adalo should not own business logic or synchronization.

## Confirmed Auth Pattern

Current intended login flow:

1. Adalo user logs in
2. Adalo calls `session-create`
3. Supabase returns:

```json
{
  "ok": 1,
  "user_id": "uuid",
  "token": "jwt",
  "exp": 1234567890,
  "expires_at": "2026-02-27T00:00:00.000Z",
  "message": "Ok"
}
```

4. Adalo stores:

- `ftx_session_token`
- `ftx_user_id`
- `ftx_session_exp`
- `ftx_session_expires_at`

5. Future API calls use:

`Authorization: Bearer {ftx_session_token}`

Repo confirmation:

- `session-create` exists in `supabase/functions/session-create/index.ts`
- It upserts `app_users`
- It ensures a `core_users` row exists
- It mints an 8-hour JWT using `FTX_JWT_SECRET`

## Current Repo State

The repo is not a git repository at the project root currently visible to this session.

Visible top-level folders:

- `supabase`
- `toolkit`
- `output`
- `snapshots`
- `tmp`
- `_gold`

Toolkit notes from `toolkit/README_TOOLKIT.txt`:

- local function testing expects Authorization headers even with `--no-verify-jwt`
- toolkit scripts exist for start, stop, deploy, reset, and local test flows

## Implemented Supabase Functions Found

Auth-related:

- `session-create`
- `auth-login`
- `auth-signup`
- `auth_logout`
- `auth_me`
- `auth_verify_refresh`
- `login`
- `redeem-signup-code`
- `signup_proxy`

Data-related:

- `log-daily-get`
- `log-daily-upsert`
- `log-mortality-upsert`
- `export-adalo`
- `access-shim`
- `hello-world`

## Important Reality Check

The codebase reflects an in-between stage.

It contains the newer `session-create` auth model, but the data endpoints and views still mostly follow older naming and structure rather than the 2026-02-27 target API.

## Database Objects Confirmed In Schema

Confirmed tables:

- `log_daily`
- `log_mortality`
- `log_weight`
- `placements`
- `app_users`
- `core_users`
- `farm_memberships`

Confirmed views:

- `placements_ui`
- `placements_ui2`
- `placement_log_daily_ui`
- `placement_log_daily_ui2`
- `v_placement`
- `v_placement_daily`

Confirmed write helpers and triggers:

- `v_placement_write()`
- `v_placement_daily_write()`
- INSTEAD OF triggers on `v_placement` and `v_placement_daily`

Confirmed uniqueness:

- `log_daily` has unique constraints on `(placement_id, log_date)`
- `log_mortality` has unique constraints on `(placement_id, log_date)`

## Mismatch Between Target Architecture And Repo

Target architecture names from checkpoint:

- `placements_dashboard_ui`
- `placement_day_ui`
- `dashboard-placements-list`
- `placement-day-get`
- `placement-day-submit`
- `weight-list`
- `weight-upsert`
- `sync_queue`
- `sync-worker`

Current repo names actually found:

- `placements_ui`
- `placement_log_daily_ui`
- `placement_log_daily_ui2`
- `v_placement`
- `v_placement_daily`
- `log-daily-get`
- `log-daily-upsert`
- `log-mortality-upsert`

Implication:

The database already has useful read and write structures, but the API layer and naming have not yet been fully migrated to the newer Adalo-oriented design.

## Function Status Assessment

`session-create`

- appears usable
- aligns with the newer checkpoint

`log-daily-upsert`

- still the default hello-world scaffold
- not implemented for real daily writes

`log-daily-get`

- exists, but the file appears partially malformed or mid-edit near the top
- likely needs cleanup before relying on it

`log-mortality-upsert`

- implemented as a separate mortality endpoint
- useful, but not yet aligned with the newer single daily packet submit model

## Adalo UI Pattern To Preserve

Adalo should use local collections for UI state:

- `UI_PlacementDashboardCache`
- `UI_PlacementDayDraft`

Dashboard collection purpose:

- render placement cards from a Supabase dashboard list response

Daily draft collection purpose:

- hold a single editable daily packet for one placement and one date

## Best Current Interpretation

Current project maturity:

1. local Supabase development environment was successfully established
2. auth work evolved from standard auth endpoints toward the custom `session-create` model
3. database schema already contains placement and daily-log foundations
4. repo still uses older function and view naming in several places
5. migration to the cleaner Adalo API contract is incomplete

## Recommended Resume Point

Resume from the newer architecture, but reuse what already exists.

Suggested next sequence:

1. inspect or refactor existing views so they support a clean dashboard contract
2. create or adapt `placements_dashboard_ui`
3. implement `dashboard-placements-list`
4. create or adapt `placement_day_ui`
5. implement `placement-day-get`
6. implement `placement-day-submit`
7. add weight endpoints
8. add sync queue schema, triggers, and worker

## Practical Guidance For The Next Assistant

Do not restart from scratch.

Start by comparing these pairs:

- target `placements_dashboard_ui` versus existing `placements_ui` or `placements_ui2`
- target `placement_day_ui` versus existing `placement_log_daily_ui`, `placement_log_daily_ui2`, or `v_placement_daily`
- target `placement-day-submit` versus current split logic in `log-daily-upsert` and `log-mortality-upsert`

Preserve the `session-create` token flow unless the user explicitly changes direction.

Assume Adalo should remain a thin client.

## Known Risks Or Cleanup Areas

- `log-daily-get` likely needs repair before use
- `log-daily-upsert` is not implemented
- view and function naming is inconsistent across checkpoints and repo
- sync objects from the later checkpoint are not yet confirmed in the repo
- RLS is present, but the current policies in the baseline schema may be broader than the final intended farm-membership model

## Suggested Immediate Task Options

- create a clean dashboard view and `dashboard-placements-list`
- normalize the daily packet read model into `placement_day_ui`
- replace older split endpoints with a single `placement-day-submit`
- create a smaller technical map of current schema object purpose and rename candidates

## Short Recovery Prompt

Use this if a future chat needs a fast restart:

"Resume FlockTrax from `C:\dev\FlockTrax\output\FlockTrax_Consolidated_Recovery_Brief_2026-03-13.md`. Adalo is UI-only. Supabase owns auth, CRUD, views, sync, and integrations. `session-create` is the active auth pattern. The repo contains older daily-log view and function names that need to be aligned to the newer architecture with `dashboard-placements-list`, `placement-day-get`, and `placement-day-submit`."
