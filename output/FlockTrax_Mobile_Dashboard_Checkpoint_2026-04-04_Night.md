# FlockTrax Mobile Dashboard Checkpoint 2026-04-04 (Night)

## Current working area

Primary repo:
- `C:\dev\FlockTrax`

Primary mobile app:
- `C:\dev\FlockTrax\mobile`

Main backend function touched tonight:
- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`

## Overall focus tonight

Tonight's work stayed focused on getting `FlockTrax-Mobile` closer to initial-release quality, especially:

- login-screen polish
- dashboard tile polish
- live filter behavior for farm-group and farm selection
- live population math on tiles
- settings-driven date/livehaul display on tiles

The dashboard is now materially closer to the provided mockups and is using live hosted data patterns rather than placeholder layout behavior.

## Mockup source of truth

Mobile mockup images reviewed and used as layout targets:
- `C:\dev\FlockTrax\mobile\screens\sign-in.png`
- `C:\dev\FlockTrax\mobile\screens\dashboard.png`
- `C:\dev\FlockTrax\mobile\screens\daily-header.png`
- `C:\dev\FlockTrax\mobile\screens\daily-log.png`
- `C:\dev\FlockTrax\mobile\screens\mort-counts.png`
- `C:\dev\FlockTrax\mobile\screens\grade.png`

## Login screen status

Files:
- `C:\dev\FlockTrax\mobile\src\screens\LoginScreen.tsx`
- `C:\dev\FlockTrax\mobile\App.tsx`

Implemented and confirmed:

- removed the duplicate/shared app header from the login route so only the styled `FlockTrax-MobileTM` login header appears
- made the login screen keyboard-aware so email/password stay above the virtual keyboard while typing on iPhone
- kept the branded header with:
  - `Field Operations`
  - `FlockTrax-MobileTM`
  - copyright line
- added signed-out footer content so the screen does not feel abandoned
- added visible release/build info:
  - release version id
  - release/build identifier
  - release date
- added `Keep me signed in` checkbox
- changed remembered-session behavior so persisted session is only stored when that box is checked
- changed dashboard logout behavior so it returns the user to the login screen without clearing the current in-memory session
- added `Active session available` banner and `Continue Session` button on the login screen so the user can jump back in without retyping credentials while the token is still valid

User validated:
- duplicate header issue fixed
- keyboard issue fixed
- logout-to-login testing loop works well

## Dashboard status

Files:
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\types.ts`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`

### Layout and style work completed

- compacted the filters so they consume much less vertical space
- switched to popup-style selection behavior for filters instead of bulky combo-box behavior
- put `Farm Group` and `Farm` back onto a tight horizontal row
- used inline `...` affordances at the right side of each filter control
- kept `Search` on a slim row underneath
- user confirmed this saved "at least a couple of rows"

Tile polish completed:

- removed the labels `PLACEMENT` and `AGE`
- increased the font size of flock/placement code and age
- changed flock/placement code and age to dark green
- replaced the old `birds assigned` line with current live population math
- compressed the total + male/female breakdown into one line

Current tile population line intent:
- `current_total_count (current_male_count males / current_female_count females)`

User explicitly approved this tighter one-line treatment.

### Current live math behavior on dashboard tiles

The tile now uses live-derived counts from placement/flock/mortality data:

- total current population:
  - `birds_placed - (male_dead + female_dead + male_culls + female_culls)`
- male current population:
  - `males_placed - (male_dead + male_culls)`
- female current population:
  - `females_placed - (female_dead + female_culls)`

Function source:
- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`

## Dashboard filters and access logic

### Final intended filter behavior

Farm-group behavior now supports:

- single-group user inferred from `farm_memberships`:
  - filter disabled
  - displays the one real farm-group label
- global admin:
  - filter enabled
  - can select among all active groups
- group selection with no placements:
  - selected group remains visible in UI
  - empty-state message shown instead of snapping back to previous group

### Important backend logic now in place

`dashboard-placements-list` now:

- resolves authenticated user from bearer token
- checks `public.is_admin()`
- loads `farm_memberships` for actual access scope
- loads `farm_group_memberships` if present
- derives accessible farm-group ids from:
  - explicit `farm_group_memberships`
  - inferred `farms.farm_group_id` from the user's `farm_memberships`
- loads farm-group labels from `public.farm_groups`
- returns filter metadata to the mobile app:
  - `can_select_farm_group`
  - `selected_farm_group_id`
  - `available_farm_groups`
  - `available_farms`

### Important mobile app behavior now in place

`App.tsx` now stores `selectedFarmGroupId` as first-class state instead of depending entirely on server-returned selected labels. This fixed the case where selecting a valid empty group as global admin visually snapped back or looked unchanged.

### Key data/debug discoveries tonight

The farm-group bug was not only UI-related. Several data issues were discovered and resolved:

- `Woape` farm previously had `farm_group_id = null`
- this prevented clean farm-group inference from `farm_memberships`
- user fixed `Woape.farm_group_id`
- a `farm_memberships.role_id` row was also found with no valid `role_code`; user fixed that

