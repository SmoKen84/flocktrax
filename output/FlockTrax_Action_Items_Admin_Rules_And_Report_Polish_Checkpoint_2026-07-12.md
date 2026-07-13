# FlockTrax Action Items Admin Rules And Report Polish Checkpoint

Date: `2026-07-12`  
Branch: `main`  
Local HEAD: `7932dc6`  
Purpose: preserve the completed web-admin Action Items terminology, lifecycle, console, report, audit-trail, hosted-backend, deployment, and local verification state before field testing the mobile Work Orders workspace.

## Product Model Now Agreed

`Action Item` and mobile `Work Order` are two names for the same record:

- management uses the Action Items Console
- farm workers use the Work Orders workspace
- the different labels reflect the user's job context, not different data models

An Action Item is created as either:

- `Barn Item`: repair, installation, calibration, maintenance, or observation attached to a physical barn
- `Placement Item`: flock health, environmental, or production concern attached to a placement/flock

The parent lifecycle is intentionally simple:

- `Open`
- `Resolved`

There is no separate parent `In Progress`, `Waiting`, `Completed`, or duplicate closed-state bucket. An open item is considered active/in progress until a saved memo resolves it.

## Audit And Update Rules

- the original item contains the Action Title/Subject and Action Details
- subsequent entries are dated append-only memos attached to the original item
- a saved update cannot be edited; a correction requires another memo
- every item and memo records creator and timestamp
- the parent tracks `created_by` and the user responsible for the latest update through `updated_by`
- the update entry has a `Resolved` checkbox
- saving an update with `Resolved` checked atomically appends the memo and closes the parent item
- the existing `Resolve` action remains, but opens the memo editor with the resolve option preselected

## Hosted Database And Functions

Applied hosted migration:

- `supabase/migrations/20260712143000_simplify_action_item_memo_lifecycle.sql`

The migration:

- adds `issues.updated_by`
- adds RPC `append_issue_memo`
- adds a trigger preventing edits to saved `issue_updates`

Hosted functions deployed during this work:

- `issue-create`
- `issue-update`
- `issue-resolve`
- `action-items-list`

The hosted database remains the development data source. Do not move this feature to a local database or assume the migration/functions are local-only.

## Admin Console Terminology And Workflow

The create/edit workflow now uses:

- `Link Action To:`
- `Assign Item to:` with Barn or Placement
- `Action Title/Subject`
- `Action Details`
- `Status:`

The Action Items list now:

- uses simple white rows
- uses a cyan background for the selected item
- uses a colored left status bracket
- displays Classification in bold navy
- displays only the Action Title/Subject beneath the classification
- keeps Update History empty until the user explicitly selects an item

The Update History heading now shows the selected Action Title in bold navy and the original Action Details immediately below it.

## Console Hero And Filter Polish

The hero explanation now describes:

- Barn Items
- Placement Items
- creation during Daily Flock Inspections in FlockTrax-Mobile
- processing through the mobile Work Orders Dashboard

`Manage Action Types` was renamed to:

- `Edit Classification Categories`

The filter band now uses the agreed labels and arrangement:

- row 1: Farm, Barn, Flock Code, Assigned To, Status
- row 2: From, To, Classification, Sort By
- action rail: Apply Filters, Clear Filters, Preview/Print Report

Additional filter corrections:

- Flock Code is a placement/flock selector instead of free text
- Assigned To supports Barn and Placement checkboxes
- Status supports Open and Resolved checkboxes
- the filter-specific responsive breakpoint was lowered so normal desktop widths retain the intended two-row band
- obsolete date-input minimum widths were removed so From and To no longer collide with adjacent fields
- the filter form is keyed to URL-backed filter state so `Clear Filters` visibly resets all controls as well as the result set

Initial create-state safety was also corrected:

- the console no longer falls back to `placements[0]`
- no Action Item row or barn context is focused on first load
- the list header reads `No Action Item selected`
- `Link Action To` starts on an empty `Select a barn / placement` placeholder
- neither Barn nor Placement assignment is preselected
- Classification is empty and disabled until the user deliberately chooses Barn or Placement
- server-side validation still rejects missing or mismatched placement, assignment, classification, and title values

