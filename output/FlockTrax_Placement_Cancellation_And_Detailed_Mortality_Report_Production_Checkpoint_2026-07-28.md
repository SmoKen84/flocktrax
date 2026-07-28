# FlockTrax Placement Cancellation And Detailed Mortality Report Production Checkpoint

Date: `2026-07-28`
Branch: `main`
Current local and remote HEAD: `73ed866a7b7cf0c2552b7a01ee8c15680484ec9e`
Checkpoint type: detailed implementation, verification, and production-deployment checkpoint

## Purpose

This checkpoint preserves the production baseline established after the July 17
admin archive/closeout release, including:

- scheduled-placement cancellation and feed reassignment
- canceled-flock archive visibility and read-only behavior
- archived-flock document/report refinements
- the new Detailed Reports -> Mortality report
- date-range population ledger calculations by sex
- compact portrait printing
- final print pagination and weekday-date polish

The newest production source baseline is commit `73ed866`.

## Production Baseline

The current `web-admin` production deployment is:

- deployment id: `dpl_DGzjyELY2uoj7aviYS7vxzxsCzM8`
- deployment URL: `https://web-admin-aexg52y5m-flock-trax.vercel.app`
- production aliases:
  - `https://flocktrax.com`
  - `https://admin.flocktrax.com`
- Vercel target: `production`
- Vercel status: `Ready`

The final deployment completed on `2026-07-24`.

Production verification performed after the final deployment:

- `https://flocktrax.com` returned HTTP `200`
- Vercel reported the deployment as `Ready`
- both production aliases were attached to the deployment
- the unauthenticated mortality route returned the expected login redirect

No mortality-report database migration or Supabase function deployment was
required. The report reads the existing hosted placement, flock, farm, barn, and
`log_mortality` data.

## Release Commits

### Placement Cancellation And Archive Baseline

Commit:

- `41f1fcb` - `Ship placement cancellation and archive reporting`

This commit established the source baseline immediately before mortality-report
development.

It includes:

- migration `20260720005413_add_scheduled_placement_cancellation.sql`
- migration `20260720020000_bump_admin_release_2_1_0_build_5_8.sql`
- placement lifecycle stage `canceled`
- cancellation timestamps and actor tracking
- safe feed transfer from a canceled scheduled flock
- canceled-flock archive visibility
- archive document and report refinements

The release-control migration sets:

- admin version: `2.1.0`
- numeric build: `11`
- visible build label: `5.8`
- release date: `2026-07-20`

These values are source-defined by the migration. They were not re-read from the
hosted `platform.control` table while creating this checkpoint.

### Initial Mortality Report

Commit:

- `3780f46` - `Add detailed mortality population report`

This commit added:

- Reports -> Detailed Reports -> Mortality
- Farm Group, Farm, Barn, Flock, Date From, and Date To filters
- historical placement options instead of active-placement-only options
- sex-specific opening, daily, and ending population calculations
- split-sex placement-date handling
- screen and print report layouts
- legacy missing-removal-date protection

Initial production deployment:

- deployment id: `dpl_Cc5hjamXTEUsGSo4AXUFRP4RF4t5`
- deployment URL: `https://web-admin-9rtdasjac-flock-trax.vercel.app`

### Portrait Print Refinement

Commit:

- `ccb22f2` - `Refine mortality report portrait printing`

This commit changed the printed/PDF report to:

- letter portrait orientation
- seven compact columns
- larger, bold data values
- daily mortality totals by sex
- combined daily mortality and population
- preserved split-sex arrival notes

Production deployment:

- deployment id: `dpl_EvBEbQmc4wQn52ozyasmoW4QL3uz`
- deployment URL: `https://web-admin-4liou7fmd-flock-trax.vercel.app`

### Final Pagination And Date Polish

Commit:

- `73ed866` - `Polish mortality report pagination and dates`

This commit:

- adds abbreviated weekday names to daily dates
- allows pages to fill before starting another page
- removes the forced one-placement-per-page rule
- keeps each placement/barn report block together when it fits on one page
- allows the browser to move a complete block to the next page rather than
  splitting it across pages

Final production deployment:

- deployment id: `dpl_DGzjyELY2uoj7aviYS7vxzxsCzM8`
- deployment URL: `https://web-admin-aexg52y5m-flock-trax.vercel.app`

## Scheduled Placement Cancellation

The cancellation workflow is limited to placements that are:

- `scheduled` or `awaiting_arrival`
- not removed
- not already in the barn
- connected to a flock used by only one placement
- free of daily, mortality, and weight records

If no feed is associated with the scheduled flock, the placement can be canceled
directly.

If feed is associated with the scheduled flock, a destination placement is
required before cancellation.

Feed considered by the cancellation function includes:

