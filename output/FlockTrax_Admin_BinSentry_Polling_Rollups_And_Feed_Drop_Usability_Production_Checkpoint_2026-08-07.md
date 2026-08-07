# FlockTrax Admin BinSentry Polling Rollups and Feed Drop Usability Production Checkpoint

Date: `2026-08-07`
Branch: `main`
Production source commit: `e504e6ea5522cde240fd0aa590c5fb86e86e8ad2`
Checkpoint type: detailed implementation, production deployment, verification, and stopping-point checkpoint

## Purpose

This checkpoint records the production baseline after the BinSentry API feed-received
polling report gained barn filtering and an optional rollup summary, the feed-ticket
drop editor's bin selector was made easier to read, and mortality entry semantics
were corrected so an omitted count is no longer indistinguishable from an intentional
zero.

The work since the August 6 feed-reconciliation checkpoint is represented by:

- `84c78c6` - `Preserve unentered mortality counts as null`
- `a5f69de` - `Add barn filter to BinSentry polling report`
- `e504e6e` - `Add polling rollups and improve feed bin selection`

## Production Baseline

Current production source commit:

- full commit: `e504e6ea5522cde240fd0aa590c5fb86e86e8ad2`
- short commit: `e504e6e`
- subject: `Add polling rollups and improve feed bin selection`

The commit is pushed to `origin/main`.

Current Vercel production deployment:

- deployment id: `dpl_F4vLg9p7B5JwDw5bbaPiKFwr2wUX`
- deployment URL: `https://web-admin-ix3fybblq-flock-trax.vercel.app`
- production alias: `https://flocktrax.com`
- secondary alias: `https://admin.flocktrax.com`
- target: `production`
- status: `Ready`
- created: `2026-08-07 12:18:31 CDT`

The immediately preceding barn-filter deployment was:

- source commit: `a5f69de8c5f2c407e826dd4307c5dda36f96d1fd`
- deployment id: `dpl_2CBCjJSsCKNgcwtpdHewJY2Gycyi`

The new deployment supersedes that deployment and includes the barn filter plus the
new optional summary and feed-ticket selector changes.

## Release Control

This was a targeted production patch. The hosted `platform.control` Admin release
markers were intentionally not incremented.

The authoritative Admin release-control baseline remains:

- version: `2.1.0`
- numeric build: `12`
- visible build label: `5.9`
- released: `2026-08-06`

No schema migration, PostgreSQL function, or Supabase Edge Function change was
required for the barn filter, polling summary, or selector presentation work.

## Mortality Null Semantics

Commit `84c78c6` corrected mortality and cull entry behavior across the mobile and
Admin data paths.

The settled rule is:

- an unentered mortality or cull count remains `null`
- an intentional entry of `0` remains numeric zero
- reports can therefore distinguish a verified zero from a day or sex that was not
  collected or entered
- blank values display as blank instead of implying that mortality was checked and
  found to be zero

The change covered:

- mobile mortality entry initialization and payload handling
- placement-day retrieval and submission functions
- Admin mortality and flock-history report formatting
- At-a-Glance mortality formatting
- archived flock and archive-summary report formatting
- forward database normalization through
  `20260807092126_preserve_unentered_mortality_counts_as_null.sql`

Hosted function status was read back on August 7. The relevant placement-day
functions are active, including:

- `placement-day-get` version `21`
- `placement-day-submit` version `21`
- `placement-day-get-adalo` version `8`
- `adalo-placement-day-cache-fill` version `1`

The Admin production deployment contains the updated report behavior. The mobile
source is committed, but this checkpoint does not represent a new iOS or Android
binary submission after mobile `1.0.5`.

## BinSentry Polling Barn Filter

The `BinSentryAPI-Drops` report now supports a dependent Barn filter in addition to
Farm Group and Farm.

Behavior:

- barn choices are loaded from the authoritative `barns` table
- barn choices narrow automatically based on the selected farm group and farm
- `barnId` is preserved through date changes, sort changes, density-option changes,
  preview, print, and return navigation
- the feed-bin query is constrained by `feedbins.barn_id` before BinSentry requests
  are issued
- selecting one barn therefore reduces external API polling to only mapped bins for
  that barn instead of polling all bins and discarding rows afterward
- the report summary identifies the selected Farm / Barn scope

Commit:

- `a5f69de8c5f2c407e826dd4307c5dda36f96d1fd`

## Optional Polling Rollup Summary

The report filters now include:

- `Include rollup summary page`

The option is clear by default. When it is not selected, the report renders and
prints exactly the existing detail and delivery/date subtotals without adding pages.

When selected, `includeRollupSummary=1` is carried through filter state, preview,
print, and return navigation. A distinct summary sheet is appended after the detail
report and begins on a new printed page.

