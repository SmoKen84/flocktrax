# FlockTrax Digital Archive Summary And Report Flow Checkpoint

Date: `2026-06-03`
Repo: `C:\dev\FlockTrax`
Branch: `main`
HEAD: `776e204`
Mode: detailed crash-safe checkpoint

## Purpose

This checkpoint captures the follow-on closeout/report work after the queue and worksheet foundation was already in place:

- closeout report print layout was hardened against orphaned blocks
- feed-report content was embedded into the closeout report
- a new combined `Digital Archive Summary` packet was added from the closeout hero
- the archive packet was intentionally rewound from auto-print to manual print-only behavior
- the flock-history matrix truncation inside the combined packet was corrected by removing forced page-break behavior in that specific context

This is the best restart point if the next work item is:
- archive packet polish
- report print/PDF flow
- flock-history packet validation
- closeout handoff for grower invoice support

## Main User-Facing Change

On the closeout placement screen:

- the top hero block still includes `Closeout Report`
- it now also includes:
  - `Save Digital Archive Summary`

That new button opens a combined packet page intended to support grower settlement/invoice submission by pulling several flock artifacts into one browser document.

## Current Digital Archive Summary Behavior

Main files:
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\[placementId]\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\[placementId]\archive-summary\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\archive-summary-actions.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

The archive-summary page now behaves like this:

- opens in a new browser tab from the closeout hero button
- does **not** auto-print
- shows one continuous combined document
- still provides the normal `Print / Save PDF` and `Close Window` actions
- leaves the user on the combined archive document after opening it

This was an intentional rewind from the earlier auto-print attempt because:
- browser-controlled save dialogs should not be fought
- auto-print was too aggressive
- the user specifically wanted the combined document displayed, not immediately sent to print

## Combined Archive Packet Contents

The `Digital Archive Summary` packet currently includes, in this order:

1. closeout summary
2. first 7-day mortality archive section
3. livehaul and load detail
4. flock feed report
5. flock history daily-log matrix
6. flock history mortality matrix

### Closeout Summary

The packet opens with the same closeout-first logic the user asked for:
- placement / closeout rollup strip
- overall process summary
- feed, mortality, live %, breed, processed head, live weight, FCR, etc.
- optional notes / override reason

This keeps the packet “business-first” rather than making the user dig through operational detail before seeing the closeout summary.

### First 7-Day Mortality Archive

The archive packet now includes a dedicated first-7-day section built from the existing closeout worksheet data:

- roo first-7 losses and percent
- hen first-7 losses and percent
- total first-7 losses
- 7-day live %
- day-by-day first-7 breakdown table

This section reflects the poultry-farming definition already agreed earlier:
- cumulative day `1` through day `7`
- not “the mortality on day 7”

### Livehaul And Load Detail

The packet includes livehaul detail exactly as the closeout report had been reshaped:

- oldest to newest livehaul order
- per-livehaul summary pills
- status, sex, target/actual head, load count, live weight / avg, breed / %
- full load rows under each livehaul

### Flock Feed Report

The archive packet also includes the flock feed report directly in the same document.

Source behavior:
- uses the placement code as the flock report key
- constrains the date range to:
  - `placedDate`
  - `removedDate`

Included feed-report content:
- date-range summary
- overall net
- starter net
- grower net
- by-ticket-type breakdown
- by-source breakdown
- feed-drop detail table

### Flock History Matrices

The archive packet includes the two main flock-history matrix sections:

- daily log matrix
- mortality matrix

It intentionally does **not** currently include the action-items page from the flock-history report.

That keeps the archive packet focused on the grower-invoice settlement artifact rather than pulling in every history appendix page.

## Print / Orphan Protection

The closeout report and packet print CSS were updated to better protect against orphaned blocks:

- closeout sections
- livehaul cards
- feed breakdown cards
- metric cards
- note cards
- summary strips
- table wrappers

Main goal:
- avoid stranded headers
- reduce awkward splitting of small report blocks

This work lives mostly in:
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Important Reversal: Auto-Print Removed

There was a short-lived implementation where the archive-summary page auto-triggered `window.print()` on load.

That behavior has been removed.

Reason:
- the user wanted the combined packet shown as a single document first
- auto-print made the experience feel too forceful
- browser save dialogs remain browser-controlled anyway

Current file reflecting the corrected behavior:
- `C:\dev\FlockTrax\web-admin\app\admin\flock-closeout\archive-summary-actions.tsx`

## Important Fix: Flock History Matrix Truncation

During the first archive-summary implementation, the flock-history matrix sections were truncating after roughly ~10 rows.

Root cause:
- the combined archive page was inheriting the flock-history report’s explicit page-break classes:
  - `flock-history-report-page--after-header`
  - `flock-history-report-page--break`
- in the archive-summary context, those forced “paged report” semantics caused the matrices to behave like segmented report pages instead of one continuous document

Fix applied:
- removed those forced page-break classes from the archive-summary page
- added archive-summary-scoped CSS to relax that behavior:
  - `.digital-archive-summary-shell .flock-history-report-page`
    - `break-before: auto`
    - `page-break-before: auto`
  - `.digital-archive-summary-shell .flock-history-report-table-wrap`
    - `overflow: visible`

Result:
- the archive-summary packet now treats those flock-history matrix sections as part of one continuous document
- truncation was corrected in the combined packet context

## Relationship To Earlier June 3 Checkpoint

This checkpoint builds directly on:
- `C:\dev\FlockTrax\output\FlockTrax_Closeout_Queue_Report_And_Placement_Scheduler_Checkpoint_2026-06-03.md`

That earlier checkpoint remains the broader operational baseline for:
- queue workflow
- queue milestone matrix
- worksheet sub-state checkboxes
- placement scheduler fill-date fixes
- dashboard badge recovery

This newer checkpoint is narrower and newer:
- it focuses on report flow and the digital archive packet

## Current Dirty Worktree Snapshot

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
- `C:\dev\FlockTrax\output\FlockTrax_Closeout_Queue_Report_And_Placement_Scheduler_Checkpoint_2026-06-03.md`
- `C:\dev\FlockTrax\output\FlockTrax_Closeout_Queue_Report_And_Scheduler_Polish_Checkpoint_2026-06-03.md`
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

Latest relevant verification during this pass:
- `npm run typecheck` passed in `C:\dev\FlockTrax\web-admin`

Not fully completed in this checkpoint:
- visual verification of every archive-summary section with a long real flock-history dataset
- print-preview verification of the new combined packet after the truncation fix

## Best Next Steps

1. visually validate the combined archive packet with a flock that has long daily-log and mortality matrices
2. print-preview the archive packet and confirm the flock-history sections now flow full-length
3. decide whether the archive packet should also include:
   - action-items history
   - closeout submission metadata
   - invoice/settlement placeholders
4. return to the previously open closeout data issue:
   - `283-S2` duplicate `4/27/26` livehaul discrepancy between closeout and livehaul scheduler

## Recommended Restart Prompt

```text
Load C:\dev\FlockTrax\output\FlockTrax_Digital_Archive_Summary_And_Report_Flow_Checkpoint_2026-06-03.md first.
```
