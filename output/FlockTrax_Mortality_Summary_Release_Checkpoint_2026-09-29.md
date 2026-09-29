# Mortality summary release — September 29, 2026

## Source and database state

- Production source: `a37e7bc`, branch `release/admin-2.6.0`, checkout `C:/dev/FlockTrax-Production-Release`.
- Demo source: `33374c4`, branch `demo-hosted`, checkout `C:/dev/FlockTrax-Demo-Hosted`.
- Both source commits are pushed to origin.
- Migration `20260929120000_add_mortality_window_summary.sql` is applied to production (`frneaccbbrijpolcesjm`) and demo (`srkgobayrzidytmvoago`). Subsequent dry runs report both databases up to date.
- The historical/mobile checkout `C:/dev/FlockTrax` was missing six already-applied September 14–22 migration files. They were recovered from hosted migration history. No migration history was marked reverted or reapplied. Do not deploy the web app from that older checkout.

## Change

The detailed report and dashboard previously read mortality in one API request.
Production has 1,040 rows, exceeding the 1,000-row response cap. The new server-only
`get_mortality_window` RPC returns historical loss summaries and requested daily
details. The dashboard also receives lifetime/first-week totals and first-week
details. API paging remains available for placement summaries, with batches of
100 IDs. The last-seven-day total now uses the same seven dates as its breakdown.

Only mortality data loading changed. The newer branches' independent weight
selection, livehaul/population reconciliation, barn ordering, BinSentry report,
marketing, and demo signup changes were preserved. No mortality records, sync
jobs, credentials, or environment settings were changed.

## Verification

- Seven Node regression tests passed in each deployment checkout.
- TypeScript checks passed in each deployment checkout.
- Actual PostgreSQL migration tests passed in a disposable local database with
  more than 1,000 historical records, boundary cases, inactive logs, missing
  values, overlapping windows, invalid ranges, and execution privileges.
- Hosted read-only comparison passed against all 1,040 production mortality
  records / 56 placements and all 217 demo mortality records / 19 placements.
- Both report and dashboard loaders completed against each hosted database.
- Production September 23–27 report: seven sections, daily losses 66, 108, 189,
  169, and 62. Last-seven-day dashboard totals equal their displayed details.
- Anonymous execution of the new RPC is denied in both environments.
- Probe `toolkit/Test-MortalityWindowHosted.cjs` deliberately suppresses the
  dashboard's existing derived-issue refresh so verification is read-only.

## Deployment completion

- Production READY: `dpl_HsMEZLXE8ihchGyrBkxWbhSjfqSc`,
  `https://web-admin-p9fk2awn7-flock-trax.vercel.app`, aliased to `https://flocktrax.com`.
- Demo READY: `dpl_GU2aGyiPxudt6WLiuWhPfsp2JPKb`,
  `https://flocktrax-demo-abkrm7m2j-flock-trax.vercel.app`, aliased to `https://flocktrax-demo.vercel.app`.
- Both hosted builds passed compilation, type/lint checks, and page generation.
- Live login pages return HTTP 200; anonymous overview and mortality-report
  requests redirect to login. Data validation used the deployed source loaders
  against each hosted database, not a fresh authenticated browser visual audit.
- Documentation-only commits following the source commits do not require a redeploy.

## Recovery

The migration is additive and can remain installed if a web rollback is needed.
Previous READY deployments are recorded in the September 28 checkpoint. Revert
through the correct Vercel project rather than changing operational data or
resetting shared worktrees. Production's pre-existing change to
`supabase/.temp/cli-latest` remains uncommitted.
