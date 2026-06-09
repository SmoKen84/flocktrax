# FlockTrax Feed Order Prediction And BinSentry Foundation Checkpoint

Date: 2026-06-06
Workspace: `C:\dev\FlockTrax`
Branch: `main`
Status: local working changes only, not yet committed or deployed

## Purpose

This checkpoint captures the first implementation pass toward turning the existing 10-day feed requirement popup into a real feed-ordering tool by adding:

- on-hand inventory context
- open feed-order context
- a recommended order calculation
- the first BinSentry integration foundation

This work is intentionally local-only at this point. The database migrations for this branch were run manually in Supabase, but the web-admin code is still uncommitted and undeployed.

## Business Direction Confirmed

The user wants the current 10-day feed popup to remain the forecast engine, but also show what must actually be ordered.

Current estimator already uses:

- `public.stdbreedspec.dayfeedperbird`
- projected population by day
- mortality trend adjustment
- livehaul schedule reduction

Two missing ordering factors were identified:

1. current barn/bin inventory
   - intended source: BinSentry API
2. feed already ordered but not yet delivered
   - does not currently exist in BinSentry operationally
   - should be tracked in FlockTrax for now

Agreed implementation direction:

- keep the demand forecast formula separate from ordering logic
- compute a net order position as:
  - `projected need - on hand - on order = recommended order`
- wire BinSentry for inventory first
- keep open feed orders in FlockTrax until BinSentry order entry becomes real in operations

## Database Changes Added

Two new migrations were created locally and the SQL was pasted/run manually by the user in Supabase:

### 1. Feed ordering foundation

File:
- [C:\dev\FlockTrax\supabase\migrations\20260606113000_create_feed_ordering_foundation.sql](C:\dev\FlockTrax\supabase\migrations\20260606113000_create_feed_ordering_foundation.sql)

Tables created:

- `public.feed_inventory_snapshots`
  - stores observed pounds on hand
  - intended for BinSentry or manual snapshot ingestion
- `public.feed_order_commitments`
  - stores open / partial / received / cancelled feed order commitments
  - provides the “on order” layer independent of delivered ticket history

The user confirmed:
- SQL ran successfully

### 2. BinSentry mapping on feed bins

File:
- [C:\dev\FlockTrax\supabase\migrations\20260606124500_add_binsentry_mapping_to_feedbins.sql](C:\dev\FlockTrax\supabase\migrations\20260606124500_add_binsentry_mapping_to_feedbins.sql)

Columns added to `public.feedbins`:

- `binsentry_bin_ref`
- `binsentry_last_sync_at`
- `binsentry_last_inventory_lbs`
- `binsentry_sync_note`

The user confirmed:
- SQL ran successfully

## Web Admin Changes Implemented Locally

### Dashboard feed popup enhancements

Files:
- [C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx](C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx)
- [C:\dev\FlockTrax\web-admin\lib\admin-data.ts](C:\dev\FlockTrax\web-admin\lib\admin-data.ts)
- [C:\dev\FlockTrax\web-admin\lib\types.ts](C:\dev\FlockTrax\web-admin\lib\types.ts)

New placement-level feed fields were added:

- `feedInventoryOnHandLbs`
- `feedInventorySnapshotAt`
- `feedOnOrderLbs`
- `feedOnOrderOpenCount`
- `feedOnOrderNextEta`
- `feedRecommendedOrderLbs`
- `feedProjectedSupplyLbs`
- `feedProjectedNetPositionLbs`

The 10-day popup now displays:

- total requirement
- on hand inventory
- open orders
- recommended order
- average per day
- daily range
- window
- net position
- explanatory status lines for livehaul adjustment, inventory state, on-order state, and ordering position

Design rule preserved:

- existing forecast math was not replaced
- new supply/order information is layered on top of the forecast

### Feed bin admin changes

