# FlockTrax Release Lightweight Checkpoint

Date: 2026-05-05
Track: Release

## Current Release State

- iOS review candidate is now `1.0.1 (10)`.
- `build 10` was submitted to Apple.
- App Store Connect status currently shows:
  - `Waiting for Review`

## What This Build Includes

- mobile account deletion flow required by Apple Guideline `5.1.1(v)`
- physical-device recording was attached showing:
  - sign in
  - navigate to delete account
  - complete delete flow
  - return to login

## Relevant Release Work Already Completed

- `auth-delete-account` Supabase Edge Function is implemented and deployed
- mobile app now exposes a `Delete Account` action on the dashboard
- delete flow requires typed confirmation: `DELETE`
- app clears session and returns to login after deletion

Key files:
- `C:\dev\FlockTrax\supabase\functions\auth-delete-account\index.ts`
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`

## Credential State

Known-good reviewer account:
- `reviewme@mothercluckershenhouse.com`
- `FlockTraxReview!2026`

Known-good throwaway/demo account used for deletion testing:
- `flocktraxuser@gmail.com`
- `FlockTrax26!`

Important note:
- invite/reset email flow has proven unreliable
- direct password setting in Supabase admin was used to stabilize accounts

## Build / Submission Notes

Successful iOS build:
- build id: `a4016b7f-485e-4ec5-ab2d-c0bd15beadc4`
- app version: `1.0.1`
- build number: `10`

Submission path:
- EAS submit reported version/build collision behavior, indicating Apple had already registered build `10`
- final App Store Connect state now reflects the real desired outcome:
  - build `10` submitted
  - review status `Waiting for Review`

## Best Next Release Step

- wait for Apple review response on `build 10`
- if rejected again, compare the new reason specifically against:
  - account deletion UX
  - reviewer access
  - live binary behavior