The summary includes:

- overall refill count
- overall refill volume in cubic feet
- overall estimated refill weight in pounds
- totals by feed type
- totals by barn, with farm context
- totals by bin, with farm and barn context so repeated bin numbers are unambiguous

Every rollup row reports:

- refill count
- total refill volume
- total estimated weight

The summary does not make another BinSentry request and does not perform an
independent estimate. It aggregates the exact rows already used by the detailed
report. Therefore:

- BinSentry stored-density mode produces rollups from BinSentry-density detail rows
- optional default-type-density mode produces rollups from the same default-density
  detail rows
- feed-type, barn, bin, and overall totals reconcile to the displayed detail

Print behavior:

- portrait report orientation is unchanged
- the optional summary uses `break-before: page`
- type and barn blocks are kept together where possible
- bin rows may continue naturally if the selected scope contains too many bins for
  one physical page
- no summary page exists when the option is clear

## Feed-Ticket Drop Bin Selector

The feed-ticket editor's drop grid previously allocated only a `5rem` minimum to the
Bin combobox. The selected barn/bin label was frequently truncated, and native
disabled styling made queued selections difficult to read.

The production behavior now is:

- Bin column minimum width increased to `8.75rem`
- selected bin text increased to `0.9rem`
- selected bin text uses bold weight and dark navy color
- enough right padding is reserved for the native select arrow
- disabled queued or off-farm selectors retain full-opacity dark text instead of
  browser-default faded text
- the complete selected or queued-source bin label is available as hover text for
  labels that remain unusually long
- the neighboring Note column was compacted slightly to reclaim the needed width
  without widening the overall editor panel

The mobile breakpoint remains a one-column drop layout, so this desktop grid change
does not create a narrow-screen horizontal overflow requirement.

## Verification

Local validation:

- `npm run typecheck` passed
- `npm run build` passed
- Next.js compiled successfully
- lint and type validation passed inside the production build
- all `47` routes completed static/dynamic page generation
- `/admin/reports/feed-drops` remained present in the route manifest
- `/admin/feed-tickets` remained present in the route manifest
- `git diff --check` passed before the release commit

Vercel validation:

- Vercel independently ran `npm run build` successfully
- all `47` routes completed generation in the hosted build
- deployment status read back as `Ready`
- `https://flocktrax.com/` returned HTTP `200`
- `/admin/reports/feed-drops` matched the expected route and redirected to `/login`
  when queried without an authenticated session
- `/admin/feed-tickets` matched the expected route and redirected to `/login` when
  queried without an authenticated session
- both `flocktrax.com` and `admin.flocktrax.com` are attached to the deployment

Repository validation:

- production commit `e504e6e` is present on `origin/main`
- the checkpoint and index are added after the production source commit so they can
  cite the confirmed deployment id and verification results

## Operational Boundaries

- Polling-report estimated pounds remain a BinSentry-derived operational estimate,
  not the feed mill's certified invoice or scale-ticket weight.
- Rollup accuracy is exactly the accuracy of the detailed refill rows and selected
  density mode; the rollups intentionally do not override or normalize those rows.
- Unknown feed type remains its own type bucket rather than being silently combined
  with Starter or Grower.
- An unassigned feed bin is grouped under `Unassigned barn` rather than being omitted
  from the rollup.
- Barn totals depend on the FlockTrax `feedbins.barn_id` mapping.
- This patch did not modify feed tickets, feed drops, BinSentry data, or other hosted
  operational records.
- No new mobile store binary was built or submitted in this checkpoint.

## Current Stopping Point

The production Admin application now contains:

- the August 6 feed-reconciliation baseline
- intentional-null mortality and cull semantics
- BinSentry polling by Farm Group, Farm, Barn, and date range
- optional polling rollups by feed type, barn, bin, and overall report scope
- improved feed-ticket drop bin visibility

There are no known compile or deployment blockers at this stopping point.

## Resume Guidance

At the next development session:

1. Start from `main` after pulling `origin/main`.
2. Treat deployment `dpl_F4vLg9p7B5JwDw5bbaPiKFwr2wUX` and source commit
   `e504e6e` as the authoritative Admin production baseline.
3. Field-test the polling report with the summary option both clear and selected.
4. Confirm feed-type, barn, bin, and overall pounds reconcile to the detailed refill
   rows for a known delivery range.
5. Print or save the report as PDF and confirm the optional summary begins on a new
   page while the non-summary report adds no extra page.
6. Open feed tickets containing normal and queued drops and confirm the selected bin
   labels are fully visible and remain dark when disabled.
7. Continue treating blank mortality/cull values as not entered and numeric zero as
   an intentional observed count.