- feed drops assigned directly to the source placement
- queued feed drops whose source placement is the canceled placement
- active feed-order commitments with remaining ordered pounds

Transfer rules include:

- the destination cannot be the source placement
- the destination must be a later scheduled or awaiting-arrival flock
- delivered or queued feed can only move to a later flock in the same barn
- order commitments can move to another qualifying destination
- the destination feed-bin reference is retained only when the barn matches

After cancellation:

- placement lifecycle stage becomes `canceled`
- placement is inactive
- `canceled_at` and `canceled_by` are recorded
- the associated flock is not active, in-barn, complete, or settled

The user confirmed the cancellation flow worked for `276-W3`, including feed that
had originally been entered as an open balance.

Canceled flocks are available through the archived flock listing as read-only
historical records.

## Mortality Report Location

Admin navigation:

1. Open `Reports`.
2. Select `Detailed Reports`.
3. Select `Mortality`.

Report route:

- `/admin/reports/mortality`

Available filters:

- Farm Group
- Farm
- Barn
- Flock
- Date From
- Date To

Unlike the other reports that build filter options only from active placements,
the Mortality report loads historical placement options. Canceled placements are
excluded from its filter options and report output.

## Mortality Calculation Rules

The report is a placement-specific population ledger. It does not combine
different flocks merely because they occupied the same barn at different times.

### Daily Mortality

For each sex:

`Daily Mortality = Dead + Culls`

Specifically:

- female daily mortality = `dead_female + cull_female`
- male daily mortality = `dead_male + cull_male`

Culls are not ignored. A culled bird is removed from the live population and is
therefore included in mortality for population-ledger purposes.

The full on-screen table preserves Dead and Cull as separate audit columns. The
compact portrait print table combines them into one Mortality column for each sex.

### Day 1 Balance Forward

For a sex that arrived on or before the first report day:

`Opening Population = Placed Count - All Active Mortality Before Date From`

The opening row is labeled:

- `Day 1 - Balance Forward`

If the selected range begins on the placement date, the initial placed population
appears in the opening balance and is not added a second time on that day's row.

### Split-Sex Placement Dates

The report honors:

- `female_date_placed`
- `male_date_placed`

If one sex arrives after the first report day:

- that sex begins with a zero opening population
- its placed count is added on its actual arrival date
- the running population changes on that date
- the portrait print table shows a small `Placed +N` note below population

### Daily Rows

The report generates one row for every calendar day in the placement/report
overlap, including days with zero recorded mortality.

For each sex:

`Ending Daily Population = Prior Population + Arrivals - Dead - Culls`

Population values are clamped at zero rather than displaying negative birds.

If more than one active mortality row exists for the same placement and date, the
report aggregates those rows before calculating the daily balance.

Only active mortality rows are included.

### Ending Population

After the last daily row, the report shows:

- female mortality in the selected range
- male mortality in the selected range
- combined mortality in the selected range
- ending female population
- ending male population
- ending combined population

The report-level summary cards also show:

- report range and scope
- total Day 1 balance forward
- total mortality in the selected range
- total ending population

### Placement Date Overlap

The report includes only the portion of a placement that overlaps the selected
date range.

It uses:

- the earliest applicable male/female/main placement date as placement start
- explicit `date_removed` when present
- the day before the next non-canceled placement in the same barn when a legacy
  placement is missing `date_removed`

The inferred end-date rule prevents legacy records from overlapping newer flocks
and inflating report totals.

This safeguard was added after live-data verification exposed legacy examples
such as old `1-W1` and `270-W8` records with no removal date.

### Population Scope Limitation

The report is intentionally a mortality population ledger:

- placed birds are added
- dead birds are subtracted
- culled birds are subtracted

Livehaul removals are not independently inserted as mortality rows by this report.
The report ends a placement at its explicit or inferred removal boundary. If a
future requirement needs within-livehaul-day inventory accounting, that should be
designed as a separate population-adjustment rule rather than treating processed
birds as mortality.

## Screen Layout

The on-screen report retains the full audit detail.

Columns include:

- Date
- Female Placed
- Female Dead
- Female Cull
- Female Daily Loss
- Female Population
- Male Placed
- Male Dead
- Male Cull
- Male Daily Loss
- Male Population
- Combined Daily Loss
- Combined Population

Each placement section identifies:

- farm group
- farm
- barn
- flock
- placement date
- effective report date range

## Portrait Print Layout

The print/PDF report uses a separate compact table so the screen report does not
need to sacrifice detailed audit columns.

Printed columns:

- Date
- Female Mortality
- Female Population
- Male Mortality
- Male Population
- Combined Mortality
- Combined Population

Print characteristics:

