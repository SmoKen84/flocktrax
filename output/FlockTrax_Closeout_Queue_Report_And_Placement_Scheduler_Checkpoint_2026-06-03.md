# FlockTrax Closeout Queue, Report, And Placement Scheduler Checkpoint

Date: `2026-06-03`
Repo: `C:\dev\FlockTrax`
Branch: `main`
HEAD: `776e204`
Mode: detailed crash-safe checkpoint

## Purpose

This checkpoint captures the current state after the closeout queue was reshaped into an operator-facing workflow, the closeout report was restructured around livehaul/load detail, and the placement/livehaul schedulers received additional UI and calendar corrections.

This is the best resume point for:
- closeout queue / worksheet / report work
- livehaul scheduler and closeout livehaul reconciliation
- placement scheduler farm-view calendar polish
- admin dashboard tile regression cleanup

## High-Level State

The project is now materially deeper into the flock closeout lifecycle than the earlier `2026-06-02` checkpoints:

- `placement_closeouts` is now the active closeout business record model
- closeout progress is represented as user-checked process steps instead of optimistic inferred queue marks
- the closeout queue now behaves more like a real work queue with pagination, refresh, compact row actions, and milestone columns
- the closeout detail screen now acts like a worksheet
- the closeout report now shows livehaul/load detail first and overall process summary second
- the placement scheduler and livehaul scheduler both have month-picker UI support

## Database / Schema Baseline

The following schema work exists locally in `supabase/migrations` and had been applied live earlier in this lifecycle unless noted otherwise:

- `20260530193000_add_placement_lifecycle_stage.sql`
  - adds authoritative `placements.lifecycle_stage`
  - introduces:
    - `scheduled`
    - `awaiting_arrival`
    - `in_barn_growing`
    - `waiting_closeout`
    - `closeout_submitted`
    - `archived`

- `20260530204500_create_livehaul_schedule_and_loads.sql`
  - creates:
    - `public.livehaul_schedule`
    - `public.livehaul_loads`
  - backfills legacy `lh1_date/lh2_date/lh3_date`

- `20260531140000_create_livehaul_lookup_view.sql`
  - `public.v_livehaul_schedule_lookup`

- `20260531141500_create_livehaul_edit_lookup_view.sql`
  - `public.v_livehaul_edit_lookup`

- `20260602130000_create_placement_closeouts.sql`
  - creates `public.placement_closeouts`
  - syncs lifecycle RPCs with closeout rows

- `20260602183000_add_livehaul_target_sex.sql`
  - adds `livehaul_schedule.target_sex`
  - app code assumes this exists for livehaul sex-targeted breed comparisons

- `20260602193000_add_closeout_task_milestones.sql`
  - adds milestone timestamp columns to `placement_closeouts`:
    - `livehaul_complete_at`
    - `feed_verified_at`
    - `invoice_created_at`
    - `closeout_completed_at`
    - corresponding `*_by` fields

## Closeout Queue State

Main route:
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\page.tsx`

Backing data:
- `C:\dev\FlockTrax\web-admin\lib\closeout-data.ts`

Current closeout queue behavior:
- queue landing page is separate from placement-specific closeout work
- hero block remains at top
- summary badges remain below hero
- queue rows are single-line operational rows
- queue is paginated to the current visible working length (`9` rows/page)
- queue header now includes a `Refresh` button
- end-of-line action is now a compact pencil edit button instead of `Open`

Queue columns now include:
- `Placement`
- `State`
- `Removed`
- `Head`
- `LH-Head`
- `FCR`
- `LH`
- `Feed`
- `Inv`
- `Sent`
- `Paid`

Notable queue behavior:
- `Head`
  - now shows final live population based on mortality-adjusted head count
- `LH-Head`
  - now shows closeout processed-head total, not raw scheduler-only load rollups
- `FCR`
  - now appears directly in the queue for fast operational review

Removed from the queue:
- `Issues`
- `Done`
- `Recent Activity`

Rationale:
- `Done` should imply archive, so it no longer belongs on the active queue
- `Issues` was not meaningfully helping closeout progression

## Closeout Sub-State Model

The queue is now intended to reflect explicitly saved closeout process completion rather than inference.

Worksheet checkboxes now control the queue marks:
- `LH Complete`
- `Feed Verified`
- `Invoice Created`
- `Submitted`
- `Settlement Received`
- `Closeout Complete`

Queue marks now:
- should only appear when the related checkbox has been checked and saved
- are represented as checkmarks, not generic `X`s

Important change:
- earlier queue logic inferred some progress from livehaul states and lifecycle state
- that inference was removed because it was making the queue look complete before the user had actually confirmed steps

## Closeout Worksheet State

Main files:
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\[placementId]\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\closeout-worksheet-form.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\actions.ts`
- `C:\dev\FlockTrax\web-admin\lib\closeout-data.ts`

