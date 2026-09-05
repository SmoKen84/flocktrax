# FlockTrax Google Sheets Outbox and Mortality Responsive Production Checkpoint

Date: `2026-09-05`
Branch: `main`
Repository: `C:\dev\FlockTrax`
Source baseline: `a160f56`
Production deployment: `dpl_B9Eo1bizRHmuWS9CAfaDqcKkpm5T`
Production URL: `https://web-admin-acm5omshu-flock-trax.vercel.app`
Production aliases: `https://flocktrax.com`, `https://admin.flocktrax.com`
Checkpoint type: production repair, responsive-layout correction, deployment verification, and stopping-point checkpoint

## Purpose

This checkpoint records the production state after repairing automatic Google
Sheets outbox processing and correcting the Admin overview mortality summary at
single-flock/mobile widths. It also records the exact deployment, verification
evidence, and intentionally preserved dirty-tree boundary.

No secret values or sensitive credentials are recorded here.

## Current Production Baseline

- source commit: `a160f56` (`Fix Sheets outbox scheduling and mobile mortality layout`)
- `origin/main`: matched the source commit before checkpoint documentation
- Vercel deployment: `dpl_B9Eo1bizRHmuWS9CAfaDqcKkpm5T`
- Vercel state: `READY`
- production target: `production`
- primary alias: `https://flocktrax.com`
- live primary-alias response: HTTP `200`
- Vercel optimized production build: passed
- all `49` Next.js routes generated successfully

The checkpoint/index documentation commit follows the source baseline and does
not alter application behavior.

## Google Sheets Outbox Scheduler Repair

### Symptom

Google Sheets worksheet updates were being added to the outbox correctly, but
pending rows remained queued until the outbox processor was invoked manually.
There was no requirement to replay previously completed history; only rows still
marked `pending` were eligible for processing.

### Root cause

The August 29 security hardening changed `googleapis-outbox-process` to require a
valid privileged Supabase credential. The pre-existing `pg_cron` invocation still
presented the public anon credential, so scheduled requests reached the Edge
Function but were rejected with HTTP `401`.

### Implemented repair

- added a dedicated `GOOGLEAPIS_OUTBOX_CRON_SECRET` worker credential;
- stored the credential in Supabase Edge Function secrets and its corresponding
  value in Vault without placing the value in source control;
- allowed `googleapis-outbox-process` to authenticate either an existing valid
  administrative Supabase credential or the dedicated
  `x-flocktrax-cron-secret` header;
- explicitly configured `googleapis-outbox-process` with `verify_jwt = false` so
  the function can perform its own restricted worker-credential validation;
- added `platform.invoke_googleapis_outbox_worker()` as a `security definer`
  function with an empty search path and execution restricted to `service_role`;
- replaced the obsolete schedules with one active
  `googleapis-outbox-process-every-15-min` job;
- set the scheduled HTTP request timeout to `120000` milliseconds;
- retained the processor limit of `100` rows per invocation.

Production database migrations:

- `20260903114500_repair_googleapis_outbox_cron_auth.sql`
- `20260903120500_extend_googleapis_outbox_cron_timeout.sql`

Production Edge Function:

- `googleapis-outbox-process`, version `9`

### Hosted verification

Verification performed on September 5 confirmed:

- the cron job is active on the `*/15 * * * *` schedule;
- the latest observed run at `2026-09-05 09:15 UTC` succeeded;
- the last 24 hours contained `30` scheduled HTTP `200` responses and no `401`
  responses;
- the outbox contained `1,958` rows marked `sent`;
- the outbox contained zero `pending` and zero `failed` rows;
- the small number of rows pending when the repair was applied processed normally;
- already processed historical rows were not replayed;
- local and hosted Supabase migration histories matched.

## Responsive Mortality Summary Repair

### Symptom

When the Admin overview collapsed to one flock card, including on an iPhone or
when browser zoom reduced the layout to a single-card width, the mortality
summary labels and totals wrapped into an unreadable arrangement.

### Root cause

The mortality summary markup renders five cells per row, but the media query at
`max-width: 1080px` changed `.tile-mortality-table` to three grid columns. The
browser consequently flowed each five-cell row across mismatched three-column
tracks.

### Implemented repair

The incorrect three-column responsive override was removed from
`web-admin/app/globals.css`. The component now retains its intended five-column
grid at single-card and phone widths, keeping the row label plus male, female,
total, and percentage values aligned.

### Visual and build verification

- verified at an iPhone-sized `390 x 844` viewport;
- verified at a `900 x 700` single-card viewport;
- the five mortality columns remained aligned and readable at both sizes;
- `npm run typecheck`: passed;
- local `npm run build`: passed;
- Vercel production build: passed and generated all `49` routes.

## Deployment Record

The source commit was pushed to `origin/main`, then `web-admin` was deployed to
Vercel production.

- deployment ID: `dpl_B9Eo1bizRHmuWS9CAfaDqcKkpm5T`
- immutable deployment URL: `https://web-admin-acm5omshu-flock-trax.vercel.app`
- Vercel inspection state: `Ready`
- aliases confirmed by Vercel:
  - `https://flocktrax.com`
  - `https://admin.flocktrax.com`
  - `https://web-admin-azure.vercel.app`
  - `https://web-admin-flock-trax.vercel.app`
- primary production alias returned HTTP `200` after deployment.

## Files in the Source Commit

- `supabase/config.toml`
- `supabase/functions/googleapis-outbox-process/index.ts`
- `supabase/migrations/20260903114500_repair_googleapis_outbox_cron_auth.sql`
- `supabase/migrations/20260903120500_extend_googleapis_outbox_cron_timeout.sql`
- `web-admin/app/globals.css`

## Preserved Dirty-Tree Boundary

The following pre-existing local items are intentionally not included in either
the source commit or the checkpoint documentation commit:

- modified generated CLI metadata: `supabase/.temp/cli-latest`
- untracked diagnostic screenshot directory:
  `mobile/screens/errors/` (including `RLS-ErrorAfterPermissionsMigration.PNG`)

These items were already identified as outside the releasable source boundary in
the August 31 checkpoint. Do not delete, overwrite, or commit them without an
explicit decision from the repository owner.

## Stopping Point

The Google Sheets outbox is processing automatically in production, no pending
or failed rows remain, the responsive mortality summary fix is live, and the
production Admin deployment is healthy. No further implementation or deployment
work is required for these two defects.

Suggested resume prompt:

> Load `output/FlockTrax_Google_Sheets_Outbox_And_Mortality_Responsive_Production_Checkpoint_2026-09-05.md` and `output/FlockTrax_Checkpoint_Index.md`, verify the current branch and preserved dirty-tree boundary, then continue from the September 5 production baseline.
