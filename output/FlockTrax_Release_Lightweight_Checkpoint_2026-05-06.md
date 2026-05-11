# FlockTrax Release Lightweight Checkpoint

Date: 2026-05-06
Track: Release
Timezone: America/Chicago

## Current Release State

- iOS review candidate `1.0.1 (10)` was approved by Apple.
- `build 10` is now live on the App Store and available for download.
- The Apple-side account deletion requirement is satisfied by the shipped mobile flow and supporting public policy pages.
- Google Play is now the primary remaining storefront release task.

## What This Live iOS Build Includes

- mobile account deletion flow required by Apple Guideline `5.1.1(v)`
- in-app `Delete Account` action on the dashboard
- typed confirmation requirement: `DELETE`
- successful delete path clears session and returns to login

## Release Support URLs Now Live

- Privacy Policy:
  - `https://flocktrax.com/privacy`
- Delete Account Support:
  - `https://flocktrax.com/delete-account`

These pages are now hosted live and were also added to the web-admin sidebar footer for internal visibility.

## Relevant Release Work Already Completed

- `auth-delete-account` Supabase Edge Function is implemented and deployed
- mobile app exposes the account deletion flow in production
- live public policy/support pages are deployed on `flocktrax.com`
- Apple review notes can now reference the hosted policy URLs consistently

Key files:
- `C:\dev\FlockTrax\supabase\functions\auth-delete-account\index.ts`
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\api\http.ts`
- `C:\dev\FlockTrax\mobile\src\screens\DashboardScreen.tsx`
- `C:\dev\FlockTrax\web-admin\app\privacy\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\delete-account\page.tsx`

## Credential State

Known-good reviewer account:
- `reviewme@mothercluckershenhouse.com`
- `FlockTraxReview!2026`

Known-good throwaway/demo account used for deletion testing:
- `flocktraxuser@gmail.com`
- `FlockTrax26!`

Important note:
- invite/reset email flow had proven unreliable earlier
- direct password setting in Supabase admin was used to stabilize accounts during review prep

## Play Store State

- Play developer account is being treated as an organization verification flow.
- Public website/policy support is now in place for Play Console submission.
- Next major task is Google Play Console verification + first Android production upload.

## Best Next Release Step

1. Complete Google Play organization / website verification if any verification items remain open.
2. Complete Play Console metadata:
   - privacy policy URL
   - app access
   - data safety
   - content rating
3. Build first Android production `.aab`.
4. Upload first Android bundle manually in Play Console.

## Practical Resume Marker

If resuming release work from this point, assume:

- iOS App Store release is live
- policy URLs are live
- Play Store is now the active release track