- letter portrait
- larger bold numeric data
- compact proportional column widths
- green-tinted headers and alternating rows
- abbreviated weekday plus numeric date
- repeating table headers when supported by the browser
- page-filling flow before pagination
- placement sections marked to avoid splitting across pages

The final date format is similar to:

- `Wed, 07/15/2026`

## Verification

Successful local gates:

- `npm run typecheck`
- optimized `npm run build`
- all `45` static pages generated
- `git diff --check`

The production and local builds retain three pre-existing, non-blocking
Autoprefixer warnings recommending `flex-end` instead of `end`.

### Hosted-Data Browser Verification

The report was exercised locally against the hosted development/production data.

For `2026-07-01` through `2026-07-24`, after applying the legacy placement-overlap
guard, the all-farms sample produced:

- `8` valid flock sections
- Day 1 balance forward: `66,963`
- female opening population: `33,427`
- male opening population: `33,536`
- mortality in range: `11,211`
- female mortality: `4,775`
- male mortality: `6,436`
- ending population: `55,752`
- ending female population: `28,652`
- ending male population: `27,100`

A partial-range spot check for `319-S2`, `2026-07-15` through `2026-07-20`,
verified:

- Day 1 balance forward: `8,091`
- first daily row mortality: `14`
- first daily ending population: `8,077`

This confirmed that a partial report begins from the prior day's ending population
rather than resetting to the original placed count.

No browser console warnings or errors were observed during the report check.

## Primary Files

Mortality data and calculations:

- `web-admin/lib/mortality-report-data.ts`

Mortality report page:

- `web-admin/app/admin/reports/mortality/page.tsx`

Reports hub and filter routing:

- `web-admin/app/admin/reports/page.tsx`
- `web-admin/app/admin/reports/reports-filter-panel.tsx`

Report presentation and print rules:

- `web-admin/app/globals.css`

Placement cancellation foundation:

- `supabase/migrations/20260720005413_add_scheduled_placement_cancellation.sql`
- `web-admin/app/admin/placements/new/actions.ts`
- `web-admin/app/admin/placements/new/cancel-scheduled-placement-control.tsx`
- `web-admin/app/admin/placements/new/page.tsx`
- `web-admin/lib/placement-scheduler-data.ts`
- `web-admin/lib/flock-archive-data.ts`

## Git And Working Tree

At checkpoint creation:

- branch: `main`
- local HEAD: `73ed866a7b7cf0c2552b7a01ee8c15680484ec9e`
- `origin/main`: `73ed866a7b7cf0c2552b7a01ee8c15680484ec9e`
- local `main` matches `origin/main`
- no uncommitted `web-admin` source changes remain

Intentionally unrelated local files remain:

- modified `supabase/.temp/cli-latest`
- untracked `mobile/ReleaseSupport/AppScreens/1.0.5/`
- untracked `mobile/ReleaseSupport/FlockTrax_Mobile_1_0_5_Release_Changes_2026-07-13.pdf`

These files were not included in the mortality commits or deployments.

This new checkpoint and its index edit will become the only additional
documentation changes after this state is recorded.

## Resume Guidance

For mortality-report follow-up:

1. Start from commit `73ed866`.
2. Open Reports -> Detailed Reports -> Mortality.
3. Confirm the requested filters before investigating population math.
4. Treat `dead + culls` as mortality for each sex.
5. Preserve the Day 1 balance-forward rule for partial date ranges.
6. Preserve split-sex arrival additions.
7. Preserve legacy missing-removal-date inference.
8. Keep screen audit detail separate from compact portrait print detail.
9. Do not reintroduce forced one-placement-per-page printing.
10. Do not add livehaul head as mortality without a separately approved
    population-adjustment design.

For scheduled-placement cancellation follow-up:

1. Start from commit `41f1fcb` or later.
2. Preserve the server-side cancellation validation.
3. Require feed reassignment when feed exists.
4. Keep delivered/queued feed in the same barn.
5. Keep canceled placements read-only in the flock archive.

## Exact Resume Prompt

`Load C:\dev\FlockTrax\output\FlockTrax_Placement_Cancellation_And_Detailed_Mortality_Report_Production_Checkpoint_2026-07-28.md and C:\dev\FlockTrax\output\FlockTrax_Checkpoint_Index.md. Preserve the unrelated dirty files. Treat commit 73ed866 and Vercel deployment dpl_DGzjyELY2uoj7aviYS7vxzxsCzM8 as the current admin production baseline. The Detailed Reports -> Mortality report is live in portrait print form, uses dead plus culls as mortality, calculates partial-range Day 1 balance forward by sex, honors split-sex placement dates, infers missing legacy removal dates from the next placement in the barn, fills pages before paginating, and keeps placement blocks together.`
