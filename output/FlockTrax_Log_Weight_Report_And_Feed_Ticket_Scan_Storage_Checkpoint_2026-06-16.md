# FlockTrax Log Weight Report And Feed Ticket Scan Storage Checkpoint

Date: `2026-06-16`  
Captured: `2026-06-16 07:59:43 -05:00`  
Repo: `C:\dev\FlockTrax`  
Branch: `main`  
HEAD: `a6798990291ad82a850887a60d35f1e9e79340bf`  
HEAD message: `Add release 5.6 production checkpoint`  
Mode: local working-tree checkpoint

## Purpose

This checkpoint records two related admin-side threads:

- the new placement `log_weight` report flow that now plugs into closeout, the placement log matrix area, and the live dashboard
- the agreed storage direction for original scanned feed-ticket documents needed for ROA/ROC, NOP, and feed-total audit/investigation work

This is the right restart point if the next task is:

- finishing or reviewing the new `log_weight` vs `stdbreedspec` report flow
- extending the feed-ticket list so ticket numbers open original scanned documents
- adding database/storage schema for immutable ticket-scan originals and metadata

## What Was Added For Log Weight Reporting

New shared report/data files were added:

- `web-admin/lib/placement-log-weight-report.ts`
- `web-admin/components/log-weight-report.tsx`
- `web-admin/app/admin/placements/[placementId]/logs/weight-report/page.tsx`

Those files establish a reusable report bundle and print-style report section that:

- loads active `log_weight` rows for a placement
- resolves the placement flock's male and female breed ids
- matches each sample row to active same-age `stdbreedspec` rows
- shows sample count, average weight, standard deviation, procure, benchmark target weight, percent-of-spec, variance-from-spec, benchmark day-feed-per-bird, and notes

The report currently sorts by `log_date` and then sex, and exposes latest male/female sample summaries in the report header strip.

## Where The New Report Was Wired In

The shared report section was embedded into the closeout print/report surfaces:

- `web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx`
- `web-admin/app/admin/flock-closeout/[placementId]/archive-summary/page.tsx`

New launch points were added from:

- `web-admin/app/admin/flock-closeout/[placementId]/page.tsx`
- `web-admin/app/admin/placements/[placementId]/logs/page.tsx`
- `web-admin/components/active-placement-dashboard.tsx`

Styling support for the dashboard link and the numeric/variance display in the report table was added in:

- `web-admin/app/globals.css`

In practical terms, the current navigation surface is:

- closeout workspace -> `Log Weight Report`
- placement log matrix page -> `Log Weight Report`
- live dashboard weight subpanel -> `Log Weight Report`

## Feed Ticket Scan Storage Decision

The agreed recommendation for preserving original scanned ticket documents is:

- store the original scan files themselves in a private Supabase Storage bucket
- store only metadata and lookup keys in the main Supabase/Postgres database
- treat the stored originals as immutable audit documents rather than overwritable attachments

The reason for that direction is the operational requirement to reopen the exact original scan later during:

- ROA/ROC audit support
- NOP audit support
- feed-total investigations when a flock total looks wrong, for example ticket review on cases like `294-W2`

The key conclusion was:

- yes, this approach can preserve and later reopen the original document image/PDF itself
- no transformation is required for the archive copy if audit fidelity matters

Recommended metadata shape for a future `feed_ticket_scans` table:

- `id`
- `feed_ticket_id`
- `ticket_num_snapshot`
- `storage_bucket`
- `storage_path`
- `original_filename`
- `mime_type`
- `byte_size`
- `sha256`
- `uploaded_at`
- `uploaded_by`
- `is_active`

Recommended storage behavior:

- upload original file as-is
- do not overwrite existing originals
- create a new version/row if a replacement is ever needed
- open scans from the app through a controlled URL or protected route rather than relying on local disk/OneDrive paths

## Current Dirty Worktree Context

Current `git status --short` at checkpoint time:

- modified:
  - `supabase/.temp/cli-latest`
  - `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
  - `web-admin/app/admin/feed-tickets/page.tsx`
  - `web-admin/app/admin/flock-closeout/[placementId]/archive-summary/page.tsx`
  - `web-admin/app/admin/flock-closeout/[placementId]/page.tsx`
  - `web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx`
  - `web-admin/app/admin/flock-closeout/actions.ts`
  - `web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx`
  - `web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx`
  - `web-admin/app/admin/flock-closeout/page.tsx`
  - `web-admin/app/admin/placements/[placementId]/logs/page.tsx`
  - `web-admin/app/globals.css`
  - `web-admin/components/active-placement-dashboard.tsx`
  - `web-admin/lib/closeout-data.ts`
  - `web-admin/lib/feed-ticket-data.ts`
- untracked:
  - `web-admin/app/admin/placements/[placementId]/logs/weight-report/`
  - `web-admin/components/log-weight-report.tsx`
  - `web-admin/lib/placement-log-weight-report.ts`

Important boundary:

- the new report work from this thread is only a subset of the current dirty tree
- there were already broader local edits in closeout/feed-ticket files before this checkpoint was captured
- next-step work should read those files carefully rather than assuming all current diffs belong to one change set

## Diff Snapshot

Overall `git diff --stat` at checkpoint time:

- `15 files changed, 504 insertions(+), 39 deletions(-)`

That diffstat includes broader in-progress closeout and feed-ticket edits beyond the new log-weight reporting files.

The most relevant files for the new report flow are:

- `web-admin/lib/placement-log-weight-report.ts`
- `web-admin/components/log-weight-report.tsx`
- `web-admin/app/admin/placements/[placementId]/logs/weight-report/page.tsx`
- `web-admin/app/admin/flock-closeout/[placementId]/report/page.tsx`
- `web-admin/app/admin/flock-closeout/[placementId]/archive-summary/page.tsx`
- `web-admin/app/admin/flock-closeout/[placementId]/page.tsx`
- `web-admin/app/admin/placements/[placementId]/logs/page.tsx`
- `web-admin/components/active-placement-dashboard.tsx`
- `web-admin/app/globals.css`

## Validation

Validation run during this thread:

- `npm run typecheck` in `C:\dev\FlockTrax\web-admin` -> passed

No browser verification was run in this checkpoint.

## Recommended Next Start

If the next task is to finish the scanned-ticket launch flow from the feed-ticket list, resume from this checkpoint and treat the remaining work as:

- define the exact app-setting key(s) for scan storage location
- choose whether scan delivery will use direct Storage URLs or a protected app route
- add scan metadata lookup to the feed-ticket data bundle
- render the ticket number column as a link only when an original scan can be resolved

Suggested resume framing:

`Resume C:\dev\FlockTrax from C:\dev\FlockTrax\output\FlockTrax_Log_Weight_Report_And_Feed_Ticket_Scan_Storage_Checkpoint_2026-06-16.md. The new placement log-weight report flow is wired into closeout, the log matrix area, and the dashboard, and typecheck passed. The agreed document-archive direction is private Supabase Storage plus immutable metadata rows in Postgres. Continue by adding feed-ticket scan metadata and turning the ticket-number column into a launch link for original scanned documents.`
