# FlockTrax Admin Release 5.5 Feed Ordering Reports And Scheduler Production Checkpoint

Date: `2026-06-09`  
Captured: `2026-06-09 10:44:33 -05:00`  
Branch: `main`  
HEAD: `536ce942c24f0bee18e3fe23d56e0d19fe83c360`

## Purpose

Capture the production release that shipped:

- the feed-ordering database foundation
- BinSentry feed-bin mapping and live inventory browser/sync UI
- the first-pass starter/grower 10-day ordering projection
- the new reports hub and 10-day feed report
- the reusable Sheets historical backfill importer
- scheduler fixes for farm-view handoff, awaiting-arrival edits, and scheduled-flock juggle/cancel handling
- closeout/feed-report corrections and closeout header polish

This file is the best single resume point for the June 6 to June 9 feed-ordering and historical-backfill arc.

## Repo State

Committed and pushed to `origin/main`:

- commit: `536ce94`
- message: `Ship feed ordering, BinSentry, reports, and scheduler upgrades`

Repo state at release time before this checkpoint note:

- clean product commit pushed
- production deploy completed from the pushed repo state

## Production Deployment

Production web-admin deployment completed through Vercel:

- deployment id: `dpl_7LyMJxUEgT84SYTG18x5gvbotqtJ`
- inspector: [https://vercel.com/flock-trax/web-admin/7LyMJxUEgT84SYTG18x5gvbotqtJ](https://vercel.com/flock-trax/web-admin/7LyMJxUEgT84SYTG18x5gvbotqtJ)
- deployment URL: [https://web-admin-9umcdgo9w-flock-trax.vercel.app](https://web-admin-9umcdgo9w-flock-trax.vercel.app)
- production aliases:
  - [https://flocktrax.com](https://flocktrax.com)
  - [https://admin.flocktrax.com](https://admin.flocktrax.com)

Verification:

- local `npm run typecheck` passed
- local `npm run build` passed
- `vercel deploy --prod --yes` completed successfully
- deployment status was `READY`
- `https://flocktrax.com` returned HTTP `200`
- `https://admin.flocktrax.com` returned HTTP `200`

Build notes:

- Vercel build completed successfully on Next.js `15.2.8`
- two non-blocking autoprefixer warnings remain in [globals.css](C:/dev/FlockTrax/web-admin/app/globals.css) suggesting `flex-end` instead of `end`

## Hosted Admin Build Marker

Hosted `platform.control` row verified after update:

- `group`: `admin`
- `version`: `2.0.0`
- `build`: `8`
- `build_label`: `5.5`
- `released`: `2026-06-09`

Release marker migration created locally and executed against the linked hosted database:

- [20260609154500_bump_admin_release_build_5_5.sql](C:/dev/FlockTrax/supabase/migrations/20260609154500_bump_admin_release_build_5_5.sql)

## Hosted Supabase Changes Applied In This Release Pass

The following hosted SQL changes were executed directly against the linked project `frneaccbbrijpolcesjm`:

- [20260606113000_create_feed_ordering_foundation.sql](C:/dev/FlockTrax/supabase/migrations/20260606113000_create_feed_ordering_foundation.sql)
- [20260606124500_add_binsentry_mapping_to_feedbins.sql](C:/dev/FlockTrax/supabase/migrations/20260606124500_add_binsentry_mapping_to_feedbins.sql)
- [20260609154500_bump_admin_release_build_5_5.sql](C:/dev/FlockTrax/supabase/migrations/20260609154500_bump_admin_release_build_5_5.sql)

Verified live after execution:

- `public.feed_inventory_snapshots` exists
- `public.feed_order_commitments` exists
- `public.feedbins` has:
  - `binsentry_bin_ref`
  - `binsentry_last_sync_at`
  - `binsentry_last_inventory_lbs`
  - `binsentry_sync_note`

Important migration-history note:

- the linked remote migration history is still incomplete for many older migrations even though the live schema/features already exist
- because of that, this release followed the safer existing pattern:
  - execute the required SQL directly with `supabase db query --linked --file ...`
  - verify the live schema/row state directly afterward
- this avoided a risky blanket `supabase db push --linked`

## What Is Now Live

### Feed Ordering Foundation

The hosted database now has the first persistent foundation for feed-ordering work:

- inventory snapshots table for live or manual on-hand feed observations
- feed order commitments table for open / partial / received / cancelled orders
- placement/barn/bin-aware data structure for future net-ordering math

The current admin projection logic now supports a first-pass starter/grower split:

- starter target driven by `starter_lbs_per_chick`
- starter consumed first through day `14`
- scheduled flocks placing within the next 10 days are included from arrival day forward
- incoming flocks receive a `12,000 lb` starter minimum within the arrival window when their 10-day startup need would otherwise be too small

### BinSentry Integration

The admin now includes a full first-pass BinSentry foundation:

- server-side BinSentry login using username/password or bearer token fallback
- BinSentry feed-bin reference storage on `feedbins`
- paginated BinSentry ref-discovery page under `Utilities`
- live inventory sync foundation wired into the feed-ordering/inventory model
- corrected kg-to-lb conversion behavior for the tenant’s BinSentry readings

### Reports Hub

`Reports` now opens to a dedicated hub screen instead of overloading the sidebar with report links.

Current live report flow includes:

- `Feed Reports`
- `10-Day Feed Requirements`
- cascading farm/barn/flock filters
- preview-in-place navigation
- loading-state screens instead of a blank white transition

The 10-day feed report currently:

- limits to barns with current in-barn flocks plus flocks arriving within the next 10 days
- includes starter/grower-aware first-pass projection output

### Feed Bin Editor

The feed-bin management area now includes:

- BinSentry reference handling and saved-ref reader UI
- compact top-level farm/barn/bin selection flow
- focused single-bin editor model
- BinSentry ref-finder route and sidebar access

### Scheduler / Placement Flow

The placement scheduler shipped several major admin fixes:

- sidebar entry now opens in `Farm View` with `All Farms`
- clicking from `Farm View` into `Barn View` preserves usable farm/barn context
- `awaiting_arrival` placements can move their placed date without being treated like locked live flocks
- dependent dates shift with placed-date moves when those fields were not manually overridden
- conflict errors now name the blocking placement/flock and date range
- super admin can edit the authoritative `Placement State`
- scheduled-flock juggle/cancel-transfer workflow exists in code, and one real `310-W5 -> 311-W5` transfer was already performed directly in production data earlier in the session history

### Closeout / Feed Report Corrections

The closeout and printed feed-report path now better match operational expectations:

- printed flock feed reports now retain adjustment rows such as `f2f`, `iTran`, and `xTran`
- closeout feed-report launch no longer drops rows merely because they fall outside the placement-date window
- closeout livehaul daily headers now show:
  - `Loads`
  - `Head`
  - `Net Weight`
  - `Bird Wt / Breed Target`
  - `Bird Wt Var %`
- flock-level closeout header/worksheet now shows processed-head comparison against mortality-derived final head count rather than incorrectly placing that comparison on each individual livehaul day sheet

### Historical Sheets Backfill Tooling

A reusable historical importer now exists for reverse-sync from Google Sheets into FlockTrax:

- [backfill_from_sheets.py](C:/dev/FlockTrax/toolkit/sync_engine/backfill_from_sheets.py)
- default behavior is `fill_missing_or_blank`
- missing FlockTrax dates are created from sheet history
- existing populated FlockTrax values are preserved
- worksheet single-weight values default to `male`

Earlier in this same work arc, it was already used successfully to backfill:

- `274-W6`
- `286-W8`
- `280-W1`
- `278-W7`
- `272-W2`

with the required pending/rejected Google Sheets outbox cleanup afterward.

## Local Verification Performed

Local verification performed before deployment:

- `npm run typecheck` in [web-admin](C:/dev/FlockTrax/web-admin)
- `npm run build` in [web-admin](C:/dev/FlockTrax/web-admin)
- hosted `platform.control` query verification before and after bump
- hosted schema verification for feed-ordering and BinSentry columns/tables
- Vercel production deployment confirmation
- live HTTP `200` on:
  - [https://flocktrax.com](https://flocktrax.com)
  - [https://admin.flocktrax.com](https://admin.flocktrax.com)

## Key Files

- [supabase/migrations/20260606113000_create_feed_ordering_foundation.sql](C:/dev/FlockTrax/supabase/migrations/20260606113000_create_feed_ordering_foundation.sql)
- [supabase/migrations/20260606124500_add_binsentry_mapping_to_feedbins.sql](C:/dev/FlockTrax/supabase/migrations/20260606124500_add_binsentry_mapping_to_feedbins.sql)
- [supabase/migrations/20260609154500_bump_admin_release_build_5_5.sql](C:/dev/FlockTrax/supabase/migrations/20260609154500_bump_admin_release_build_5_5.sql)
- [web-admin/lib/admin-data.ts](C:/dev/FlockTrax/web-admin/lib/admin-data.ts)
- [web-admin/lib/feed-ticket-data.ts](C:/dev/FlockTrax/web-admin/lib/feed-ticket-data.ts)
- [web-admin/lib/feed-bin-data.ts](C:/dev/FlockTrax/web-admin/lib/feed-bin-data.ts)
- [web-admin/lib/binsentry.ts](C:/dev/FlockTrax/web-admin/lib/binsentry.ts)
- [web-admin/lib/binsentry-auth.ts](C:/dev/FlockTrax/web-admin/lib/binsentry-auth.ts)
- [web-admin/lib/binsentry-browser.ts](C:/dev/FlockTrax/web-admin/lib/binsentry-browser.ts)
- [web-admin/lib/binsentry-http.ts](C:/dev/FlockTrax/web-admin/lib/binsentry-http.ts)
- [web-admin/app/admin/feed-bins/feed-bins-view.tsx](C:/dev/FlockTrax/web-admin/app/admin/feed-bins/feed-bins-view.tsx)
- [web-admin/app/admin/feed-bins/binsentry-refs/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/feed-bins/binsentry-refs/page.tsx)
- [web-admin/app/admin/reports/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/reports/page.tsx)
- [web-admin/app/admin/reports/feed-projection/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/reports/feed-projection/page.tsx)
- [web-admin/app/admin/placements/new/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/new/page.tsx)
- [web-admin/app/admin/placements/new/actions.ts](C:/dev/FlockTrax/web-admin/app/admin/placements/new/actions.ts)
- [web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-worksheet-form.tsx)
- [web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx](C:/dev/FlockTrax/web-admin/app/admin/flock-closeout/closeout-livehaul-load-forms.tsx)
- [toolkit/sync_engine/backfill_from_sheets.py](C:/dev/FlockTrax/toolkit/sync_engine/backfill_from_sheets.py)
- [toolkit/sync_engine/README.md](C:/dev/FlockTrax/toolkit/sync_engine/README.md)

## Recommended Resume Point

If work resumes in a new chat, start with:

`Load C:\\dev\\FlockTrax\\output\\FlockTrax_Admin_Release_5_5_Feed_Ordering_Reports_And_Scheduler_Production_Checkpoint_2026-06-09.md first.`

Then likely next steps are:

1. Continue the feed-ordering engine beyond the first-pass starter/grower split into the fuller FIFO/bin-layer model from the June 7 spec.
2. Decide whether to formalize a reusable scheduler-side juggle UI now that the direct real-world replacement transfer path has been proven.
3. Continue closeout/retroactive livehaul tooling for flocks that were historically closed outside the newer queue flow.
4. Decide whether to clean up the remaining autoprefixer `end` warnings in [globals.css](C:/dev/FlockTrax/web-admin/app/globals.css).
