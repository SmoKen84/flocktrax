# FlockTrax Dashboard Weight + Sync Checkpoint

Date: 2026-04-20 PM
Workspace root: `C:\dev`

## Current system state

This checkpoint captures the system after the Google Sheets sync engine, read-before-edit behavior, and the dashboard weight fallback were all proven working.

The system is now operating as a real two-way sync workflow:

1. FlockTrax writes operational records into Supabase.
2. Sync outbox rows are created automatically.
3. The Google Sheets worker processes those queue rows and writes mapped values into the farm workbook.
4. When a user opens a synced record for edit, FlockTrax pulls the spreadsheet values back first so the user is editing current integrator truth instead of stale local values.
5. The admin dashboard now also falls back to spreadsheet-backed weight data when the local weight row has a date but missing averages.

## Source-of-truth rule now in force

For mapped sync fields:

- Google Sheets is the source of truth.
- Supabase remains the local operational store and queue origin.
- Before edit, FlockTrax should hydrate from the sheet when possible.
- FlockTrax is not trying to mirror every integrator edit continuously in the background.
- The important behavior is that users are not editing blind.

This rule has now been proven on the mobile side for:

- daily log
- mortality
- grades
- weight

## Latest completed fix

### Dashboard weight block fallback

Issue:

- The dashboard weight block for `W1` showed an `As Of 4/24` date but did not show the male weight.
- Root cause: `web-admin/lib/admin-data.ts` was building dashboard weight summaries only from raw `public.log_weight` rows.
- In the sync model, a local weight row can exist with the correct date while the actual weight values are only available through the spreadsheet-backed read path.

Fix:

- Added a server-side dashboard fallback in `web-admin/lib/admin-data.ts`.
- If the latest local weight row has a date but a missing male or female average, the dashboard now calls the hosted `weight-entry-get` function for that placement/date.
- The returned sheet-backed sample values are then used to hydrate the dashboard tile summary.

Result:

- The dashboard can now show the same spreadsheet-backed weight truth that the mobile editor already shows.

## Latest live deployment

Web admin production deployment:

- Vercel deployment id: `dpl_3EXwJYVwfwEXwZbZVc4UFBPqpJCi`
- Production URL: `https://web-admin-5g4hjnulx-flock-trax.vercel.app`
- Aliases confirmed:
  - `https://admin.flocktrax.com`
  - `https://flocktrax.com`

This deployment includes:

- outbox stats band layout
- outbox filtering
- sync UI routing refinements
- latest dashboard weight tile fallback

## Sync engine status

### Database foundation

Applied migrations already in place:

- `20260420101500_platform_sync_engine_foundation.sql`
- `20260420114500_googleapis_outbox_queue.sql`
- `20260420123000_googleapis_column_map.sql`
- `20260420131500_googleapis_column_map_state.sql`
- `20260420154500_googleapis_worker_helpers.sql`

### Sync admin UI

Live under `admin.flocktrax.com`:

- `Config`
- `Outbox`
- `Column Map`

Working features:

- farm workbook config
- copy maps from farm
- outbox stats
- outbox refresh
- outbox filters
- stable 3-button sync nav
- column map states:
  - `Enabled`
  - `Audit Log Only`
  - `Paused`

### Column maps

Confirmed complete for:

- Sedberry
- Woape

Important worksheet convention:

- one workbook per farm
- worksheet/tab name = `placement_key`

### Worker

Local toolkit worker exists and works:

- path: `C:\dev\FlockTrax\toolkit\sync_engine\worker.py`

It currently:

- claims pending rows
- loads source records
- loads enabled map rows
- resolves placement tab by `placement_key`
- resolves date row
- writes mapped values into Google Sheets
- marks queue rows `sent`, `failed`, or `rejected`
- writes sync audit entries

This proved successfully against real test data.

## Hosted Supabase function status

Working shared reader:

- `supabase/functions/_shared/google-sheets-read.ts`

Working read-before-edit functions:

- `supabase/functions/placement-day-get/index.ts`
- `supabase/functions/weight-entry-get/index.ts`

Important behavior currently working:

- date matching against sheet rows like `Fri 4/24/26`
- service-role lookup for sync config and map access
- daily logs hydrate from sheet before edit
- weight entry hydrates from sheet before edit
- daily log now marks spreadsheet-backed rows as existing logs instead of `New Log`

## Known test data and proof points

Clean test flocks created:

- Woape: `999-W1`
- Sedberry: `999-S1`

Known successful readback proof:

- `999-W1`
- date: `2026-04-24`

Verified on mobile:

- daily log values read from sheet
- mortality values read from sheet
- grades read from sheet
- weight values read from sheet

## Activity/audit logging

The diary/audit log foundation is in place.

Concept in force:

- do not duplicate all operational table detail into the diary
- log meaningful events and memo-style comments
- support future inspector-facing activity evidence

`Audit Log Only` in column maps currently means:

- do not sync that row to Sheets
- preserve mapping intent

It does **not yet** create a special derived diary line from the map row by itself. That is still a future refinement if wanted.

## Weather idea captured

User raised a future enhancement:

- prefill certain environmental fields using an external weather API
- examples: daily high, daily low, current outside temp
- goal: avoid asking the user to manually enter values that come from a public weather source

This has **not** been implemented yet.

## Mobile app status

The mobile app can be started from:

- `C:\dev\FlockTrax\mobile`

Current state:

- no new mobile code was required for the latest sync proof
- the mobile app is still Expo-managed
- there is still no generated native iOS project checked in

## Important local/non-deployed items

Toolkit code and checkpoint docs remain local assets unless separately copied or deployed:

- `toolkit/sync_engine/*`
- output checkpoint markdown files

The worker itself is local/manual at this stage. It is not yet turned into a hosted scheduled service.

## Next best steps

Recommended next sequence:

1. Decide whether to productize the worker.
   - Options:
     - keep manual/local worker during alpha
     - move to hosted scheduled execution later
2. Add better queue semantics/naming if desired.
   - User noted `Outbox` may be better renamed to `Task Queue` or `Task Outbox`.
3. Consider adding sync audit visibility improvements.
   - richer status details
   - better per-endpoint troubleshooting
4. Consider turning `Audit Log Only` rows into explicit diary line generation if still desired.
5. Evaluate weather-prefill feature for environmental fields.
6. Continue broader live alpha testing across:
   - mobile to DB
   - DB to Sheets
   - Sheets back to mobile/admin edit flows
7. Resume the longer-range work after sync:
   - Google Sheets sync hardening
   - eventual integrator/generalized adapter model growth
   - later iOS/TestFlight path

## Suggested immediate resume point

When work resumes, the safest starting prompt is:

> Continue from the 2026-04-20 PM dashboard weight + sync checkpoint. The two-way Google Sheets sync is working, the dashboard weight fallback is live, and the next decision is whether to harden/productize the worker or add the next sync refinement.