Current worksheet state:
- focused closeout work happens on a single-placement screen
- rollups are compacted into badge-like groups
- livehaul detail sections are ordered oldest to newest (`LH1` -> `LHx`)
- livehaul sections show header-level status controls and load rows
- process-step checkboxes are visually grouped and highlighted with a stronger violet-blue outline/background

Worksheet process-step layout:
- left column:
  - `LH Complete`
  - `Feed Verified`
  - `Invoice Created`
- right column:
  - `Submitted`
  - `Settlement Received`
  - `Closeout Complete`

Closeout archive behavior:
- after save, if all closeout steps are complete, the screen offers a `Move To Archive` action
- archive still routes through the closeout archive path so the placement remains historically accessible through archive rather than disappearing silently

## Closeout Metrics / Business Logic

The closeout worksheet and queue currently reflect these clarified rules:

- feed consumed is already correctly represented by feed ticket accounting
  - `f2f` crediting is already accounted for in ticket totals
  - manual feed-credit subtraction was removed from the worksheet

- `Final`
  - means actual final remaining population:
    - birds placed
    - minus mortality
    - minus culls

- additional closeout metrics now included:
  - overall `Live %`
  - mortality % by roo / hen
  - poultry-style first `7-day` cumulative mortality (`day 1` through `day 7`)

- breed comparison logic changed:
  - no longer based on the flock’s final removed date
  - now computed on each livehaul date, which is the correct lifecycle endpoint for those birds
  - livehaul target sex is used so roos and hens compare against the correct breed spec

## Closeout Report State

Report route:
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\[placementId]\report\page.tsx`

The closeout report now follows this structure:
- compact top badge-style rollup
- livehaul sections oldest to newest
- actual load rows shown under each livehaul
- overall process summary after all livehauls

This is a shift from earlier summary-first versions and better matches how flock closeout should be reviewed.

Open report item:
- user requested print output scale reduced to `75%`
- that request was not implemented before this checkpoint
- this remains a next-step print-layout task

## Livehaul Scheduler State

Route:
- `C:\dev\FlockTrax\web-admin\app\admin\placements\livehaul\page.tsx`

Backing data:
- `C:\dev\FlockTrax\web-admin\lib\livehaul-scheduler-data.ts`

Current scheduler characteristics:
- default barn context is `All Barns`
- calendar can show farm-wide livehaul visibility
- month-picker icon support exists
- scheduled tiles can show flock number, barn code, and target head
- if target head is missing, the head line is left blank instead of `Head TBD`

Important unresolved livehaul issue:
- user reported `283-S2` shows a duplicate `4/27/26` livehaul on the closeout side
- that extra livehaul does not appear in the livehaul scheduler
- discrepancy is still unresolved at this checkpoint
- likely next debugging target:
  - compare `closeout-data.ts` livehaul query/merge behavior against `livehaul-scheduler-data.ts`
  - determine whether duplicate is data-level or view-level

## Placement Scheduler State

Route:
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx`

New support added:
- month-picker icon button now exists on the placement scheduler too
  - `C:\dev\FlockTrax\web-admin\app\admin\placements\new\placement-month-picker.tsx`

Important farm-view calendar fix:
- neighboring-month fill dates in farm view were incorrectly saying `No start` even when a real placement existed on that date
- root cause:
  - farm calendar view was only using current-month starts for the whole displayed grid
- fix:
  - separated:
    - `allPlacementStarts` for the full six-week grid
    - `monthlyPlacementStarts` for month-specific recap work

Result:
- fill dates should no longer incorrectly claim `No start` when a real placement exists

Visual note:
- follow-up CSS attempts to keep fill days neutral while still showing placement badges led to some mixed/half-applied styling behavior
- the data fix is the important permanent correction
- the neighboring-month visual polish may still want one more controlled pass if the current look remains inconsistent

