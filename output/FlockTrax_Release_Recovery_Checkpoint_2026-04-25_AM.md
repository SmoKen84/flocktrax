# FlockTrax Release Recovery Checkpoint

Date: 2026-04-25 AM
Workspace: `C:\dev\FlockTrax`

## Repo / release state

- Current git HEAD: `e541c48`
- `origin/main`: still at `e541c48`
- New local uncommitted code changes exist in:
  - `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
  - `C:\dev\FlockTrax\supabase\functions\weight-entry-get\index.ts`
- These two function changes were deployed live already even though they are not committed yet.

## What was fixed tonight

### 1. Mobile read-path bug

Problem:
- Mobile read flows were still capable of hydrating from Google Sheets during edit-open.
- That made sheet-only weight edits risky to preserve into native Supabase.

Fix applied:
- Removed Google Sheets read-before-edit fallback from:
  - `placement-day-get`
  - `weight-entry-get`
- Result:
  - mobile now reads native Supabase rows only
  - save path remains native Supabase
  - no mobile rebuild was required for this backend fix

Deployment:
- `placement-day-get` deployed to hosted Supabase project `frneaccbbrijpolcesjm`
- `weight-entry-get` deployed to hosted Supabase project `frneaccbbrijpolcesjm`

## Data recovery completed

### 283-S2

Confirmed in Supabase:
- `2026-04-20` male avg weight `4.54`
- `2026-04-22` male avg weight `5.00`

### 284-W4

Inserted into `public.log_weight`:
- `2026-04-15` male avg weight `4.80`
- `2026-04-15` female avg weight `4.619`
- `2026-04-20` male avg weight `4.92`
- `2026-04-20` female avg weight `4.224`

Verification:
- These weights were confirmed to retrieve correctly in the app after insertion.

## Admin web deploy state

Findings:
- `admin.flocktrax.com` existed and responded, but earlier showed an older splash/version presentation.
- Local `web-admin` code clearly contains the newer splash/sidebar/version-era UI.
- Local `web-admin` production build passed successfully via `npm run build`.

Production deploy performed:
- Vercel production deployment executed from:
  - `C:\dev\FlockTrax\web-admin`
- Deployment id:
  - `dpl_5FKc44R8aK9kMcuSAgQ4PsLLKrjP`

Important note:
- The splash/version text still showed:
  - `Version 1 · Build 1 · Released 2026-04-21`
- This appears to be coming from platform/splash content data, not from a failed frontend deploy.
- In other words:
  - frontend deploy succeeded
  - displayed version/build line is still stale data/content until the hosted platform content/build metadata is updated

## Reviewer auth / access findings

### Reviewer user discovered

Supabase auth user exists:
- email: `reviewme@mothercluckershenhouse.com`
- user id: `bc3ad0bd-ef41-4bf8-ab5f-20bddac1a901`
- full name: `John Q. Farmer`

Meaning:
- reviewer account already exists in auth
- email limit does **not** block progress completely
- password can be set directly through Supabase admin if needed, bypassing more invite/reset emails

### Your login findings

- Production login for your own account initially returned:
  - `Invalid login credentials`
- After password reset / retry, you regained access successfully.
- This suggests production auth is functional and the earlier issue was credential-state related, not total auth failure.

### Access-control UI bug found

Observed issue:
- In `User Access Control`, clicking the upper-right button caused the selected target/grant panel to appear to swap users.
- The page then showed:
  - `The target role is equal to or higher than the acting user.`
- Sidebar/auth identity still indicated the authenticated user was unchanged.

Likely cause:
- UI/state fallback bug in `web-admin/app/admin/user-access/page.tsx`
- `selectedTarget` can silently fall back to another visible user on rerender/navigation
- acting user is still derived from actual auth session
- so this looked like a grantor swap, but was most likely a target-selection swap

Operational guidance:
- avoid further risky clicking in User Access until patched
- explicitly reselect the intended user
- prefer production site only, not localhost, for reviewer testing

## Production vs localhost auth lesson

Key discovery:
- reviewer/account testing done from localhost can generate misleading auth redirect behavior
- production reviewer/auth testing should be done from:
  - `https://admin.flocktrax.com`
- not from:
  - `http://localhost:3001`

Reason:
- invite/reset actions build callback origin from request/app origin
- local admin testing can therefore create local/dev-flavored auth flows

## Immediate next best actions when resuming

1. Start at `https://admin.flocktrax.com`
2. Log in with your working production admin account
3. Do **not** use localhost for reviewer testing
4. Either:
   - set a password directly for `reviewme@mothercluckershenhouse.com` via Supabase admin, or
   - wait for email rate limit reset and do a clean production reset flow
5. Re-test reviewer login in production
6. If App Store Connect metadata was wiped again, reuse the prepared copy from prior notes/chat
7. After release pressure is off:
   - commit the two Supabase function fixes back into git
   - patch the User Access target-selection bug
   - later design the cleaner `log_observations` model

## Files most relevant on resume

- `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\weight-entry-get\index.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\actions.ts`
- `C:\dev\FlockTrax\output\FlockTrax_Release_Submission_Checkpoint_2026-04-24_AM.md`

## Safety note

No further data edits should be needed for the recovered weight records listed above unless you discover additional sheet-only historical entries.
