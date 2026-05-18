# FlockTrax User Access And Mobile Stability Checkpoint

Date: 2026-05-15

## Current production/backend state

- The mortality save incident that looked like a JWT/session expiration was traced to a permission-path mismatch, not an auth persistence failure.
- Root cause:
  - the mobile app was sending grading fields on mortality save even when all values were `null`
  - the backend interpreted that as a grading edit
  - users without grading permission received `403`
  - the mobile client mislabeled the `403` as an expired JWT/session
- Production backend hotfix was deployed to:
  - `C:\dev\FlockTrax\supabase\functions\placement-day-submit\index.ts`
- Result:
  - non-grading users can save mortality without being bounced to login when no real grading edit is being attempted
  - actual unauthorized grade edits should still be blocked

## Current mobile app release/version state

- App Store submission:
  - iOS version `1.0.2`
  - build `13`
- Play build created and ready:
  - Android version `1.0.2`
  - versionCode `7`
- `platform.control.version` was converted from numeric to text so real semantic versions can be stored.
- Current release values were updated to:
  - `mobile_ios` -> `1.0.2`, build `13`
  - `mobile_droid` -> `1.0.2`, build `7`
- Mobile version plumbing is prepared locally so the next mobile cut can display the hosted published version/build on the dashboard.
- `dashboard-placements-list` backend support for platform-aware version display is already deployed.

## Current user access findings

- A new farm group such as `Joyce` did not appear in the User Access membership dropdowns because the screen was building its group/farm option list from existing user memberships instead of the master farm-group/farm registry.
- That meant a newly created group with no memberships yet could not be selected from the User Access screen at all.

## Local web-admin fixes now completed

These changes are in local code and passed typecheck. They are not deployed yet.

### 1. Farm group / farm assignment options fixed

- User Access now sources available farm groups and farms from the real registry instead of only from already-assigned memberships.
- Scope filtering for the acting grantor is still preserved.
- Result:
  - new groups like `Joyce` should become assignable immediately

Files:
- `C:\dev\FlockTrax\web-admin\lib\types.ts`
- `C:\dev\FlockTrax\web-admin\lib\access-control.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`

### 2. Hard delete replaced with safer retire/disable model

- The super-admin destructive delete path on the User Access screen was replaced with a retire/disable flow.
- New behavior:
  - remove live `user_roles`
  - remove live `farm_memberships`
  - remove live `farm_group_memberships`
  - preserve the auth user UUID for audit continuity
  - disable sign-in using Supabase admin `ban_duration`
- The UI now requires typing `RETIRE` instead of `DELETE`.
- Intent:
  - preserve historical references and attribution continuity
  - avoid wiping identity rows behind operational history

Files:
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`

### 3. Invite recovery / resend setup link added

- A new selected-user action now sends a fresh password setup link for invite-pending users.
- This is intended to solve the expired invite-link support problem directly from the User Access screen.
- The button appears only when:
  - the acting user can manage the selected user
  - the selected user is not self
  - the selected user is still invite-pending
  - the selected user is not retired/disabled

Files:
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`

### 4. User activity/status language improved

- User tiles now show a small activity line such as:
  - `Last active ...`
  - `No sign-in recorded yet`
  - `Sign-in disabled`
- The selected user panel now shows:
  - a clearer activity line
  - a state explanation
  - a secondary note when useful
- Invite-pending and retired users now read much more clearly than before.

Files:
- `C:\dev\FlockTrax\web-admin\lib\types.ts`
- `C:\dev\FlockTrax\web-admin\lib\access-control.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Typecheck

- `web-admin` typecheck passed after these user-access changes.

Command run:

```powershell
cd C:\dev\FlockTrax\web-admin
npm run typecheck
```

## Files touched in this pass

- `C:\dev\FlockTrax\web-admin\lib\types.ts`
- `C:\dev\FlockTrax\web-admin\lib\access-control.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Deployment status

### Already live

- `placement-day-submit` backend hotfix for the mortality/grading permission incident
- `dashboard-placements-list` backend platform-version support
- earlier dashboard/placement/derived-alert production work from prior passes

### Local only right now

- user-access farm-group/farm option fix
- retire user access flow
- resend setup link action
- clearer user activity/invite status presentation

## Recommended next step

1. QA `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx` locally with:
   - an invite-pending user
   - an active user
   - a retired user
   - a new farm group like `Joyce`
2. If the behavior reads well, deploy `web-admin` so the new support tooling is live on `flocktrax.com`.

## Resume prompt

Resume from the User Access improvements completed on 2026-05-15:
- Joyce/new farm groups should now appear in User Access assignment dropdowns
- destructive delete was replaced with retire/disable
- resend setup link exists for invite-pending users
- user tiles/panel now show clearer activity and invite state
- `web-admin` typecheck passed
- next step is local QA and then deploy if approved