Critical insight:
- `farm_group_memberships` can be completely empty and the single-group lock case should still work if `farm_memberships -> farms.farm_group_id -> farm_groups.group_name` is valid

That inference path now works.

### Current tested outcomes

Tested and confirmed:

1. single-group case
- user had two farm memberships
- both farms belonged to the same farm group
- no `farm_group_memberships` rows existed
- result now works correctly:
  - group filter disabled
  - shows one actual group label instead of `All groups`

2. global admin multi-group case
- user added a third farm under a second farm group
- as global admin, the farm-group filter is enabled
- after app-side state fix, selecting an empty second group keeps that selected group visible and shows no placements, which is the expected behavior if no placement rows exist in that group

User confirmed this behavior with:
- "works as billed"

## Temporary debug aid added

To identify which auth user the phone session was really using, the dashboard currently shows a tiny debug line:

- `auth_user: <uuid>`

Location:
- under the `Active Flocks` title in `DashboardScreen.tsx`

This was intentionally temporary and was useful because:
- `auth.uid()` in Supabase SQL editor returned `NULL`
- duplicate auth/app/core user identities existed historically
- the dashboard line exposed the actual live mobile auth UUID

This debug line may be removed later once identity cleanup is no longer needed.

## App settings integration status

Settings source table:
- `public.app_settings`

User described the options/settings structure as:
- `GROUP`
- `Name`
- `Value`

Tonight's specific settings work:

### `DOW_Date`

This is now wired into `dashboard-placements-list` and returned to the mobile app.

Current use:
- formats the estimated first livehaul date line on each tile

### `First-LH`

This is the exact app setting name user clarified at end of session:
- `First-LH`

Current local code status:
- `dashboard-placements-list` now reads both:
  - `DOW_Date`
  - `First-LH`
- `First-LH` is used to populate:
  - `first_livehaul_days`
  - `est_first_catch = addDays(placedDate, firstLivehaulDaysSetting)`

Important note:
- the mobile app type shape was updated to include:
  - `settings.first_lh`

File updated:
- `C:\dev\FlockTrax\mobile\src\types.ts`

## Current tile line directly under population

The line beneath population now aims to display:

- formatted estimated first-livehaul date based on `DOW_Date`
- text: `Estimated First Livehaul`
- `(<First-LH> days)`

Styling intent:
- date portion in dark red
- day-count portion in dark red

Current rendering location:
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`

## Very important deployment note

The `First-LH` fix is present in local code, but the hosted function must still be redeployed for the phone to reflect it.

Deploy command:

```powershell
cd C:\dev\FlockTrax
supabase functions deploy dashboard-placements-list --project-ref frneaccbbrijpolcesjm
```

Until that deploy happens, the phone may still show earlier hosted behavior.

## Typecheck status

Verified:

```powershell
cd C:\dev\FlockTrax\mobile
npm run typecheck
```

Typecheck passed after the latest mobile type update.

## Identity/admin debugging notes

Important schema/runtime findings from tonight:

- `public.core_users` is a minimal identity-anchor table and not a readable profile table
- many historical `core_users` ids do not resolve cleanly to `auth.users`
- `auth.uid()` in SQL editor returned `NULL`, which is expected because the editor is not executing as the mobile app's user context
- `farm_memberships` and `farms.farm_group_id` turned out to be the real keys to single-group filter inference

Diagnostic SQL file previously created:
- `C:\dev\FlockTrax\output\FlockTrax_Identity_Diagnostics_2026-04-04.sql`

## Files changed or materially involved tonight

Mobile:
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\LoginScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\types.ts`

Backend:
- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`

Reference/mockups:
- `C:\dev\FlockTrax\mobile\screens\*.png`

## Best next step when resuming

1. Deploy the latest hosted `dashboard-placements-list` function:

```powershell
cd C:\dev\FlockTrax
supabase functions deploy dashboard-placements-list --project-ref frneaccbbrijpolcesjm
```

2. Reload the mobile app on iPhone.

3. Verify that the tile line under population now uses the real `First-LH` setting value from `app_settings` instead of any old placeholder behavior.

4. Once dashboard tile/date behavior is confirmed, continue the screen-by-screen refinement path:
- dashboard final polish if needed
- placement-day header shell
- daily log tab
- mortality tab
- grade tab

## Short resume prompt

"Resume `C:\dev\FlockTrax` from `output/FlockTrax_Mobile_Dashboard_Checkpoint_2026-04-04_Night.md`. Mobile login and dashboard have been significantly refined against the provided mockups. The current dashboard supports farm-group inference from `farm_memberships`, correct single-group lock behavior, global-admin multi-group selection, live current-population math, and settings-driven estimated first livehaul display. The latest local function reads `DOW_Date` and `First-LH` from `public.app_settings`, but `dashboard-placements-list` still needs to be redeployed to hosted Supabase before the phone reflects the newest tile line behavior." 