## Admin Dashboard Regression / Recovery

Primary files:
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

Recent regression:
- dashboard tiles started looking cramped / overflowing like a smaller-device layout

Root cause identified:
- the duplicate `Awaiting Arrival` badge fix replaced one pill with a real open-items badge
- the new text (`2 Open Items`) was wider than the old duplicate pill
- that wider pill cramped tile headers and made the dashboard feel broken

Recovery steps applied:
- open-items badge text compacted to a shorter label like `Open 2`
- header pills tightened slightly
- badge text globally centered in shared badge styles

Meaningful dashboard behavior now:
- lifecycle badge still shows placement state
- open-items badge shows a real issue/action-needed notice instead of reusing the lifecycle label

## Report Tab Titles

Report routes were previously updated so browser tabs identify themselves clearly:

- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\report\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flocks\[flockId]\report\page.tsx`

Examples:
- `Feed Report | ... | FlockTrax Admin`
- `Flock History Report | ... | FlockTrax Admin`

## Dirty Worktree Snapshot At Checkpoint Time

Modified:
- `C:\dev\FlockTrax\output\FlockTrax_Checkpoint_Index.md`
- `C:\dev\FlockTrax\supabase\.temp\cli-latest`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\report\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flocks\[flockId]\report\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\overview\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\web-admin\app\page.tsx`
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`
- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\types.ts`

Untracked:
- `C:\dev\FlockTrax\output\FlockTrax_Closeout_Report_Livehaul_Target_Sex_And_Archive_Recovery_Checkpoint_2026-06-02.md`
- `C:\dev\FlockTrax\output\FlockTrax_Closeout_Worksheet_And_Report_Links_Detailed_Checkpoint_2026-06-02.md`
- `C:\dev\FlockTrax\output\FlockTrax_Lifecycle_Livehaul_Closeout_Detailed_Checkpoint_2026-05-31.md`
- `C:\dev\FlockTrax\output\FlockTrax_Lifecycle_Stage_Implementation_Design_2026-05-30.md`
- `C:\dev\FlockTrax\output\stray-images\`
- `C:\dev\FlockTrax\supabase\migrations\20260530193000_add_placement_lifecycle_stage.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260530204500_create_livehaul_schedule_and_loads.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260531140000_create_livehaul_lookup_view.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260531141500_create_livehaul_edit_lookup_view.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260602130000_create_placement_closeouts.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260602183000_add_livehaul_target_sex.sql`
- `C:\dev\FlockTrax\supabase\migrations\20260602193000_add_closeout_task_milestones.sql`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\livehaul\`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\placement-month-picker.tsx`
- `C:\dev\FlockTrax\web-admin\lib\closeout-data.ts`
- `C:\dev\FlockTrax\web-admin\lib\livehaul-scheduler-data.ts`
- `C:\dev\FlockTrax\web-admin\screens\PlacementCloseoutMockup.png`

## Verification State

During this period, repeated local verification standard remained:
- `npm run typecheck` in `C:\dev\FlockTrax\web-admin`

At this checkpoint:
- typecheck had been passing after the recent closeout queue/report/scheduler edits

Not fully completed before pause:
- browser validation of every new closeout queue/report permutation
- live investigation of the `283-S2` duplicate `4/27/26` livehaul discrepancy
- print-scale change to `75%` on the closeout report

## Best Next Steps

1. Resolve the `283-S2` duplicate livehaul discrepancy.
   - compare raw `livehaul_schedule` rows with closeout-rendered livehaul list
   - determine whether duplicate is a data duplication or closeout aggregation bug

2. Finish the closeout report print-layout pass.
   - implement requested `75%` print scale
   - confirm livehaul/load sections still paginate/read cleanly when printed

3. Give the placement scheduler neighboring-month fill dates one calm final polish pass.
   - keep the data fix
   - keep real starts visible
   - avoid half-active/half-muted mixed coloring

4. Keep an eye on dashboard tile width regressions.
   - recent badge-width problem was corrected
   - if the admin overview still feels cramped, revisit pill sizing and tile header spacing before touching deeper grid structure

## Recommended Restart Prompt

```text
Load C:\dev\FlockTrax\output\FlockTrax_Closeout_Queue_Report_And_Placement_Scheduler_Checkpoint_2026-06-03.md first.
```

