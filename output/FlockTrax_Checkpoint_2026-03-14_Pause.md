# FlockTrax Checkpoint 2026-03-14 (Pause Point)

## Current Situation

We paused after recovering the local Supabase environment and validating most of the new Adalo-facing API slice.

Project path:
- `C:\dev\FlockTrax`

Key recovery docs already in `output`:
- `FlockTrax_Consolidated_Recovery_Brief_2026-03-13.md`
- `FlockTrax_Operator_Handoff_2026-03-13.md`
- `FlockTrax_Schema_To_API_Map_2026-03-13.md`
- `FlockTrax_Build_Checkpoint_2026-03-13.md`
- `FlockTrax_Local_Supabase_Bootstrap_Diagnosis_2026-03-14.md`

## Code Added Earlier In This Session Chain

New compatibility views:
- `supabase/migrations/20260313093000_create_placements_dashboard_ui.sql`
- `supabase/migrations/20260313094500_create_placement_day_ui.sql`

New functions:
- `supabase/functions/dashboard-placements-list/index.ts`
- `supabase/functions/placement-day-get/index.ts`
- `supabase/functions/placement-day-submit/index.ts`

Config updated:
- `supabase/config.toml` registers the 3 new functions

## Local Supabase Bootstrap Outcome

We spent a lot of time on a local Supabase failure that originally looked like a Docker bug.

What turned out to matter:
- local stack was repeatedly failing on missing `/docker-entrypoint-initdb.d/init-scripts/99-roles.sql`
- old cached temp metadata in `supabase/.temp` was pinning the project to stale local service versions
- after clearing stale version cache files under `supabase/.temp`, the local stack rebuilt correctly
- local DB is now healthy again

Important current local state:
- `docker ps` shows `supabase_db_FlockTrax` on `public.ecr.aws/supabase/postgres:17.6.1.095`
- `supabase start` now works again and exposes:
  - Project URL: `http://127.0.0.1:54321`
  - REST: `http://127.0.0.1:54321/rest/v1`
  - Edge Functions: `http://127.0.0.1:54321/functions/v1`
- `supabase status` still warns that local versions differ from linked remote project versions
- current `supabase/config.toml` has `major_version = 17`

Note:
- earlier during debugging, `docker inspect` still showed the old Postgres 15 image, but after clearing the stale `.temp` cache and restarting, the running DB image is now Postgres 17.6.1.095

## Local Test Data Added

The local reset left core data empty, so one minimal test farm/barn/flock/placement chain was seeded directly into Postgres for endpoint testing.

Seeded IDs:
- farm: `11111111-1111-1111-1111-111111111111`
- barn: `22222222-2222-2222-2222-222222222222`
- flock: `33333333-3333-3333-3333-333333333333`
- placement: `44444444-4444-4444-4444-444444444444`

Seeded business values:
- farm code: `TST01`
- farm name: `Local Test Farm`
- barn code: `B1`
- flock number: `1001`
- placement key: `1001-B1`
- placed date: `2026-03-01`
- female count: `12000`
- male count: `8000`

