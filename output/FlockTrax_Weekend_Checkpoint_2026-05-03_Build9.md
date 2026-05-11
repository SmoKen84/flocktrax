# FlockTrax Weekend Checkpoint - May 3, 2026 Build 9

Recovered from Codex local session history on `2026-05-03`.

Checkpoint saved here in-chat:

We are in `C:\dev\FlockTrax` on Windows, date `May 3, 2026`, timezone `America/Chicago`.

## Most important final outcome

- iOS submission is now corrected and resubmitted with a verified working binary.
- The broken TestFlight/App Review issue was fixed by shipping a new build.
- User confirmed the new TestFlight build opens and logs in successfully.

## What actually caused the iOS/TestFlight failure

- `C:\dev\FlockTrax\mobile\.env` is gitignored
- EAS production build reported:
  - `No environment variables with visibility "Plain text" and "Sensitive" found for the "production" environment on EAS.`
- The app already had a hardcoded fallback for API base URL, but not for `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- That meant cloud/TestFlight builds could miss the anon key even while local/dev builds still worked
- Hosted backend/auth was verified healthy on `May 3, 2026`:
  - `auth-login` returned `200`
  - `auth_me` returned `200`
  - `dashboard-placements-list` returned `200`

## Files changed to fix this

- `C:\dev\FlockTrax\mobile\src\api\config.ts`
  - added built-in fallback for Supabase anon key
  - also tightened base URL/env trimming
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
  - improved request error text so failures identify endpoint path instead of only raw status code

## Verification

- `npm run typecheck` passed in `C:\dev\FlockTrax\mobile`

## New fixed iOS build

- app version: `1.0.1`
- build number: `9`
- EAS build ID:
  - `c1cd3c22-7daa-4775-8745-415fd3eb8faa`
- IPA:
  - [https://expo.dev/artifacts/eas/pW2r2htazQfpqX5FebFHWj.ipa](https://expo.dev/artifacts/eas/pW2r2htazQfpqX5FebFHWj.ipa)

## Apple submission for fixed build

- EAS submission ID:
  - `372f4983-545d-44fa-a7a3-b993fa3c43b7`
- submission page:
  - [https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/372f4983-545d-44fa-a7a3-b993fa3c43b7](https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/372f4983-545d-44fa-a7a3-b993fa3c43b7)

## User-confirmed final iOS state

- build `9` finished processing in App Store Connect
- user installed build `9` from TestFlight
- app opened successfully
- reviewer login worked successfully
- user stated:
  - `it has been submitted. right this time.`

## Reviewer credentials still in use

- username/email:
  - `reviewme@mothercluckershenhouse.com`
- password:
  - `FlockTraxReview!2026`

## Important nuance discovered during debugging

- The login screen footer still shows old hardcoded release text in:
  - `C:\dev\FlockTrax\mobile\src\screens\LoginScreen.tsx`
- It currently says:
  - `Release 0.1.0 | Build FLM-2026.04.04-a`
  - `Release date: April 4, 2026`
- That footer is stale and not authoritative for the actual store build, but it did not block the fix
- This is a cleanup item for later if desired

## Other mobile work already completed and still pending release uptake

- mobile dashboard state-colored cards
- arrival interception modal for non-in-barn placements
- split pre-arrival states:
  - farther than 3 days from placement = blue `Pending`
  - within 3 days and not in barn = `Waiting for Chicks`
  - only `Waiting for Chicks` prompts to change state to `Chicks Arrived`
- related files:
  - `C:\dev\FlockTrax\mobile\App.tsx`
  - `C:\dev\FlockTrax\mobile\src\api\config.ts`
  - `C:\dev\FlockTrax\mobile\src\api\http.ts`
  - `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`

## Android status for next pickup

- Android production build had already been started earlier:
  - build ID: `7c0f39ae-809e-4118-bf3c-e6d114b4489d`
  - app version `1.0.1`
  - versionCode `6`
- Auto-submit failed because Google Play service account key is not configured for non-interactive submit
- Planned next Android path:
  1. check whether build `7c0f39ae-809e-4118-bf3c-e6d114b4489d` is finished
  2. do the first manual Play Console upload if needed
  3. configure Google Play API/service-account key for future automated submits

## Web-admin/live site context still relevant

- live site: [https://flocktrax.com](https://flocktrax.com)
- historical feed-ticket fallback fix already deployed live
- live admin is the current place user is entering lots of historical feed tickets

## Best next task if resumed from this point

- continue with Android submission
- then optionally clean up the stale mobile login footer text and any remaining App Review notes/version metadata drift if needed
