# FlockTrax Checkpoint 2026-03-16

## What changed

- Updated `supabase/functions/session-create/index.ts` so local development can mint Adalo-style JWTs without a separately seeded `FTX_JWT_SECRET`.
- Added `role = authenticated` and `aud = authenticated` claims to the minted JWT so the token works with Supabase REST/RLS in the same shape as the verified local smoke token.
- Added `supabase/migrations/20260316083500_fix_can_write_farm_role_code.sql` to reconcile `public.can_write_farm()` with the actual `public.roles(code, ...)` table shape.

## Local validation completed

- `session-create` previously failed with `Missing FTX_JWT_SECRET secret`.
- `session-create` now returns a token locally after falling back to the standard local Supabase JWT secret path.
- A manually minted local JWT signed with the local Supabase dev secret successfully wrote to:
  - `public.log_daily`
  - `public.log_mortality`
- A function-generated `session-create` token also successfully completed the same `placement-day-submit` path.
- The write set `created_by` and `updated_by` to the test user UUID, confirming `auth.uid()` was present in the insert/update path.
- `placement-day-submit` returned a successful combined payload for:
  - `placement_id = 44444444-4444-4444-4444-444444444444`
  - `log_date = 2026-03-14`
- `placement-day-get` round-tripped the same date successfully.
- A local `manager` role row was seeded with id `55555555-5555-5555-5555-555555555555`.
- A local `farm_memberships` row was seeded for the test farm `11111111-1111-1111-1111-111111111111`.
- After applying the `can_write_farm()` fix to the running local DB, `POST /rest/v1/rpc/can_write_farm` returned `true` for the seeded test user.

## Important notes

- The successful first submit test did not depend on farm membership because the current `log_daily` and `log_mortality` RLS policies are permissive for `authenticated`.
- The local running database was updated manually for validation; the durable repo fix is the migration `20260316083500_fix_can_write_farm_role_code.sql`.
- Future local resets should either keep the seeded `manager` role/membership or recreate equivalent access rows before testing flows that depend on `public.can_write_farm()`.

## Suggested next step

1. Decide whether to keep the ad hoc local role/membership seed as a repeatable migration or test seed script.
2. If desired, clean up or retire the older `log-daily-*` compatibility flow now that the Adalo-facing `placement-day-*` round-trip is validated.
