# FlockTrax Mobile 1.0.3 Build 14 Submission Checkpoint

Date: `2026-05-26`  
Branch: `main`  
HEAD after release-prep commit: `b61f28226ee4b4dff8835f0e79365c281a89859d`

## Purpose

Capture the iOS mobile release cut for:

- marketing version `1.0.3`
- remote iOS build `14`
- hosted `platform.control` bump for `mobile_ios`
- EAS build and scheduled App Store Connect submission state

## Repo Release Snapshot

Release-prep commit created locally:

- `b61f282` - `Prepare mobile 1.0.3 release and checkpoint local work`

That commit includes:

- mobile `after_save_goback` flag split
- the local mobile daily-log behavior changes
- earlier local web-admin work
- May 25 and May 26 planning/checkpoint docs
- `mobile/app.json` marketing-version bump to `1.0.3`

## Mobile Versioning Decision

The next mobile release line was moved from `1.0.2` to `1.0.3`.

Reason:

- this is a new externally shipped behavior change
- prior release notes already pointed to `1.0.3` as the cleaner next public version line
- EAS production build config is already set to remote version source with auto-increment for build numbers

Relevant file:

- [app.json](C:/dev/FlockTrax/mobile/app.json)

Current marketing version in repo:

- `1.0.3`

## Local Verification

Mobile verification passed before release cut:

- `npm run typecheck` in `C:\dev\FlockTrax\mobile`

Web-admin verification warning:

- `npm run build` in `C:\dev\FlockTrax\web-admin` currently fails on `/admin/about` page-data collection
- this did not block the mobile release path
- it should still be treated as a known repo-state warning for later web-admin cleanup

## EAS Build Result

Production iOS build completed successfully.

Build details:

- EAS build id: `eaeaf577-3975-4bf3-9ee4-2dc201ddccaa`
- platform: `ios`
- profile: `production`
- distribution: `store`
- version: `1.0.3`
- build number: `14`
- commit: `b61f28226ee4b4dff8835f0e79365c281a89859d`

Build links:

- build page: [EAS iOS build 14](https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/eaeaf577-3975-4bf3-9ee4-2dc201ddccaa)
- IPA artifact: [download IPA](https://expo.dev/artifacts/eas/v1v7cjtEwzK6iBULW6rd9S.ipa)

## App Store Connect Submission State

EAS submit used the existing App Store Connect API key configuration and scheduled the iOS submission successfully.

Submission details captured in local log:

- App Store Connect API key id: `W9572DMP42`
- ASC app id: `6763434225`
- submitted build id: `eaeaf577-3975-4bf3-9ee4-2dc201ddccaa`
- submitted app version: `1.0.3`
- submitted build number: `14`

Submission link:

- [EAS submission e458cd49-f166-4ea1-a574-ae64474bde5f](https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/e458cd49-f166-4ea1-a574-ae64474bde5f)

Important note:

- the local shell timed out while waiting for completion, but EAS successfully scheduled the submission before timeout
- this checkpoint should treat the build as uploaded/scheduled through EAS
- final App Store Connect processing/review state should still be confirmed directly in Apple systems

## Hosted Mobile Release Marker

A new migration was created and applied to the linked Supabase project:

- [20260526105000_bump_mobile_ios_release_1_0_3_build_14.sql](C:/dev/FlockTrax/supabase/migrations/20260526105000_bump_mobile_ios_release_1_0_3_build_14.sql)

Applied with:

- `supabase db query --linked --file ...`
- `supabase migration repair 20260526105000 --status applied --linked`

Verified current hosted values:

- `mobile_ios`
  - version: `1.0.3`
  - build: `14`
  - released: `2026-05-26`
- `mobile_droid`
  - version: `1.0.2`
  - build: `7`
  - released: `2026-05-15`

Reason Android was left unchanged:

- only the iOS build was cut/submitted in this session
- this avoids moving the Android published marker ahead of an actual Android release

## Current Remaining Local Change After Release Prep Commit

After the release-prep commit, the only meaningful new tracked change created during release execution was:

- [20260526105000_bump_mobile_ios_release_1_0_3_build_14.sql](C:/dev/FlockTrax/supabase/migrations/20260526105000_bump_mobile_ios_release_1_0_3_build_14.sql)

Still-present non-product temp noise:

- `supabase/.temp/cli-latest`

## Recommended Immediate Next Steps

1. Commit and push the new mobile iOS release-marker migration.
2. Confirm the EAS submission finishes processing in App Store Connect.
3. If Apple requires manual version attachment / final review click-through, complete that in App Store Connect for version `1.0.3`, build `14`.
4. Later, cut the matching Android release before bumping `mobile_droid`.
