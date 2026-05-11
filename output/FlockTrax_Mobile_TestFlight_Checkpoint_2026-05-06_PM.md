# FlockTrax Mobile TestFlight Checkpoint

Date: 2026-05-06
Time: PM
Track: Mobile release candidate / TestFlight

## Current State

- Mobile patch candidate version is `1.0.2`
- iOS build was created successfully as `1.0.2 (11)`
- Build `11` was submitted to App Store Connect for TestFlight
- Apple upload completed successfully and the build is now in Apple processing

## Build References

- EAS build:
  - `c9317729-7395-4884-9514-d4b42924d74d`
- EAS submission:
  - `b086c966-6463-43cb-b581-7f226c367261`
- App Store Connect app:
  - `6763434225`

## Links

- TestFlight:
  - `https://appstoreconnect.apple.com/apps/6763434225/testflight/ios`
- EAS build page:
  - `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/c9317729-7395-4884-9514-d4b42924d74d`
- EAS submission page:
  - `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/b086c966-6463-43cb-b581-7f226c367261`

## Changes Included In 1.0.2

1. Decimal-entry fix for weight entry fields
- Prevents decimal values from collapsing while the user is still typing.

2. Same focused numeric-entry behavior applied to daily-log decimal fields
- Covers temperature, humidity, water meter, and grading-style numeric inputs.

3. Session-expiry re-authentication modal
- If auth expires during active use, the app now presents a login modal over the current screen instead of dumping the user back to login.
- Intended result is that the user can re-authenticate and continue where they were.

4. Marketing version bump
- Mobile version advanced from `1.0.1` to `1.0.2`

## Important Open Validation Item

- The only unverified behavior is the new in-place re-authentication modal during token expiry.
- Everything else needed for the patch candidate was implemented and mobile typecheck passed before build/submission.

## Platform Control

- `platform.control` has not been updated yet.
- This was intentional so the visible system version marker does not move ahead of a validated TestFlight build.
- Recommended next step is to update `platform.control` only after build `11` is processed and sanity-checked in TestFlight.

## Recommended Next Step When Resuming

1. Check whether Apple has finished processing build `1.0.2 (11)` in TestFlight.
2. Install the processed TestFlight build.
3. Validate:
- decimal entry in weight screen
- decimal entry in daily numeric fields
- expired-session re-auth modal behavior
4. If good, update `platform.control` to reflect `1.0.2 / build 11`.

## Related Repo Checkpoint

- `output/FlockTrax_Mobile_1.0.2_RC_Checkpoint_2026-05-06.md`
