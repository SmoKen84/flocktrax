# FlockTrax Admin Release 5.4 Closeout And Lifecycle Production Checkpoint

Date: `2026-06-04`  
Captured: `2026-06-04 10:54:01 -05:00`  
Branch: `main`  
HEAD: `14af6b82b06090eababefcfd804e79a9b90eec95`

## Purpose

Capture the production release that shipped the new placement lifecycle, livehaul scheduler, closeout queue, closeout worksheet, archive-summary packet, and the day-1 mortality rule correction.

This checkpoint is the new top-of-stack release baseline for the current admin system.

## Repo State

Committed and pushed to `origin/main`:

- commit: `14af6b8`
- message: `Implement placement lifecycle, livehaul, and closeout workflows`

Repo state immediately after the release commit:

- clean working tree

## Production Deployment

Production web-admin deployment completed through Vercel:

- deployment id: `dpl_FWFfcY4LiEUWiioTZJ1ZghRL6s19`
- inspector: [https://vercel.com/flock-trax/web-admin/FWFfcY4LiEUWiioTZJ1ZghRL6s19](https://vercel.com/flock-trax/web-admin/FWFfcY4LiEUWiioTZJ1ZghRL6s19)
- deployment URL: [https://web-admin-1fjvkv7m2-flock-trax.vercel.app](https://web-admin-1fjvkv7m2-flock-trax.vercel.app)
- production aliases:
  - [https://flocktrax.com](https://flocktrax.com)
  - [https://admin.flocktrax.com](https://admin.flocktrax.com)

Verification:

- local `npm run build` passed after clearing stale `.next` output
- local `npm run typecheck` passed
- `vercel deploy --prod --yes` completed successfully
- Vercel deployment status was `Ready`
- `https://flocktrax.com` returned HTTP `200`

Build notes:

- Vercel build completed successfully
- two non-blocking autoprefixer warnings remain in `app/globals.css` suggesting `flex-end` instead of `end`

## Hosted Admin Build Marker

Hosted `platform.control` row verified after update:

- `group`: `admin`
- `version`: `2.0.0`
- `build`: `7`
- `build_label`: `5.4`
- `released`: `2026-06-04`

Release marker migration created locally and executed against the linked hosted database:

- [20260604133000_bump_admin_release_build_5_4.sql](C:/dev/FlockTrax/supabase/migrations/20260604133000_bump_admin_release_build_5_4.sql)

## Hosted Supabase Changes Applied In This Release Pass

The following hosted updates were confirmed during this release session:

- hosted `platform.control` admin marker bumped to `5.4`
- hosted function `log-mortality-upsert` redeployed
- the earlier first-7/day-1 mortality rule migration was already run successfully:
  - [20260604123000_include_day1_mortality_in_first7_windows.sql](C:/dev/FlockTrax/supabase/migrations/20260604123000_include_day1_mortality_in_first7_windows.sql)

Important business-rule result:

- placement-date DOAs are no longer treated as a separate mortality bucket in the active admin/mobile flow
- placement day now counts as `day 1` for first-7 mortality windows
- hatchery-quality/day-1 warning logic now evaluates the placement date itself

## What Is Now Live

### Placement Lifecycle

Placements now operate with authoritative lifecycle stages:

- `scheduled`
- `awaiting_arrival`
- `in_barn_growing`
- `waiting_closeout`
- `closeout_submitted`
- `archived`

The lifecycle-stage schema and supporting RPCs were committed in this release baseline.

### Livehaul Scheduler

The livehaul scheduler is now a first-class placement workflow:

- dedicated `Placements > Livehaul` route
- flexible `livehaul_schedule` rows instead of `lh1/lh2/lh3` hard slots
- `All Barns` viewing support
- day-tile flock visibility across month fill dates
- target head capture
- target sex capture for breed-spec comparisons
- scheduler behavior aligned to the placement-scheduler pattern

### Closeout Queue And Worksheet

The closeout flow is now structured as:

- queue landing page with one-line placement rows
- sub-state progress matrix:
  - `LH`
  - `Feed`
  - `Inv`
  - `Sent`
  - `Paid`
- focused single-placement closeout workspace
- closeout worksheet backed by `placement_closeouts`
- manual milestone checkboxes driving queue state

### Livehaul-In-Closeout Pattern

Livehaul load entry now lives with closeout, not the scheduler:

- livehaul schedule row acts as the header
- load rows sit underneath like feed-ticket drops
- processed head and live-weight summary roll into closeout
- breed comparison is evaluated by livehaul date, not final removed date
- target sex now controls male/female breed-spec comparison logic

### Reporting And Archive Packet

The following reporting surfaces are now part of the live baseline:

- closeout report
- digital archive summary packet
- feed report launch from closeout
- mortality summary launch from closeout
- first-7-day popup/report launch from closeout
- report tab titles for easier multi-tab operator use

The digital archive summary now opens as a combined document and no longer auto-triggers print.

### Dashboard And Mortality Math

The dashboard/admin path now:

- reads livehaul dates from `livehaul_schedule`
- uses `target_head` for feed-estimator planning before actual load values exist
- applies completed/past livehaul reductions to current projected population
- includes placement date in first-7 mortality windows

### Legacy / Compatibility Mortality Upsert

The older edge function [log-mortality-upsert/index.ts](C:/dev/FlockTrax/supabase/functions/log-mortality-upsert/index.ts) was aligned locally and deployed so it no longer silently carries an old `doa` concept forward.

Current behavior:

- active current-schema mortality fields are accepted
- old `male_dead` / `female_dead` aliases are mapped to current fields for compatibility
- stale legacy fields such as `doa`, `unknown_dead`, `culls`, and `euthanized` are ignored rather than allowed to distort totals

## Local Verification Performed

Local verification performed before deployment:

- `npm run build`
- `npm run typecheck`
- hosted `platform.control` query verification
- hosted function deploy confirmation for `log-mortality-upsert`
- Vercel production deploy confirmation
- live HTTP `200` on `https://flocktrax.com`

## Notable Data Cleanup Performed

During the mortality-rule cleanup work, flock `308-W1` had pre-placement test rows removed from hosted production data:

- old `log_mortality` rows before `2026-06-03`
- old `log_daily` rows before `2026-06-03`

That cleanup was done to keep first-7 mortality, total population, dashboard math, and derived alerts honest for the flock’s real placement date.

## Key Files

- [web-admin/app/admin/flock-closeout/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/page.tsx)
- [web-admin/app/admin/flock-closeout/[placementId]/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/page.tsx)
- [web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx)
- [web-admin/app/admin/flock-closeout/[placementId]/archive-summary/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/archive-summary/page.tsx)
- [web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx)
- [web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx)
- [web-admin/app/admin/placements/livehaul/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/page.tsx)
- [web-admin/app/admin/placements/livehaul/livehaul-scheduler-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-scheduler-forms.tsx)
- [web-admin/app/admin/placements/new/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/new/page.tsx)
- [web-admin/components/active-placement-dashboard.tsx](C:/dev/FlockTrax/web-admin/components/active-placement-dashboard.tsx)
- [web-admin/lib/admin-data.ts](C:/dev/FlockTrax/web-admin/lib/admin-data.ts)
- [web-admin/lib/closeout-data.ts](C:/dev/FlockTrax/web-admin/lib/closeout-data.ts)
- [web-admin/lib/livehaul-scheduler-data.ts](C:/dev/FlockTrax/web-admin/lib/livehaul-scheduler-data.ts)
- [supabase/functions/log-mortality-upsert/index.ts](C:/dev/FlockTrax/supabase/functions/log-mortality-upsert/index.ts)
- [supabase/migrations/20260530193000_add_placement_lifecycle_stage.sql](C:/dev/FlockTrax/supabase/migrations/20260530193000_add_placement_lifecycle_stage.sql)
- [supabase/migrations/20260530204500_create_livehaul_schedule_and_loads.sql](C:/dev/FlockTrax/supabase/migrations/20260530204500_create_livehaul_schedule_and_loads.sql)
- [supabase/migrations/20260602130000_create_placement_closeouts.sql](C:/dev/FlockTrax/supabase/migrations/20260602130000_create_placement_closeouts.sql)
- [supabase/migrations/20260602183000_add_livehaul_target_sex.sql](C:/dev/FlockTrax/supabase/migrations/20260602183000_add_livehaul_target_sex.sql)
- [supabase/migrations/20260602193000_add_closeout_task_milestones.sql](C:/dev/FlockTrax/supabase/migrations/20260602193000_add_closeout_task_milestones.sql)
- [supabase/migrations/20260604123000_include_day1_mortality_in_first7_windows.sql](C:/dev/FlockTrax/supabase/migrations/20260604123000_include_day1_mortality_in_first7_windows.sql)
- [supabase/migrations/20260604133000_bump_admin_release_build_5_4.sql](C:/dev/FlockTrax/supabase/migrations/20260604133000_bump_admin_release_build_5_4.sql)

## Recommended Resume Point

If work resumes in a new chat, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Admin_Release_5_4_Closeout_And_Lifecycle_Production_Checkpoint_2026-06-04.md first.`

Then likely next steps are:

1. Continue closeout workflow refinement from the now-live baseline instead of reconstructing the feature path.
2. Decide whether livehaul `DOA` wording on processing/load screens should remain explicit or be softened.
3. Decide whether the remaining autoprefixer `end` warnings in `globals.css` are worth a cleanup pass.
