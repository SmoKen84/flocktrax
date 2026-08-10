# FlockTrax Admin Closeout, Selectors, and At-a-Glance Print Production Checkpoint

Date: `2026-08-10`
Branch: `main`
Production source commit: `31ec57872f466aacccef47853ce8cab37e757da4`
Checkpoint type: detailed implementation, production deployment, verification, and stopping-point checkpoint

## Purpose

This checkpoint records the Admin production work completed after the livehaul
dashboard/mobile `1.0.6` checkpoint from earlier on August 10. It covers:

- detection and prevention of stale closeout Live Weight totals;
- removal of archived placements from operational flock selectors;
- landscape printing and compact, stronger typography for the Quick Access
  At-a-Glance report.

The earlier authoritative livehaul dashboard rule and mobile build state remain
documented in:

- `output/FlockTrax_Livehaul_Dashboard_Admin_Production_And_Mobile_1_0_6_Build_Checkpoint_2026-08-10.md`

## Closeout Live Weight Discrepancy

The reported case was placement `294-W2`.

- Livehaul load net weights: `29,860 lb` and `11,940 lb`
- Correct current load total: `41,800 lb`
- Stale stored `placement_closeouts.live_weight_final`: `36,500 lb`
- The stored closeout value predated later load edits and was not automatically
  refreshed when those load net weights changed.
- Clearing the Live Weight field and saving correctly recalculated it to the
  current load total.

Production protection added in commit `491f940` (`Warn on closeout live weight discrepancies`):

- current livehaul load net weights are now the preferred derived Live Weight;
- a persisted closeout value is used only when no current load total exists;
- a visible red warning identifies a stored/current mismatch and shows both
  values plus the signed difference;
- `Invoice Created` and `Submitted` saves are blocked while a discrepancy exists
  unless a Manual Override Reason documents the intentional exception;
- intentional, documented manual overrides remain supported.

Deployment:

- Vercel deployment: `dpl_CMTsKSDDwjuekFif6x8BrqE6QPFB`
- production alias: `https://flocktrax.com`

## Archived Placements Removed From Operational Selectors

Settled rule:

- once closeout is completed and the placement is archived, that placement must
  not be offered in operational flock/placement combo boxes;
- the Flock Archive functionality remains the intentional place to select and
  inspect archived flocks;
- existing historical records remain queryable and auditable.

The archive action already synchronizes `placement_closeouts` archive state to
`placements.lifecycle_stage = 'archived'`. Hosted verification found:

- total placements: `56`
- selectable non-archived placements: `49`
- archived placements excluded: `7`
- archived records leaking into the selectable set: `0`
- archived closeouts lacking archived placement lifecycle state: `0`

Existing active-placement sources for Admin dashboards, mobile dashboards,
issues, standard reports, and the livehaul scheduler already excluded archived
placements. Commit `3ec8670` (`Hide archived flocks from operational selectors`)
closed the remaining gaps in:

- Feed Ticket Editor placement choices;
- Feed Ticket Console flock filtering;
- Detailed Mortality Report flock filtering.

The Archive module was deliberately not changed.

Deployment:

- Vercel deployment: `dpl_BuTUoRJr5PkqDjatd8gEk6MX4pMZ`
- production alias: `https://flocktrax.com`

## Quick Access At-a-Glance Print Layout

The report route is:

- `/admin/reports/today-at-a-glance`
- Reports Hub category/report: `quick_access_reports.at_a_glance`

Commit `640074d` (`Print At-a-Glance report in landscape`) gave this report its
own named US Letter landscape print page. Other reports retain their existing
page orientation.

Deployment:

- Vercel deployment: `dpl_7kV6ZWxY1zZnT8wxdSZbXnJRN64r`

The first landscape version still inherited the shared Feed Projection table
minimum width of `1360px`, forcing print scaling to roughly `60%`. Commit
`31ec578` (`Compact At-a-Glance print columns`) corrected that cause:

- At-a-Glance screen table minimum width reduced to `980px`;
- print table minimum width removed and width set to `100%` of the `10.3in`
  printable landscape area;
- fixed table layout with explicit proportions totaling `100%` across all ten
  columns;
- print horizontal cell padding reduced to `2px`;
- print table overflow and rounded clipping removed;
- body print type increased/held at `8.5pt`, emphasized values at `9pt`, and
  headers at `8pt`;
- header, body, value, and secondary text weights increased;
- cell-stack gaps reduced to remove dead vertical space.

Final deployment:

- Vercel deployment: `dpl_47RB9zZw2PBUtMhuBy3rHruAxSTr`
- deployment URL: `https://web-admin-8pbz8s0zd-flock-trax.vercel.app`
- production alias: `https://flocktrax.com`
- target/status: `production` / `READY`

## Validation

- Admin TypeScript typecheck passed after each change.
- Admin optimized production build passed with all `47` routes.
- Each Vercel production build completed successfully.
- `https://flocktrax.com/` returned HTTP `200` after the final deployment.
- Protected Admin routes continued to redirect unauthenticated requests to
  `/login`.
- Hosted placement lifecycle/archive consistency checks passed.
- `git diff --check` passed before each source commit.
- Source commits were pushed to `origin/main`.

## Source Commits In This Workline

1. `f5c7b38` - Use livehaul schedules on dashboards
2. `33684fc` - Record livehaul dashboard production release
3. `491f940` - Warn on closeout live weight discrepancies
4. `3ec8670` - Hide archived flocks from operational selectors
5. `640074d` - Print At-a-Glance report in landscape
6. `31ec578` - Compact At-a-Glance print columns

## Operational Boundaries

- No database migration was required for the closeout warning, selector cleanup,
  or print-layout changes.
- No additional mobile source change was required for archived placement
  selection because mobile receives the already-filtered active dashboard list.
- This checkpoint does not advance mobile `platform.control` release markers or
  assert completion of the Android/iOS store-release steps from the earlier
  mobile `1.0.6` checkpoint.

## Resume

1. Load this checkpoint first for the latest Admin production baseline.
2. Load the earlier August 10 livehaul/mobile checkpoint before resuming mobile
   `1.0.6` store delivery.
3. Field-check the At-a-Glance browser print preview at normal landscape scale;
   its table should no longer require the former `60%` scaling.
4. For any future operational flock selector, source choices from non-archived
   placement lifecycle data and preserve `/admin/flocks` as the archive exception.
5. Keep the closeout invoice discrepancy guard intact whenever livehaul load or
   closeout calculations are changed.

Suggested resume prompt:

`Load FlockTrax_Admin_Closeout_Selectors_And_At_A_Glance_Print_Production_Checkpoint_2026-08-10.md and FlockTrax_Checkpoint_Index.md first. Treat commit 31ec578 and Vercel deployment dpl_47RB9zZw2PBUtMhuBy3rHruAxSTr as the latest Admin production baseline. Load the earlier August 10 livehaul/mobile checkpoint too if continuing mobile 1.0.6 store delivery.`
