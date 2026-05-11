# FlockTrax Web Admin Checkpoint
Date: 2026-04-13
Workspace: `C:\dev\FlockTrax`
Primary app: `C:\dev\FlockTrax\web-admin`

## Current Position
The web-admin console has crossed from mockup-only into a mixed state:

- splash screen is real, branded, and platform-table driven
- login/logout flow now exists and is usable
- user access screen is visually close to the intended model
- live hosted security tables are being read for roles, actions, and role-action permissions
- user directory is now based on Supabase Auth users, not `app_users`
- the biggest remaining schema flaw identified is `public.user_roles`

The user asked to shorten the conversation and requested a detailed restart checkpoint.

## What Is Implemented

### Splash and shell
- Splash page reads from:
  - `platform.control`
  - `platform.screen_txt`
  - `platform.license_policy`
- Splash uses hosted Supabase data, not local fallback, after:
  - exposing schema `platform`
  - granting schema/table access
- Signed-out splash behavior:
  - menu items greyed out
  - `Login` button appears in sidebar
- Signed-in splash behavior:
  - identity card shown in sidebar
  - menu and CTA enabled

### Admin shell
- Admin pages under `/admin/...` now require a real Supabase session
- Sidebar uses the newer splash-era visual language instead of the older shell
- Sidebar now shows:
  - signed-in user name
  - role label
  - optional scope label
  - date/time line
  - `Switch User`
  - `Logout`
- `Logout` is real and posts to:
  - `app/logout/route.ts`

### Login and session control
- `/login` now exists as a modal-style page rather than a plain standalone form
- Login uses Supabase Auth directly via:
  - `supabase.auth.signInWithPassword`
- `remain logged in` is currently handled by Supabase session cookies by default
- Password reset flow was updated for local testing:
  - reset email now uses explicit local callback target
  - `app/auth/callback/route.ts` added
  - `app/reset-password/page.tsx` added
  - `app/login/actions.ts` updated with:
    - `forgotPasswordAction`
    - `updatePasswordAction`
    - `logoutAction`

Important local setup note:
- Supabase Auth URL config still needs localhost callback URLs allowed for whichever ports are used locally:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3001/auth/callback`
  - `http://localhost:3002/auth/callback`

### User Access Control screen
Route:
- `app/admin/user-access/page.tsx`

Current screen shape:
- top hero tile
- `User Directory` on left
- `Grant User Access` on right
- selected/acting user visual blocks
- memberships section
- roles bucket
- role permission matrix
- `Invite New User` button on the `User Directory` tile

Current interaction state:
- user rows are clickable for selection
- filters were added for:
  - group
  - farm
  - status
- `Restricted` badge means:
  - visible in directory
  - not editable by current acting user

Important honesty note:
- this page is still partly a working maintenance screen and partly a staged editor
- not all add/remove/edit buttons write to the hosted DB yet

## Live Data Sources Now In Use

### Security model
The web app now reads these live hosted tables:
- `public.roles`
- `public.sysactions`
- `public.roles_actions_permissions`

These are being converted into live role templates and permission rows in:
- `web-admin/lib/access-control.ts`

### User directory base identity
Base identity source is now:
- Supabase Auth users via `supabase.auth.admin.listUsers()`

Then overlaid with:
- `public.user_roles`
- `public.farm_group_memberships`
- `public.farm_memberships`

This was changed intentionally so:
- invited/authenticated Supabase users can appear before FlockTrax memberships are assigned
- the old `app_users` dependency is no longer the primary identity source

## Key Security Model Decisions Reached

### Core framing
- roles define **what**
- memberships define **where**

### Scope hierarchy
- `integrator_group`
- `farm_group`
- `farm`

### Intended authority rule
- `Super-Admin`
  - global reach
  - can see unaffiliated authenticated users
- `Admin`
  - local/group authority only
  - should not automatically reach unaffiliated users

This distinction was explicitly locked into code in `web-admin/lib/access-control.ts`.

### Operational language that tested well
The user strongly responded to this plain-language framing:
- role template = permission package
- memberships = boundary of where that package applies
- grantor should assign role + memberships, not hand-place every token

### Role design direction
- role templates should carry the heavy complexity
- grantor should mostly choose:
  - role
  - scope
- deny/contra-action tokens may exist, but as exceptional user-level overrides, not primary role design

## Major Schema Discovery

