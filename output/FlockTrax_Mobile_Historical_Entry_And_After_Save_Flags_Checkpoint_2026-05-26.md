# FlockTrax Mobile Historical Entry And After Save Flags Checkpoint

Date: `2026-05-26`  
Branch: `main`  
HEAD: `05f88b7ca72f84471801be2d72f5c3e488dec695`

## Purpose

Capture the mobile-app behavior split between:

- `platform.settings.name("allow_historical_entry")`
- `platform.settings.name("after_save_goback")`

This checkpoint records the implementation that separates date-selection permission from post-save navigation behavior on the mobile `log_daily` screen.

## Requested Behavior

The requested rule set was:

### `allow_historical_entry`

- `true`
  - user may change the focus date from the mobile `log_daily` screen using the `Pick Date` button
- `false`
  - user may not change the focus date away from the current calendar date
  - only current-date data entry is allowed

### `after_save_goback`

- `true`
  - after a successful save of daily / mortality / grade data, the app returns to the mobile dashboard
  - if save fails, the user remains on the placement-day screen and sees the error
- `false`
  - after save, the app remains on the placement-day screen
  - user may then manually select another focus date and continue entering historical data

## What Was Changed

### Mobile Settings Type

Added the new boolean to the mobile settings payload type:

- [types.ts](C:/dev/FlockTrax/mobile/src/types.ts)

Added:

- `after_save_goback: boolean`

### Mobile Dashboard Settings Payload

Updated the mobile dashboard placements function to:

- read `platform.settings.after_save_goback`
- support a few normalized setting-name variants
- return the new value in the mobile `settings` payload

File:

- [index.ts](C:/dev/FlockTrax/supabase/functions/dashboard-placements-list/index.ts)

Notes:

- demo/test response payload was also updated so the field exists there as well
- boolean parsing matches the existing `allow_historical_entry` style

### Mobile Placement-Day Screen

Updated the save and date-change behavior in:

- [PlacementDayScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/PlacementDayScreen.tsx)

Behavior now:

- `allow_historical_entry` only controls whether focus-date changes are allowed
- when historical entry is off:
  - the entry-date button is disabled
  - the `Pick Date` button is disabled
  - save rejects any non-today date with a user-facing validation message
- `after_save_goback` only controls post-save navigation

### Important Behavior Change

The prior local behavior used `allow_historical_entry` to auto-advance from one historical date to the next after save.

That behavior was removed.

Current result:

- when `after_save_goback = true`
  - successful save returns to dashboard
- when `after_save_goback = false`
  - successful save stays on the same placement-day screen
  - user can manually choose another date if historical entry is enabled

This matches the requested workflow more closely than the old auto-advance behavior.

## Files Touched

- [PlacementDayScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/PlacementDayScreen.tsx)
- [types.ts](C:/dev/FlockTrax/mobile/src/types.ts)
- [index.ts](C:/dev/FlockTrax/supabase/functions/dashboard-placements-list/index.ts)

## Validation

Verification completed:

- `npm run typecheck` passed in `C:\dev\FlockTrax\mobile`

No deploy was performed in this session.

Status:

- local only
- not deployed
- not committed

## Current Local Worktree Context

Current `git status --short` still includes unrelated local work from earlier checkpoints, including:

- local web-admin invite-flow split work
- local `Micro Archive Copy` work
- local live-haul feed-projection fix
- planning docs and checkpoints added on May 25

For this checkpoint specifically, the mobile-related active files are:

```text
 M mobile/src/screens/PlacementDayScreen.tsx
 M mobile/src/types.ts
 M supabase/functions/dashboard-placements-list/index.ts
```

Also still present in the broader worktree:

```text
 M output/FlockTrax_Checkpoint_Index.md
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
?? output/FlockTrax_BinSentry_10_Day_Forecast_Popup_Mini_Spec_2026-05-25.md
?? output/FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md
?? output/FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md
?? supabase/migrations/20260519094709_bump_admin_release_build_5_1.sql
?? web-admin/app/mobile-access-ready/
?? web-admin/screens/FeedBin.png
```

Notes:

- `supabase/.temp/cli-latest` is temp noise
- the mobile flag-split work should be treated as a local additive change on top of the existing dirty workspace

## Relationship To Earlier Checkpoints

For the most recent planning work on BinSentry feed forecasting, also use:

- [FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md](C:/dev/FlockTrax/output/FlockTrax_BinSentry_Forecast_Planning_Checkpoint_2026-05-25.md)

For the broader production-vs-local execution baseline, still use:

- [FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md](C:/dev/FlockTrax/output/FlockTrax_Local_Production_Sync_And_Invite_Flow_Checkpoint_2026-05-19.md)

## Recommended Resume Point

If work resumes specifically on the mobile daily-log historical-entry workflow, start with:

1. [FlockTrax_Mobile_Historical_Entry_And_After_Save_Flags_Checkpoint_2026-05-26.md](C:/dev/FlockTrax/output/FlockTrax_Mobile_Historical_Entry_And_After_Save_Flags_Checkpoint_2026-05-26.md)
2. [PlacementDayScreen.tsx](C:/dev/FlockTrax/mobile/src/screens/PlacementDayScreen.tsx)
3. [index.ts](C:/dev/FlockTrax/supabase/functions/dashboard-placements-list/index.ts)
4. [types.ts](C:/dev/FlockTrax/mobile/src/types.ts)

## Likely Next Steps

When approved to continue, likely next steps are:

1. Deploy the updated `dashboard-placements-list` function if this behavior should go live
2. Publish a mobile build if the new flag behavior needs to be distributed through the app binary
3. Optionally create a short admin/operator note describing the new meaning of each setting
