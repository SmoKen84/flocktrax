# FlockTrax Development Checkpoint

Date: 2026-05-14
Workspace: `C:\dev\FlockTrax`
Focus: derived placement alerts, admin/dashboard issue flow, recent web-admin fixes, and new dashboard tile -> placement editor modal

## Current Status

This checkpoint captures the work completed through the new live-dashboard placement editor modal pass.

At a high level:

- The derived placement alert backend is live.
- The duplicate auto-alert guard is live.
- The mortality warning logic is now settings-driven and live.
- The earlier bundled web-admin fixes were deployed live to `flocktrax.com`.
- The new dashboard tile -> placement editor modal is implemented locally, typechecked, and not yet deployed.

## Already Completed And Live

### 1. Derived placement alert backend

Implemented a data-driven placement alert path using existing issue plumbing so current flocks surface as danger tiles without manual issue entry.

Behavior added:

- `Severe Early Mortality` auto-derived from mortality data
- `Hatchery Quality Incident` auto-derived from placement-day / bird-health style inputs
- active dashboard tiles surface these through the existing open-issue logic
- placement-day issue bundles pick them up automatically
- web-admin issue/dashboard readers use the shared issue model

Primary backend pieces:

- `C:\dev\FlockTrax\supabase\migrations\20260513110000_add_derived_placement_alerts.sql`
- `C:\dev\FlockTrax\supabase\functions\_shared\issues.ts`
- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`
- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`

Deployment status:

- SQL was run manually in the Supabase SQL editor.
- Edge functions were deployed.

### 2. Duplicate auto-derived issue cleanup and prevention

Observed issue:

- duplicated action items were being created for the same derived placement alert

Fixes added:

- dedupe existing duplicate derived placement issues
- add uniqueness protection for open auto-derived issues
- replace sync behavior with an atomic/upsert-safe path

Migration:

- `C:\dev\FlockTrax\supabase\migrations\20260513124500_dedupe_derived_placement_issues.sql`

Deployment status:

- SQL was run manually in the Supabase SQL editor and is live

### 3. Settings-driven placement alert thresholds and enable/disable flag

Added support for configurable settings in `public.app_settings`:

- `mortality_autowarn`
- `7day_warning`
- `hatchery_issue_level`

Behavior:

- `mortality_autowarn` can disable use of the auto-derived mortality placement alerts entirely
- `7day_warning` controls the 7-day mortality threshold
- `hatchery_issue_level` controls the hatchery-quality threshold
- existing auto-derived alerts resolve automatically when the relevant setting disables or clears them

Migration:

- `C:\dev\FlockTrax\supabase\migrations\20260513133000_configurable_derived_placement_alerts.sql`

Deployment status:

- SQL was run manually in the Supabase SQL editor and is live

### 4. Earlier web-admin fixes that were bundled and deployed

These were implemented and deployed to production previously:

- `Entry By:` for auto-derived items changed from `Unknown` to `FlockTrax`
- Action Items update date inheritance fix
- admin font/rendering consistency update
- feed ticket filter work and feed-ticket function updates
- farm placement editor layout fixes from the prior pass
- feed-ticket/bin ordering work based on `barn.sort_code`

Known deployed targets from earlier turn:

- Supabase function `feed-ticket-get` was deployed
- `web-admin` was deployed to production on Vercel and aliased to `https://flocktrax.com`

Earlier referenced deploy ids:

- `dpl_45WbgxFXjhhM1thrrUn4sDWDuaeH`
- `dpl_2ttkL36h4gBbcpDdqyyZWtNxJaoJ`

## Current Local Feature Pass: Dashboard Tile -> Placement Editor Modal

### Goal

Add a link/open behavior from clicking a dashboard tile so a modal panel opens and displays the placement editor. The fields shown should be unlocked or read-only based on the signed-in user’s permissions. Some fields must remain locked, especially placement date. If the user lacks view access, the modal should clearly say so.

### Current Result

Implemented locally and typechecked:

- clicking a dashboard tile opens a placement editor modal
- the tile is keyboard accessible through `Enter` and `Space`
- the modal shows a blocked/read-only message when access is limited
- `Placed Date` remains locked
- flock-side fields and placement-side fields unlock independently based on access
- save goes through a dashboard-specific server action
- overview page and refresh API both deliver the extra placement editor data and access flags

### Files Added

- `C:\dev\FlockTrax\web-admin\lib\placement-editor-access.ts`

### Files Updated

- `C:\dev\FlockTrax\web-admin\lib\types.ts`
- `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\overview\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\api\admin-overview-dashboard\route.ts`
- `C:\dev\FlockTrax\web-admin\components\live-dashboard-panel.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\overview\actions.ts`
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Detailed Notes For The Current Modal Feature

### Access model

New helper file:

- `C:\dev\FlockTrax\web-admin\lib\placement-editor-access.ts`

Responsibilities:

- load acting user auth context
- inspect `user_roles`, `roles`, `roles_actions_permissions`, `sysactions`
- inspect `farm_group_memberships` and `farm_memberships`
- determine whether the user can:
  - open the editor
  - view the placement
  - edit flock-owned fields
  - edit placement-owned fields
- return a message when access is blocked or only partial

Important exported functions:

- `buildPlacementEditorAccess(...)`
- `getPlacementEditorActorAccess()`
- `applyPlacementEditorAccess(...)`

### Type additions

In `C:\dev\FlockTrax\web-admin\lib\types.ts`:

