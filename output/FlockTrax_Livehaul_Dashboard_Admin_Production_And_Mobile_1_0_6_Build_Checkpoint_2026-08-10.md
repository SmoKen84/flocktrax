# FlockTrax Livehaul Dashboard Admin Production and Mobile 1.0.6 Build Checkpoint

Date: `2026-08-10`
Branch: `main`
Production source commit: `f5c7b38eab2e0a9934971ceae8866c34193875a4`

## Purpose

This checkpoint records the production deployment of the authoritative livehaul
schedule display for the Admin and mobile dashboards and the start of the mobile
`1.0.6` store-build process. The change is operationally important because the
displayed dates are used to prepare work for the catch crew.

## Settled Dashboard Rule

- `est_first_catch` is a calculated planning placeholder.
- The placeholder remains visible until a real `public.livehaul_schedule` row with
  `sequence_num = 1` exists for the placement.
- Sequence `1` then replaces the estimate as the displayed First Livehaul date.
- Sequence `2` and later rows display in sequence order as additional livehaul
  dates.
- The dashboard does not use fixed `placements.lh1_date`, `lh2_date`, or
  `lh3_date` fields.
- Admin dashboard editing of those fixed fields was removed; livehaul maintenance
  routes through the flexible Live Haul scheduler.

## Production Admin and API Deployment

Source commit:

- `f5c7b38eab2e0a9934971ceae8866c34193875a4`
- subject: `Use livehaul schedules on dashboards`
- pushed to `origin/main`

Supabase Edge Function:

- function: `dashboard-placements-list`
- project: `frneaccbbrijpolcesjm`
- deployed successfully
- hosted test response confirmed `has_first_livehaul_schedule` and
  `livehaul_dates` are present

Vercel:

- deployment id: `dpl_J63zCDD3CsKQgNseWtJ8rRbCu3rN`
- deployment URL: `https://web-admin-plral82dh-flock-trax.vercel.app`
- production alias: `https://flocktrax.com`
- secondary alias: `https://admin.flocktrax.com`
- target: `production`
- status: `Ready`

Hosted verification:

- `https://flocktrax.com/` returned HTTP `200`
- unauthenticated `/admin/overview` returned HTTP `307` to `/login`
- Vercel independently built all `47` routes successfully

## Mobile 1.0.6 Package

- marketing version: `1.0.6`
- iOS build: `18`
- Android version code: `13`
- EAS build source commit: `f5c7b38eab2e0a9934971ceae8866c34193875a4`
- release changes: `output/FlockTrax_Mobile_1_0_6_Release_Changes_2026-08-10.md`

The first dual-platform EAS command timed out while uploading and did not create
build jobs. It advanced the remote Android counter from `11` to `12`. The
successful Android retry therefore produced version code `13`. No duplicate
`1.0.6` artifact was created.

### iOS

- build id: `296421b3-b9dc-4bd9-83b4-e51ac89ed288`
- version/build: `1.0.6 (18)`
- status: `FINISHED`
- artifact: `https://expo.dev/artifacts/eas/th4xvwK29tCNLRn11aqYLxhK0J1Bfz0hVH4GT9qr3JI.ipa`
- build page: `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/296421b3-b9dc-4bd9-83b4-e51ac89ed288`

### Android

- build id: `ba7eb130-904d-4b95-8216-cfbde034f838`
- version/build: `1.0.6 (13)`
- status at checkpoint: `IN_QUEUE`
- build page: `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/ba7eb130-904d-4b95-8216-cfbde034f838`

## Validation

- Admin TypeScript typecheck passed
- Mobile TypeScript typecheck passed
- Admin optimized production build passed with all `47` routes
- Expo production export passed for iOS and Android
- Edge Function TypeScript syntax check passed
- `git diff --check` passed

## Release-Control Boundary

The hosted `platform.control` mobile markers remain at published version `1.0.5`.
They should not be changed to `1.0.6` until store delivery is confirmed. No store
submission was made in this checkpoint.

## Resume

1. Wait for Android build `ba7eb130-904d-4b95-8216-cfbde034f838` to finish.
2. Submit iOS build `296421b3-b9dc-4bd9-83b4-e51ac89ed288` through the production
   App Store profile when store submission is approved.
3. Submit the exact Android build id after it reaches `FINISHED`; do not use an
   ambiguous `--latest` submission.
4. Confirm TestFlight/App Store Connect and Google Play processing.
5. Update `platform.control` to the confirmed published `1.0.6` build numbers only
   after store delivery is established.
