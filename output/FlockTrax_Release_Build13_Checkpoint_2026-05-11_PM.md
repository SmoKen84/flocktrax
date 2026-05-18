# FlockTrax Release Build 13 Checkpoint

Date: `2026-05-11 PM`

## Snapshot

This checkpoint marks the current release baseline after:
- committing the release work to the repo
- rebuilding the admin console from repo state
- cutting and submitting the next iOS build

## Repo State

Latest release-related commits:
- `e9fd35e` — `Stabilize release flows and admin operations tooling`
- `d68dbbd` — `Clean admin repo state and ignore local env`

Important repo outcome:
- `web-admin/.env` is no longer tracked
- local admin secrets and TypeScript build cache are now excluded from version control
- fresh repo-backed admin deployment was built after that cleanup

## Live Admin State

Production admin web is live on:
- [https://flocktrax.com](https://flocktrax.com)

Current live highlights:
- Action Items console is live
- custom invite email from `no-reply@flocktrax.com` is working
- existing-user password setup/reset flow is working
- super-admin-only delete user flow is live
- privacy and delete-account public pages are live

## iOS Release State

Current iOS build:
- version: `1.0.2`
- build number: `13`

EAS build:
- [dd90e3e9-f1bb-4e9b-ad1b-f3d405c9349c](https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/dd90e3e9-f1bb-4e9b-ad1b-f3d405c9349c)

IPA artifact:
- [download IPA](https://expo.dev/artifacts/eas/tmSK4btQxtk2CRacWqyd2S.ipa)

App Store Connect submission:
- [d987fae9-3fde-4e04-a5b1-e743c4051e45](https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/d987fae9-3fde-4e04-a5b1-e743c4051e45)

App Store Connect / TestFlight:
- [https://appstoreconnect.apple.com/apps/6763434225/testflight/ios](https://appstoreconnect.apple.com/apps/6763434225/testflight/ios)

Status at checkpoint:
- uploaded successfully
- submitted successfully
- waiting on Apple processing / TestFlight availability

## Admin Validation Goal

Use the fresh live repo-backed admin build to verify:
- Action Items workflow
- User Access invite flow
- existing-user password setup path
- feed-ticket admin workflow
- dashboard links into Action Items

## Mobile Validation Goal

Use TestFlight build `13` to verify:
- login
- lock / unlock popup flow
- expired-session reauth flow
- daily log save
- mortality save
- weight save
- feed-ticket save

## Android Next

Once admin and TestFlight validation are clean:
- move directly to Android production build and Play Store publication

## Remaining Local-Only Files Not In Repo

These were intentionally left out of the repo snapshot:
- `supabase/.temp/cli-latest`
- `mobile/dist-ios-releasecheck/`
- `mobile/dist-store-releasecheck/`
- `backups/`
- `toolkit/sync_engine/flocktrax-sync.ini`
- `toolkit/sync_engine/__pycache__/`
- `alphaBU.bat`

## Recommended Resume Prompt

`Use the Build 13 release checkpoint, validate the fresh live admin build and TestFlight build 13, then move to Android Play Store release.`
