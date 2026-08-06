# FlockTrax Admin 2.1.0 Build 5.9 Feed Reconciliation Production Checkpoint

Date: `2026-08-06`
Branch: `main`
Production source commit: `9d4ffbed25e6b6ef762f05761150a176ea13756b`
Checkpoint type: detailed implementation, release, verification, and stopping-point checkpoint

## Purpose

This checkpoint records the production baseline after the BinSentry density model
was aligned with BinSentry-owned feed calculations and the feed reconciliation
reporting package was completed.

The release includes:

- BinSentry-owned density and inventory conversion behavior
- revised lifetime starter ordering logic
- corrected BinSentry refill-volume calculations
- the BinSentry API feed-received polling report
- the queued feed deliveries report
- queued-only feed-ticket drop filtering
- employee reactivation support
- the previously prepared mobile 1.0.5 release-support assets
- Admin release build `12`, displayed as build label `5.9`

## Production Baseline

Production source commit:

- `9d4ffbe` - `Ship feed reconciliation and queued delivery reports`

The commit is pushed to `origin/main`, and local `main` matched `origin/main`
before this checkpoint documentation was added.

Current Vercel production deployment:

- deployment id: `dpl_FcN5R68z2YRrfvWpq4NVVYL4sLyd`
- deployment URL: `https://web-admin-op5zf2cgp-flock-trax.vercel.app`
- production alias: `https://flocktrax.com`
- secondary alias: `https://admin.flocktrax.com`
- target: `production`
- status: `Ready`
- created: `2026-08-06 01:38:35 CDT`

Hosted Supabase project:

- project reference: `frneaccbbrijpolcesjm`
- project name: `GPC-DailyCollection`
- changed function: `binsentry-sync-all`
- deployed function version: `5`
- function status: `ACTIVE`
- function updated: `2026-08-06 06:38:23 UTC`

## Release Control

The hosted `platform.control` Admin row was updated and read back as:

- id: `4`
- group: `admin`
- version: `2.1.0`
- numeric build: `12`
- visible build label: `5.9`
- released: `2026-08-06`

Source migration:

- `supabase/migrations/20260806013012_bump_admin_release_2_1_0_build_5_9.sql`

The repository has a mixed historical migration ledger because many migrations
were applied directly to hosted Supabase during development. A blanket
`supabase db push` was intentionally not used. Only the exact release-control
row update in the new migration was applied to hosted Supabase, then verified
through the hosted REST API.

## BinSentry Density Model

FlockTrax no longer assumes or pushes the old `47.6 lb/ft3` application setting
when reading BinSentry inventory.

The authoritative rule is now:

- BinSentry owns the bin-volume-to-weight conversion.
- FlockTrax uses BinSentry's returned estimated weight when it is available.
- If weight is absent but BinSentry returns estimated volume and bulk density,
  FlockTrax derives weight from those two BinSentry values.
- FlockTrax does not substitute an application-wide density constant.

The Feed Bins admin screen no longer exposes the density audit or density
push-back controls. The related server actions and supporting data structures
were removed.

The same conversion fallback was deployed in both paths that can refresh live
inventory:

- `web-admin/lib/binsentry.ts`
- `supabase/functions/binsentry-sync-all/index.ts`

## Feed Projection Rules

The starter requirement now represents the flock's cradle-to-grower starter
obligation:

`Total Starter Required = starter_lbs_per_chick * head_placed`

Initial starter ordering behavior:

- The first projection proposes the full starter requirement when it has not
  already been supplied or ordered.
- Delivered starter and all still-open starter orders reduce the remaining
  starter obligation.
- Later projections can recommend only the remaining starter obligation.
- Starter on hand is not treated as an immediate order need when it is enough
  to cover the report window.
- Once the remaining starter obligation reaches zero, projected ordering moves
  to grower feed for subsequent demand.

The standard and custom projection reports share the revised report-data logic.
Legacy report-level density preflight and constant-density assumptions were
removed.

## BinSentry Feed Received Polling Report

Reports navigation:

- category: `Feed Reports`
- screen label: `BinSentryAPI-Drops`
- report route: `/admin/reports/feed-drops`
- printed title: `BinSentry API - Feed Received Polling Report`

Filters:

- Farm Group
- Farm
- inclusive Start Date
- inclusive End Date
- sort by Date, Bin Number, or Feed Type
- `Use default type density values` option

Displayed refill information:

- received date and time
- farm and barn
- bin number
- feed type
- refill volume
- density applied
- estimated refill weight
- blank audit checkbox

Density behavior:

- With the optional checkbox clear, the report uses the density stored with the
  BinSentry refill record.
- With the checkbox selected, starter uses `37 lb/ft3` and grower uses
  `38 lb/ft3`.
- An unknown feed type uses the average known default density, `37.5 lb/ft3`,
  only when the optional default-density mode is selected.
- The `Density Applied` column always displays the density actually used for
  that row's estimated weight.

Refill-volume correction:

- A BinSentry `REFILL` event's reported volume is the post-delivery bin total,
  not necessarily the quantity delivered.
