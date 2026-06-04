# FlockTrax Closeout Report, Livehaul Target Sex, And Archive Recovery Checkpoint

Date: `2026-06-02`  
Captured: `2026-06-02 04:24:53 -05:00`  
Branch: `main`

## Purpose

Capture the next closeout/livehaul phase after the earlier June 2 worksheet checkpoint, including:

- the new printable flock closeout report
- the `All Barns` livehaul scheduler behavior and follow-up fixes
- the archive recovery performed for `282-W5`
- the new `livehaul_schedule.target_sex` model
- default livehaul sex behavior for roo / mixed / hen haul patterns

This is now the best restart point for closeout + livehaul continuation.

## Live Database State

Already live in Supabase before this checkpoint:

- [20260530193000_add_placement_lifecycle_stage.sql](C:/dev/FlockTrax/supabase/migrations/20260530193000_add_placement_lifecycle_stage.sql)
- [20260530204500_create_livehaul_schedule_and_loads.sql](C:/dev/FlockTrax/supabase/migrations/20260530204500_create_livehaul_schedule_and_loads.sql)
- [20260602130000_create_placement_closeouts.sql](C:/dev/FlockTrax/supabase/migrations/20260602130000_create_placement_closeouts.sql)

Created locally in this checkpoint but not yet confirmed run in Supabase from this chat:

- [20260602183000_add_livehaul_target_sex.sql](C:/dev/FlockTrax/supabase/migrations/20260602183000_add_livehaul_target_sex.sql)

### `282-W5` Archive Recovery

During this chat, `282-W5` was found incorrectly sitting in archive.

Observed before recovery:

- `placements.lifecycle_stage = archived`
- `placement_closeouts.status = archived`
- `flocks.is_complete = true`
- archive timestamps were null, suggesting it had been swept there rather than properly finalized through the newer closeout flow

It was manually restored to the expected working closeout state:

- `placements.lifecycle_stage = waiting_closeout`
- `placement_closeouts.status = draft`
- `flocks.is_complete = false`
- archive/submission markers cleared

This was verified after the update through the admin Supabase client.

## Livehaul Scheduler State

Main files:

- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/page.tsx)
- [livehaul-filter-form.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-filter-form.tsx)
- [livehaul-month-picker.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-month-picker.tsx)
- [livehaul-scheduler-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-scheduler-forms.tsx)
- [livehaul-scheduler-data.ts](C:/dev/FlockTrax/web-admin/lib/livehaul-scheduler-data.ts)
- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/actions.ts)

### `All Barns` Mode

The livehaul scheduler no longer forces a single-barn view.

Current behavior:

- barn combo defaults to `All Barns` once a farm is selected
- farm-wide calendar view shows scheduled livehauls across visible barns
- date tiles can display multiple barn/flock entries
- month recap list is farm-wide and includes a `Barn` column
- creating a new livehaul still requires a specific barn context

Tile polish completed in this phase:

- in `All Barns`, day tiles now show:
  - flock number
  - barn code beneath the flock
  - target head if present
- if target head is not set, the tile leaves that line blank instead of showing `Head TBD`

### Selected Placement Carry-Forward Fix

Important scheduler bug fixed:

- when selecting a new empty date for a flock with existing livehaul rows, the scheduler could snap back to the last defined haul row instead of continuing the same flock context

Fix:

- the livehaul scheduler now carries the active `placement` context in the URL
- calendar date clicks, month navigation, and recap selection preserve that placement context

This specifically addressed the failed attempt to add another haul day for `283-S2`.

## Closeout Screen State

Main files:

- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/page.tsx)
- [closeout-livehaul-load-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx)
- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/actions.ts)
- [closeout-data.ts](C:/dev/FlockTrax/web-admin/lib/closeout-data.ts)

### Livehaul Order Fix

The closeout placement screen now explicitly orders livehaul rows:

- oldest to newest
- effectively `LH1` through `LHx`

Sorting is locked by:

1. `sequence_num`
2. `lh_date`
3. `livehaul_id`

### Livehaul Status Control In Closeout

Each closeout livehaul header now has a compact status control:

- `Scheduled`
- `Complete`
- `Canceled`

This saves against the current `livehaul_schedule` row from the closeout screen while loads are being entered.

## Closeout Report State

New files:

- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx)
- [closeout-report-actions.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-report-actions.tsx)

Updated launch point:

- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/page.tsx)

