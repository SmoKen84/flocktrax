# FlockTrax BinSentry Live Inventory Sync And Feed Bin Editor Checkpoint

Date: 2026-06-06
Workspace: `C:\dev\FlockTrax`
Branch: `main`
Status: local working changes only, not yet committed or deployed

## Purpose

This checkpoint captures the second June 6 BinSentry execution pass after the initial feed-ordering foundation checkpoint.

It records:

- live BinSentry credential-based authentication
- live bin-ref discovery from the BinSentry API
- full feed-bin ref mapping for all 22 bins
- corrected live inventory sync into FlockTrax
- the verified dashboard popup result
- the current `Feed Bins` screen interaction/layout state

This is now the best restart point for BinSentry inventory and feed-bin editor work.

## What Was Proven Live

The BinSentry integration is no longer just a local first pass.

As of June 6, 2026, the following were proven against the live BinSentry tenant:

- server-side login using local `.env` credentials works
- live bin discovery works
- pagination was required because the tenant has 22 bins, not 20
- real BinSentry entity URLs were mapped onto FlockTrax `feedbins`
- live inventory sync wrote snapshot rows and updated `feedbins`
- the active-placement dashboard popup appears to reflect correct inventory data

The user manually checked the dashboard popup and confirmed it appears to show the right numbers.

## BinSentry Auth / Discovery Implementation

New local files added:

- [C:\dev\FlockTrax\web-admin\lib\binsentry-auth.ts](C:\dev\FlockTrax\web-admin\lib\binsentry-auth.ts)
- [C:\dev\FlockTrax\web-admin\lib\binsentry-http.ts](C:\dev\FlockTrax\web-admin\lib\binsentry-http.ts)
- [C:\dev\FlockTrax\web-admin\lib\binsentry-browser.ts](C:\dev\FlockTrax\web-admin\lib\binsentry-browser.ts)
- [C:\dev\FlockTrax\web-admin\lib\binsentry.ts](C:\dev\FlockTrax\web-admin\lib\binsentry.ts)

Credential handling now supports:

- `BINSENTRY_USERNAME`
- `BINSENTRY_PASSWORD`
- fallback `BINSENTRY_API_BEARER_TOKEN`
- `BINSENTRY_API_ROOT_URL`
- `BINSENTRY_BIN_ENTITY_URL_TEMPLATE`

Current auth behavior:

- if username/password are set, web-admin logs in to BinSentry server-side using the API root `login` relation and the `user-login` action
- if those credentials are absent, the code falls back to the manual bearer token

Important live fixes made:

1. relation matching was tightened so `bins` no longer incorrectly matches `search-bins`
2. bin entity URLs are read from embedded item self links, not assumed from top-level `href`
3. bin discovery now follows pagination instead of stopping at the first 20 results

## Bin Ref Discovery Utility

Utility page added:

- [C:\dev\FlockTrax\web-admin\app\admin\feed-bins\binsentry-refs\page.tsx](C:\dev\FlockTrax\web-admin\app\admin\feed-bins\binsentry-refs\page.tsx)

Popup reader component added:

- [C:\dev\FlockTrax\web-admin\app\admin\feed-bins\binsentry-refs\binsentry-ref-reader.tsx](C:\dev\FlockTrax\web-admin\app\admin\feed-bins\binsentry-refs\binsentry-ref-reader.tsx)

Navigation links added:

- [C:\dev\FlockTrax\web-admin\components\admin-shell.tsx](C:\dev\FlockTrax\web-admin\components\admin-shell.tsx)
- [C:\dev\FlockTrax\web-admin\app\page.tsx](C:\dev\FlockTrax\web-admin\app\page.tsx)

Current location:

- `BinSentry Refs` under `Utilities`
- present in both the admin sidebar and the splash sidebar

The ref finder now lists all 22 bins and is usable as a copy source for feed-bin mapping.

## Feed Bin Ref Mapping State

The BinSentry refs were mapped onto FlockTrax feed bins using live entity URLs.

The two bins that were initially missed were not actually missing from BinSentry. They were on page 2 of the bins collection because the first request used `limit=20`.

Confirmed paginated refs:

- `71` -> `https://api.binsentry.com/bins/8c53394b-e253-468c-bd74-c09520cf7c54`
- `81` -> `https://api.binsentry.com/bins/02667ca1-15fa-4964-aa6f-9f85ea520656`

Net result:

- all 22 mapped feed bins now have BinSentry refs

## Inventory Sync Correction

The first live inventory readings were wrong because BinSentry `weight` / `estimatedWeight` values for this tenant are effectively kilograms, not pounds.

User-reported correct BinSentry dashboard values for barn `W1`:

- `11 = 7890`
- `12 = 19312`
- `13 = 11933`

The initially stored values matched after `* 2.20462`, which confirmed the unit conversion issue.

`[C:\dev\FlockTrax\web-admin\lib\binsentry.ts](C:\dev\FlockTrax\web-admin\lib\binsentry.ts)` was then corrected so that:

- explicit `*_lbs` values are treated as pounds
- plain `weight` / `estimatedWeight` are converted from kilograms to pounds
- sync follows the live BinSentry level relation before extracting inventory

