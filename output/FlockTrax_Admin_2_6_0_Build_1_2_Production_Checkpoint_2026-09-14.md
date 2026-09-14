# FlockTrax Admin 2.6.0 Build 1.2 Production Checkpoint

Date: `2026-09-14`
Release branch: `release/admin-2.6.0`
Deployed source commit: `f953700`
Rollback tag: `checkpoint/pre-admin-2.6.0-production-20260914`
Production URL: `https://flocktrax.com`

> Superseded age-14 rule: the later hotfix checkpoint
> `FlockTrax_Admin_2_6_0_Age14_Feed_Projection_Hotfix_Production_Checkpoint_2026-09-14.md`
> replaces the Starter-shortfall conversion behavior described below. At age 14
> or older, an unfulfilled Starter gap is historical only and is not added to
> Grower demand.

## Released Changes

- Positive actual livehaul head takes precedence over proposed head; proposed is
  retained as the fallback when actual is zero or unavailable.
- At age 14 or later, outstanding Starter shortage is ordered as Grower while
  lifetime Starter requirement, delivery, inventory, order, and shortage facts
  remain visible and accurate.
- Dashboard population now displays and deducts past livehaul as
  `Started - Dead - Hauled = Now`; today's events are not deducted until the next
  operational day.
- Mobile Operations Calendar API now returns the rolling prior 12 calendar
  months, today, and all matching future placements/livehauls.

## Release Identity

The guarded migration
`20260914180000_bump_admin_release_2_6_0_build_1_2.sql` was the only pending
migration in the dry run and was applied to production Supabase project
`frneaccbbrijpolcesjm`.

Production readback:

- platform group: `admin`
- version: `2.6.0`
- numeric build: `3`
- visible build label: `1.2`
- released: `2026-09-14`

Published mobile identity was not advanced:

- iOS remains `1.0.7 (20)`, released `2026-08-29`.
- Android remains `1.0.5 (11)` until a newer Android artifact is built.
- The calendar UI source requires a future mobile build before installed users
  receive the expanded navigation window.

## Production Edge Functions

- `operations-calendar-list`: ACTIVE, version `9`
  - local bundle entrypoint SHA-256:
    `329CC0AE68D258A3A440CCD2349D7C62577B938B196290A7B42037B3510C7C6D`
- `dashboard-placements-list`: ACTIVE, version `33`
  - local bundle entrypoint SHA-256:
    `AE1F14AB00170695AC688F27A334B21101DB90F8B362E2DC553B25BEE606130A`

Both functions returned HTTP `401` when called without authentication after
deployment.

## Vercel Deployment

The first deployment (`dpl_D7f56ctLPpbbXCzUSjjZLuPC6SkZ`) built successfully
but exposed a missing Vercel production environment variable during runtime
verification: `NEXT_PUBLIC_SUPABASE_URL` was absent, causing protected Admin data
loads to return HTTP `500`. No Supabase operational data was changed by that
failure.

The production project environment was repaired with these non-secret bindings:

- `NEXT_PUBLIC_SUPABASE_URL=https://frneaccbbrijpolcesjm.supabase.co`
- `NEXT_PUBLIC_APP_URL=https://flocktrax.com`

The superseding production deployment is:

- deployment: `dpl_917dzUiUswkHXUoiZrc3nP6dozEX`
- deployment URL: `https://web-admin-29iap6bx6-flock-trax.vercel.app`
- inspector: `https://vercel.com/flock-trax/web-admin/917dzUiUswkHXUoiZrc3nP6dozEX`
- target/status: production / READY
- aliases:
  - `https://flocktrax.com`
  - `https://admin.flocktrax.com`
  - `https://web-admin-azure.vercel.app`
  - `https://web-admin-flock-trax.vercel.app`

## Verification

- Local Admin typecheck passed.
- Local optimized Admin build passed all 49 routes.
- Local Mobile typecheck passed.
- Vercel production build passed all 49 routes.
- `flocktrax.com` returned HTTP `200` and rendered version `2.6.0`, build `1.2`.
- `admin.flocktrax.com` returned HTTP `200` and rendered the same release marker.
- Neither production homepage contained the FlockTrax Demo marker.
- Unauthenticated `/admin/overview` returned HTTP `307` to `/login`.
- The superseding deployment had no HTTP `500` runtime logs after verification.
- Production Supabase release-control readback matched exactly one Admin row.

## Remaining Acceptance Boundary

Technical production deployment is complete. Final user field acceptance remains:

1. visually confirm one known dashboard population where a livehaul occurred
   before today;
2. visually confirm one age-14-or-older feed projection with an outstanding
   Starter shortage;
3. build/distribute a later iOS/Android artifact when the mobile calendar UI
   change is ready for installed devices.

Demo seed/reset, simulated BinSentry behavior, demo branding, disabled demo
integrations, and demo environment configuration were not promoted.
