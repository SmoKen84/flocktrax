# FlockTrax Admin 2.5.0 Build 1.1 Feed Inventory Production Checkpoint

Date: `2026-08-25`
Branch: `main`
Production source commit: `a4b1511`
Checkpoint type: implementation, release, production deployment, verification, and stopping-point checkpoint

## Purpose

This checkpoint records the completed BinSentry Current Feed Inventory report,
the correction of its coming-order query, the removal of FlockTrax's internal
iframe-based Split View, the Admin build increment, and the production release
to `flocktrax.com`.

## Feed Inventory Report

The report is available from Reports -> Feed Reports as:

- `BinSentry Current Feed Inventory`
- route: `/admin/reports/feed-inventory`

Implemented behavior:

- reads the latest usable BinSentry inventory for every mapped feed bin in the
  selected farm group, farm, or barn scope;
- presents on-hand pounds by bin and feed type;
- provides barn, farm, and overall subtotals;
- adds compact visual separation after barns and larger separation after farms,
  with reduced print spacing;
- lists coming orders separately so they are never included in inventory on hand;
- includes finalized, unreceived BinSentry states `ready`, `scheduled`, and
  `not-delivered` across all delivery dates;
- excludes drafts and received/closed orders;
- uses BinSentry's supported maximum page size of `50` and follows pagination
  until exhausted;
- warns when BinSentry feed density is unavailable and an order cannot contribute
  to coming-pound totals.

The live BinSentry API returned three scheduled orders during implementation
verification. The original empty Coming Orders result was traced to the report
requesting `limit=100`; BinSentry rejects values above `50` with HTTP `422`.

## Split View Decision

FlockTrax's internal Split View was removed.

The removed implementation used an outer Admin shell plus two full same-origin
iframe application instances and a recurring iframe-location synchronization
timer. The user confirmed Chrome's native tab Split View had not shown the same
performance regression.

Retained behavior:

- the installable FlockTrax web app / PWA remains available;
- the manifest, install listener, and minimal network-first service worker remain;
- users who need side-by-side FlockTrax screens should open two ordinary Chrome
  tabs and use Chrome's native Split View.

## Release Control

The authoritative hosted Admin release marker is now:

- version: `2.5.0`
- build: `2`
- build label: `1.1`
- released: `2026-08-25`

Release-control migration:

- `supabase/migrations/20260825193000_bump_admin_release_2_5_0_build_1_1.sql`

Only that exact SQL file was executed against the linked hosted database. A bulk
`supabase db push` was intentionally not used because the repository's historical
migration ledger contains many entries that were applied through earlier targeted
release procedures rather than recorded in remote migration history.

Hosted readback confirmed `platform.control` Admin row `id=4` contains version
`2.5.0`, build `2`, build label `1.1`, and release date `2026-08-25`.

## Source Commits

1. `ae8ef26` - Add BinSentry current feed inventory report
2. `236b393` - Remove internal admin split view
3. `a4b1511` - Release admin build 1.1

All three commits were pushed to `origin/main` before the production deployment.

## Production Deployment

- platform/project: Vercel `flock-trax/web-admin`
- deployment id: `dpl_FuDwJw4U6DBVhRMb9jFHVQ1jfwsd`
- deployment URL: `https://web-admin-l3yppe7sx-flock-trax.vercel.app`
- inspector: `https://vercel.com/flock-trax/web-admin/FuDwJw4U6DBVhRMb9jFHVQ1jfwsd`
- production alias: `https://flocktrax.com`
- secondary alias: `https://admin.flocktrax.com`
- target/status: `production` / `READY`

## Verification

Local verification:

- optimized production build passed after a clean `.next` cache rebuild;
- TypeScript and lint validation passed as part of the Next.js build;
- all `49` routes generated successfully;
- `git diff --check` passed before each source commit.

Vercel verification:

- Vercel independently ran `npm run build` successfully;
- all `49` routes generated successfully;
- deployment status read back as `Ready`;
- both production aliases are attached to the deployment.

HTTP verification:

- `https://flocktrax.com/` returned HTTP `200` and contained build label `1.1`;
- `https://admin.flocktrax.com/` returned HTTP `200` and contained build label `1.1`;
- `https://flocktrax.com/manifest.webmanifest` returned HTTP `200`;
- unauthenticated `/admin/reports/feed-inventory` returned HTTP `307` to `/login`;
- public production HTML contained no `Split View` or `Split Workspace` text.

## Worktree Boundary

The unrelated tracked file below remains intentionally modified and uncommitted:

- `supabase/.temp/cli-latest`

The temporary pre-restart Feed Inventory checkpoint and its standalone index
entry were superseded by this production checkpoint and removed during index
reconciliation.

## Resume

1. Treat commit `a4b1511` and Vercel deployment
   `dpl_FuDwJw4U6DBVhRMb9jFHVQ1jfwsd` as the Admin production baseline.
2. Field-check the authenticated Feed Inventory report and confirm the current
   pending BinSentry orders appear under Coming Orders.
3. Use Chrome's native Split View for side-by-side FlockTrax work; do not restore
   the removed iframe implementation without a new performance-safe design.
4. Preserve `supabase/.temp/cli-latest` unless its separate CLI-maintenance
   workline is intentionally addressed.

Suggested resume prompt:

`Load FlockTrax_Admin_2_5_0_Build_1_1_Feed_Inventory_Production_Checkpoint_2026-08-25.md and FlockTrax_Checkpoint_Index.md first. Treat commit a4b1511 and Vercel deployment dpl_FuDwJw4U6DBVhRMb9jFHVQ1jfwsd as the current Admin production baseline. The BinSentry Current Feed Inventory report is live, coming orders use all finalized unreceived states without a date cutoff, internal Split View was removed, PWA support remains, and Admin build label 1.1 is live.`
