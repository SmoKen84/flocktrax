# FlockTrax BinSentry Density Diagnostics — Production Checkpoint

Date: `2026-09-14`

## Outcome

FlockTrax now exposes the bulk-density inputs returned by BinSentry anywhere those inputs can affect reported inventory or projected feed needs. This is a read-only diagnostic feature: FlockTrax does not change BinSentry bulk density.

The production refresh confirmed the user's concern. Of 22 mapped production bins, 18 returned density data and four did not. The returned values form two practical bands—approximately `45.2 lb/ft³` and `46.1 lb/ft³`—so the active inputs are not uniform.

## Production behavior

- The Feed Bin configuration screen displays the latest BinSentry bulk density and the weight basis used by the integration.
- BinSentry Current Feed Inventory displays bulk density and weight basis per bin and warns when one feed type has mixed densities.
- Standard and Custom Feed Projection reports include a `BinSentry Density Inputs` audit table with farm, barn, bin, current feed, density, weight basis, and last synchronization time.
- Projection reports mark each feed type as `MIXED`, `CONSISTENT`, or `UNKNOWN`.
- Coming BinSentry orders disclose the density/basis used for volume-to-weight conversion. Native FlockTrax orders are identified as FlockTrax pounds.
- Missing density is shown as unknown instead of being silently presented as a verified density.
- Synchronization retains BinSentry's exact weight-source field so displayed pounds can be traced to the provider response.

## Safety boundary

- No write-back to BinSentry was restored.
- The deprecated `update-bulk-density` provider action remains unused.
- FlockTrax only reads and caches diagnostic values returned by BinSentry.
- Existing feed-bin mappings and production density settings were not changed.

## Database and Edge deployment

- Production Supabase project: `frneaccbbrijpolcesjm`
- Migration: `20260914190000_cache_binsentry_density_diagnostics.sql`
- Added nullable `public.feedbins` fields:
  - `binsentry_last_bulk_density_kg_m3`
  - `binsentry_last_bulk_density_lb_ft3`
  - `binsentry_last_estimated_volume_m3`
  - `binsentry_last_weight_source`
- `binsentry-sync-all` deployed and active at production version `10`.
- A post-deployment production synchronization populated the new cache fields.

## Source and hosted deployment

- Source commit: `63a4eb9` (`Expose BinSentry density diagnostics`)
- Branch: `release/admin-2.6.0`
- Production `main` also received the source commit.
- Vercel deployment: `dpl_5CeLW52t88VfBP4fjXgJhEDYyXLM`
- Permanent aliases: `https://flocktrax.com` and `https://admin.flocktrax.com`

## Validation

- Fresh Admin TypeScript check passed.
- Optimized Admin build passed with 49 routes.
- Vercel deployment status is `READY`.
- Production home returned HTTP `200` with title `FlockTrax Admin`.
- Protected Feed Bins route returned HTTP `307` to `/login` while unauthenticated.
- No HTTP 500 logs were found during the deployment verification window.
- Live cache audit: 22 mapped bins; 18 with density; four without density; distinct returned values `45.19`, `45.20`, `46.10`, and `46.13 lb/ft³`; weight source `binsentry:estimatedWeight`.

## Operational use

Use `Configuration → Feed Bins` to inspect a particular bin and request a fresh BinSentry synchronization. Use `Feed Reports → BinSentry Current Feed Inventory` for a fleet-wide density comparison. Use either Feed Projection report's `BinSentry Density Inputs` section to verify the exact inputs behind a projection before relying on its order recommendation.

## Restore and continuation

The preceding production application deployment was `dpl_Es6PHuExie1oYtobsXAmWWVXfqMj` at source `bb96d31`. The database migration is additive and nullable, so the preceding application can run against the migrated schema if an application rollback is required.

The next operational task is to investigate the four mapped bins returning no density and reconcile the two active density bands in BinSentry. Any density correction remains a deliberate BinSentry-side action.
