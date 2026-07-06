# FlockTrax Feed Order Reconciliation And Bin Layer State Checkpoint

Date: `2026-06-17`  
Captured: `2026-06-17 23:53:46 -05:00`  
Repo: `C:\dev\FlockTrax`  
Branch: `main`  
HEAD: `a6798990291ad82a850887a60d35f1e9e79340bf`  
HEAD message: `Add release 5.6 production checkpoint`  
Mode: local working-tree checkpoint

## Purpose

This checkpoint captures the current feed-ordering continuation after the June 9 production baseline and the June 16 report/storage checkpoint.

It specifically records:

- the new layered bin-state schema for starter/grower-aware feed ordering
- the feed-bin editor additions for accessible and queued feed state
- the BinSentry sync update that now preserves layer context and refreshes accessible pounds for single-layer bins
- the forward-only bin-layer inference from real feed-ticket drops
- the new load-level feed-order receipt reconciliation model that treats orders as total load commitments and receipts as the actual drop history

This is the right restart point if the next task is:

- continuing feed project and ordering recommendations work
- validating live BinSentry-driven layered feed state
- refining or deploying feed-ticket-to-order reconciliation
- extending open-order creation/editing so `feed_type` is always populated

## What Was Added

New schema migration file added:

- `supabase/migrations/20260617120000_add_feed_layer_state_and_feed_type_to_ordering.sql`

That migration adds:

- `feedbins.accessible_feed_type`
- `feedbins.accessible_feed_lbs`
- `feedbins.queued_feed_type`
- `feedbins.queued_feed_lbs`
- `feedbins.feed_state_effective_at`
- `feedbins.feed_state_source`
- `feed_order_commitments.feed_type`
- `feed_inventory_snapshots.accessible_feed_type`
- `feed_inventory_snapshots.queued_feed_type`

The user confirmed during this thread that the SQL ran successfully against the live environment.

## Current Feed Ordering Model After This Pass

The current intended operational model is now:

- feed orders are treated as load-level commitments, commonly `48,000 lbs`
- planned drops on the order remain useful planning intent, but are not treated as a strict receipt contract
- real feed tickets and their actual drops are the receipt truth
- reconciliation consumes compatible open loads from actual delivered drops, even when the mill delivers in a different drop order than originally planned

Compatibility currently means:

- same farm at minimum
- more specific scoped orders are preferred first:
  - `feed_bin_id`
  - then `placement_id`
  - then `barn_id`
  - then broader farm-level scope
- typed orders are preferred ahead of untyped orders
- older ETA / older created loads win inside the same compatibility band

## Bin Layer State Work

The feed-bin maintenance surface now exposes layered state fields in:

- `web-admin/app/admin/feed-bins/feed-bins-view.tsx`
- `web-admin/app/admin/feed-bins/actions.ts`
- `web-admin/lib/feed-bin-data.ts`

Current intent of those fields:

- `accessible_*` = feed reachable by birds now
- `queued_*` = next feed stacked above the accessible layer
- `feed_state_source` records whether the state is:
  - manual
  - `ticket_inferred`
  - `binsentry_sync`

## BinSentry Sync Behavior

`web-admin/lib/binsentry.ts` was updated so BinSentry sync now:

- preserves layer context onto inventory snapshots
- writes `accessible_feed_type` / `queued_feed_type` context to `feed_inventory_snapshots`
- refreshes `accessible_feed_lbs` from live BinSentry pounds when the bin is operating as a single known accessible layer

Important boundary:

- BinSentry still does not decide feed type by itself
- it supplies live quantity
- FlockTrax owns feed-layer meaning

## Forward-Only Bin Layer Inference

Forward-only layer inference was added in:

- `supabase/functions/feed-ticket-submit/index.ts`
- `web-admin/app/api/feed-ticket-editor/route.ts`

Behavior:

- when a feed ticket is saved, edited, or deleted, only the touched bins are recalculated
- the first relevant positive delivered drop becomes the accessible layer
- a later positive delivered drop of another type becomes the queued layer
- negative drops reduce the matching layer
- if the accessible layer is depleted and queued feed exists, queued feed promotes down to accessible
- no broad historical backfill was attempted

