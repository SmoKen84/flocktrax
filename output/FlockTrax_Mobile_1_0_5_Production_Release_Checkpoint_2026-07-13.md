# FlockTrax Mobile 1.0.5 Production Release Checkpoint

Date: `2026-07-13`
Branch: `main`
Release commit: `5e545eb2462ad8d9dfbc679ff5d7a7c1ccd644c4`

## Release Package

- marketing version: `1.0.5`
- iOS build: `17`
- Android version code: `11`
- hosted release date: `2026-07-13`
- release commit pushed to `origin/main`
- commit message: `Ship mobile 1.0.5 work orders and operations calendar`

The complete user-facing change list is recorded in:

- [FlockTrax_Mobile_1_0_5_Release_Changes_2026-07-13.md](C:\dev\FlockTrax\output\FlockTrax_Mobile_1_0_5_Release_Changes_2026-07-13.md)

Release-history baseline used for that list:

- last confirmed public iOS release: `1.0.1 (10)`, live `2026-05-06`
- last hosted Android marker before this release: `1.0.2 (7)`, dated `2026-05-15`
- no indexed evidence confirms that the earlier Android artifact reached a public Play release

## Verification

Successful local gates:

- mobile TypeScript typecheck
- Expo production export for both iOS and Android
- web-admin TypeScript typecheck
- optimized Next.js production build
- Git whitespace/error audit, with only pre-existing Markdown line-break warnings

The Next.js build retained three non-blocking autoprefixer warnings recommending
`flex-end` instead of `end` in existing CSS.

Hosted mobile dependencies confirmed active:

- `action-items-list`
- `issue-create`
- `issue-update`
- `issue-resolve`
- `operations-calendar-list`

The Action Item memo-lifecycle migration `20260712143000` is recorded remotely.

## Hosted Release Control

Verified live values in `platform.control`:

- `mobile_ios`: version `1.0.5`, build `17`, released `2026-07-13`
- `mobile_droid`: version `1.0.5`, build `11`, released `2026-07-13`

Migration:

- `20260713123000_bump_mobile_release_1_0_5.sql`
- applied directly through the hosted service client
- remote migration history repaired to `applied`

## iOS Build And Submission

Build:

- status: `FINISHED`
- EAS build id: `77fa3b88-cf7e-40fb-8213-c7617a64c03d`
- version/build: `1.0.5 (17)`
- Git commit: `5e545eb2462ad8d9dfbc679ff5d7a7c1ccd644c4`
- artifact: `https://expo.dev/artifacts/eas/5Pxf7lB6KLJfkb2RZLImrr_U6mAYYccPauJBbE8NGFw.ipa`
- build page: `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/77fa3b88-cf7e-40fb-8213-c7617a64c03d`

Submission:

- EAS submission id: `a53edbac-df55-40ad-ad52-22d1109a564e`
- submission was scheduled successfully with App Store Connect API key `W9572DMP42`
- App Store Connect app id: `6763434225`
- submission page: `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/a53edbac-df55-40ad-ad52-22d1109a564e`
- local CLI was still waiting for Apple processing when this checkpoint was written

## Android Build And Submission

Build:

- status at checkpoint: `IN_QUEUE`
- EAS build id: `a76d85ae-8373-43c2-bcda-1891825814fc`
- version/build: `1.0.5 (11)`
- Git commit: `5e545eb2462ad8d9dfbc679ff5d7a7c1ccd644c4`
- build page: `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/a76d85ae-8373-43c2-bcda-1891825814fc`

Do not submit Android with `--latest` until this build finishes because the most
recent finished Android artifact before it is the older `1.0.4 (10)` test build.

After build `a76d85ae-8373-43c2-bcda-1891825814fc` reaches `FINISHED`, submit that
exact id:

```powershell
cd C:\dev\FlockTrax\mobile
npx eas submit --platform android --id a76d85ae-8373-43c2-bcda-1891825814fc --profile production --non-interactive --wait
```

The last Android submission attempt in May was blocked by missing one-time Google
Play service-account setup in EAS. Whether that credential has since been added
cannot be tested until the new Android build finishes.

## Git State

The release package was committed and pushed before EAS compilation so both store
artifacts are attributable to an exact GitHub source state.

One tracked generated file remains intentionally outside the release commit:

- `supabase/.temp/cli-latest`

It only records the local Supabase CLI patch version and is not product source.

## Resume

1. Check Android build `a76d85ae-8373-43c2-bcda-1891825814fc`.
2. Submit that exact Android build id when it is finished.
3. Confirm iOS submission `a53edbac-df55-40ad-ad52-22d1109a564e` reaches App Store Connect/TestFlight.
4. Record final Android artifact/submission links and Apple processing status.
5. Commit and push this release checkpoint/index update.
