# FlockTrax Mobile 1.0.2 RC Checkpoint

Date: 2026-05-06
Track: Mobile patch release candidate
Candidate version: 1.0.2
Build status: Not yet built

## Purpose

This checkpoint captures the current mobile patch set prepared after the live iOS 1.0.1 release. The immediate trigger for this release candidate was a field usability defect in weight entry where decimal-point input could not be completed reliably while entering new flock placement weights.

## Included Changes

1. Weight entry decimal input fix
- File: `mobile/src/screens/WeightEntryScreen.tsx`
- Decimal fields now preserve the user's typed text while the field is focused.
- This prevents values like `1.` from collapsing back to `1` before the user finishes entering the fractional part.

2. Daily log numeric input parity fix
- File: `mobile/src/screens/PlacementDayScreen.tsx`
- Applied the same focused-text entry behavior to other decimal-capable numeric fields.
- This protects environmental, water, and grading inputs from the same mid-entry parsing problem.

3. In-session auth expiry handling
- Files:
  - `mobile/src/api/http.ts`
  - `mobile/App.tsx`
  - `mobile/src/screens/LoginScreen.tsx`
- API auth failures now surface as a re-authentication interruption instead of a generic error-only flow.
- The app raises a modal login prompt over the current screen so the user can re-authenticate and continue where they were.
- The current screen is preserved rather than forcing the user back to the main login route.

4. Marketing version bump
- Files:
  - `mobile/app.json`
  - `mobile/package.json`
- App marketing version is now `1.0.2`.

## Important Behavior Notes

1. Re-authentication preserves location
- If the token expires during active use, the app should now present an in-place login modal.
- After successful login, the user remains on the interrupted screen.

2. Failed action retry is still manual
- If token expiry occurs during a save or fetch, the app currently restores session context but does not automatically replay the failed request.
- The user may need to tap `Save` or repeat the action once after re-authentication.

3. Remote build numbering still applies
- `mobile/eas.json` uses remote app versioning.
- Marketing version can move to `1.0.2`, but actual build numbers will continue from the remote EAS/App Store sequence unless explicitly reset.
- This means the next iOS build will not naturally be `build 1`.

## Validation Completed

1. Mobile TypeScript validation
- Command: `npm run typecheck`
- Result: passed

## Files Touched For This Candidate

- `mobile/App.tsx`
- `mobile/app.json`
- `mobile/package.json`
- `mobile/src/api/http.ts`
- `mobile/src/screens/LoginScreen.tsx`
- `mobile/src/screens/PlacementDayScreen.tsx`
- `mobile/src/screens/WeightEntryScreen.tsx`

## Recommended Next Checks Before Build

1. Manually verify decimal entry on-device
- Weight entry: `Average Wt`, `Std Dev`, `Procure`
- Daily log: barn/outside temps, humidity, water meter, grade fields

2. Manually verify auth-expiry experience
- Confirm the re-auth modal appears above the active screen
- Confirm successful login leaves the user in place
- Confirm the user can complete the interrupted action afterward

3. Confirm release intent
- If approved, use this checkpoint as the `1.0.2` build baseline for the next iOS submission and any Android parity build.

## Baseline Context

- iOS 1.0.1 was previously approved and released live.
- This checkpoint represents the next intended mobile patch candidate after that live release.
