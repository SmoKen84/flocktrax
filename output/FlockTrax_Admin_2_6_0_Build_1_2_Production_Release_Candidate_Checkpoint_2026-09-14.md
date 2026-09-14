# FlockTrax Admin 2.6.0 Build 1.2 Production Release Candidate Checkpoint

Date: `2026-09-14`
Branch: `release/admin-2.6.0`
Base: `4b494db` (`origin/main` and tag `pre-demo-stable-2026-09-05`)
Checkpoint type: isolated production release candidate; source prepared and validated, not deployed

## Purpose

Prepare the shared fixes proven in the isolated hosted demo for production without
promoting any demo database, seed/reset behavior, simulated integrations, demo
branding, or demo environment configuration.

The production release candidate lives in the dedicated worktree:

- `C:\dev\FlockTrax-Production-Release`

The older `C:\dev\FlockTrax` worktree remains on `demo-platform` with its existing
generated Supabase CLI metadata change and RLS diagnostic screenshot preserved.
Neither item is part of this release candidate.

## Prepared Production Changes

### Livehaul actual-head precedence

- Production commit: `f083734`
- Feed projections use a positive recorded actual head count first.
- If actual is null, zero, or otherwise unusable, the proposed/target head count
  remains the fallback.

### Starter-to-Grower ordering beginning at age 14

- Production commits: `01b0c3f`, `393dbd8`
- Lifetime Starter requirement, delivery, inventory, order, and shortfall facts
  remain accurate and visible.
- At age 14 or later, no new Starter is recommended; any unfulfilled Starter
  shortage is added to the Grower ordering recommendation.

### Mobile Operations Calendar rolling history

- Production commit: `d0cc4b9`
- The API returns matching placement and non-cancelled livehaul events beginning
  exactly 12 calendar months before the America/Chicago operational date.
- Today and all returned future matching events remain available.
- The mobile calendar can navigate backward through the rolling history and
  forward through the latest returned future event.
- This is mobile source readiness only. Installed mobile users will not receive
  the navigation change until a new binary is built and distributed.

### Dashboard population accounts for past livehaul

- Production commit: `fde65c9`
- Admin and mobile dashboard population use `Started - Dead - Hauled = Now`.
- Only livehaul scheduled strictly before today reduces the current population.
- Positive actual head is preferred; proposed head is the fallback.
- Sex-specific removals affect the specified sex; unsexed removals are allocated
  proportionally without allowing a negative population.
- Feed projections avoid deducting historical livehaul twice while retaining
  today's scheduled effect inside the projection.

## Release Identity

Prepared Admin release marker:

- version: `2.6.0`
- numeric build: `3`
- visible build label: `1.2`
- release date: `2026-09-14`
- migration: `supabase/migrations/20260914180000_bump_admin_release_2_6_0_build_1_2.sql`

The migration fails unless it updates exactly one Admin `platform.control` row.
It has not been applied to production.

Mobile identity is intentionally not advanced by this release preparation:

- published iOS baseline: `1.0.7 (20)`, released `2026-08-29`
- hosted Android baseline: `1.0.5 (11)` until an Android 1.0.7 artifact exists
- local Expo marketing version: `1.0.7`
- repository `mobile/package.json` and lockfile corrected from stale `1.0.6` to
  `1.0.7`
- local iOS build number `19` is not authoritative because EAS remote versioning
  produced the actual iOS build `20`

## Demo Isolation Review

The release diff contains no matches for the demo project reference, demo reset
functions, `binsentry_demo`, demo environment branching, or FlockTrax Demo
branding. Targeted production calendar and dashboard Edge Function files match
their tested demo counterparts.

The following remain demo-only and are excluded:

- synthetic/demo migrations and reset helpers;
- simulated BinSentry inventory and orders;
- disabled outbound-integration presentation;
- demo Supabase/Vercel configuration;
- red sidebar and browser-tab identity;
- demo splash copy, future schedules, app settings, and daily-age task seed.

## Validation Completed

- Admin `npm ci`: completed.
- Admin `npm run typecheck`: passed.
- Admin `npm run build`: passed; all 49 routes generated.
- Mobile `npm ci`: completed.
- Mobile `npm run typecheck`: passed.
- `git diff --check`: passed before the release-identity commit.
- Demo-only token scan of the production release diff: no matches.

Dependency audits reported existing dependency findings:

- Admin: 9 findings (`1` moderate, `7` high, `1` critical).
- Mobile: 27 findings (`1` low, `8` moderate, `16` high, `2` critical).

No automatic or forced dependency upgrades were performed because that would
expand the scope and may introduce unrelated breaking changes.

## Safety and Deployment Boundary

At this checkpoint:

- production Supabase has not been changed;
- no production Edge Function has been deployed;
- production Vercel has not been deployed;
- no mobile binary has been built or submitted;
- `main` has not been moved;
- production data has not been read, copied, reset, or modified.

## Controlled Release Sequence

1. Review the release branch diff against `origin/main`.
2. Create/push the pre-release rollback tag at base commit `4b494db`.
3. Apply only the Admin 2.6.0 release-control migration to production and verify
   exactly one Admin control row reads `2.6.0 / 3 / 1.2`.
4. Deploy `operations-calendar-list` and `dashboard-placements-list` to the
   production Supabase project, then verify their active versions and smoke-test
   authenticated farm scoping.
5. Deploy the Admin application from this release source to production Vercel.
6. Verify the dashboard Hauled matrix and age-14 feed-order behavior using known
   production examples.
7. Merge the accepted release branch into `main`, push `main`, and mark the
   promotion ledger entries complete with production deployment identifiers.
8. Merge the updated `main` into `demo-hosted`; never merge `demo-hosted`
   wholesale into production.
9. Build and distribute a later mobile artifact for the calendar UI change;
   update the hosted mobile marker only after the actual artifact number exists.

## Resume Point

Resume from branch `release/admin-2.6.0` in
`C:\dev\FlockTrax-Production-Release`. Treat the six release commits above as a
validated but undeployed production candidate. Reconfirm production Supabase and
Vercel identities immediately before any hosted mutation.
