# FlockTrax App Store Submitted Checkpoint

Date: 2026-04-25 PM  
Workspace: `C:\dev\FlockTrax`

## Current release state

- iOS App Store version record:
  - `1.0.1`
- iOS build attached and submitted:
  - `1.0.1 (7)`
- App Review submission status:
  - submitted in App Store Connect

## iOS build and submit details

- EAS iOS build ID:
  - `77e64014-cdf7-4e8a-bcf1-f557777b8a01`
- EAS build page:
  - `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/builds/77e64014-cdf7-4e8a-bcf1-f557777b8a01`
- IPA artifact:
  - `https://expo.dev/artifacts/eas/fNJkYwDuLJ8nAHpkSfFoSv.ipa`

- EAS submission ID:
  - `d3858bb7-d1da-4cf0-a56c-640f3028d726`
- EAS submission page:
  - `https://expo.dev/accounts/smoken/projects/flocktrax-mobile/submissions/d3858bb7-d1da-4cf0-a56c-640f3028d726`

- App Store Connect app record:
  - ASC App ID `6763434225`

## Mobile fixes included in build 7

### Local-date bug fix

Problem:
- mobile app was using UTC date derivation for "today"
- around late evening Central time, daily entry could roll to the next date too early

Fix applied in mobile app:
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx`

Result:
- default ISO dates are now derived from device-local date parts instead of UTC `toISOString().slice(0, 10)`

Verification:
- `npx tsc --noEmit` passed before build

## Hosted backend fixes already live

These did not require a mobile rebuild, but were part of the overall release stabilization:

- `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\weight-entry-get\index.ts`

Deployed behavior:
- mobile read paths now hydrate from native Supabase tables only
- Google Sheets read-before-edit fallback was removed from those live hosted functions

## Data recovery completed before submission

### 283-S2

Confirmed in Supabase:
- `2026-04-20` male avg weight `4.54`
- `2026-04-22` male avg weight `5.00`

### 284-W4

Inserted and verified in Supabase:
- `2026-04-15` male avg weight `4.80`
- `2026-04-15` female avg weight `4.619`
- `2026-04-20` male avg weight `4.92`
- `2026-04-20` female avg weight `4.224`

User confirmed these retrieve correctly in the app.

## App Store Connect metadata state

Completed items during this session:
- promotional text prepared and entered
- description prepared and entered
- keywords prepared
- App Review notes prepared
- reviewer credentials prepared and working
- support URL created and used
- privacy policy URL created and used
- `6.5"` iPhone screenshots accepted
- `13"` iPad screenshots accepted

## Support / privacy site

Created standalone Vercel-hosted support site at:
- `C:\dev\vercel\support`

Important local files:
- `C:\dev\vercel\support\index.html`
- `C:\dev\vercel\support\privacy.html`
- `C:\dev\vercel\support\styles.css`

Live support URL:
- `https://support.flocktrax.com`

Privacy policy URL used for App Store Connect:
- `https://support.flocktrax.com/privacy.html`

Important note:
- `flocktrax.com` DNS is controlled by Vercel nameservers
- `flocktrax.com` currently has no live MX records
- because of that, the support site was updated to use:
  - `ken@mothercluckershenhouse.com`
  instead of a nonfunctional `support@flocktrax.com`

## Screenshot work products

### iPhone 6.5 canvas set

Source:
- `C:\dev\FlockTrax\mobile\screens\6.3.native`

Generated accepted-size set:
- `C:\dev\FlockTrax\mobile\screens\6.5.canvas`

Final dimensions:
- `1242 x 2688`

### iPad 13.0 canvas set

Source:
- `C:\dev\FlockTrax\mobile\screens\6.5.iPad`

Generated accepted-size set:
- `C:\dev\FlockTrax\mobile\screens\13.0.canvas`

Final dimensions:
- `2064 x 2752`

## Admin / sync web fixes deployed this session

Problem observed:
- outbox page could show stale data until manual refresh
- sync engine sidebar badge was not reflecting real pending work immediately

Files changed:
- `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\page.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\outbox\outbox-console.tsx`
- `C:\dev\FlockTrax\web-admin\app\admin\sync\googleapis-sheets\sync-engine-nav.tsx`
- `C:\dev\FlockTrax\web-admin\app\api\sync-engine-badge\route.ts`
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`

Result:
- opening Outbox now forces a fresh refresh
- sync-engine links no longer rely on stale prefetching
- sidebar badge counts pending + in-progress + failed + rejected rows
- badge refreshes on route changes

Vercel production deployment for that fix:
- deployment id `dpl_2xwheJXKU2maW7Q2nMvntf7QeTuy`

## Live roles/permissions adjusted during release push

`READONLY` role:
- converted from label-only to real live read-only role
- `placements` access removed to avoid exposing placement wizard route

`TECH` role:
- seeded with read access plus edit rights for:
  - `weight_samples`
  - `grade_birds`

These were applied directly in hosted Supabase permission tables and are already live.

## Current git / local worktree note

Local modified files still exist and are not all committed/pushed:
- `C:\dev\FlockTrax\mobile\App.tsx`
- `C:\dev\FlockTrax\mobile\app.json`
- `C:\dev\FlockTrax\mobile\eas.json`
- `C:\dev\FlockTrax\mobile\src\screens\FeedTicketScreen.tsx`
- `C:\dev\FlockTrax\supabase\functions\placement-day-get\index.ts`
- `C:\dev\FlockTrax\supabase\functions\weight-entry-get\index.ts`
- `C:\dev\FlockTrax\web-admin\app\admin\layout.tsx`
- `C:\dev\FlockTrax\web-admin\components\admin-shell.tsx`
- sync-engine web-admin files listed above

Important:
- some of these changes are already deployed live even though git has not been cleaned up yet

## Best next steps after resting

1. Watch App Store Connect / email for App Review status or questions.
2. If Apple requests clarification, use the reviewer credentials and App Review notes already prepared.
3. Commit and push the local release-stabilization changes back into git.
4. Revisit Android Play Console setup and upload path when ready.
5. Later clean up:
   - user-access target-selection UI bug
   - domain mail hosting for `flocktrax.com`
   - longer-term `log_observations` architecture

## Short status summary

The iOS app is submitted for review on build `1.0.1 (7)`, the mobile date bug fix is included in that build, the hosted backend and sync-engine stabilization fixes are live, the accepted iPhone and iPad screenshot sets were generated locally, and the support/privacy URLs are now backed by a live Vercel-hosted support site.