This was intentionally done as a live-safe, forward-oriented approach rather than seeding or bulk rewriting live data.

## Feed Order Receipt Reconciliation

Load-level receipt reconciliation was added in:

- `supabase/functions/feed-ticket-submit/index.ts`
- `web-admin/app/api/feed-ticket-editor/route.ts`

Current behavior:

- only positive `Reg` ticket drops are treated as feed receipts
- reconciliation rebuilds `feed_order_commitments.received_lbs` from current receipt history for the touched farms
- order status is recalculated to:
  - `open`
  - `partial`
  - `received`
- `received_ticket_id` is set only when one fully received order resolves to exactly one ticket

Important operational decision captured here:

- the system does **not** require actual receipts to match the original planned drop sequence on the order
- the order is treated as the load commitment
- the ticket drop pattern is treated as what really happened

## Report And Dashboard Read-Side Changes

The admin read-side was extended so typed recommendations can exist when enough typed state exists:

- `web-admin/lib/admin-data.ts`
- `web-admin/lib/types.ts`
- `web-admin/app/admin/reports/feed-projection/page.tsx`
- `web-admin/app/admin/reports/feed-projection/feed-projection-report-table.tsx`
- `web-admin/components/active-placement-dashboard.tsx`

Current behavior:

- total recommendation remains available as a fallback
- typed starter/grower recommendation only activates when enough typed inventory/order context exists
- if untyped open orders still exist, the system intentionally stays conservative and uses the legacy total-pound fallback rather than pretending certainty

## Validation

Validation run during this thread:

- `npm run typecheck` in `C:\dev\FlockTrax\web-admin` -> passed

Validation not completed in this thread:

- no browser verification
- no local `deno check` because `deno` was not installed in the current shell environment
- no web-admin or Supabase function deployment was performed in this thread

## Current Dirty Worktree Context

Current `git status --short` at checkpoint time includes broader unrelated local work as well as the new feed-ordering changes.

Most relevant files for this checkpoint are:

- `supabase/migrations/20260617120000_add_feed_layer_state_and_feed_type_to_ordering.sql`
- `supabase/functions/feed-ticket-submit/index.ts`
- `web-admin/app/api/feed-ticket-editor/route.ts`
- `web-admin/lib/binsentry.ts`
- `web-admin/lib/admin-data.ts`
- `web-admin/lib/types.ts`
- `web-admin/lib/feed-bin-data.ts`
- `web-admin/app/admin/feed-bins/actions.ts`
- `web-admin/app/admin/feed-bins/feed-bins-view.tsx`
- `web-admin/app/admin/reports/feed-projection/page.tsx`
- `web-admin/app/admin/reports/feed-projection/feed-projection-report-table.tsx`
- `web-admin/components/active-placement-dashboard.tsx`

Important boundary:

- the repo still contains the separate in-flight June 16 log-weight report and feed-ticket-scan storage work
- there are also broader closeout/feed-ticket edits in the dirty tree beyond this feed-ordering slice
- resume work should continue reading touched files carefully rather than assuming all current diffs belong to only one feature

## Diff Snapshot

Overall `git diff --stat` at checkpoint time:

- `26 files changed, 1841 insertions(+), 67 deletions(-)`

That diffstat includes other broader local edits already in flight before this exact checkpoint.

## Recommended Next Start

If work resumes in a new chat, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Feed_Order_Reconciliation_And_Bin_Layer_State_Checkpoint_2026-06-17.md first. The layered feed-state migration has already been applied live, BinSentry sync now refreshes single-layer accessible pounds, feed-ticket saves/deletes now infer touched-bin layer state from real drops, and positive Reg ticket receipts now reconcile against compatible open load commitments by scope rather than by the original planned drop sequence. Continue by validating real live receipt matches, making sure new open orders always capture feed_type, and preparing the deploy path for web-admin plus the feed-ticket-submit function.`
