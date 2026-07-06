# FlockTrax Document Archive Placement Closeout And Backfill Checkpoint

Date: `2026-06-23`  
Captured: `2026-06-23 02:33:32 -05:00`  
Repo: `C:\dev\FlockTrax`  
Branch: `main`  
HEAD: `a6798990291ad82a850887a60d35f1e9e79340bf`  
HEAD message: `Add release 5.6 production checkpoint`  
Mode: local working-tree checkpoint

## Purpose

This checkpoint preserves the current document-archive implementation state after the first major expansion beyond feed tickets.

It records:

- the agreed archive-link model by business record
- the live feed-ticket original backfill milestone
- the current placement/closeout archive hooks now implemented in web-admin
- the exact dirty worktree snapshot needed if the local machine restarts unexpectedly

## Primary Resume Context

Load these first if this thread needs to be resumed:

- `output/FlockTrax_Document_Archive_Placement_Closeout_And_Backfill_Checkpoint_2026-06-23.md`
- `output/FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md`
- `output/FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md`

The June 22 checkpoint is still the foundation note for:

- the private Supabase Storage bucket
- the `document_archives` metadata table
- the first feed-ticket archive/open flow
- the signed retrieval path and audit-original visibility model

This June 23 checkpoint layers the next archive wave on top of that foundation.

## Agreed Archive Model

Current intended linkage model:

- hatch ticket -> `placement`
- livehaul packet -> `placement`
- summary snapshot / final Google Sheets printout -> `placement_closeouts`
- feed ticket original -> `feed_tickets`
- misc/supporting docs -> usually `placement`

Important clarification decided today:

- the GPC livehaul packet is not tied to each `livehaul_schedule` day row
- it is one combined packet covering the entire placement livehaul process
- therefore the `Livehaul Packet` archive item should be linked once to the `placement`

## Workflow Decisions Captured

The user’s real-world filing conventions and workflow now reflected in the system direction:

- dedicated Epson `ESW-500W` scanner remains the primary digitization path
- mobile camera capture remains a future secondary/backup path for field use
- existing manual scan/import flow is acceptable for now; direct scanner-to-FlockTrax capture can come later
- hatch/livehaul/summary naming convention outside feed tickets is:
  - `FlockCode-BarnCode_Hatch.pdf`
  - `FlockCode-BarnCode_Livehaul.pdf`
  - `FlockCode-BarnCode_Summary.pdf`
- feed-ticket historical originals on disk were already standardized as:
  - `Feed-<ticket_number>.pdf`
- `SMO` feed tickets are expected unmatched cases because they are internal transfers and often have no scanned supplier original

## What Was Implemented In This Phase

### Feed Ticket Archive Progress

- the feed-ticket archive foundation from June 22 was carried forward
- feed-ticket list UI was simplified earlier to use:
  - `Missing` when no original is linked
  - `Filed` when an original exists
- the separate `on file` badge was removed
- the `Add Doc` button was converted to a tighter icon-style control to keep one-row ticket layout
- a role-limited feed-ticket flock override path was added for super admin / farm manager use when a drop must be reassigned to the correct flock
- the label language was clarified from `Correct` to `Override`

### Feed Ticket Original Backfill

- local feed-ticket originals from `C:\Users\Ken\OneDrive\Desktop\scans\flocktrax\feed` were used for backfill work
- the backfill expectation was:
  - import originals back to `2026-01-01`
  - leave anything before that as manual-only
- a known correction was captured:
  - `feed-010761.pdf` is the correct image for ticket `010761`
- a backfill summary artifact now exists at:
  - `output/feed-ticket-backfill-summary-2026-06-23.json`

### Placement / Dashboard / Closeout Hooks

- hatch ticket archive hook added on placement everyday workflow surfaces
- hatch ticket hook kept available in the placement log matrix editor, but also surfaced in the more natural manager flow
- the dashboard placement editor popup now includes hatch ticket access
- closeout document access was consolidated into one checklist instead of separate scattered blocks

### Closeout Document Checklist Direction

The closeout screen now aims to function as one compact audit checklist:

- required rows:
  - `Hatch Ticket`
  - `Livehaul Packet`
  - `Summary Snapshot`
- supporting section:
  - `Other Documents`

The intent is:

- show whether each required document is present or missing
- open existing originals directly from closeout
- attach missing originals directly from closeout
- allow multiple supporting docs with human titles for miscellaneous audit support

### Livehaul Packet Correction

The closeout checklist originally showed `Livehaul Packet LH1`, `Livehaul Packet LH2`, etc.

That was corrected conceptually and in code:

- the closeout checklist now treats livehaul packet as one placement-level required document
- the upload action stores/replaces the `bill_of_lading` archive row against `placement_id`
- the closeout placement page now reads a single placement-level livehaul packet summary

### Misc Document Role

A new document role for supporting placement paperwork was added and the SQL was run successfully:

- migration:
  - `supabase/migrations/20260623153000_add_misc_document_role.sql`

Examples discussed for `Misc`:

- clean-wood / shavings declarations
- veterinary statements
- inspection support paperwork
- other flock-level supporting documents that do not belong to the fixed required categories

## Current Important Files

Primary archive-related files touched in this phase include:

