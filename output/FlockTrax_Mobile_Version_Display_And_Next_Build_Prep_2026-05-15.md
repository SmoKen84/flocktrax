# FlockTrax Mobile Version Display And Next Build Prep

Date: 2026-05-15
Workspace: `C:\dev\FlockTrax`
Working commit: `d68dbbd`

## Summary

This checkpoint captures the mobile-version display work and the state of the next mobile release prep after:

- converting `platform.control.version` from numeric to text
- updating hosted mobile release rows to real semantic version strings
- wiring the dashboard API to return the platform-specific published mobile release marker
- wiring the mobile app to display that hosted release marker on the dashboard
- removing the stale hardcoded mobile release footer text from the login screen
- deploying the backend support needed for the mobile apps to read the hosted release marker

## Database / Hosted Version Control

Applied manually in Supabase SQL editor:

- `supabase/migrations/20260515113000_platform_control_version_to_text.sql`
- `supabase/migrations/20260515114500_bump_mobile_release_1_0_2_text_versions.sql`

Expected current hosted values:

- `mobile_ios`
  - `version = '1.0.2'`
  - `build = 13`
  - `released = '2026-05-15'`
- `mobile_droid`
  - `version = '1.0.2'`
  - `build = 7`
  - `released = '2026-05-15'`

## Code Changes Made

### Backend

Deployed:

- `supabase/functions/dashboard-placements-list/index.ts`

Behavior added:

- reads `X-Mobile-Platform` request header
- maps `ios -> mobile_ios`
- maps `android -> mobile_droid`
- returns platform-specific hosted release fields in dashboard `settings`

Settings payload now includes:

- `mobile_release_version`
- `mobile_release_build`
- `mobile_release_released`

### Mobile

Changed files:

- `mobile/src/api/http.ts`
- `mobile/src/types.ts`
- `mobile/src/screens/DashboardScreen.tsx`
- `mobile/src/screens/LoginScreen.tsx`

Behavior added:

- mobile requests now send `X-Mobile-Platform: ios|android`
- dashboard settings type now includes hosted mobile release fields
- dashboard shows a published-release line such as:
  - `Published iPhone | v1.0.2 | Build 13 | 2026-05-15`
  - `Published Android | v1.0.2 | Build 7 | 2026-05-15`
- stale hardcoded login footer release/build text was removed

## Verification Completed

- `mobile` typecheck passed:
  - `npm run typecheck`
- backend function deployed:
  - `supabase functions deploy dashboard-placements-list`

## Current Expo / EAS Release Configuration

From `mobile/eas.json`:

- `cli.appVersionSource = remote`
- `build.production.autoIncrement = true`

Meaning:

- EAS controls the platform build counters remotely
- local `ios.buildNumber` and `android.versionCode` in `mobile/app.json` are not authoritative for production releases
- the important local version field for release labeling is `expo.version`

Current local marketing version in `mobile/app.json`:

- `1.0.2`

## Important Release Note

The next mobile build requires a conscious decision on the next marketing version:

- keep `1.0.2` and generate a higher remote build number, or
- bump to `1.0.3` before building

Because `1.0.2` is already the current store/test line, the likely cleaner next step is to bump to `1.0.3` if these fixes are intended as the next externally visible release.

## Suggested Next Build Sequence

1. Decide the next marketing version.
   - likely candidate: `1.0.3`
2. Update `mobile/app.json`
   - `expo.version`
3. Update `platform.control`
   - `mobile_ios`
   - `mobile_droid`
4. Run mobile typecheck again.
5. Build iOS production:
   - `cd C:\dev\FlockTrax\mobile`
   - `npx eas-cli@latest build -p ios --profile production`
6. Build Android production:
   - `cd C:\dev\FlockTrax\mobile`
   - `npx eas-cli@latest build -p android --profile production`
7. After build completion, record the new remote build numbers and artifact links.

## Resume Prompt

When resuming, the next practical move is:

1. choose whether the next mobile release should remain `1.0.2` or become `1.0.3`
2. if `1.0.3`, update `mobile/app.json`
3. then build both platforms with EAS production profiles
