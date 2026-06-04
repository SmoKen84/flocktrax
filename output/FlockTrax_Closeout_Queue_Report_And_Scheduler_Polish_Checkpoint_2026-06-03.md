# FlockTrax Closeout Queue, Report, And Scheduler Polish Checkpoint

Date: `2026-06-03`
Repo HEAD: `776e204`
Workspace: `C:\dev\FlockTrax`

## Purpose

This checkpoint captures the current state of the closeout workflow, queue, printable closeout report, placement/livehaul scheduler polish, and the small admin-dashboard regression/fix cycle that happened after the closeout work expanded.

This is the best resume point if the next session needs to continue any of:
- closeout queue behavior
- closeout worksheet milestones
- closeout report layout or print behavior
- placement scheduler farm-view calendar behavior
- livehaul scheduler continuity
- admin dashboard tile polish after the open-items badge fix

## Current High-Level State

### Database / schema

These schema additions now exist locally as migrations, and most have already been run live during the prior June 2 work:

- `supabase/migrations/20260530193000_add_placement_lifecycle_stage.sql`
  - adds authoritative `placements.lifecycle_stage`
- `supabase/migrations/20260530204500_create_livehaul_schedule_and_loads.sql`
  - creates `livehaul_schedule` and `livehaul_loads`
- `supabase/migrations/20260531140000_create_livehaul_lookup_view.sql`
- `supabase/migrations/20260531141500_create_livehaul_edit_lookup_view.sql`
- `supabase/migrations/20260602130000_create_placement_closeouts.sql`
  - creates `placement_closeouts`
- `supabase/migrations/20260602183000_add_livehaul_target_sex.sql`
  - adds `livehaul_schedule.target_sex`
- `supabase/migrations/20260602193000_add_closeout_task_milestones.sql`
  - adds closeout task milestone timestamps

Known live business model now:
- placement lifecycle remains high-level:
  - `scheduled`
  - `awaiting_arrival`
  - `in_barn_growing`
  - `waiting_closeout`
  - `closeout_submitted`
  - `archived`
- closeout substates are handled on `placement_closeouts` as milestone timestamps, not as extra placement lifecycle states

### Closeout workflow

`Placements > Closeout` now has:
- queue landing screen
- one-line placement queue rows
- explicit substate task matrix:
  - `LH`
  - `Feed`
  - `Inv`
  - `Sent`
  - `Paid`
- per-placement closeout screen
- closeout worksheet with explicit user-controlled milestone checkboxes
- livehaul detail with load entry under each livehaul header
- printable closeout report

### Scheduler workflow

Placement scheduler:
- now has the same centered month-picker icon pattern as livehaul scheduler
- farm-view calendar now correctly shows placement starts on fill dates from the prior/next month instead of incorrectly showing `No start`

Livehaul scheduler:
- keeps the month-picker behavior from earlier work
- supports `All Barns`
- continues to be schedule-focused, with load-entry work moved into closeout

### Admin live dashboard

The live dashboard recently had a small header-fit regression caused by the new open-items badge wording. That was corrected by:
- changing the open-items badge text from a wider phrase to compact `Open N`
- shrinking dashboard tile header pill sizing

This was a layout fix, not a data-model change.

## What Changed In This Session

## 1. Closeout queue became explicitly milestone-driven

Files:
- `web-admin/lib/closeout-data.ts`
- `web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx`
- `web-admin/app/admin/flock-closeout/actions.ts`
- `web-admin/app/admin/flock-closeout/page.tsx`
- `web-admin/app/globals.css`

Behavior now:
- queue marks are driven by saved milestone timestamps only
- they are no longer inferred from livehaul completion heuristics
- worksheet shows explicit checkboxes for:
  - `LH Complete`
  - `Feed Verified`
  - `Invoice Created`
  - `Submitted`
  - `Settlement Received`
  - `Closeout Complete`
- after saving, if all milestone checks are complete, the form offers a `Move To Archive` action
- archive action calls the archive closeout path and returns to the queue

Important design detail:
- user specifically wanted closeout substates to be human-checked instead of automatically inferred
- queue `X`/check state now follows that instruction

## 2. Closeout queue UI was tightened and reorganized

Files:
- `web-admin/app/admin/flock-closeout/page.tsx`
- `web-admin/app/globals.css`

Current queue behavior:
- paginated at `9` visible rows per page
- compact `Refresh` button added to queue header
- row action changed from text `Open` to pencil edit icon
- columns now include:
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
- `Head` now shows final live population from mortality-adjusted flock count
- `LH-Head` now shows closeout processed-head total
- `FCR` now shows closeout feed conversion

Latest column order on queue:
- `LH`
- `Feed`
- `Inv`
- `Sent`
- `Paid`

## 3. Closeout worksheet milestone block was visually highlighted

Files:
- `web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx`
- `web-admin/app/globals.css`

State:
- milestone checkboxes are arranged in two columns
- user-requested violet-blue outline/highlight added
- current left/right grouping:
  - left:
    - `LH Complete`
    - `Feed Verified`
    - `Invoice Created`
  - right:
    - `Submitted`
    - `Settlement Received`
    - `Closeout Complete`

## 4. Closeout report was restructured

Files:
- `web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx`
- `web-admin/app/globals.css`

Report now:
- uses a compact top summary pill strip instead of larger rollup cards
- shows each livehaul in sequence, oldest to newest
- under each livehaul, shows actual load rows:
  - truck
  - trailer
  - head
  - scale location
  - empty
  - loaded
  - live weight
  - avg per head
  - comment
