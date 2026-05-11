# FlockTrax Release / App Store / Play Checkpoint

Date: 2026-04-23 PM

## Release state

- Repo root: `C:\dev\FlockTrax`
- Release commit: `e541c48`
- Release tag: `admin-v1.03-mobile-v1.0.1-b4-2026-04-23`
- Pushed to `origin/main`: yes
- Tag pushed: yes

## Version/builds locked for this release

- Admin:
  - `Version 1`
  - `Build 3`
- Mobile:
  - app version `1.0.1`
  - iOS build `4`
  - Android versionCode `4`

## Release files changed in the final commit

- `C:\dev\FlockTrax\mobile\app.json`
- `C:\dev\FlockTrax\supabase\migrations\20260423170000_bump_admin_and_mobile_release_builds.sql`
- `C:\dev\FlockTrax\web-admin\app\admin\layout.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\user-access\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\globals.css`
- `C:\dev\FlockTrax\web-admin\app\page.tsx`
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`
- `C:\dev\FlockTrax\web-admin\lib\access-control.ts`
- `C:\dev\FlockTrax\web-admin\lib\types.ts`

## Verification completed

- Admin build:
  - `cd C:\dev\FlockTrax\web-admin`
  - `npm run build`
  - passed
- Mobile typecheck:
  - `cd C:\dev\FlockTrax\mobile`
  - `npx tsc --noEmit`
  - passed
- Mobile export smoke check:
  - `npx expo export --platform all --output-dir dist-store-releasecheck`
  - passed

## Admin UI status at checkpoint

- Sidebar stretch/zoom issue fixed by changing the sidebar shell to flex-column and removing forced viewport min-height.
- Sidebar tightened vertically.
- Sidebar version strip added above the sidebar.
- Sidebar footer now shows across the admin system, not just splash.
- Sidebar date/time changed to white and made larger/bold.
- Sidebar footer text changed to white.
- Sidebar copyright now splits after `All Rights Reserved.` via helper rendering.
- User Access screen now includes `Security Validation`:
  - `User Can`
  - `User Cannot`
  - based on assigned roles + permission catalog
- Security Validation panel moved to the bottom of the live edit flow.
- Selected-user status pill issue fixed by pinning the pill in the target card.

## Platform release DB note

- Repo migration created:
  - `C:\dev\FlockTrax\supabase\migrations\20260423170000_bump_admin_and_mobile_release_builds.sql`
- This still needs to be applied to the hosted DB if you want `platform.control` live display to match the release immediately.

## App Store / Play submission status

### What was attempted

- Ran:
  - `npx eas-cli@latest login`
  - `npx eas-cli@latest build -p ios --profile production`
- EAS updated `eas.json` successfully to:
  - `"appVersionSource": "remote"`
  - production `"autoIncrement": true`

### Current blocker

- `eas-cli` crashed during interactive project-creation prompt while running under:
  - Node `v24.13.1`
  - npm `11.8.0`
- Strong suspicion: EAS prompt compatibility problem on Node 24.

### Recommended next step after restoring session

Install Node 22 LTS directly from nodejs.org, then:

```powershell
node -v
npm -v
cd C:\dev\FlockTrax\mobile
npx eas-cli@latest login
npx eas-cli@latest build -p ios --profile production
```

Preferred answer when prompted:

- Use remote app version source: already set
- Create EAS project automatically: `Y`
- Let EAS manage credentials/provisioning where possible
- For provisioning profile: `Distribution` -> `App Store Connect`
- Bundle ID must remain: `com.flocktrax.mobile`

## Current key config files

- Mobile app config:
  - `C:\dev\FlockTrax\mobile\app.json`
- EAS config:
  - `C:\dev\FlockTrax\mobile\eas.json`
- Admin release migration:
  - `C:\dev\FlockTrax\supabase\migrations\20260423170000_bump_admin_and_mobile_release_builds.sql`

## Important local-only files deliberately not committed

- `C:\dev\FlockTrax\web-admin\.env`
- `C:\dev\FlockTrax\supabase\.temp\cli-latest`
- `C:\dev\FlockTrax\web-admin\tsconfig.tsbuildinfo`
- local screenshots, exports, caches, backups, helper BAT files

## Resume instruction

When the terminal/chat returns after Node install:

1. Verify Node is `v22.x`
2. Re-run EAS iOS login/build from `C:\dev\FlockTrax\mobile`
3. Walk through provisioning / credentials prompts
4. Submit iOS build
5. Then repeat the same release flow for Android / Google Play