Local Clear Filters verification confirmed:

- URL returns to `/admin/issues`
- all filter checkboxes clear
- farm, barn, flock, and classification return to their default values
- sort returns to `Date Opened`

## Multi-Item Action Item Report

The report is intended to be a readable open-work list with each Action Item followed by its linked memo/update thread.

Current report refinements:

- open items include their update entries beneath the parent item
- update entries are indented and visually attached to their parent
- barn/location is bold navy and more prominent than ordinary metadata
- Classification and Location remain separate columns
- fixed column widths keep every Location aligned vertically across items
- item blocks use a darker warm parchment background and stronger border
- update blocks use a contrasting blue-gray background and stronger left accent
- `Clear Filters` behavior is corrected before launching a new report

Print-specific changes:

- Action Items Report uses a named `letter landscape` print page
- other reports retain the global portrait rule
- general printed report data is approximately `14.4px`
- Action Details are approximately `14.4px` with increased line spacing
- update memo text is approximately `15px`
- titles, locations, filters, summaries, and statuses were increased proportionally

## Verification Completed

Repeated successful checks:

- `npx tsc --noEmit` in `C:\dev\FlockTrax\web-admin`
- `git diff --check` for the edited Action Items files
- authenticated localhost browser inspection of `/admin/issues`
- authenticated localhost browser inspection of `/admin/issues/report`
- direct browser test of populated filters followed by Clear Filters
- direct browser verification of the blank initial create/list state

The admin user confirmed the final console layout, report alignment, report shading, and filter behavior during localhost testing.

## Deployment Boundary

An earlier Action Items lifecycle/console build was deployed to production:

- deployment id: `dpl_5Vvp8N2PS35TuFRrRGxAUJqKLDed`
- alias: `https://flocktrax.com`

Important:

- the later localhost polish in this checkpoint was performed after that deployment
- the latest filter spacing, shortened report button, report location emphasis/alignment, darker blocks, landscape print sizing, larger print fonts, and Clear Filters remount fix are currently local working-tree changes
- run a fresh web-admin production build/deploy before expecting those final refinements on `flocktrax.com`

## Mobile Handoff

The admin Action Items rules and terminology are now considered synchronized and complete enough to shift attention to mobile Work Orders testing.

Next focus:

1. Test the mobile Work Orders list against the web-admin Action Items Console.
2. Verify farm/user scoping.
3. Verify Barn and Placement ownership.
4. Verify append-only memo creation and history order.
5. Verify the Resolved checkbox closes the parent and removes it from the open mobile queue.
6. Fix mobile discrepancies without reopening the settled admin terminology unless testing exposes a true shared-data problem.

## Git And Recovery State

This work is not committed at this checkpoint.

- branch: `main`
- local HEAD: `7932dc6`
- the working tree contains substantial related mobile, web-admin, Supabase, feed-projection, and checkpoint work
- do not reset, clean, or discard the working tree
- `supabase/.temp/cli-latest` is non-product CLI noise

Key Action Item files:

- `C:\dev\FlockTrax\web-admin\app\admin\issues\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\issues\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\issues\report\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\issues\work-order\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\supabase\migrations\20260712143000_simplify_action_item_memo_lifecycle.sql`
- `C:\dev\FlockTrax\supabase\functions\action-items-list\index.ts`
- `C:\dev\FlockTrax\supabase\functions\issue-update\index.ts`
- `C:\dev\FlockTrax\mobile\src\screens\ActionItemsScreen.tsx`

## Safe Resume Prompt

`Load FlockTrax_Action_Items_Admin_Rules_And_Report_Polish_Checkpoint_2026-07-12.md, FlockTrax_Mobile_Work_Orders_1_0_4_Test_Readiness_Checkpoint_2026-07-12.md, and FlockTrax_Checkpoint_Index.md. Preserve the dirty working tree. Treat the admin lifecycle and terminology as settled, continue with mobile Work Orders field testing, and remember that the final localhost admin/report polish still needs a production web deployment.`
