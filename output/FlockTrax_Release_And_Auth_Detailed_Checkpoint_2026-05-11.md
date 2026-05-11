# FlockTrax Release And Auth Detailed Checkpoint

Date: `2026-05-11`

Purpose:
- capture the current release-ready state after the Action Items console push
- document the working custom invite email flow and reset-password fixes
- preserve the exact mobile release-hardening state before the next build cycle
- define the next concrete steps for iOS patch readiness and Android publication

## Current Headline State

- `web-admin` is live on [https://flocktrax.com](https://flocktrax.com)
- iOS App Store release `1.0.1 (10)` is already approved and live
- mobile `1.0.2` source contains post-release fixes that still need final release hardening
- Action Items console is live and materially usable in admin
- custom invite email now sends from `no-reply@flocktrax.com`
- re-inviting an already-known auth user now works and lands them on a usable password set/reset path
- Android/Play remains the main store-release track still to be pushed through

## Live URLs

- site root: [https://flocktrax.com](https://flocktrax.com)
- admin overview: [https://flocktrax.com/admin/overview](https://flocktrax.com/admin/overview)
- action items console: [https://flocktrax.com/admin/issues](https://flocktrax.com/admin/issues)
- action type maintenance: [https://flocktrax.com/admin/issues/types](https://flocktrax.com/admin/issues/types)
- user access control: [https://flocktrax.com/admin/user-access](https://flocktrax.com/admin/user-access)
- privacy policy: [https://flocktrax.com/privacy](https://flocktrax.com/privacy)
- delete-account support: [https://flocktrax.com/delete-account](https://flocktrax.com/delete-account)

## Action Items Status

The Action Items console is live and no longer just scaffold.

Current state:
- naming is `Action Items`
- mockup-style console layout is in place
- filter band is horizontal under the title block
- left pane is the action-item list
- right pane is update history
- lower pane acts as detail / edit / update / resolve workspace
- dashboard placement-tile open-item pill links into the console with preloaded `farm`, `barn`, and `open` status
- resolved items are read-only and cannot be updated further
- action types are editable from the admin maintenance screen

Current important behavior:
- item type drives whether a row is treated as barn-linked or placement/flock-linked
- action-item rows now show the linked barn code or flock code under status
- `Linked to:` metadata displays in both the first-screen detail state and the edit state

Main web-admin files touched in this phase:
- `C:\dev\FlockTrax\web-admin\app\admin\issues\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\issues\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\issues\back-button.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\issues\types\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\issues\types\actions.ts`
- `C:\dev\FlockTrax\web-admin\components\active-placement-dashboard.tsx`
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`
- `C:\dev\FlockTrax\web-admin\app\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## User Access / Invite Mail Status

This area changed significantly and is now in a much better state.

### What was wrong before

- `Invite New User` relied on Supabase built-in invite mail delivery
- users were not reliably receiving those emails
- existing auth users who were invited again did not get a usable fresh password path
- custom emailed links initially landed on expired or unusable reset flows

### What is working now

- invites are generated via Supabase admin link generation
- the actual email is sent by FlockTrax through SMTP from `no-reply@flocktrax.com`
- production SMTP was configured in Vercel
- Google-hosted mailbox required an app password
- both new-user and existing-user paths are handled

### Current logic

For brand-new auth users:
- generate Supabase `invite` link
- extract `hashed_token`
- send a FlockTrax callback URL using:
  - `/auth/callback?token_hash=...&type=invite&next=/reset-password`

For existing auth users:
- generate Supabase `recovery` link
- extract `hashed_token`
- send a FlockTrax callback URL using:
  - `/auth/callback?token_hash=...&type=recovery&next=/reset-password`

### Critical auth fix

The callback route was patched so auth cookies are written onto the redirect response itself. Without that, `/reset-password` thought the reset session had already expired.

Files changed in this auth/invite phase:
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\actions.ts`
- `C:\dev\FlockTrax\web-admin\lib\email\invite-email.ts`
- `C:\dev\FlockTrax\web-admin\app\auth\callback\route.ts`
- `C:\dev\FlockTrax\web-admin\.env.example`

### Verified outcome

Latest user report:
- custom invite email arrived
- after the final callback/token-hash fixes, the flow now `works perfectly`

## User Deletion

Super-admin-only delete was added to User Access Control.

Current behavior:
- only super admins can permanently delete users
- typed confirmation is required: `DELETE`
- self-delete is blocked from this screen
- delete removes related access records and then deletes the Supabase auth user

Files changed:
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\actions.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`

## Mobile Current State

### Important implemented mobile fixes in source

- decimal-entry fix for weights and related numeric fields
- lock-in-place reauth modal path for expired session
- delete-account trigger moved away from the main tap zone and up under the user email
- `Sign Out` changed to a `Lock` flow that opens reauth in place

Main files touched:
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\WeightEntryScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\PlacementDayScreen.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\LoginScreen.tsx`
- `C:\dev\FlockTrax\mobile\app.json`
- `C:\dev\FlockTrax\mobile\package.json`

### Local Expo validation status

Important recent local validation:
- malformed/expired token handling was exercised
- reauth popup eventually behaved correctly in local Expo
- the raw JWT parser error path was normalized out of the user experience
- user asked to continue using local Expo/dev until the product feels stable enough to release

### Current release implication

Do not treat the existing public mobile binaries as final for these fixes yet.
The source is ahead of the currently published store artifacts.

## Feed Ticket Status

Important recent stabilization:
- internal voucher preview bug on admin ticket entry was fixed
- new admin internal tickets now show the next safe voucher number instead of reusing stale values like `SMO11`
- user confirmed this now `works correctly`

Key file:
- `C:\dev\FlockTrax\web-admin\app\api\feed-ticket-editor\route.ts`

## Verification Completed This Session

- multiple `npm run build` passes succeeded in `C:\dev\FlockTrax\web-admin`
- multiple Vercel production deploys completed and were aliased to `https://flocktrax.com`
- custom SMTP invite email delivery succeeded
- existing-user reset/invite path now works after callback and token-hash corrections
- user cleanup in User Access Control succeeded using the new super-admin delete flow

## Still Not Done

### Mobile release hardening

- final full mobile sweep still needed in local Expo:
  - login
  - lock / unlock popup flow
  - expired-session reauth on save
  - daily log save
  - mortality save
  - weights save
  - feed ticket save
  - mobile issue create / resolve

### iOS patch release

- once local Expo validation feels boring and stable, cut the next iOS/TestFlight candidate from current source
- after TestFlight validation, promote toward App Store patch release

### Android publication

- Play Console metadata/forms still need completion and/or final submission pass
- first production Android `.aab` upload/review path remains active work
- organization verification and console setup were already in flight earlier

## Recommended Next Step

Resume in this order:

1. local Expo mobile hardening sweep
2. cut next iOS/TestFlight build from the stabilized `1.0.2` source line
3. verify critical demo flows for the integrator presentation
4. build and push the Android production bundle / Play submission path

## Recommended Resume Prompt

If resuming from this checkpoint, load this file first and continue with:

`Use the release/auth checkpoint and continue the local Expo mobile hardening sweep for the next release build, then move to Android publication readiness.`
