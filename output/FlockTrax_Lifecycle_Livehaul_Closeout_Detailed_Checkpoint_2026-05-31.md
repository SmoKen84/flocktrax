# FlockTrax Lifecycle, Livehaul, And Closeout Detailed Checkpoint

Date: `2026-05-31`  
Captured: `2026-05-31 15:10:09 -05:00`  
Branch: `main`  
HEAD: `776e20482ce1a33a2fe0f467be773cbe6752fd1b`

## Purpose

Capture the current working state after:

- adopting the authoritative `lifecycle_stage` direction from the closeout blueprint
- applying the first live database migration for `placements.lifecycle_stage`
- adding the two-table livehaul model and backfilling legacy `lh1/lh2/lh3` dates
- building the first local `Placements > Livehaul` scheduler in `web-admin`
- building the first local `Placements > Closeout` workspace shell
- rewiring the live dashboard and feed estimator away from the old three-date placement model

This checkpoint is the best restart point for the current flock-lifecycle work.

## Live Database State

These migrations were run successfully in the live Supabase project on `2026-05-30` and `2026-05-31`:

- [20260530193000_add_placement_lifecycle_stage.sql](C:/dev/FlockTrax/supabase/migrations/20260530193000_add_placement_lifecycle_stage.sql)
- [20260530204500_create_livehaul_schedule_and_loads.sql](C:/dev/FlockTrax/supabase/migrations/20260530204500_create_livehaul_schedule_and_loads.sql)

Additional helper views were also prepared locally for edit/lookup support:

- [20260531140000_create_livehaul_lookup_view.sql](C:/dev/FlockTrax/supabase/migrations/20260531140000_create_livehaul_lookup_view.sql)
- [20260531141500_create_livehaul_edit_lookup_view.sql](C:/dev/FlockTrax/supabase/migrations/20260531141500_create_livehaul_edit_lookup_view.sql)

### Lifecycle Stage Model

`public.placements` now carries the first authoritative placement lifecycle fields:

- `lifecycle_stage`
- `closeout_submitted_at`
- `closeout_submitted_by`
- `archived_at`
- `archived_by`

The placement-state RPCs were updated so they now write lifecycle truth directly:

- `make_placement_current(...)`
- `mark_chicks_arrived(...)`
- `mark_barn_empty(...)`
- `submit_flock_closeout(...)`
- `archive_flock_closeout(...)`

Key business meaning at this checkpoint:

- `is_active` still exists as a compatibility/live-ops flag
- `lifecycle_stage` is now the intended business truth
- checkout moves a flock into `waiting_closeout`

### Livehaul Model

The old fixed placement fields `lh1_date`, `lh2_date`, and `lh3_date` are no longer the future model.

The new livehaul foundation is:

- `public.livehaul_schedule`
  - one row per scheduled livehaul event
  - flexible haul count per placement
  - backfilled from legacy `lh1/lh2/lh3`
- `public.livehaul_loads`
  - child rows for truck/load execution detail under a scheduled livehaul
  - intended for actual weights, heads, DOAs, and closeout reconciliation

Backfill status:

- legacy non-null `lh1_date`, `lh2_date`, and `lh3_date` values were migrated into `livehaul_schedule`
- validation looked correct after migration
- `livehaul_loads` is currently expected to be mostly or fully empty until actual load entry is added

## Local Web-Admin State

Most of the UI work below is local-only at this checkpoint and has not been treated as a production deployment.

### Sidebar And Navigation Direction

The admin sidebar was reorganized into:

- `Console`
- `Placements`
- `Configuration`
- `Utilities`

The `Placements` section now contains:

- `Schedule`
- `Livehaul`
- `Closeout`

Cleanups also completed:

- removed duplicate `Placement Wizard` from `Configuration`
- removed `Rollups` from the nav

Main files:

- [admin-shell.tsx](C:/dev/FlockTrax/web-admin/components/admin-shell.tsx)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/page.tsx)

### Livehaul Scheduler

The first local livehaul scheduler is built at:

- `/admin/placements/livehaul`

Primary files:

- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/page.tsx)
- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/actions.ts)
- [livehaul-scheduler-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-scheduler-forms.tsx)
- [livehaul-filter-form.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-filter-form.tsx)
- [livehaul-month-picker.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/livehaul/livehaul-month-picker.tsx)
- [livehaul-scheduler-data.ts](C:/dev/FlockTrax/web-admin/lib/livehaul-scheduler-data.ts)
- [globals.css](C:/dev/FlockTrax/web-admin/app/globals.css)

Implemented behavior:

- no default farm or barn is selected on entry
- livehaul queries do not run until user context is chosen
- farm and barn selectors auto-refresh the page context
- month picker lives in the centered calendar header
- calendar uses a distinct livehaul color treatment from placement scheduling
- day tiles show flock number and target head count
- tile content is bottom-aligned to avoid overlapping the day number
- summary area is a single-line compact pill strip
- the right-hand panel follows the same multiuse pattern as placement scheduling
  - no selected date: month recap
  - selected empty day: create form
  - selected scheduled day: editor
  - after create/save/delete: return to month recap

