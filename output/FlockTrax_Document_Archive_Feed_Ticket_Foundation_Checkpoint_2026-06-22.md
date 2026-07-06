# FlockTrax Document Archive Feed Ticket Foundation Checkpoint

Date: `2026-06-22`  
Captured: `2026-06-22 09:44:32 -05:00`  
Repo: `C:\dev\FlockTrax`  
Branch: `main`  
HEAD: `a6798990291ad82a850887a60d35f1e9e79340bf`  
HEAD message: `Add release 5.6 production checkpoint`  
Mode: local working-tree checkpoint

## Purpose

This checkpoint records the first implemented document-archive foundation for audit originals, with the first live workflow wired into the admin feed-ticket screen.

This is the right restart point if the next task is:

- continuing the document archive feature
- wiring the same archive model into placements, livehaul, or closeout records
- starting historical scan import/backfill from the existing scan folder

## What Was Added

Database/storage foundation added:

- private Supabase Storage bucket: `flocktrax-document-archive`
- new metadata table: `public.document_archives`
- support for linking one immutable current archive row to exactly one business record:
  - `placements`
  - `feed_tickets`
  - `livehaul_schedule`
  - `livehaul_loads`
  - `placement_closeouts`

Main new files added:

- `supabase/migrations/20260622113000_create_document_archive.sql`
- `web-admin/lib/document-archive.ts`
- `web-admin/app/admin/feed-tickets/actions.ts`
- `web-admin/app/admin/feed-tickets/feed-ticket-document-uploader.tsx`
- `web-admin/app/api/document-archive/[documentId]/route.ts`

Main existing files updated for the first UI pass:

- `web-admin/lib/feed-ticket-data.ts`
- `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
- `web-admin/app/globals.css`

## Feed Ticket Workflow Now In Place

The admin feed-ticket list now has a document-status column and archive actions.

Current behavior:

- tickets with no archived original show `Missing`
- tickets with an archived original show `Filed`
- the action cell now uses compact icon buttons to avoid wrapping
- the archive dialog opens from the feed-ticket row
- archive retrieval uses a protected app route that signs a private Storage URL at request time

Important UI adjustment made during this pass:

- the original multi-line `On File`/upload detail display was intentionally collapsed into a single-line `Filed` status stamp so the feed-ticket screen stays dense and usable

## Validation Performed

Validation completed during this pass:

- `npm run typecheck` in `C:\dev\FlockTrax\web-admin` -> passed
- local admin dev server launched successfully on `http://localhost:3001`
- feed-ticket list rendered the new `Document` column and `Missing` status
- archive dialog rendered correctly
- protected open route successfully redirected to a signed private Supabase Storage URL

Important validation note:

- browser automation could not drive the native file-picker itself in this runtime
- the end-to-end verification was completed by inserting and then removing a harmless test archive record directly through the same Storage/table path
- the temporary verification PDF and inserted test archive row were removed before this checkpoint was captured

## Current Product Boundary

The archive foundation is implemented, but only the feed-ticket surface is wired so far.

Still not yet wired:

- hatch-ticket originals linked to `placements`
- bills of lading linked to `livehaul_schedule`
- scale tickets linked to `livehaul_loads`
- final worksheet/sheet snapshot linked to `placement_closeouts`
- office scan-inbox import flow from the Epson-generated PDF folder
- historical backfill/import tooling for existing scanned originals from `2026-01-01` forward

## Current Dirty Worktree Context

Current `git status --short` at checkpoint time included the following document-archive files in addition to broader existing local work:

- untracked:
  - `output/FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md`
  - `supabase/migrations/20260622113000_create_document_archive.sql`
  - `web-admin/app/admin/feed-tickets/actions.ts`
  - `web-admin/app/admin/feed-tickets/feed-ticket-document-uploader.tsx`
  - `web-admin/app/api/document-archive/`
  - `web-admin/lib/document-archive.ts`
- modified:
  - `web-admin/app/admin/feed-tickets/feed-ticket-console.tsx`
  - `web-admin/app/globals.css`
  - `web-admin/lib/feed-ticket-data.ts`

Important boundary:

- the worktree still also contains the broader June 17 feed-ordering / bin-layer-state / receipt-reconciliation path and the June 16 log-weight report path
- do not treat the full dirty tree as document-archive-only work

## Recommended Next Start

If resuming this exact thread, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Document_Archive_Feed_Ticket_Foundation_Checkpoint_2026-06-22.md first, then C:\\dev\\FlockTrax\\output\\FlockTrax_PC_Stability_Precaution_Checkpoint_2026-06-20.md, then continue the document archive rollout without disturbing the broader dirty tree.`

Most likely next steps:

- manually verify one real feed-ticket upload through the browser file picker
- decide whether the next archive surface should be `placements`, `livehaul_schedule`, `livehaul_loads`, or `placement_closeouts`
- add missing-document visibility/reporting so audit exceptions surface early
- design the scan-inbox / backfill path using the existing office scan folder with the `2026-01-01` archive coverage boundary