### New Printable Report

There is now a dedicated printable flock closeout report route per placement.

It includes:

- closeout header summary
- closeout state
- placement state
- placed/removed dates
- birds started
- final population
- oldest age
- processed head
- live weight
- feed delivered / consumed
- per head / FCR
- breed compare
- live %
- mortality %
- livehaul summary table

The closeout placement screen now has a `Closeout Report` button that opens the report in a new tab.

Browser tab title added:

- `Closeout Report | <placement> | FlockTrax Admin`

## Livehaul Target Sex Model

This was the biggest domain correction in this phase.

Problem recognized:

- the livehaul schedule needed to indicate what sex a haul is targeting
- otherwise breed comparison could wrongly compare hens against roo specs or vice versa

### New Field

New local migration:

- [20260602183000_add_livehaul_target_sex.sql](C:/dev/FlockTrax/supabase/migrations/20260602183000_add_livehaul_target_sex.sql)

Field:

- `public.livehaul_schedule.target_sex`

Allowed values:

- `male`
- `female`
- `null` meaning open/mixed/unspecified

### Scheduler UI

The livehaul scheduler create/edit forms now expose:

- `Open / Mixed`
- `Roo`
- `Hen`

### Closeout Breed Comparison Behavior

`closeout-data.ts` now uses `target_sex` when resolving the expected breed weight for a livehaul:

- `male` => compare to the male breed spec only
- `female` => compare to the female breed spec only
- blank => fall back to the older combined weighted comparison

The livehaul header and closeout report now display the target sex so the benchmark source is visible.

## Livehaul Target Sex Defaulting

You clarified the normal operational flow:

- first night is roos only
- second is generally mixed
- last is hens

That is now reflected in the app in a conservative way.

Current defaulting behavior:

- new livehaul create form starts with `Roo`
- if user leaves sex blank:
  - first haul resolves to `Roo`
  - middle hauls remain `Open / Mixed`
  - a blank highest-sequence haul resolves to `Hen` on save
- explicit user choice always wins

Implementation lives in:

- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/actions.ts)
- [livehaul-scheduler-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-scheduler-forms.tsx)

## Key Files Touched In This Phase

- [20260602183000_add_livehaul_target_sex.sql](C:/dev/FlockTrax/supabase/migrations/20260602183000_add_livehaul_target_sex.sql)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/page.tsx)
- [livehaul-filter-form.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-filter-form.tsx)
- [livehaul-month-picker.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-month-picker.tsx)
- [livehaul-scheduler-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-scheduler-forms.tsx)
- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/actions.ts)
- [livehaul-scheduler-data.ts](C:/dev/FlockTrax/web-admin/lib/livehaul-scheduler-data.ts)
- [closeout-data.ts](C:/dev/FlockTrax/web-admin/lib/closeout-data.ts)
- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/actions.ts)
- [closeout-livehaul-load-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/page.tsx)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx)
- [closeout-report-actions.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-report-actions.tsx)
- [globals.css](C:/dev/FlockTrax/web-admin/app/globals.css)

## Verification At Checkpoint

Completed:

- `npm run typecheck` passed repeatedly in `C:\dev\FlockTrax\web-admin`
- `282-W5` archive reversal was read back and verified
- closeout report route was added and typechecked
- livehaul target-sex flow was typechecked from scheduler through closeout/report consumption

Not completed from this chat:

- the `target_sex` migration was created and pasted, but not confirmed run in Supabase from this thread
- no full browser walkthrough of the new closeout report was performed from this thread
- no end-to-end recheck yet of a real flock with target-sex values entered on each livehaul row

## Best Resume Path

If work resumes in a new chat, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Closeout_Report_Livehaul_Target_Sex_And_Archive_Recovery_Checkpoint_2026-06-02.md first.`

## Likely Next Steps

1. Run and verify [20260602183000_add_livehaul_target_sex.sql](C:/dev/FlockTrax/supabase/migrations/20260602183000_add_livehaul_target_sex.sql) in Supabase.
2. Backfill `target_sex` on current livehaul rows where the sequence clearly implies roo / mixed / hen.
3. Add closeout state workflow controls for:
   - submit
   - settlement received
   - archive
4. Browser-test the new closeout report with a real flock and decide whether per-load detail belongs on the printed artifact.
5. Decide whether `target_sex` should appear on the live dashboard livehaul date list or remain scheduler/closeout only.