### Problem found
The user discovered that `public.user_roles` is still old-style and weakly modeled:
- `user_roles.role` is plain text
- it copies role code text
- it does **not** currently use a UUID foreign key to `public.roles(id)`

This is a real structural issue and likely explains some of the confusing authority behavior.

### Why it matters
- text drift is possible
- no FK integrity to `public.roles`
- security logic can disagree with live role catalog
- old baseline SQL still contains:
  - `public.is_admin()` checking `ur.role = 'admin'`

### Migration added in repo
A new migration was created:
- `supabase/migrations/20260413113000_normalize_user_roles_role_id.sql`

Intent of that migration:
- add `role_id uuid` to `public.user_roles`
- backfill `role_id` from `public.roles.code`
- fail if unmatched rows remain
- remove duplicate `(user_id, role_id)` rows
- make `role_id` required
- add FK to `public.roles(id)`
- change PK to `(user_id, role_id)`
- recreate supporting index
- update `public.is_admin()` to use `role_id -> roles.code`

Important note:
- this migration is in the repo only
- it has **not** been confirmed as applied to hosted DB yet

## Transitional Web Code Adjustment
To prepare for the normalized schema without breaking the current hosted DB immediately:

`web-admin/lib/access-control.ts` was updated to:
- try reading normalized `user_roles` via:
  - `user_id`
  - `role_id`
- then resolve `role_id -> roles.code`
- if that fails, fall back to legacy:
  - `user_id`
  - `role`

That means the web app is now partially transition-ready for the normalized `user_roles` design.

## Important Current Files

### Web admin auth and shell
- `C:\dev\FlockTrax\web-admin\app\login\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\login\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\logout\route.ts`
- `C:\dev\FlockTrax\web-admin\app\auth\callback\route.ts`
- `C:\dev\FlockTrax\web-admin\app\reset-password\page.tsx`
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`
- `C:\dev\FlockTrax\web-admin\lib\suppabase\server.ts`

Note:
- the actual file path is `lib/supabase/server.ts`
- this checkpoint line above is only descriptive; use the real path below when editing:
  - `C:\dev\FlockTrax\web-admin\lib\supabase\server.ts`

### User access and security logic
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\lib\access-control.ts`
- `C:\dev\FlockTrax\web-admin\lib\types.ts`

### Schema and security SQL
- `C:\dev\FlockTrax\supabase\migrations\20260413113000_normalize_user_roles_role_id.sql`
- `C:\dev\FlockTrax\tmp\Security\supabase_flocktrax_securitytables_sql.txt`

## Validation Status
- `npm run typecheck` has been run repeatedly in `web-admin`
- latest typecheck passed after:
  - modal-style login
  - logout route
  - local reset-password callback flow

The very last repo change before this checkpoint was:
- adding the `user_roles` normalization migration
- adding transition logic in `web-admin/lib/access-control.ts`

That last specific change was **not yet re-verified in the browser** within this conversation after the checkpoint request arrived.

## Honest Current Gaps

### 1. Hosted DB may still be on legacy `user_roles`
Until the hosted migration is applied:
- authority resolution may still be shaky
- `is_admin()` may still rely on text role matching

### 2. User Access screen is not fully write-enabled
The UI shape is close, but not all maintenance actions are live:
- add/remove role
- add/remove memberships
- full grantor edits
- code maintenance mode writes

### 3. Invite workflow is only staged
`Invite New User` exists visually and routes into the screen flow, but a full invite/send/assign path has not been fully completed.

### 4. Login/password recovery still depends on Supabase Auth dashboard config
Without localhost callback URLs allowed in Supabase:
- reset email links won’t round-trip back into local FlockTrax cleanly

## Best Resume Point
When restarting the chat, the clean next move is:

1. Confirm whether hosted DB has applied:
   - `20260413113000_normalize_user_roles_role_id.sql`
2. If not, apply it to hosted DB
3. Re-test `/admin/user-access`
4. Confirm:
   - acting role resolution
   - visible directory users
   - editable vs restricted logic
5. Then wire real write actions for:
   - assign/remove user roles
   - assign/remove memberships

## Suggested Restart Prompt
Use something close to this in the next chat:

> Resume from `output/FlockTrax_Web_Admin_Chat_Checkpoint_2026-04-13.md`. We were fixing the hosted security model and discovered `public.user_roles` still uses a text `role` instead of `role_id` FK to `public.roles`. Please continue from there, verify the migration path, and keep the user-access screen honest about what is live versus staged.