Important fixes completed during live testing:

- fixed create-path mislink where selecting flock `293` could still save the old flock id `275`
  - server now derives `farm_id`, `barn_id`, and `flock_id` from the selected `placement_id`
- improved placement picker clarity by rendering `Flock ### | placement | lifecycle`
- added `Target Head` to the upper editor and persistence path
- made duplicate same-day same-placement adds fail safely via the existing unique constraint

Open note:

- user suspects there may still be a small editor bug on the livehaul screen
- that issue was intentionally left for the next session after broader workflow validation

### Closeout Workspace

The first local closeout workspace shell exists at:

- `/admin/flock-closeout`

Main file set:

- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/page.tsx)
- [closeout-data.ts](C:/dev/FlockTrax/web-admin/lib/closeout-data.ts)

Current shape:

- read-first queue against `waiting_closeout` and `closeout_submitted`
- stage counts, issue counts, and recap behavior
- intended to work first with already checked-out flocks before end-to-end testing on upcoming live flock closeouts

## Dashboard And Feed Projection State

The live dashboard was updated so it no longer depends on `placements.lh1_date/lh2_date/lh3_date` for livehaul display.

Files:

- [admin-data.ts](C:/dev/FlockTrax/web-admin/lib/admin-data.ts)
- [types.ts](C:/dev/FlockTrax/web-admin/lib/types.ts)
- [active-placement-dashboard.tsx](C:/dev/FlockTrax/web-admin/components/active-placement-dashboard.tsx)

What changed:

- active placement records now carry `liveHaulDates`
- dashboard tiles show a simple list of haul dates from `livehaul_schedule`
- old `lh1/lh2/lh3` remain only as compatibility fallback fields

### Feed Estimator Logic

The feed estimator path was also corrected during this checkpoint.

Current rules:

- prefer `livehaul_schedule.head_target` first
- fall back to `head_actual` second
- fall back again to the older percentage-based livehaul reduction only when neither value exists

Important bug fix completed:

- past livehaul dates and same-day livehauls are now folded into the starting population before projecting tomorrow onward
- this fixed the case where flock `293-S1` still looked overpopulated because prior haul dates were only being applied inside the forward 10-day window

## Repo State At Checkpoint

Current repo status includes both modified tracked files and local untracked work.

Tracked modifications shown by `git status --short`:

- `supabase/.temp/cli-latest`
- `web-admin/app/admin/overview/actions.ts`
- `web-admin/app/globals.css`
- `web-admin/app/page.tsx`
- `web-admin/components/active-placement-dashboard.tsx`
- `web-admin/components/admin-shell.tsx`
- `web-admin/lib/admin-data.ts`
- `web-admin/lib/types.ts`

Untracked files/folders shown by `git status --short`:

- `output/FlockTrax_Lifecycle_Stage_Implementation_Design_2026-05-30.md`
- `output/stray-images/`
- `supabase/migrations/20260530193000_add_placement_lifecycle_stage.sql`
- `supabase/migrations/20260530204500_create_livehaul_schedule_and_loads.sql`
- `supabase/migrations/20260531140000_create_livehaul_lookup_view.sql`
- `supabase/migrations/20260531141500_create_livehaul_edit_lookup_view.sql`
- `web-admin/app/admin/flock-closeout/`
- `web-admin/app/admin/placements/livehaul/`
- `web-admin/lib/closeout-data.ts`
- `web-admin/lib/livehaul-scheduler-data.ts`
- `web-admin/screens/PlacementCloseoutMockup.png`

Meaning:

- the live database has already moved ahead on lifecycle/livehaul schema
- the current admin UI implementation remains largely local and uncommitted
- this is a dirty worktree checkpoint and should not be “cleaned up” casually

## Verification At Checkpoint

Local verification completed repeatedly during this work:

- `npm run typecheck` passed in `C:\dev\FlockTrax\web-admin` after the recent lifecycle/livehaul/feed-estimator changes

Not completed from this chat:

- no fresh production deployment for this local lifecycle/livehaul UI work
- no fully end-to-end live closeout validation on an upcoming real flock
- no `livehaul_loads` child-entry UI yet

## Best Resume Path

If work resumes in a new chat, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Lifecycle_Livehaul_Closeout_Detailed_Checkpoint_2026-05-31.md first.`

Likely next steps from this exact state:

1. Recheck the small suspected livehaul editor bug and tighten that screen if needed.
2. Add child `livehaul_loads` CRUD under scheduled livehauls.
3. Expand the closeout workspace so it consumes livehaul schedule/load truth.
4. Decide when to move the current local web-admin lifecycle/livehaul work toward commit and deployment.

## Related Design Note

The design document that established the current implementation direction is:

- [FlockTrax_Lifecycle_Stage_Implementation_Design_2026-05-30.md](C:/dev/FlockTrax/output/FlockTrax_Lifecycle_Stage_Implementation_Design_2026-05-30.md)
