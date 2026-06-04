# FlockTrax Closeout Worksheet And Report Links Detailed Checkpoint

Date: `2026-06-02`  
Captured: `2026-06-02 America/Chicago`  
Branch: `main`

## Purpose

Capture the current state after extending the lifecycle/livehaul work into the first true closeout worksheet model, including:

- the live `placement_closeouts` database foundation
- the first saveable closeout worksheet on the placement closeout screen
- livehaul-level breed comparison logic
- first-7-day mortality interpretation correction
- closeout report-launch shortcuts and browser-tab title labeling

This is the best restart point for continued closeout implementation.

## Live Database State

The following migrations are now live in Supabase:

- [20260530193000_add_placement_lifecycle_stage.sql](C:/dev/FlockTrax/supabase/migrations/20260530193000_add_placement_lifecycle_stage.sql)
- [20260530204500_create_livehaul_schedule_and_loads.sql](C:/dev/FlockTrax/supabase/migrations/20260530204500_create_livehaul_schedule_and_loads.sql)
- [20260602130000_create_placement_closeouts.sql](C:/dev/FlockTrax/supabase/migrations/20260602130000_create_placement_closeouts.sql)

### `placement_closeouts`

`public.placement_closeouts` now exists and is the persistent business record for closeout workflow.

Key columns:

- workflow/status
  - `status`
  - `submitted_at`
  - `settlement_received_at`
  - `archived_at`
- final production
  - `processed_head_final`
  - `live_weight_final`
- feed/fcr
  - `feed_delivered_total_lbs`
  - `feed_consumed_total_lbs`
  - `starter_consumed_lbs`
  - `grower_consumed_lbs`
  - `feed_per_head_lbs`
  - `starter_per_head_lbs`
  - `grower_per_head_lbs`
  - `feed_conversion`
- breed comparison storage
  - `breed_stat_snapshot`
  - `breed_stat_comparison`
- notes / override
  - `notes`
  - `manual_override_reason`

Current observed backfill status:

- the table populated successfully
- example rows showed `draft` and `archived` states
- `284-W4` backfilled real processed/live-weight values from livehaul data
- some historic archived rows have `status = archived` but null archive timestamps because older placement rows did not always have `placements.archived_at` populated before this migration

### Lifecycle RPC Sync

The closeout table is now tied into lifecycle RPC behavior:

- `mark_barn_empty(...)`
  - ensures a `placement_closeouts` row exists when a flock is checked out
- `submit_flock_closeout(...)`
  - updates the closeout row to `submitted`
- `archive_flock_closeout(...)`
  - updates the closeout row to `archived`

## Closeout Screen State

The focused placement closeout screen:

- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/page.tsx)

now opens around:

1. compact summary badges
2. a real closeout worksheet card
3. the per-livehaul detail/load-entry panels

### New Closeout Worksheet

Main files:

- [closeout-worksheet-form.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx)
- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/actions.ts)
- [closeout-data.ts](C:/dev/FlockTrax/web-admin/lib/closeout-data.ts)

The worksheet is now saveable and uses `placement_closeouts` as its persistence target.

Current editable fields:

- `Processed Head`
- `Live Weight`
- `Manual Override Reason`
- `Notes`

Current derived summary blocks:

- `Feed Delivered`
- `Feed Consumed`
- `Per Head / FCR`
- `Breed Compare`
- `Live % / First 7d Mort`
- `Mortality %`

### Feed Logic Correction

Important business correction made during this checkpoint:

- flock-to-flock credit is already handled via feed ticket type `f2f`
- because of that, closeout should not subtract a manual feed-credit amount again

Result:

- the worksheet no longer uses a manual `Feed Credit` entry
- feed-consumed numbers now come directly from feed ticket/drop totals
- starter/grower closeout numbers are based on the ticket data already booked in the system

## Livehaul Detail State

Main file:

- [closeout-livehaul-load-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx)

Current livehaul detail behavior:

- scheduled livehaul is the header block
- loads render below it in compact feed-ticket-like rows
- load entry/edit/delete remains on the closeout screen, not the scheduler

### Breed Comparison Correction