- then shows the overall process summary after all livehaul detail

This change matches the operational reading order the user wanted:
1. see each livehaul and its actual loads
2. then review the rolled-up process totals

## 5. Placement scheduler month picker added

Files:
- `web-admin/app/admin/placements/new/placement-month-picker.tsx`
- `web-admin/app/admin/placements/new/page.tsx`
- `web-admin/app/globals.css`

Behavior:
- centered month-picker icon now sits beside the placement scheduler month title
- navigation preserves current placement scheduler context

## 6. Placement scheduler farm-view fill-date bug fixed

Files:
- `web-admin/app/admin/placements/new/page.tsx`
- `web-admin/app/globals.css`

Bug:
- in farm view, only selected-month start dates were being fed into the calendar grid
- fill dates from adjacent months could show `No start` even when a real placement started there

Fix:
- farm calendar now uses all displayed placement starts for the visible 6-week grid
- month recap remains month-scoped

Important user preference after the fix:
- the user does not want fill dates to inherit full active color treatment
- they only want those dates to stop lying with `No start`
- current CSS was adjusted to neutralize neighboring-month blocked-day styling so fill dates stay visually muted while still showing the flock badge

## 7. Admin live dashboard duplicate badge issue corrected

Files:
- `web-admin/components/active-placement-dashboard.tsx`
- `web-admin/app/globals.css`

Problem:
- some awaiting-arrival tiles showed two header pills
- both said `Awaiting Arrival`

Reason:
- one badge was lifecycle state
- one badge was open-items notice
- but the open-items badge was mistakenly reusing the lifecycle label

Fix:
- open-items badge now uses compact open-items wording like `Open 2`
- tile pill sizing was tightened to avoid tile header overflow

## Known Open Items / Follow-Up Notes

### 1. Closeout report print scaling request not yet completed

User asked:
- reduce the printout size to `75%`

That request was not completed before checkpointing.

Next likely implementation:
- add print-specific CSS on the closeout report route, probably under `@media print`
- safest approach is to scale only the report body container rather than globally shrinking all app print pages

### 2. Duplicate livehaul discrepancy for `283-S2`

User reported:
- `283-S2` shows a duplicate `4/27/26` livehaul on the closeout screen
- that extra livehaul does not show on the livehaul scheduler

This was not resolved in the current session.

Most likely next debugging path:
- compare `closeout-data.ts` livehaul query/grouping against `livehaul-scheduler-data.ts`
- verify whether this is:
  - a real duplicate `livehaul_schedule` row in the database
  - or a closeout-only rendering/query duplication issue

### 3. Admin dashboard layout should be sanity-checked visually

The live dashboard had a layout regression after the open-items badge fix and was tightened.
It is likely correct now, but should still be visually sanity-checked in-browser on the current viewport.

### 4. Queue mark glyph still has an encoding artifact in source display

The queue checkmark renders from code that currently contains a mojibake-looking glyph in source (`âœ“` in the file view), even though the intent is a checkmark. This did not block behavior, but it is worth normalizing to plain ASCII-safe handling or a clean Unicode literal later.

## Important Files To Load First

If resuming this closeout/admin work, load these first:

- `C:\dev\FlockTrax\output\FlockTrax_Closeout_Queue_Report_And_Scheduler_Polish_Checkpoint_2026-06-03.md`
- `C:\dev\FlockTrax\output\FlockTrax_Closeout_Report_Livehaul_Target_Sex_And_Archive_Recovery_Checkpoint_2026-06-02.md`
- `C:\dev\FlockTrax\output\FlockTrax_Closeout_Worksheet_And_Report_Links_Detailed_Checkpoint_2026-06-02.md`

Most relevant current source files:
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\closeout-worksheet-form.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\[placementId]\report\page.tsx`
- `C:\dev\FlockTrax\web-admin\lib\closeout-data.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\placements\new\placement-month-picker.tsx`
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Dirty Worktree Snapshot At Checkpoint Time

`git status --short` showed:

Modified:
- `output/FlockTrax_Checkpoint_Index.md`
- `supabase/.temp/cli-latest`
- `web-admin/app/admin/feed-tickets/report/page.tsx`
- `web-admin/app/admin/flocks/[flockId]/report/page.tsx`
- `web-admin/app/admin/overview/actions.ts`
- `web-admin/app/admin/placements/new/page.tsx`
- `web-admin/app/globals.css`
- `web-admin/app/page.tsx`
- `web-admin/components/active-placement-dashboard.tsx`
- `web-admin/components/admin-shell.tsx`
- `web-admin/lib/admin-data.ts`
- `web-admin/lib/types.ts`

Untracked:
- prior checkpoint docs under `output/`
- lifecycle / livehaul / closeout migrations listed above
- `web-admin/app/admin/flock-closeout/`
- `web-admin/app/admin/placements/livehaul/`
- `web-admin/app/admin/placements/new/placement-month-picker.tsx`
- `web-admin/lib/closeout-data.ts`
- `web-admin/lib/livehaul-scheduler-data.ts`
- `web-admin/screens/PlacementCloseoutMockup.png`

## Verification State

Most recent repeated local verification:
- `npm run typecheck` in `C:\dev\FlockTrax\web-admin`
- result: passing

No new database migration was run in this checkpointing session.

## Recommended Restart Prompt

Use this exact prompt next time:

`Load C:\dev\FlockTrax\output\FlockTrax_Closeout_Queue_Report_And_Scheduler_Polish_Checkpoint_2026-06-03.md first.`
