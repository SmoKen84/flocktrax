# FlockTrax Apple Review Login Investigation Checkpoint

Date: April 28, 2026  
Context: iOS submission `1.0.1 (7)` was rejected by Apple under `Guideline 2.1(a) - Performance - App Completeness` for a login-stage error.

## Apple Review Finding

Apple reported:

- `The app displayed an error message during login.`

Submission details from App Store Connect:

- App: `FlockTrax-Mobile`
- Version/build under review: `1.0.1 (7)`
- Rejection date shown: April 28, 2026

## What We Verified

### 1. The app/backend wiring is correct in principle

The compiled mobile app sends requests to Supabase Edge Functions, not to a local server.

Relevant config:

- `C:\dev\FlockTrax\mobile\src\api\config.ts`
- default API base URL:
  - `https://frneaccbbrijpolcesjm.supabase.co/functions/v1`

So `Save Log`, login, profile load, dashboard load, etc. all go to the hosted Supabase project.

### 2. The likely login chain is:

From mobile `handleLogin(...)`:

1. `auth-login`
2. `auth_me`
3. `dashboard-placements-list`

Relevant files:

- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\supabase\functions\auth-login\index.ts`
- `C:\dev\FlockTrax\supabase\functions\auth_me\index.ts`
- `C:\dev\FlockTrax\supabase\functions\dashboard-placements-list\index.ts`

Important note:

- the login screen currently treats any thrown failure in that whole chain as a login failure
- however, the fresh-session repro below strongly suggests the first step itself failed with bad credentials

### 3. Fresh-session test result

We reproduced on a fresh Expo Go session after reconnecting the app:

- app reached the FlockTrax login screen
- using the reviewer credentials immediately returned:
  - `Invalid login credentials`

This is important because it points to `auth-login` / Supabase password auth rejecting the credentials directly, rather than only a post-login dashboard bootstrap problem.

### 4. Historical reviewer-account behavior remains suspicious

Earlier observed pattern:

1. Invite / first password setup through Supabase did **not** reliably produce a working FlockTrax login.
2. Sending a later password reset and setting a new password **did** produce a working login afterward.

That pattern suggests the reviewer account/password lifecycle is not trustworthy enough yet, even if it appeared to work during Saturday-night testing.

### 5. Password-reset retest could not be completed tonight

We attempted to retest the reset flow, but hit the Supabase daily email limit.

Result:

- no further password reset emails can be sent tonight
- this blocked completion of the fresh reset -> immediate mobile login verification loop

### 6. Desktop reset-link result was inconclusive

A reset-password link opened on the computer appeared to land at the FlockTrax splash screen and then stall.

However:

- that test was done on desktop/browser because the review mailbox was not available on the phone at that moment
- so it is **not** definitive proof of the phone-side recovery flow

### 7. Network/Expo noise was investigated but is not the main issue

There was substantial iPhone network noise tonight:

- Orbi access-control interference
- captive portal / `captive.apple.com` weirdness
- Safari local-server failures
- Expo LAN issues
- tunnel-mode install friction

But despite that noise, we still obtained the key auth signal:

- fresh-session reviewer login returned `Invalid login credentials`

So the current main issue is still reviewer auth reliability, not the save-path fixes or general mobile functionality.

## Current Best Diagnosis

Most likely root problem:

- the reviewer account/password state is not reliably valid at the moment Apple uses it

Most likely technical layer:

- Supabase password auth / reviewer credential lifecycle

Less likely, but still worth remembering:

- login-stage bootstrap flow is still brittle because auth, profile load, and dashboard load are chained together

## What Is *Not* The Problem

Not indicated by current evidence:

- mobile save permission fixes
- mortality history popup work
- local Expo dev server requirements for the released binary
- lack of a traditional always-running local server

## Recommended Next Steps

1. Resolve the Supabase email limit problem:
   - increase/reset limit if possible, or
   - switch to a mail path that is not quota-blocked, or
   - set the reviewer password directly through Supabase admin without email

2. Set one brand-new reviewer password and record it exactly.

3. Immediately test that exact password on a fresh mobile session on a clean device.

4. If successful, update Apple with the final verified reviewer credentials and request re-review.

5. Longer-term:
   - separate `auth-login` failures from post-login bootstrap failures in mobile error handling
   - harden invite/reset/reviewer onboarding flow

## Resume Point

Resume from:

- direct reviewer password reset/set
- fresh-device mobile login retest
- then App Review response

