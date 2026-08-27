# FlockTrax Admin Feed Projection Starter Order Correction Field-Test Checkpoint

Date: `2026-08-27`
Branch: `main`
Source commit: `229a390`
Production baseline commit: `a4b1511`
Checkpoint type: local implementation, validation, field-test stopping point, and operational-data note

## Purpose

This checkpoint preserves the correction to Starter ordering calculations shared
by the 10-Day and Custom Feed Projection reports. The correction is committed and
locally validated, but it has not been deployed because additional field-condition
testing is still in progress.

## Report Problem

The report displayed reasonable lifecycle Starter Requirement and current Starter
On-Hand values, but Starter Order Needed often ignored on-hand inventory. It could
therefore recommend ordering the full remaining lifecycle requirement even when a
barn already held Starter.

The report could also omit valid pending BinSentry orders because the lookup:

- requested only the `scheduled` state;
- did not follow pagination;
- compared BinSentry bin references as literal strings instead of canonical URLs;
- could miss relationship data available only on the detailed order entity.

## Implemented Calculation

Starter Order Needed is now:

`Starter Target - Recognized Starter Supply - All Open Starter Orders`

The result is clamped at zero.

Recognized Starter Supply is the greater of:

- Starter pounds already recorded as feed-ticket deliveries for the placement; or
- accessible Starter inventory currently reported for the barn.

Using the greater value allows live inventory to cover missing or lagging ticket
allocation without adding current inventory to historical deliveries and counting
the same feed twice.

Only Starter supply offsets the Starter requirement.

## BinSentry Pending-Order Correction

The shared report data loader now:

- includes `ready`, `scheduled`, and `not-delivered` orders;
- uses BinSentry's supported page limit of `50` and follows pagination;
- canonicalizes bin and feed URLs before matching or caching;
- combines summary and detailed order properties;
- deduplicates orders across pages/results;
- counts all open Starter orders against lifecycle Starter need, even when the
  delivery date falls beyond the report's short projection window;
- continues applying the selected report window to generic and Grower on-order
  totals.

## User-Facing Math Detail

The clickable Starter math detail now displays:

- lifecycle Starter target;
- recorded Starter deliveries;
- current accessible Starter on hand;
- pending Starter on order;
- the recognized-supply formula and explanation;
- Starter obligation before on-hand and orders.

## Reference Case: 332-W6

The reported reference values were:

- Starter Requirement: `24,000 lb`
- Starter On-Hand: `11,347 lb`
- BinSentry pending Starter order: `12,000 lb`
- expected additional Starter order: `653 lb`

The live BinSentry verification found the `12,000 lb` Starter order for bin `61`,
state `scheduled`, delivery date `2026-09-01`. No recorded Starter feed drop was
present for `332-W6`, so current accessible inventory is the recognized supply in
this case.

## Files Changed

- `web-admin/lib/feed-projection-report-data.ts`
- `web-admin/app/admin/reports/feed-projection/feed-projection-report-table.tsx`

Source commit:

- `229a390` - Correct starter feed projection ordering

## Validation

Completed successfully before the source commit:

- `npm run typecheck`
- `npm run build`
- optimized Next.js build, lint, and TypeScript checks
- all `49` routes generated
- `git diff --check`
- targeted live BinSentry verification of the `332-W6` pending order

## Deployment Boundary

This correction is **not deployed** to `flocktrax.com` yet.

The current production baseline remains:

- source commit: `a4b1511`
- Admin version/build label: `2.5.0` / `1.1`
- Vercel deployment: `dpl_FuDwJw4U6DBVhRMb9jFHVQ1jfwsd`

Do not treat commit `229a390` as production until a later checkpoint records a
successful deployment and production verification.

## Field-Test Checklist

Test the report under these conditions before deployment:

1. On-hand Starter with no recorded Starter deliveries.
2. Recorded Starter deliveries with remaining Starter on hand.
3. Pending Starter orders in `ready`, `scheduled`, and `not-delivered` states.
4. No Starter on hand and no Starter on order.
5. Starter obligation already fully satisfied.
6. Multiple bins and multiple pending orders for one barn.

## Transitional Flock 262-W1 Operational Note

During this workline, transitional flock `262-W1` could not pass the standard
closeout constraint because its imported manual-era feed history contained a
`24,000 lb` Starter delivery and a `-1,050 lb` Grower feed credit, producing an
invalid negative Grower ratio for the normal closeout calculation.

With explicit user authorization, a controlled legacy closeout was completed:

- placement `e6195b2a-e038-4591-99a2-5f728ea7c631` was archived/inactivated;
- flock `c46709de-e2f0-4f40-be2f-3235d3029966` was marked complete, inactive, and
  not in barn;
- the closeout was archived;
- explanatory closeout notes, a manual-override reason, and an attributed
  activity-log entry were added;
- the historical Feed Credit record was preserved.

This was a one-time hosted-data action, not a schema or source-code change.

## Worktree Boundary

The unrelated tracked file below remains intentionally modified and uncommitted:

- `supabase/.temp/cli-latest`

Preserve it unless its separate CLI-maintenance workline is intentionally handled.

## Resume

1. Load this checkpoint and `FlockTrax_Checkpoint_Index.md`.
2. Treat source commit `229a390` as the committed local field-test state.
3. Continue the Feed Projection condition tests listed above.
4. If the results are correct, deploy commit `229a390` through the normal Admin
   release process and record the deployment/build marker in a production checkpoint.
5. If a case fails, diagnose from the shared report loader rather than introducing
   separate 10-Day and Custom report formulas.
6. Preserve `supabase/.temp/cli-latest`.

Suggested resume prompt:

`Load FlockTrax_Admin_Feed_Projection_Starter_Order_Correction_Field_Test_Checkpoint_2026-08-27.md and FlockTrax_Checkpoint_Index.md. Resume from source commit 229a390. The shared 10-Day/Custom Feed Projection Starter formula now subtracts recognized supply and all open Starter orders, validation passed, field testing is still in progress, and the correction has not been deployed.`
