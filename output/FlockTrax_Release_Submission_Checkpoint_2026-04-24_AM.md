# FlockTrax Release Submission Checkpoint

Date: 2026-04-24 AM

## Repo release state

- Workspace: `C:\dev\FlockTrax`
- Release commit: `e541c48`
- Release tag: `admin-v1.03-mobile-v1.0.1-b4-2026-04-23`
- `origin/main` pushed: yes
- tag pushed: yes

## Locked release versions

- Admin platform release target:
  - `Version 1`
  - `Build 3`
- Mobile app version:
  - `1.0.1`
- Mobile remote build numbers actually used by EAS:
  - iOS: `5`
  - Android: `5`

Important:
- local `app.json` still shows iOS/Android build `4`
- because EAS was switched to remote version source with auto-increment, the actual submitted store builds became `5`

## Key files in this release

- `C:\dev\FlockTrax\mobile\app.json`
- `C:\dev\FlockTrax\mobile\eas.json`
- `C:\dev\FlockTrax\supabase\migrations\20260423170000_bump_admin_and_mobile_release_builds.sql`
- `C:\dev\FlockTrax\web-admin\app\admin\layout.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\web-admin\app\page.tsx`
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`
- `C:\dev\FlockTrax\web-admin\lib\access-control.ts`
- `C:\dev\FlockTrax\web-admin\lib\types.ts`

## Verification completed before stopping

- Admin:
  - `cd C:\dev\FlockTrax\web-admin`
  - `npm run build`
  - passed repeatedly after final sidebar/security changes

- Mobile:
  - `cd C:\dev\FlockTrax\mobile`
  - `npx tsc --noEmit`
  - passed
  - `npx expo export --platform all --output-dir dist-store-releasecheck`
  - passed

## Admin UI state at checkpoint

- Sidebar stretch/zoom issue fixed
- Sidebar spacing tightened and made more compact
- Sidebar version line added above sidebar
- Shared sidebar footer added across admin routes, not just splash
- Sidebar date/time:
  - white
  - larger
  - bold
- Sidebar version label above the sidebar changed to dark brown
- Sidebar footer copyright renderer now splits after `All Rights Reserved.` case-insensitively
- `Rollups` and `Reports` are grayed out
- User Access has:
  - `Security Validation`
  - `User Can`
  - `User Cannot`
  - moved to the bottom of the live edit flow

## Platform DB note

- Repo contains migration:
  - `C:\dev\FlockTrax\supabase\migrations\20260423170000_bump_admin_and_mobile_release_builds.sql`
- If you want the live `platform.control` display to reflect this release immediately, that migration still needs to be applied to the hosted database.

## iOS / App Store status

### EAS / Expo

- Node 24 caused `eas-cli` interactive prompt crashes
- fixed by installing Node 22 LTS
- final working local versions:
  - `node -v` -> `v22.22.2`
  - `npm -v` -> `10.9.7`

### EAS iOS build

- Command used:
```powershell
cd C:\dev\FlockTrax\mobile
npx eas-cli@latest login
npx eas-cli@latest build -p ios --profile production
```

- Build finished successfully
- EAS build ID:
  - `4e61f7a3-308a-4ffe-b392-06ee361a2275`
- Artifact:
  - `https://expo.dev/artifacts/eas/aFofwHubTjbZKLmuzm7cxk.ipa`
- Build page:
  - `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/4e61f7a3-308a-4ffe-b392-06ee361a2275`

### Apple credentials created/used

- Distribution Certificate:
  - Serial: `74291051C9F549791E4A3EF1E93C03CE`
  - Team: `9A84FQ5HX3`
  - Expires: `2027-04-23`

- Provisioning Profile:
  - ID: `7WJZQA27CT`
  - Team: `9A84FQ5HX3`
  - Status: `active`
  - Expires: `2027-04-23`

### EAS iOS submit

- Command used:
```powershell
eas submit --platform ios
```

- Chose:
  - `Select a build from EAS`
  - build ID `4e61f7a3-308a-4ffe-b392-06ee361a2275`

- Apple login succeeded:
  - Apple ID used: `ken@mothercluckershenhouse.com`
  - Team: `Smotherman Farms, LTD (9A84FQ5HX3)`
  - Provider: `127876343`

- App Store Connect API key was created by EAS:
  - Key ID: `W9572DMP42`
  - Name: `[Expo] EAS Submit S8sRjgyqDX`

- ASC App ID:
  - `6763434225`

- Submission succeeded
- Submission page:
  - `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/0c6caea6-e1ab-4dcf-a187-565266fd1be8`

### Current App Store Connect state

- Binary uploaded successfully
- Apple processing finished
- The next step was to:
  1. open App Store Connect
  2. open app `FlockTrax`
  3. go to `App Store`
  4. open/create version `1.0.1`
  5. attach build `1.0.1 (5)`
  6. complete metadata / screenshots / privacy / review notes
  7. `Add for Review`
  8. `Submit for Review`

## Android / Google Play status

### EAS Android build

- Command used:
```powershell
npx eas-cli@latest build -p android --profile production
```

- EAS remote Android credentials were created
- Android keystore was generated in the cloud
- Build finished successfully

- Build ID:
  - `ce22d781-7ca8-44e8-97b6-009890f79de6`
- Artifact:
  - `https://expo.dev/artifacts/eas/rsn9ZMR7g7em4vhyN7RsbS.aab`
- Build page:
  - `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/ce22d781-7ca8-44e8-97b6-009890f79de6`

### Google Play submit blocker

- `eas submit -p android` wants a Google Play service account JSON key
- That key was not created yet
- Important distinction:
  - this is **not** `google-services.json`
  - it is a Google Cloud service account JSON key used for Play API access

### Current Google Play console state

- Developer account exists
- Verification/setup is still underway
- screenshot showed `Settings` page with:
  - no visible `API access`
- likely reasons discussed:
  - developer verification not fully finished
  - or account owner-only menu not yet available

- User said:
  - the app record is not created yet in Play Console

### Practical next move for Android

Do not block on service-account JSON.

After returning:
1. Create the app manually in Google Play Console:
   - `Create app`
   - name `FlockTrax`
   - `App`
   - probably `Free`
2. Use manual upload path with the already built `.aab`
3. Go to:
   - `Testing` -> `Internal testing`
   - create release
   - upload the `.aab`
4. Complete:
   - store listing
   - app access
   - privacy policy
   - data safety
   - content rating

Service-account JSON can be revisited later once Play Console setup/verification is complete.

## App Review / Store text state

Prepared App Review guidance already exists in chat:
- iOS reviewer note text
- Google Play short/full descriptions
- Android/iOS release checklists

## Local environment notes

- Node 22 is now the working version for EAS
- local-only files intentionally not committed include:
  - `C:\dev\FlockTrax\web-admin\.env`
  - `C:\dev\FlockTrax\supabase\.temp\cli-latest`
  - `C:\dev\FlockTrax\web-admin\tsconfig.tsbuildinfo`
  - local exports, screenshots, helper scripts, backups

## Best resume point after reboot

1. Verify Node:
```powershell
node -v
npm -v
```

2. Finish iOS App Store Connect submission:
   - attach build `1.0.1 (5)`
   - complete metadata
   - submit for review

3. Create Google Play app record manually

4. Upload Android `.aab` manually from:
   - `https://expo.dev/artifacts/eas/rsn9ZMR7g7em4vhyN7RsbS.aab`

5. Complete Play Console setup fields