Files:
- [C:\dev\FlockTrax\web-admin\app\admin\feed-bins\actions.ts](C:\dev\FlockTrax\web-admin\app\admin\feed-bins\actions.ts)
- [C:\dev\FlockTrax\web-admin\app\admin\feed-bins\feed-bins-view.tsx](C:\dev\FlockTrax\web-admin\app\admin\feed-bins\feed-bins-view.tsx)
- [C:\dev\FlockTrax\web-admin\lib\feed-bin-data.ts](C:\dev\FlockTrax\web-admin\lib\feed-bin-data.ts)
- [C:\dev\FlockTrax\web-admin\app\globals.css](C:\dev\FlockTrax\web-admin\app\globals.css)

Added:

- `BinSentry Ref` input per feed bin
- last sync / last inventory / sync note display on the feed-bin editor card
- barn-level `Sync BinSentry` button

### BinSentry integration helper

File:
- [C:\dev\FlockTrax\web-admin\lib\binsentry.ts](C:\dev\FlockTrax\web-admin\lib\binsentry.ts)

Current behavior:

- pulls mapped feed bins for a selected barn
- reads `binsentry_bin_ref`
- supports either:
  - full URL in the ref
  - or a ref that can be expanded through a template
- uses bearer token auth
- fetches current bin payload
- attempts to extract pounds-on-hand from a tolerant set of candidate property names
- writes successful readings into `feed_inventory_snapshots`
- updates sync status fields on `feedbins`

Important limitation:

- no live BinSentry payload has been tested yet
- therefore the payload parser is best-effort, not yet tenant-verified

## Environment Variables Added

File:
- [C:\dev\FlockTrax\web-admin\.env.example](C:\dev\FlockTrax\web-admin\.env.example)

Added placeholders:

- `BINSENTRY_API_ROOT_URL`
- `BINSENTRY_API_BEARER_TOKEN`
- `BINSENTRY_BIN_ENTITY_URL_TEMPLATE`

## Build / Verification Status

Local verification completed successfully:

- `npm run typecheck` passed
- `npm run build` passed

Known non-blocking warning remains:

- autoprefixer warnings in `app/globals.css` about `end` vs `flex-end`

## BinSentry API Discussion / Known Facts

The user reported:

- JWT tokens appear valid for 30 days
- current provided token expires at:
  - `2026-06-07T18:15:11.000Z`

That equals:
- `June 7, 2026 1:15:11 PM CDT`

Current integration assumption for V1:

- use bearer token auth first
- later improve to service-account login or refresh flow if needed

The user also asked where the `BinSentry Ref` should come from.

Answer given:

- safest source is the BinSentry API entity reference, not just the human-readable UI label
- best forms:
  - full API entity URL for a bin
  - or a stable API bin/entity id

## Current Open Need To Finish BinSentry Proof

To complete a first live test, the next session needs:

1. a valid `BINSENTRY_API_BEARER_TOKEN` in local web-admin env
2. one real `BinSentry Ref` saved on one feed bin
3. ideally one real sample BinSentry bin/entity payload if sync extraction fails

Once that is available:

- open `Feed Bins`
- save the ref on a real mapped bin
- click `Sync BinSentry`
- verify `feed_inventory_snapshots` gets rows
- verify the 10-day popup reflects `On Hand Inventory`

## Current Git / Working Tree State

At checkpoint time, the repo is **not clean**. Current uncommitted changes:

- modified: `web-admin/.env.example`
- modified: `web-admin/app/admin/feed-bins/actions.ts`
- modified: `web-admin/app/admin/feed-bins/feed-bins-view.tsx`
- modified: `web-admin/app/globals.css`
- modified: `web-admin/components/active-placement-dashboard.tsx`
- modified: `web-admin/lib/admin-data.ts`
- modified: `web-admin/lib/feed-bin-data.ts`
- modified: `web-admin/lib/types.ts`
- untracked: `supabase/migrations/20260606113000_create_feed_ordering_foundation.sql`
- untracked: `supabase/migrations/20260606124500_add_binsentry_mapping_to_feedbins.sql`
- untracked: `web-admin/lib/binsentry.ts`

These changes are local-only and not yet committed or deployed.

## Recommended Restart Order

If resuming this feed-ordering / BinSentry branch in a new chat, load first:

1. [C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md)
2. [C:\dev\FlockTrax\output\FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md)
3. [C:\dev\FlockTrax\output\FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md)

## Best Restart Prompt

```text
Load C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md first.
```