- added `PlacementEditorAccessRecord`
- added `BreedOptionRecord`
- extended `ActivePlacementRecord` with:
  - `flockId`
  - `flockNumber`
  - `projectedEndDate`
  - `dateRemoved`
  - `breedFemales`
  - `breedMales`
  - `lh2Date`
  - `placementEditorAccess`
- extended `AdminDataBundle` with:
  - `breedOptions`

### Dashboard/admin data plumbing

In `C:\dev\FlockTrax\web-admin\lib\admin-data.ts`:

- placement query now includes `lh2_date`
- active placement records now include the extra flock/placement fields needed by the modal
- breed options are built from breed rows and returned as `breedOptions`
- each placement is initialized with a placeholder `placementEditorAccess`

In `C:\dev\FlockTrax\web-admin\app\admin\overview\page.tsx`:

- `getAdminData()` result is passed through `applyPlacementEditorAccess(...)`
- `placements` and `breedOptions` are passed into `LiveDashboardPanel`

In `C:\dev\FlockTrax\web-admin\app\api\admin-overview-dashboard\route.ts`:

- refresh API also applies placement editor access
- response now includes `breedOptions`

In `C:\dev\FlockTrax\web-admin\components\live-dashboard-panel.tsx`:

- local state includes `breedOptions`
- refresh handler updates both placements and breed options
- `ActivePlacementDashboard` receives `breedOptions`

### Dashboard UI behavior

In `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`:

- added `PlacementEditorPopup`
- whole tile can open the placement editor unless the click originated on a nested control
- tile now supports keyboard open via `Enter` and `Space`
- modal fields include:
  - placed date
  - projected end
  - date removed
  - start males
  - start females
  - LH 1
  - LH 2
  - LH 3
  - breed males
  - breed females
- field locking respects:
  - `canEditFlockFields`
  - `canEditPlacementFields`
- save closes the modal and refreshes the router on success

Important behavior notes:

- `Placed Date` is shown but disabled/read-only in the dashboard modal
- the selected placement lookup was normalized to use `placementId`
- the whole tile is now `role="button"` with `tabIndex={0}`

### Dashboard save action

In `C:\dev\FlockTrax\web-admin\app\admin\overview\actions.ts`:

- added `saveDashboardPlacementEditorAction(formData)`
- validates sign-in
- loads placement, farm, flock context
- computes current user access via `buildPlacementEditorAccess(...)`
- blocks save if the user lacks view or edit access
- validates:
  - projected end date cannot be before placed date
  - removed date cannot be before placed date
- updates only the sections the user can edit
- writes activity log entry
- revalidates:
  - `/admin/overview`
  - `/admin/placements/new`

Important implementation note:

- this action was adjusted to use `createSupabaseAdminClient()` for the actual reads/writes, matching the privilege model already used by the existing placement editor paths
- auth still comes from `createSupabaseServerClient()`

## Styling Added For Current Feature

In `C:\dev\FlockTrax\web-admin\app\globals.css`:

- clickable dashboard tile styling
- focus-visible treatment for tile-open behavior
- modal shell and modal panel styles
- modal header/title/copy styles
- read-only, blocked, note, and feedback banner styles
- placement summary card styles
- responsive modal action/summary stacking

Key selectors added:

- `.placement-tile--clickable`
- `.dashboard-placement-editor-shell`
- `.dashboard-placement-editor-panel`
- `.dashboard-placement-editor-header`
- `.dashboard-placement-editor-summary`
- `.dashboard-placement-editor-actions`
- `.dashboard-placement-editor-readonly`

## Verification Performed

### Completed

- `npm run typecheck` in `C:\dev\FlockTrax\web-admin`
- typecheck passed after the dashboard modal implementation
- local port check confirmed `localhost:3000` is running
- `curl.exe -I http://localhost:3000/admin/overview` responded with `307 Temporary Redirect` to `/login`

### Not Completed

- no authenticated browser walkthrough of the modal
- no production deploy for this latest dashboard editor feature
- no Vercel deploy for the current local changes yet

Because `/admin/overview` redirects to `/login`, the local app is up but I could not complete an authenticated click-through from here in this pass.

## Current Deployment State

### Live / deployed

- derived placement alert SQL changes
- dedupe/uniqueness guard SQL changes
- configurable mortality/hatchery settings SQL changes
- previously deployed web-admin fixes from the earlier pass
- previously deployed `feed-ticket-get`

### Local only right now

- dashboard tile -> placement editor modal
- placement editor access helper and access plumbing
- dashboard placement editor save action
- new dashboard modal styles

## Recommended Next Step

When ready to continue:

1. Run an authenticated local UI test of `/admin/overview`
2. Click a dashboard tile and verify:
   - no-access users see the blocked message
   - read-only users see the modal with locked fields
   - edit users can change only the fields their role allows
   - placed date stays locked
3. Verify save updates are reflected in:
   - the modal refresh
   - `/admin/placements/new`
   - activity log entries
4. If the behavior looks good, deploy `web-admin` to production

## Good Resume Prompt

Use this to resume:

"Continue from `FlockTrax_Dashboard_Placement_Editor_Checkpoint_2026-05-14.md`. The dashboard tile placement editor modal is implemented locally and typechecked but not deployed. Start by doing an authenticated local QA pass on `/admin/overview`, verify the permission-locking behavior, then deploy `web-admin` if it checks out."
