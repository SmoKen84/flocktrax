# FlockTrax Admin Live Dashboard Checkpoint 2026-04-03

## Current state

Primary workspace:
- `C:\dev\FlockTrax`

Main app areas touched in this stretch:
- `C:\dev\FlockTrax\web-admin`
- `C:\dev\FlockTrax\mobile`
- `C:\dev\FlockTrax\supabase`

Important visual reference used for current work:
- `C:\dev\FlockTrax\images\sample-DashboardTiles.jpg`

## What was confirmed

### Mobile vs admin data source mismatch

This was confirmed and then corrected at the feedback level:
- `FlockTrax-mobile` was using hosted/live Supabase function data
- `FlockTrax-admin` was appearing to use local/mock data

Root cause:
- admin loader in `web-admin/lib/admin-data.ts` used to silently fall back to mock data when live Supabase reads failed

That silent fallback was removed.

Current behavior:
- admin now throws a visible error instead of masking the issue with mock records
- error screen lives at:
  - `C:\dev\FlockTrax\web-admin\app\admin\error.tsx`

### First real admin schema error found and fixed

Visible error exposed by new admin error path:
- `Admin data failed to load from Supabase: column placements.date_placed does not exist`

Fix applied:
- admin loader was aligned with the working hosted function pattern
- `placements.date_placed` is no longer queried directly
- placement date now comes from the related `flocks.date_placed`

File changed:
- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`

## Major work completed tonight

### 1. Admin dashboard tiles now use live rollup math

The active placement tiles were upgraded to use live aggregate data from hosted Supabase instead of only simplistic flock totals.

Current rollup inputs:
- `placements`
- `flocks`
- `log_mortality`
- `log_weight`
- `v_placement_daily`

Current live-calculated placement tile fields:
- started female count
- started male count
- mortality female total
- mortality male total
- current female count
- current male count
- mortality totals for first 7 days
- mortality totals for last 7 days
- latest weight average for females
- latest weight average for males
- latest weigh counts by sex
- latest weight log date

The effective design decision in code is now:
- use live rollups from source tables
- do not store mutable bucket counters back onto `placements`

This is the current recommended architecture because:
- mortality edits/corrections will automatically flow through
- no drift between source logs and dashboard totals
- current scale of placements appears manageable for live rollups

### 2. Tile component was redesigned toward the mockup

The active placement tile UI was heavily reshaped to move toward the sample image.

Current tile sections now include:
- large barn code at top
- farm and farm group context
- placement / placed / age summary row
- sex-split mortality matrix with:
  - Started
  - Mortality
  - Current
  - Loss %
- summary chips for:
  - First 7 days
  - Current
  - Last 7 days
- a `Live Haul` panel
- a `Weights` panel
- today’s packet completion progress bar

Main files changed:
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

### 3. Type model expanded for live tile data

`ActivePlacementRecord` was expanded to support the new live rollup data fields.

File changed:
- `C:\dev\FlockTrax\web-admin\lib\types.ts`

### 4. Mock data compatibility preserved

The older `mock-data.ts` fixture no longer matches the expanded live placement record shape.
Rather than backfilling every mock field immediately, compatibility was preserved with an explicit cast.

File changed:
- `C:\dev\FlockTrax\web-admin\lib\mock-data.ts`

## Important files now driving the current admin state

### Data / loader
- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`

This file now:
- loads live farm groups, farms, barns, flocks, placements
- aggregates mortality totals by sex
- aggregates 7-day mortality buckets
- aggregates latest weights by sex
- throws visible admin-data errors instead of silently falling back

### Dashboard UI
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`

This file now renders:
- the upgraded mockup-inspired placement tiles

### Shared types
- `C:\dev\FlockTrax\web-admin\lib\types.ts`

### Global styles
- `C:\dev\FlockTrax\web-admin\app\globals.css`

### Admin shell / sidebar
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`

## What remains incomplete / important nuance

### Breed display is not fully resolved

The schema shows:
- `flocks.breed_males`
- `flocks.breed_females`

There is also:
- `public.stdbreedspec`

But a clean readable breed-name lookup path was not fully wired for the dashboard tiles yet.

So current tile redesign prioritizes:
- live counts
- mortality math
- weight summaries

and does not yet fully replicate any breed-name text blocks from the mockup.

### Weight display is partially real

Current `Weights` panel is based on:
- latest `log_weight` rows by sex

So it can show real values when weights exist.

It is not yet doing:
- breed target comparison
- pro chart logic
- completion percentages for scale data

### Mockup fidelity is improved but not final

The current tile layout is structurally much closer to the image reference, but it is still not a final visual match.

Expected next polish areas:
- card spacing
- line density
- typography sizing
- chip styling
- more exact panel proportions
- more compact table treatment

## New request received but not yet implemented

User gave a new sidebar/settings request that was **not yet built** before this checkpoint was requested.

Requested behavior:
- add a `Settings` menu option on the left pane menu
- likely accessed by a gear icon above and toward the corner of the logo head
- selecting Settings should remove current menu items
- replace them with a menu titled:
  - `Settings & Preferences`
- under subtitle `Settings`, first option should be:
  - `General`
- selecting `General` should display in tabular form the `public.Settings` table from Supabase
- only if the user has `admin` or higher role

Current status of that request:
- requested
- not yet implemented
- no sidebar/menu refactor for settings exists yet

Most relevant file for that future work:
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`

## Verification completed

TypeScript validation was run from:
- `C:\dev\FlockTrax\web-admin`

Command:

```powershell
npm run typecheck
```

Result:
- passed cleanly after the live rollup, tile redesign, and mock compatibility fixes

## Recommended next step when resuming

1. Open the admin overview page and visually inspect the upgraded live tiles.
2. Compare directly against:
   - `C:\dev\FlockTrax\images\sample-DashboardTiles.jpg`
3. Do a visual polish pass on the active placement tile layout.
4. After tile polish, start the requested Settings navigation work:
   - add gear icon / settings entry
   - swap left-nav sections when Settings is selected
   - scaffold `Settings & Preferences`
   - load `public.Settings` table for admin-or-higher users

## Resume prompt

"Resume `C:\dev\FlockTrax` from `output/FlockTrax_Admin_Live_Dashboard_Checkpoint_2026-04-03.md`. The admin app no longer silently falls back to mock data; it now surfaces real Supabase loader errors. The `placements.date_placed` schema mismatch was fixed by aligning admin queries to the working function pattern and reading placement date from the related flock. The overview dashboard tiles were upgraded to use live rollups from `placements + flocks + log_mortality + log_weight`, including started, mortality, and current in-house counts split by sex plus 7-day mortality buckets and latest weights. The tile layout has been reshaped toward `sample-DashboardTiles.jpg`, but still needs a final visual polish pass. A new sidebar/settings request was received but not implemented yet: add a gear-accessed Settings mode, replace the normal left-nav with `Settings & Preferences`, and show `public.Settings` in tabular form for admin-or-higher users."