- The report now finds the closest valid pre-refill reading and calculates:
  `refill volume = post-refill volume - pre-refill volume`.
- The report presents the post/pre relationship so the delivered increase is
  auditable.
- This corrected the July 14 WOAPE case where `265.26 ft3` had previously been
  treated as the full refill instead of subtracting the `101.86 ft3` opening
  volume. The corrected refill is `163.40 ft3`, or approximately `6,209.2 lb`
  at `38 lb/ft3`.

Grouping and printing:

- Refills at the same farm on the same date and within one hour are grouped as
  a likely common delivery and subtotaled.
- If time proximity cannot establish a delivery group, date-level grouping is
  retained.
- The first mostly blank print page was removed.
- The report prints in portrait orientation.

## Queued Feed Deliveries Report

Reports navigation:

- category: `Feed Reports`
- title: `Queued Feed Deliveries Not Received`
- route: `/admin/reports/queued-feed-deliveries`

Filters:

- Farm Group
- Farm
- Barn
- Feed Mill
- inclusive Start Date
- inclusive End Date

The inclusive date range is based on feed-ticket delivery date. The report lists
only feed drops whose `queued_for_reconciliation` flag is true.

Displayed detail includes:

- delivery date
- queued timestamp
- ticket number
- feed mill
- farm, barn, and bin
- source flock/placement
- feed type
- queued pounds

The report totals queued pounds by feed type and provides an overall queued-feed
total. It preserves the queued source barn, bin, and placement information used
for reconciliation. The printed report uses landscape orientation.

The working hosted-data validation snapshot during development returned:

- queued drops: `12`
- Starter queued: `2,671 lb`
- Grower queued: `95,527 lb`
- overall queued: `98,198 lb`

These values are a point-in-time operational snapshot and will change as queued
drops are reconciled.

## Feed Ticket Queued Filter

`Show only tickets with Queued drops` now behaves according to `List By` mode:

- `Tickets` mode shows tickets containing at least one queued drop and retains
  the ticket's complete drop context.
- `Drops` mode shows only the queued drop rows from those tickets.

This prevents nonqueued drops on a qualifying ticket from appearing as if they
were themselves waiting for reconciliation.

## Employee Reactivation

The User Access screen now allows a super administrator to reactivate a retired
employee account.

Reactivation behavior:

- removes the authentication ban/retired state
- preserves existing roles
- preserves farm and farm-group memberships
- returns a clear success message identifying the reactivated user

This was added for rehired employees without creating duplicate accounts or
discarding historical attribution.

## Mobile Release-Support Archive

The release commit also captures the previously outstanding mobile 1.0.5 store
support package:

- iPhone source screenshots
- App Store-sized `1242x2688` screenshots
- iPad source screenshots
- App Store 13-inch iPad screenshots
- mobile 1.0.5 release-changes PDF

These files are release-support artifacts only; no new mobile binary was built
or submitted as part of this Admin release.

## Verification

Local validation:

- `npm run typecheck` passed.
- `npm run build` passed cleanly.
- Next.js compiled successfully.
- all `47` static/dynamic routes completed page generation.
- both new report routes appeared in the generated route manifest.
- `git diff --check` passed before the release commit.

Vercel validation:

- Vercel independently ran `npm run build` successfully.
- all `47` routes completed generation in the hosted build.
- deployment status was read back as `Ready`.
- `https://flocktrax.com` returned HTTP `200`.
- `/admin/reports/feed-drops` reached the expected authenticated login gate.
- `/admin/reports/queued-feed-deliveries` reached the expected authenticated
  login gate.
- both production aliases were attached to the new deployment.

Supabase validation:

- the Admin control row was read back as build `12` / label `5.9`.
- `binsentry-sync-all` was deployed successfully.
- Supabase reported the function as `ACTIVE`, version `5`.

Repository validation:

- release commit `9d4ffbe` is present on `origin/main`.
- local `main` and `origin/main` matched after the release push.
- the localhost development server remained available on port `3000`.

## Operational Boundaries

- The refill report is an audit aid based on BinSentry sensor history; it does
  not replace the feed mill's certified scale ticket.
- BinSentry's configured density directly affects its reported inventory and
  therefore FlockTrax's BinSentry-derived operational view.
- Unknown refill feed type remains possible when no reliable BinSentry order or
  refill-type history is available.
- Default type-density mode is optional and intentionally explicit; normal
  report behavior uses BinSentry's stored refill density.
- Existing hosted schema objects required by these reports were already in
  place; this release added only the Admin release-control migration.

## Resume Guidance

At the next development session:

1. Start from `main` after pulling `origin/main`.
2. Use this checkpoint as the authoritative Admin build `5.9` production
   baseline.
3. Confirm the live About/version display reads Admin `2.1.0`, build `5.9`.
4. Field-test the BinSentry polling report across several delivery dates,
   especially partially filled bins and multi-bin deliveries.
5. Reconcile queued drops from the new queued-deliveries report and confirm the
   totals decline as drops are resolved.
6. Treat any future density change as BinSentry-owned unless the operating rule
   is explicitly changed.

