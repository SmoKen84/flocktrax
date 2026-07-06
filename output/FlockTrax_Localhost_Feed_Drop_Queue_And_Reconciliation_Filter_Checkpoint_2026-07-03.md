# FlockTrax Localhost Feed Drop Queue And Reconciliation Filter Checkpoint

Date: `2026-07-03`
Environment: `localhost:3001`
Workspace: `C:\dev\FlockTrax`
Primary app area: `web-admin`
Checkpoint type: detailed local working-tree checkpoint

## Purpose

Capture the current in-progress state of the feed-drop reconciliation queue so work can resume later without losing:

- the new official queue path for orphaned / unresolved feed drops
- the schema and save/load behavior that preserve a queued drop's original source assignment
- the current localhost-only queue filter additions in the feed ticket console
- the production-vs-local split between already deployed queue infrastructure and still-local queue-discovery refinements

## High-Level Status

The original fake-barn / fake-bin / fake-flock workaround was rejected in favor of an official queue concept for feed drops that need to be temporarily removed from flock/bin assignment while feed-ticket balance stays intact.

The queue foundation is now implemented in local code and backed by a successfully applied database migration.

Current status by surface:

- database migration: applied successfully
- Supabase hosted functions: queue-aware behavior deployed
- production `web-admin`: queue editor behavior deployed
- localhost `web-admin`: additional queue discovery/filter refinements still under evaluation before production promotion

## Business Problem Captured

During reconciliation against BinSentry, some feed drops exist in FlockTrax but do not yet have supporting sensor evidence at the expected bin/flock destination.

The system still needs to satisfy all of these rules at the same time:

- the feed ticket must stay fully allocated
- flock/bin totals should no longer carry the unresolved drop
- closeouts should be allowed to continue once real assigned feed is reconciled
- the original source assignment must not be lost while the drop is sitting in the queue

That led to the official queued-drop direction.

## What Was Implemented

### 1. Feed-drop queue schema

Migration added and applied:

- `C:\dev\FlockTrax\supabase\migrations\20260702153000_add_feed_drop_reconciliation_queue.sql`

This migration added:

- `queued_for_reconciliation`
- `queued_from_feed_bin_id`
- `queued_from_bin_code`
- `queued_from_barn_id`
- `queued_from_barn_code`
- `queued_from_placement_id`
- `queued_from_placement_code`
- `queued_at`

Meaning:

- live assignment fields can be cleared while queued
- original source flock/bin/barn details remain attached to the drop for later reassignment

### 2. Feed ticket editor queue behavior

Primary editor file:

- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`

Behavior now supported:

- a drop can be marked `Queue`
- queued drops clear active `feed_bin_id` / `placement_id` from the live assignment path
- queued drops preserve original source details in `queued_from_*`
- queued drops require a note
- queued drops cannot be created from an unassigned drop
- turning queue back off restores the remembered original assignment back into the editable row

UI behavior now includes:

- `Disposition` column with `Off Farm` and `Queue`
- tighter drop-row layout refinements to reclaim horizontal space from the flock selector
- queued flock display showing `DROP-QUEUE` / queued-source context instead of pretending the drop still belongs to an active flock

### 3. Hosted get/save logic

Hosted function files updated:

- `C:\dev\FlockTrax\supabase\functions\feed-ticket-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts`

Queue-aware behavior added:

- queued drops are accepted as valid save records without live bin/flock assignment
- queued drops are rejected unless original source flock/bin IDs are present
- queued source fields round-trip through save/get payloads
- queued drops are excluded from active feed-order receipt reconciliation

### 4. Next route/admin-side feed-ticket handling

Route file updated:

- `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`

The admin-side recalculation path was aligned so queued drops are not treated as live assigned drops during:

- inferred feed-bin layer recalculation
- feed-order receipt recalculation
- manual flock-correction checks

### 5. Feed ticket console queue discovery filter

Console/filter files updated locally:

- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\page.tsx`
- `C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts`

Localhost now includes a new filter selection:

- `Show only tickets with Queued drops.`

This works similarly to the existing redirected-drop filter by identifying ticket IDs that contain any `queued_for_reconciliation = true` drops and limiting the ticket/drop listing to those tickets.

Important status:

- this queued-drop filter refinement is intentionally still localhost-only for now
- the user wants to run through real reconciliation work before deciding to promote this exact filter behavior to production

## Production / Deployment State Captured

### Already deployed live

Supabase hosted functions deployed to project:

- `frneaccbbrijpolcesjm`

Functions deployed:

- `feed-ticket-get`
- `feed-ticket-submit`

Production `web-admin` queue release deployed earlier in this cycle:

- deployment id: `dpl_FRFWTjvt44mXj8htEedHVizdMaTi`
- inspector: `https://vercel.com/flock-trax/web-admin/FRFWTjvt44mXj8htEedHVizdMaTi`

Live status verified at deployment time:

- `https://flocktrax.com` returned `200 OK`
- `https://admin.flocktrax.com` returned `200 OK`

### Later localhost-only refinement

The later queue-discovery filter and related console refinements were not deployed.

The user explicitly chose to keep this portion local while real reconciliation work is performed:

- queued-drop console filter remains localhost-only
- additional queue UX may still change before production promotion

## Validation Captured

Validation completed during this work cycle:

- `npm run typecheck` passed after queue-source persistence changes
- `npm run typecheck` passed again after adding the localhost queued-drop filter

Build behavior observed:

- local build reached the familiar `Compiled successfully` / `Linting and checking validity of types ...` phase in this repo
- production Vercel build for the deployed queue release completed successfully and reached `READY`

## Main Files Touched In This Queue Cycle

Schema / backend:

- `C:\dev\FlockTrax\supabase\migrations\20260702153000_add_feed_drop_reconciliation_queue.sql`
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\feed-ticket-submit\index.ts`

Admin route / data:

- `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`
- `C:\dev\FlockTrax\web-admin\lib\feed-ticket-data.ts`

UI:

- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-editor.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\feed-ticket-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\feed-tickets\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Resume Notes

When resuming:

- treat the queue schema and hosted queue behavior as already live
- treat the queued-drop console filter as local-only unless the user explicitly asks to deploy it
- expect more localhost adjustments as real BinSentry-vs-ticket reconciliation exposes edge cases
- preserve the user’s goal that queued drops must stay balanced on the ticket while remaining off the active flock/bin books until a real destination is identified

## Recommended Next Step

Continue real reconciliation work on localhost and refine queue handling based on live operator use before promoting the queued-drop discovery filter and any related console/reporting changes to production.
