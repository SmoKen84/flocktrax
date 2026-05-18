# FlockTrax Production Incident Checkpoint

Date: 2026-05-15
Environment: Production / Mobile test
Affected app versions:

- iPhone App Store release `1.0.2`
- Android test build `1.0.2` (`versionCode 7`)

## Incident

Newly invited users could:

- accept the invitation link
- set a new password
- log in successfully

But when they attempted to save a daily mortality log, the app immediately reported that the JWT/session had expired and returned them to the login screen.

## Discovery Context

This error was actually discovered during Android testing, not first on iPhone.

Because both mobile platforms share the same application logic and call the same backend save function, the defect was treated as a cross-platform mobile issue rather than an Android-only defect.

## Initial Symptom

Observed behavior looked like a session-persistence or token-storage failure:

- login succeeded
- placement/day reads succeeded
- mortality save failed with an apparent auth-expired message

## Root Cause

This was not a true JWT-expiration problem.

The mobile client posts grading fields along with mortality saves, even when those grading fields are all `null`.

On the backend, `placement-day-submit` interpreted the presence of those grading keys as a grading update attempt. For users without `grade_birds` permission, the function returned `403`.

The current mobile client treats `403` responses as auth/session failures, so the user saw a misleading expired-session message and was returned to login.

This same client behavior exists in the shared mobile codebase, so both Android and iPhone builds were susceptible.

## Confirmation

User applied a temporary workaround by assigning the `TECH` role to the affected user. After that role change, mortality save succeeded.

This confirmed the issue was permission-path related rather than token persistence.

## Production Fix Applied

Live backend function updated and deployed:

- `supabase/functions/placement-day-submit/index.ts`

Behavior of the fix:

- if a non-grading user submits mortality and the grade fields are only placeholder `null` values, the backend strips those grade keys and allows the mortality save
- if the user submits meaningful grading values without `grade_birds` permission, the backend still returns a proper authorization failure

Production deploy completed for:

- `placement-day-submit`

Supabase project:

- `frneaccbbrijpolcesjm`

## Local Follow-Up Fix

A local mobile-client fix was also made for the next mobile release:

- `mobile/src/api/http.ts`

That change stops treating every `403` as an expired JWT/session so permission denials can be surfaced honestly in a future app build.

## Validation Status

Production conclusion:

- backend hotfix is live
- Android test builds and App Store `1.0.2` should no longer require `TECH` role just to save mortality when no actual grading is being performed

Recommended validation:

1. Test with a newly invited user who has mortality permission but not grading permission.
2. Open a mortality log.
3. Save mortality values without entering grading values.
4. Confirm the save succeeds and the user is not bounced to login.

## Notes

This incident exposed two separate concerns:

- backend should distinguish meaningful grading edits from empty placeholder payload keys
- mobile client should not label all `403` responses as expired-session events

Both are now addressed:

- production backend hotfix applied
- client-side messaging fix prepared locally for next release
