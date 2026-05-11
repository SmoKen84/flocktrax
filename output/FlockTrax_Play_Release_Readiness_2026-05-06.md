# FlockTrax Play Release Readiness

Date: 2026-05-06
Timezone: America/Chicago
Track: Android / Google Play

## Repo State Confirmed

- Mobile project root: `C:\dev\FlockTrax\mobile`
- Expo SDK: `54.0.0`
- React Native: `0.81.5`
- App version: `1.0.1`
- Android package: `com.flocktrax.mobile`
- Android versionCode in app config: `4`
- EAS config uses remote app version source and production auto-increment
- Current local Node: `v22.22.2`
- Current local npm: `10.9.7`

## Android Build Compliance Status

- Google Play now requires new apps and updates to target Android 15 / API 35 or higher.
- Expo SDK 54 targets Android API 36 by default, so the current SDK line is compatible with the Play target API requirement.
- App already has an in-app `Delete Account` flow on the dashboard.
- Mobile typecheck passed on `2026-05-06`:
  - `npx tsc --noEmit`

## Repo Cleanup Completed In This Session

- Blocked unneeded Android manifest permissions in:
  - `C:\dev\FlockTrax\mobile\app.json`
- Permissions now explicitly removed from the generated manifest:
  - `android.permission.SYSTEM_ALERT_WINDOW`
  - `android.permission.READ_EXTERNAL_STORAGE`
  - `android.permission.WRITE_EXTERNAL_STORAGE`

Reason:
- these permissions were appearing in Expo introspection output
- no app code usage was found that justified keeping them
- reducing unnecessary permissions should make Play review cleaner

## Remaining Play Store Blockers / Unknowns

### 1. Privacy policy URL still needs to be confirmed

- `https://flocktrax.com` is live
- `https://admin.flocktrax.com` is live
- `https://flocktrax.com/privacy` returned `404`
- no clear Play-ready privacy policy page was found in the repo audit

This is likely still required before production submission.

### 2. Play Console app setup still needs to be completed

Need to confirm in Play Console:

- app created for package `com.flocktrax.mobile`
- app category
- contact email
- store listing copy
- screenshots
- feature graphic
- countries/regions
- content rating questionnaire
- Data safety form
- app access instructions if login is required

### 3. Production-access path depends on Play developer account type

If the Play developer account is a personal account created after `2023-11-13`, Google requires:

- a closed test
- at least 12 opted-in testers
- 14 continuous days before applying for production access

If the account is older or is an organization account, this may not apply.

### 4. Android first submission path still needs to be executed

- build production Android AAB with EAS
- upload first Android release manually in Play Console
- after the first manual upload, EAS submit automation can be added

## Recommended Next Steps

1. Confirm whether the Play Console account is:
   - organization
   - older personal account
   - newer personal account subject to the 12-testers / 14-days rule
2. Publish or identify a public privacy policy URL for FlockTrax.
3. Confirm a public account-deletion support URL if the Play Data safety form asks for a web deletion resource.
4. Create the Play Console app for `com.flocktrax.mobile` if it does not already exist.
5. Prepare store assets:
   - short description
   - full description
   - phone screenshots
   - app icon / feature graphic
6. Build the first Android production bundle:
   - `cd C:\dev\FlockTrax\mobile`
   - `npx eas-cli@latest build --platform android --profile production`
7. Manually upload the first `.aab` to Play Console.
8. Complete:
   - App content
   - Data safety
   - content rating
   - app access
9. If required by account type, start the closed test instead of production.

## Important References

- mobile app config:
  - `C:\dev\FlockTrax\mobile\app.json`
- EAS config:
  - `C:\dev\FlockTrax\mobile\eas.json`
- current release checkpoint:
  - `C:\dev\FlockTrax\output\FlockTrax_Release_Lightweight_Checkpoint_2026-05-05.md`
- prior App Store / Play checkpoint:
  - `C:\dev\FlockTrax\output\FlockTrax_Release_AppStore_Play_Checkpoint_2026-04-23_PM.md`