Important insert detail:
- core domain tables use trigger `public.set_audit_user_columns()`
- successful seed insert required setting `request.jwt.claim.sub` in the SQL session to `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- otherwise `created_by` / `updated_by` checks fail

## Smoke Tests Completed

### 1. `dashboard-placements-list`

Adalo test path works:
- GET with header `x-adalo-test: true` returns canned sample payload

Live path works against local DB:
- called with local secret key in `apikey` and `Authorization`
- returned 1 real placement from `placements_dashboard_ui`

Observed live response summary:
- placement_id: `44444444-4444-4444-4444-444444444444`
- farm_name: `Local Test Farm`
- barn_code: `B1`
- placement_code: `1001-B1`
- placed_date: `2026-03-01`
- est_first_catch: `2026-04-08`
- age_days: `14`
- head_count: `20000`
- count: `1`

### 2. `placement-day-get`

Live path works for a date with no existing log row yet.

Tested:
- `placement_id=44444444-4444-4444-4444-444444444444`
- `log_date=2026-03-14`

Observed live response summary:
- returned synthesized draft packet
- `is_existing_log: false`
- `placement_age_days: 13`
- daily values null/defaulted as expected
- mortality values zero/defaulted as expected

### 3. `placement-day-submit`

This is the remaining unfinished piece.

Attempted live POST with:
- secret key in `apikey`
- secret key in `Authorization: Bearer ...`
- valid payload for daily + mortality fields

Observed failure:
- `Daily upsert failed: new row for relation "log_daily" violates check constraint "log_daily_created_by_present_ck"`

## Meaning Of The Remaining Submit Failure

This does **not** look like a routing problem.

The submit endpoint is clearly reaching the real tables and attempting the upsert.
The failure is about audit context.

Why it happens:
- `log_daily` and related tables rely on trigger `public.set_audit_user_columns()`
- that trigger sets `created_by` / `updated_by` from `auth.uid()`
- using the local secret key as the Bearer token does not produce a user JWT with a usable `sub` for `auth.uid()`
- result: insert reaches the table, trigger leaves audit user columns null, constraint fails

So the remaining work is to test `placement-day-submit` with a **real app/user JWT**, not the service/secret key hack used for the read smoke tests.

## Auth Path Investigated

We inspected:
- `supabase/functions/session-create/index.ts`

Important behavior:
- `session-create` upserts into `app_users`
- ensures `core_users` row exists
- mints a custom JWT signed with `FTX_JWT_SECRET`
- token subject (`sub`) is `app_users.user_id`

This appears to be the intended Adalo auth path for the project.

## Access Model Investigated

We also inspected permission helpers:
- `public.can_access_farm(uuid)`
- `public.can_write_farm(uuid)`

Findings:
- read access requires either admin or an active row in `farm_memberships` for `auth.uid()`
- write access requires either admin or an active `farm_memberships` row joined to `roles` where role is effectively `admin` or `manager`

Important discovery:
- current local `roles` table is empty
- actual local columns are: `id`, `code`, `description`, `created_at`
- but `can_write_farm()` references `r.role_key`, which looks inconsistent with the current local `roles` table shape

That inconsistency needs to be revisited before finishing the full auth-based submit test.

## Best Next Step When Resuming

Resume in this order:

1. create a local Adalo-style user token through `session-create`
2. inspect and seed the minimal access rows needed for that user:
   - `app_users` / `core_users` should already be handled by `session-create`
   - add `farm_memberships` for farm `11111111-1111-1111-1111-111111111111`
3. reconcile the `roles` / `can_write_farm()` mismatch
   - current table has `code`
   - function references `role_key`
4. retry `placement-day-submit` using the real minted user token
5. confirm the saved row round-trips through `placement-day-get` and `placement_day_ui`
6. if submit succeeds, capture one more checkpoint and then consider cleaning up legacy `log-daily-*` flow

## Useful Live Values For Resume

Local URLs:
- Project URL: `http://127.0.0.1:54321`
- Edge Functions: `http://127.0.0.1:54321/functions/v1`
- DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

Local keys from `supabase start` at pause time:
- Publishable: `[redacted local publishable key]`
- Secret: `[redacted local secret key]`

Seeded placement for testing:
- `44444444-4444-4444-4444-444444444444`

Good test date:
- `2026-03-14`

## Short Resume Prompt

Use this if starting a fresh chat:

"We are resuming `C:\dev\FlockTrax`. The new compatibility views and functions (`placements_dashboard_ui`, `placement_day_ui`, `dashboard-placements-list`, `placement-day-get`, `placement-day-submit`) are already added. Local Supabase is working again after clearing stale `supabase/.temp` version cache files. A seeded local test placement exists with id `44444444-4444-4444-4444-444444444444`. `dashboard-placements-list` and `placement-day-get` passed live smoke tests. `placement-day-submit` still fails because audit triggers require a real user JWT for `auth.uid()`. Resume by using `session-create`, wiring farm access for the test user, reconciling the `roles` vs `can_write_farm()` mismatch, and finishing the submit round-trip test." 
