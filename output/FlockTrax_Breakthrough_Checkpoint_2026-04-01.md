# FlockTrax Breakthrough Checkpoint 2026-04-01

## Project root

- `C:\dev\FlockTrax`

## What changed today

Today marked the practical break away from the Adalo-first architecture and the first successful end-to-end run of the new mobile path.

Confirmed working flow now exists for:

- login
- placements list display
- placement open
- daily log save

This was achieved by:

- building a new Expo mobile app in `C:\dev\FlockTrax\mobile`
- upgrading that app to Expo SDK 54 to match iPhone Expo Go 54.0.0
- fixing the mobile login request headers
- removing runtime dependency on several missing or drifted compatibility views in hosted Supabase functions

## New mobile app

New app location:

- `C:\dev\FlockTrax\mobile`

Important files:

- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\mobile\src\screens\LoginScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\storage\session.ts`
- `C:\dev\FlockTrax\mobile\src\types.ts`
- `C:\dev\FlockTrax\mobile\README.md`
- `C:\dev\FlockTrax\mobile\.gitignore`

App status:

- `npm install` completed successfully
- `npm run typecheck` passes
- `npx expo-doctor` passes `17/17`
- app runs under Expo SDK 54
- dev server was successfully started on port `8091`

## Hosted auth breakthrough

### What was failing

The phone app originally returned `401` on login even after resetting the password.

### Root cause

The mobile app was sending `apikey`, but unauthenticated calls like `auth-login` also needed:

- `Authorization: Bearer <anon-key>`

Without that header, the hosted function path rejected the request before the login logic was reached.

### Fix

Patched:

- `C:\dev\FlockTrax\mobile\src\api\http.ts`

Behavior now:

- authenticated calls use `Bearer <user access token>`
- unauthenticated calls fall back to `Bearer <anon key>`

### Verification

Hosted login was tested directly and returned a real access token for:

- `ken@mothercluckershenhouse.com`

## Password reset tooling added

Added helper:

- `C:\dev\FlockTrax\toolkit\Reset-FlockTraxPassword.ps1`

Purpose:

- find Supabase Auth user by email
- set a new password directly via admin API using service role key

This was used to recover access when the normal reset flow was redirected to localhost-based URLs.

## Farm access tooling added

Added helper:

- `C:\dev\FlockTrax\toolkit\Grant-FlockTraxFarmAccess.ps1`

Purpose:

- inspect a user's farm memberships
- list available farms
- add or upsert active `farm_memberships` rows

This confirmed that the logged-in user had an active membership row:

- user: `5cb4797c-d376-4a9d-ab8c-0d619ccc7185`
- farm: `cc6740d2-ce13-4296-a6e0-ed94393f36eb`

## Backend schema drift discovered

The major discovery today was that the hosted database does not line up cleanly with the later compatibility-view assumptions in the repo.

Examples encountered:

- `public.placements_dashboard_ui` does not exist
- `public.placement_day_ui` does not exist
- some expected aliases on `placements_ui` / `placements_ui2` do not exist in hosted runtime shape
- `placements.date_placed` does not exist in the hosted shape being exercised by the function path

This means the old Adalo-facing compatibility layer and later checkpoint assumptions cannot be trusted as the live runtime contract for hosted production.

## Backend function repairs completed

### 1. Dashboard list

Patched:

- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`

Old assumption:

- query `placements_dashboard_ui`

Current behavior:

- queries base `placements`
- hydrates related metadata from:
  - `farms`
  - `barns`
  - `flocks`
- computes:
  - `est_first_catch`
  - `age_days`
  - `head_count`

Result:

- placements list displays in the mobile app

### 2. Placement detail read

Patched:

- `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`

Old assumptions:

- query `placement_day_ui`
- fallback to `placements_ui2`
- later fallback to `placements_ui`

Current behavior:

- existing log lookup uses `v_placement_daily`
- placement metadata is loaded directly from:
  - `placements`
  - `farms`
  - `barns`
  - `flocks`
- draft packet is synthesized without relying on the missing compatibility views

Result:

- tapping a placement now opens the detail screen

### 3. Placement save response

Patched:

- `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`

Old assumption:

- after upsert, read back `placement_day_ui`

Current behavior:

- after save, rebuilds the response item directly from:
  - `placements`
  - `farms`
  - `barns`
  - `flocks`
  - `log_daily`
  - `log_mortality`

Result:

- save path works end-to-end

## Hosted deployment path used

The following hosted functions were effectively brought into alignment with the real hosted schema:

- `dashboard-placements-list`
- `placement-day-get`
- `placement-day-submit`

Deployment command pattern used:

```powershell
supabase functions deploy <function-name> --project-ref frneaccbbrijpolcesjm
```

## Mobile UX breakthroughs

The worker-facing app is no longer shaped like an admin tool.

### Worker mental model clarified

Operators do not think in:

- flock numbers
- placement codes
- internal IDs

They think in:

- farm
- barn

That insight drove the current UI direction.

### UI updates completed

Patched:

- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`

Current UI direction:

- dashboard header emphasizes `Farm and Barn`
- list cards emphasize:
  - farm name
  - barn code
- placement code is still present, but secondary
- detail header emphasizes:
  - farm
  - barn
- `Age Days` is read-only

Reason:

- the selected farm and barn identify the active placement for field users
- age should be derived from the selected placement/date, not manually edited

## Current successful user journey

Confirmed path:

1. open Expo app
2. log in successfully
3. see placement list
4. tap a placement
5. view daily/mortality form
6. save successfully

This is the first truly working replacement flow outside Adalo.

## Strategic conclusion from today

The key product/technical conclusion is now clear:

- FlockTrax should not continue trying to force its square operating model into Adalo's triangular constraints

The new mobile path is already proving more natural because:

- the real schema can be used directly
- the worker UX can match field reality
- admin and worker responsibilities can be separated cleanly

## Product split now emerging

### Worker app

Purpose:

- location-first daily data entry

Core actions:

- choose farm and barn
- open the active placement for the day
- submit daily and mortality data

### Admin layer

Still to be designed and built:

- farm groups
- farms
- barns
- flocks
- flock-specific fields such as:
  - place date
  - estimated first live haul
- placement/allocation management that connects:
  - flock
  - farm
  - barn
  - date range / active window
  into the `placement_id` that workers consume

This is now understood as a separate admin workflow, not something line workers should have to think about.

## Current limitations

Still not completed:

- refresh token handling
- offline drafts
- broader admin interface
- cleanup/refactor of the patched hosted functions after schema truth is fully documented
- explicit grouping/filter UX on the dashboard
- unsaved-change protection

Likely next technical risk:

- there may be additional hosted schema drift in tables or views that have not yet been exercised beyond the current flow

## Recommended next step

Continue by designing the admin information architecture.

Suggested next work item:

1. define entities and relationships
2. split worker screens from admin screens
3. define placement creation/allocation workflow
4. map how admin setup drives the worker-visible farm/barn list

## Resume prompt

Use this if resuming in a fresh session:

"Resume `C:\dev\FlockTrax` from `output/FlockTrax_Breakthrough_Checkpoint_2026-04-01.md`. The Expo mobile replacement app now works end-to-end for login, placements list, placement open, and save. The main breakthrough was removing runtime dependence on missing Adalo-era compatibility views and patching hosted functions to query the actual hosted schema directly. The worker UI has also been refocused around farm and barn selection, with age made read-only. Next step is to define the admin information architecture for farm groups, farms, barns, flocks, and placement allocation that generates the worker-facing `placement_id` list."
