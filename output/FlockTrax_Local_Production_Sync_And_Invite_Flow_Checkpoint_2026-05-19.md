# FlockTrax Local / Production Sync And Invite Flow Checkpoint

Date: `2026-05-19`  
Branch: `main`  
HEAD: `05f88b7ca72f84471801be2d72f5c3e488dec695`

## Production State

- Web admin production is live on [https://flocktrax.com](https://flocktrax.com)
- Current Vercel deployment:
  - id: `dpl_467HzkhnTBqmEYkgydKmPHgGovcg`
  - inspector: [https://vercel.com/flock-trax/web-admin/467HzkhnTBqmEYkgydKmPHgGovcg](https://vercel.com/flock-trax/web-admin/467HzkhnTBqmEYkgydKmPHgGovcg)
  - deployment URL: [https://web-admin-avdtd7wbl-flock-trax.vercel.app](https://web-admin-avdtd7wbl-flock-trax.vercel.app)
- Supabase functions deployed live:
  - `placement-day-get`
  - `placement-day-submit`
  - `placement-day-get-adalo`

## Live Published Build Marker

Verified against `platform.control` after update:

- `group`: `admin`
- `version`: `2.0.0`
- `build`: `5`
- `build_label`: `5.1`
- `released`: `2026-05-19`

Release marker migration created locally:

- [20260519094709_bump_admin_release_build_5_1.sql](C:/dev/FlockTrax/supabase/migrations/20260519094709_bump_admin_release_build_5_1.sql)

The SQL was applied directly with `supabase db query --linked --file ...` and then repaired into remote migration history with:

- `supabase migration repair 20260519094709 --status applied --linked`

## What Is Already Live

### Dashboard / Report

- Admin dashboard feed projection logic is live
- Feed projection now uses:
  - `stdbreedspec.dayfeedperbird`
  - current live population
  - projected mortality trend
  - live-haul reduction inside the 10-day window
- Dashboard tile shows the feed projection behind a feed-bin icon button instead of a permanent third card
- The icon button uses:
  - [FeedBin.png](C:/dev/FlockTrax/web-admin/screens/FeedBin.png)

### Mobile Daily Log

- `public.log_daily.is_oda_open` now defaults to `true` for new daily-log loads when flock age is `14` days or older
- Existing saved daily values are preserved
- Matching logic was applied in:
  - [placement-day-get/index.ts](C:/dev/FlockTrax/supabase/functions/placement-day-get/index.ts)
  - [placement-day-submit/index.ts](C:/dev/FlockTrax/supabase/functions/placement-day-submit/index.ts)
  - [placement-day-get-adalo/index.ts](C:/dev/FlockTrax/supabase/functions/placement-day-get-adalo/index.ts)

## Current Local-Only Work Not Yet Deployed

These changes exist locally in the workspace and passed `npm run build`, but have **not** been pushed live yet:

### Invite Flow Split For Mobile vs Admin

- User invite form now requires explicit invite destination:
  - `Mobile App`
  - `Admin Console`
- Mobile-target invites now:
  - complete password setup on the web
  - route to a mobile-ready finish page instead of admin login
  - sign the web session back out after password update
- Resent invites reuse stored `invite_target` metadata

Key files:

- [actions.ts](C:/dev/FlockTrax/web-admin/app/admin/user-access/actions.ts)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/user-access/page.tsx)
- [actions.ts](C:/dev/FlockTrax/web-admin/app/login/actions.ts)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/reset-password/page.tsx)
- [invite-email.ts](C:/dev/FlockTrax/web-admin/lib/email/invite-email.ts)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/mobile-access-ready/page.tsx)

### Flock History `Micro Archive Copy`

- Added a second report mode using the current flock history report data
- Route pattern:
  - `/admin/flocks/[flockId]/report?mode=micro`
- Purpose:
  - compact portrait PDF
  - archive / attachment use
  - monitor viewing with zoom
- Wired into:
  - flock detail page
  - placement wizard editor
  - dashboard placement editor popup

Key files:

- [report/page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flocks/[flockId]/report/page.tsx)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/flocks/[flockId]/page.tsx)
- [page.tsx](C:/dev/FlockTrax/web-admin/app/admin/placements/new/page.tsx)
- [active-placement-dashboard.tsx](C:/dev/FlockTrax/web-admin/components/active-placement-dashboard.tsx)
- [globals.css](C:/dev/FlockTrax/web-admin/app/globals.css)

## Current Dirty Worktree

Exact `git status --short` snapshot at checkpoint time:

```text
 M supabase/.temp/cli-latest
 M supabase/functions/placement-day-get-adalo/index.ts
 M supabase/functions/placement-day-get/index.ts
 M supabase/functions/placement-day-submit/index.ts
 M web-admin/app/admin/flocks/[flockId]/page.tsx
 M web-admin/app/admin/flocks/[flockId]/report/page.tsx
 M web-admin/app/admin/placements/new/page.tsx
 M web-admin/app/admin/user-access/actions.ts
 M web-admin/app/admin/user-access/page.tsx
 M web-admin/app/globals.css
 M web-admin/app/login/actions.ts
 M web-admin/app/reset-password/page.tsx
 M web-admin/components/active-placement-dashboard.tsx
 M web-admin/lib/admin-data.ts
 M web-admin/lib/email/invite-email.ts
 M web-admin/lib/types.ts
?? supabase/migrations/20260519094709_bump_admin_release_build_5_1.sql
?? web-admin/app/mobile-access-ready/
?? web-admin/screens/FeedBin.png
```

Notes:

- `supabase/.temp/cli-latest` is CLI temp noise and not meaningful product work
- The rest of the dirty files are real pending work and should be treated as active local changes

## Verification State

- Web admin build verification:
  - `npm run build` passed after the latest `Micro Archive Copy` and invite-flow changes
- Production deploys completed successfully for:
  - web admin `dpl_467HzkhnTBqmEYkgydKmPHgGovcg`
  - Supabase functions listed above
- Live build marker `5.1` was verified directly from the database

## Recommended Resume Point

If work resumes in a new chat, start with:

`Load C:\dev\FlockTrax\output\FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md first.`

Then likely next steps are:

1. Decide whether to deploy the local invite-flow split and `Micro Archive Copy`
2. File current local changes into git once approved
3. Add closeout-flow wiring for `Micro Archive Copy`