Important biological/business correction made during this checkpoint:

- breed comparison should not be based on the final flock removed date
- each livehaul date is the actual lifecycle endpoint for the birds removed on that haul

Result:

- breed target/actual comparison is now calculated per livehaul date
- each livehaul card now shows:
  - actual average weight
  - target average weight
  - percent of target
- the worksheet-level breed compare is now a weighted rollup across livehaul dates instead of a single final-day comparison

## Mortality Logic State

### First 7-Day Meaning Correction

Important poultry-domain correction made during this checkpoint:

- `7-day mortality` now means cumulative `day 1` through `day 7`
- it does not mean the last seven days before closeout

Result in `closeout-data.ts`:

- first-7-day female and male losses are calculated from the placement/flick placed date window
- the closeout worksheet now shows first-7-day cumulative counts
- a day-by-day first-7 breakdown is available for popup display

### Mortality Stats Now Present

The closeout worksheet now includes:

- overall `Live %`
- female mortality %
- male mortality %
- first-7-day female losses
- first-7-day male losses
- first-7-day total losses

## Closeout Report And Popup Shortcuts

The closeout worksheet now acts as a small launchpad for related reports/screens.

### Feed Report Button

On the `Per Head / FCR` card:

- icon button opens `/admin/feed-tickets/report`
- it passes:
  - `flockCode = placementCode`
  - `dateFrom = placedDate`
  - `dateTo = removedDate`

### Mortality Report Button

On the `Mortality %` card:

- icon button opens the flock history report route:
  - `/admin/flocks/[flockId]/report`
- this route already contains the mortality matrix page

### First 7-Day Mortality Popup Button

On the `Live % / First 7d Mort` card:

- icon button opens a local popup on the closeout screen
- the popup shows:
  - first-7-day roo/hen losses
  - first-7-day roo/hen mortality %
  - total first-7-day losses
  - livability after 7 days
  - day-by-day first-7 breakdown

## Browser Tab Title Improvements

Report tabs were previously too generic.

This checkpoint added explicit browser-tab titles to:

- [feed-tickets/report/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/feed-tickets/report/page.tsx)
  - example: `Feed Report | 284-W4 | FlockTrax Admin`
- [flocks/[flockId]/report/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flocks/[flockId]/report/page.tsx)
  - example: `Flock History Report | 284-W4 | FlockTrax Admin`

## Key Files Touched In This Phase

- [20260602130000_create_placement_closeouts.sql](C:/dev/FlockTrax/supabase/migrations/20260602130000_create_placement_closeouts.sql)
- [closeout-data.ts](C:/dev/FlockTrax/web-admin/lib/closeout-data.ts)
- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/actions.ts)
- [closeout-worksheet-form.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx)
- [closeout-livehaul-load-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/page.tsx)
- [feed-tickets/report/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/feed-tickets/report/page.tsx)
- [flocks/[flockId]/report/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flocks/[flockId]/report/page.tsx)
- [globals.css](C:/dev/FlockTrax/web-admin/app/globals.css)

## Verification At Checkpoint

Completed:

- `npm run typecheck` passed repeatedly in `C:\dev\FlockTrax\web-admin`
- `placement_closeouts` migration was run successfully in Supabase
- closeout table backfill returned expected draft/archived rows

Not completed from this chat:

- no full browser walkthrough of the newest closeout worksheet additions from this thread
- no full closeout submit/settlement/archive control flow on the screen yet
- no dedicated closeout action buttons yet for:
  - `submitted`
  - `settlement received`
  - `archived`

## Best Resume Path

If work resumes in a new chat, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Closeout_Worksheet_And_Report_Links_Detailed_Checkpoint_2026-06-02.md first.`

## Likely Next Steps

1. Add the actual closeout state transition controls on the worksheet:
   - save draft
   - submit
   - mark settlement received
   - archive
2. Decide whether the worksheet needs a dedicated processed/liveweight reconciliation lock once submitted.
3. Browser-test the new closeout worksheet and popup/report links against real live data.
4. Continue tightening livehaul-level closeout ergonomics only after the workflow controls are in place.