- `supabase/migrations/20260622113000_create_document_archive.sql`
- `supabase/migrations/20260623153000_add_misc_document_role.sql`
- `web-admin/lib/document-archive.ts`
- `web-admin/lib/admin-data.ts`
- `web-admin/lib/closeout-data.ts`
- `web-admin/lib/types.ts`
- `web-admin/app/api/document-archive/`
- `web-admin/app/admin/feed-tickets/actions.ts`
- `web-admin/app/admin/feed-tickets/feed-ticket-document-uploader.tsx`
- `web-admin/app/admin/flock-closeout/actions.ts`
- `web-admin/app/admin/flock-closeout/closeout-document-panels.tsx`
- `web-admin/app/admin/flock-closeout/[placementId]/page.tsx`
- `web-admin/app/admin/placements/[placementId]/logs/actions.ts`
- `web-admin/app/admin/placements/[placementId]/logs/placement-hatch-ticket-panel.tsx`
- `web-admin/app/admin/placements/livehaul/actions.ts`
- `web-admin/components/active-placement-dashboard.tsx`
- `web-admin/app/globals.css`

## Validation State

Known validation completed in this path:

- `npm run typecheck` in `C:\dev\FlockTrax\web-admin` passed after the closeout livehaul packet refactor
- `npm run typecheck` also passed after the compacting pass on the closeout `Document Archive` section

## Current Dirty Worktree Context

Current `git status --short` at checkpoint time:

- modified:
  - `output/FlockTrax_Checkpoint_Index.md`
  - `supabase/.temp/cli-latest`
  - `supabase/functions/feed-ticket-submit/index.ts`
  - `web-admin/app/admin/feed-bins/actions.ts`
  - `web-admin/app/admin/feed-bins/feed-bins-view.tsx`
  - `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
  - `web-admin/app/admin/feed-tickets/feed-ticket-editor.tsx`
  - `web-admin/app/admin/feed-tickets/page.tsx`
  - `web-admin/app/admin/flock-closeout/[placementId]/archive-summary/page.tsx`
  - `web-admin/app/admin/flock-closeout/[placementId]/page.tsx`
  - `web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx`
  - `web-admin/app/admin/flock-closeout/actions.ts`
  - `web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx`
  - `web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx`
  - `web-admin/app/admin/flock-closeout/page.tsx`
  - `web-admin/app/admin/placements/[placementId]/logs/actions.ts`
  - `web-admin/app/admin/placements/[placementId]/logs/page.tsx`
  - `web-admin/app/admin/placements/livehaul/actions.ts`
  - `web-admin/app/admin/reports/feed-projection/feed-projection-report-table.tsx`
  - `web-admin/app/admin/reports/feed-projection/page.tsx`
  - `web-admin/app/api/feed-ticket-editor/route.ts`
  - `web-admin/app/globals.css`
  - `web-admin/components/active-placement-dashboard.tsx`
  - `web-admin/lib/admin-data.ts`
  - `web-admin/lib/binsentry.ts`
  - `web-admin/lib/closeout-data.ts`
  - `web-admin/lib/feed-bin-data.ts`
  - `web-admin/lib/feed-ticket-data.ts`
  - `web-admin/lib/types.ts`
- untracked:
  - `output/FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md`
  - `output/FlockTrax_Feed_Order_Reconciliation_And_Bin_Layer_State_Checkpoint_2026-06-17.md`
  - `output/FlockTrax_Log_Weight_Report_And_Feed_Ticket_Scan_Storage_Checkpoint_2026-06-16.md`
  - `output/FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md`
  - `output/feed-ticket-backfill-summary-2026-06-23.json`
  - `supabase/migrations/20260617120000_add_feed_layer_state_and_feed_type_to_ordering.sql`
  - `supabase/migrations/20260622113000_create_document_archive.sql`
  - `supabase/migrations/20260623153000_add_misc_document_role.sql`
  - `web-admin/app/admin/feed-tickets/actions.ts`
  - `web-admin/app/admin/feed-tickets/feed-ticket-document-uploader.tsx`
  - `web-admin/app/admin/flock-closeout/closeout-document-panels.tsx`
  - `web-admin/app/admin/placements/[placementId]/logs/placement-hatch-ticket-panel.tsx`
  - `web-admin/app/admin/placements/[placementId]/logs/weight-report/`
  - `web-admin/app/api/document-archive/`
  - `web-admin/components/log-weight-report.tsx`
  - `web-admin/lib/document-archive.ts`
  - `web-admin/lib/placement-log-weight-report.ts`

## Diff Snapshot

Overall `git diff --stat` at checkpoint time:

- `29 files changed, 3361 insertions(+), 127 deletions(-)`

Important note:

- this diffstat still spans more than one workstream
- it includes prior feed-order / closeout / report work already in the dirty tree
- do not assume every modified file belongs only to the document-archive effort

## Best Next Steps

Most likely next moves when work resumes:

- continue extending archive hooks to the remaining needed business records without changing the current working upload model
- keep scanner/manual import as the stable path for now
- revisit direct scanner-to-FlockTrax capture later as a separate capture workflow
- revisit mobile camera capture later as a controlled backup path, not as the primary office process
- keep the closeout checklist compact and operational rather than returning to large separate document panels

## Recommended Restart

If the machine crashes, reboots, or Codex session state is lost, start the next chat with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Document_Archive_Placement_Closeout_And_Backfill_Checkpoint_2026-06-23.md first, then load C:\\dev\\FlockTrax\\output\\FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md, then load C:\\dev\\FlockTrax\\output\\FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md. Resume from the document-archive expansion path, preserving the current dirty tree, and treat the current archive model as hatch ticket -> placement, livehaul packet -> placement, summary snapshot -> placement_closeouts, feed ticket original -> feed_tickets, and misc docs -> placement.` 