Important live-path behavior:

- the real pounds-on-hand value was not taken from the top-level bin entity
- sync now follows the `latest-valid` level relation for the actual reading

## Live Sync Results

One-barn proof was run first against `W1`, then the corrected sync was run across the rest of the mapped bins.

Latest successful run:

- `22` mapped bins synced
- `10` barns updated
- `feed_inventory_snapshots` rows inserted
- `feedbins.binsentry_last_inventory_lbs`, `binsentry_last_sync_at`, and `binsentry_sync_note` updated

Examples from the corrected stored data:

- `W1`
  - `11 = 7890.48 lbs`
  - `12 = 19311.88 lbs`
  - `13 = 11932.66 lbs`
- `W7`
  - `71 = 25559.85 lbs`
  - `72 = 949.64 lbs`
- `W4`
  - `41 = 16617.47 lbs`
  - `42 = 9163.07 lbs`

Some bins returned `0`. Those were treated as valid live readings rather than sync failures because BinSentry returned a usable level reading.

## Dashboard Status

The user checked the active-placement dashboard popup after sync and reported that it appears to reflect correct inventory data.

That means the current end-to-end path is now effectively proven:

- BinSentry -> feed bin mapping
- sync into `feed_inventory_snapshots`
- latest inventory surfaced through admin data
- popup rendering on the dashboard

## Feed Bins Screen State

Primary files:

- [C:\dev\FlockTrax\web-admin\app\admin\feed-bins\feed-bins-view.tsx](C:\dev\FlockTrax\web-admin\app\admin\feed-bins\feed-bins-view.tsx)
- [C:\dev\FlockTrax\web-admin\app\globals.css](C:\dev\FlockTrax\web-admin\app\globals.css)

The `Feed Bins` screen was reworked during this session.

Current interaction model:

- `Farms`, `Barns`, and a compact `Feed Bins` list remain together in the top selection area
- the `Feed Bins` list stays to the right of `Barns`
- clicking a bin selects it
- a single selected-bin editor appears in the bottom card

Important UX fix:

- farm, barn, and bin selector links now use `scroll={false}`
- selecting a different bin no longer jumps the screen back to the top

Current editor direction:

- left side is intended for FlockTrax-owned fields such as `Bin #` and `Capacity (lbs)`
- right side is intended for the BinSentry mapping area with wrapped multi-line ref display/input

Important caution:

- the feed-bin editor layout was still being tuned at the end of the session
- the last fix applied was to force each direct child of the bottom editor form to span the full form width, because the old parent grid was collapsing the new layout onto the right side
- that last adjustment was made, but no new user screenshot/confirmation was captured after the very final CSS fix

So the interaction model is in a good place, but the selected-bin editor may still need one more visual alignment pass next session.

## Dev Server / Local Runtime Notes

During the UI work, multiple Next dev servers briefly existed and caused stale behavior confusion.

Current local assumption:

- use `http://localhost:3000`

That was the active web-admin server at the end of this session.

## Verification Status

Repeatedly verified during this session:

- `npm run typecheck` passed after the code changes
- `npm run build` had passed earlier during the BinSentry implementation phase

The most important manual verification result is the user-confirmed dashboard popup inventory check.

## Current Git / Working Tree State

At checkpoint time, the repo is still not clean.

Current `git status --short`:

- `M output/FlockTrax_Checkpoint_Index.md`
- `M web-admin/.env.example`
- `M web-admin/app/admin/feed-bins/actions.ts`
- `M web-admin/app/admin/feed-bins/feed-bins-view.tsx`
- `M web-admin/app/globals.css`
- `M web-admin/app/page.tsx`
- `M web-admin/components/active-placement-dashboard.tsx`
- `M web-admin/components/admin-shell.tsx`
- `M web-admin/lib/admin-data.ts`
- `M web-admin/lib/feed-bin-data.ts`
- `M web-admin/lib/types.ts`
- `?? output/FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md`
- `?? supabase/migrations/20260606113000_create_feed_ordering_foundation.sql`
- `?? supabase/migrations/20260606124500_add_binsentry_mapping_to_feedbins.sql`
- `?? web-admin/app/admin/feed-bins/binsentry-refs/`
- `?? web-admin/lib/binsentry-auth.ts`
- `?? web-admin/lib/binsentry-browser.ts`
- `?? web-admin/lib/binsentry-http.ts`
- `?? web-admin/lib/binsentry.ts`

Nothing from this checkpoint has been committed or deployed yet.

## Recommended Restart Order

If resuming this BinSentry/feed-ordering branch later, load first:

1. [C:\dev\FlockTrax\output\FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md)
2. [C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md](C:\dev\FlockTrax\output\FlockTrax_Feed_Order_Prediction_And_BinSentry_Foundation_Checkpoint_2026-06-06.md)
3. [C:\dev\FlockTrax\output\FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md)
4. [C:\dev\FlockTrax\output\FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md](C:\dev\FlockTrax\output\FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md)

## Best Restart Prompt

```text
Load C:\dev\FlockTrax\output\FlockTrax_BinSentry_Live_Inventory_Sync_And_Feed_Bin_Editor_Checkpoint_2026-06-06.md first.
```
